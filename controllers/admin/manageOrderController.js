const {
  order,
  item,
  user,
  address,
  product,
  chequeDetail,
  orderHistory,
  supplier,
  statuses,
  shippingCompanies,
  billingAddress,
  salesRep,
  orderFrequency,
  userDiscount,
  partnerOrder,
  account,
  employee,
  emailLog,
  orderItemPriceLog,
  sequelize,
} = require("../../models");
const {
  canAccessOrder,
  pickFields,
  paymentLocked,
  EDITABLE_ORDER_FIELDS,
  SEND_INVOICE_FIELDS,
} = require("../../utils/orderAccess");
const {
  PricingError,
  canEditUnitPrice,
  catalogUnitPriceOf,
  minUnitPrice,
  priceInvoiceLines,
} = require("../../utils/invoiceLinePricing");
const { ensurePayToken, payUrl } = require("../../utils/payLink");
const { logOrderActivity, money: activityMoney } = require("../../utils/orderActivity");
const {
  verifyInvoicePayment,
  invoiceTotal,
  estimateStripeFee,
} = require("../../services/invoicePaymentVerification");

const fs = require("fs");
const path = require("path");

const { Op, literal, fn, col } = require("sequelize");
const APIFeatures = require("../../utils/apiFeatures");

const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const Stripe = require("../stripe");
const factory = require("../handlerFactory");
const { response } = require("../../utils/response");
const {
  calculateAndSaveEmployeeCommission,
} = require("../../utils/employeeCommissionUtils");
const {
  calculateAndPayoutDirectPartnerEmployeeCommission,
} = require("../../utils/directPartnerEmployeePayoutUtils");
const { applyInvoiceException } = require("../../utils/invoiceExceptionFilter");
const { applyOpsOrderDateFloor, opsOrderOnSql } = require("../../utils/opsOrderDateFloor");

const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const generateInvoicePdf = require("../../utils/generateInvoicePdf");

const {
  importCustomersToQuickBooks,
} = require("../../services/qboCustomerService");
const {
  syncInvoiceOnQuikBooks,
  updateInvoiceOnQuickBooks,
} = require("../../services/syncInvoiceOnQBO");
const {
  quickBooksInvocieDelete,
  deleteAdminQboInvoicesForOrders,
} = require("../../services/qboDeleteInvoice");

const {
  syncPaymentToQuickBooks,
  syncAdminPaymentsForOrders,
} = require("../../services/paymentSyncService");
const {
  listAdminQboSyncedOrdersBeforeCutoff,
} = require("../../services/qboOrderQueryService");
const {
  deleteAdminQboPaymentsForOrders,
} = require("../../services/qboPaymentService");
const {
  updateAdminQboInvoicesForOrders,
} = require("../../services/qboInvoice");
const {
  processTransferToLocalPartner,
} = require("../../utils/localPatnerCommissionTranfer");
const paidInvoiceEmailAdminOrLocalPatner = require("../../helper/paidInvoiceEmailAdminOrLocalPatner");
const {
  paidInvoiceAdminOrLocalPatnerEventAndCustomer,
  paidInvoiceAdminOrLocalPatnerEvent,
} = require("../events/paymentInvoicePaidEvent");
const { supplierNewOrderEvent } = require("../events/orderToSupplierEvents");
const {
  sentPaymentInvoiceEvent,
} = require("../events/sentPaymentInvoiceEvent");
const { orderShippedEvent } = require("../events/orderShippedEvent");
const { orderDispatchEvent } = require("../events/orderDispatchEvent");
// [QBO-POLICY-2026] Post-pullout QBO reconcile disabled — pulloutIntentId stays in DB only, not pushed to admin QBO.
// const {
//   reconcilePulloutSyncStateForOrder,
// } = require("../../services/pulloutSyncStateService");
const {
  dispatchOrderEmail,
} = require("../../services/orderEmailDispatchService");

exports.emailHelper = catchAsync(async (req, res, next) => {
  const { orderId, orderType, emailType } = req.body;

  const outcome = await dispatchOrderEmail({ orderId, orderType, emailType });
  if (!outcome.success) {
    const statusCode = outcome.error === "Order not found" ? 404 : 400;
    return next(new AppError(outcome.error, statusCode));
  }

  if (outcome.skipped) {
    return res.status(200).json({
      status: "success",
      skipped: true,
    });
  }

  res.status(200).json({
    status: "success",
    data: {},
  });
});

/**
 * Ensure invoice PDFs exist for orders with paymentStatus pending and invoiceDate set.
 * Finds such orders, and creates the PDF if the file is not found on disk.
 */
exports.ensurePendingInvoicePdfs = catchAsync(async (req, res, next) => {
  const pendingWithInvoice = await order.findAll({
    where: {
      paymentStatus: "pending",
      invoiceDate: { [Op.ne]: null },
      deleted: 0,
    },
    attributes: ["id"],
    raw: true,
  });

  const pdfDir = path.join(__dirname, "../../public/invoicePDFs");
  const created = [];
  const skipped = [];
  const errors = [];

  for (const row of pendingWithInvoice) {
    const orderId = row.id;
    const pdfFilename = `invoice-00${orderId}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFilename);

    if (fs.existsSync(pdfPath)) {
      skipped.push(orderId);
      continue;
    }

    try {
      const { details } = await dataForEmailAndNotifications(
        orderId,
        "customer",
      );
      if (!details) {
        errors.push({ orderId, message: "Order data not found" });
        continue;
      }
      await generateInvoicePdf(details, orderId);
      created.push(orderId);
    } catch (err) {
      errors.push({
        orderId,
        message: err?.message || String(err),
      });
    }
  }

  return res.status(200).json({
    status: "success",
    data: {
      total: pendingWithInvoice.length,
      created,
      skipped,
      errors,
    },
  });
});

/**
 * List orders that are candidates for pending PDFs:
 * paymentStatus pending, invoiceDate between 2025-01-20 and 2026-02-09.
 * Excludes orders that already have an invoice PDF on disk.
 */
exports.listPendingPdfs = catchAsync(async (req, res, next) => {
  const invoiceDateFrom = new Date("2025-01-20");
  const invoiceDateTo = new Date("2026-02-09T23:59:59.999Z");

  const all = await order.findAll({
    where: {
      paymentStatus: "pending",
      invoiceDate: {
        [Op.between]: [invoiceDateFrom, invoiceDateTo],
      },
      deleted: 0,
    },
    attributes: [
      "id",
      "invoiceNumber",
      "poNumber",
      "totalBill",
      "invoiceDate",
      "updatedAt",
      "userId",
    ],
    order: [["invoiceDate", "ASC"]],
    raw: true,
  });

  const pdfDir = path.join(__dirname, "../../public/invoicePDFs");
  const list = all.filter((row) => {
    const pdfPath = path.join(pdfDir, `invoice-00${row.id}.pdf`);
    return !fs.existsSync(pdfPath);
  });

  return res.status(200).json({
    status: "success",
    data: {
      checkorders: all.length,
      total: list.length,
      list,
    },
  });
});

exports.sendInvoice = catchAsync(async (req, res, next) => {
  const model = req.body?.order?.partnerOrderId ? partnerOrder : order;
  const orderType = req.body?.order?.partnerOrderId
    ? "local-partner"
    : "customer";
  const details = await model.findOne({
    where: { id: req.params?.orderId },
  });

  if (!details) {
    return next(new AppError("Order not found.", 404));
  }
  if (!canAccessOrder(req.user, details.salesRepId, { kind: orderType === "local-partner" ? "partner" : "customer", action: "create" })) {
    return next(new AppError("You do not have permission to send this invoice.", 403));
  }

  if (details.userId && !details?.quickBooksInvoiceId) {
    syncInvoiceOnQuikBooks({ orderId: details.id, orderType });
  }

  if (details?.paymentIntentId || details?.paymentStatus == "done") {
    return next(
      new AppError(
        "As the payment for the order has already been made, we are unable to send an invoice at this point.",
        404,
      ),
    );
  }

  // Only the invoice date / reminder stamps; everything else on the order is server-managed.
  await model.update(pickFields(req.body?.order, SEND_INVOICE_FIELDS), {
    where: { id: req.params?.orderId },
  });

  sentPaymentInvoiceEvent({
    orderId: req.params?.orderId,
    orderType: req.body?.order?.partnerOrderId ? "local-partner" : "customer",
  });

  //   let checkSession = false

  //   if(details?.invoiceId){
  //     const session = await Stripe.checkCheckoutSessionStatus(details?.invoiceId)

  //     if(session== "paid"){
  //         await order.update({paymentMethod:'card',paymentStatus:'done'},{where:{id:req.params.orderId}})
  //         return next(new AppError('As the payment for the order has already been made, we are unable to send an invoice at this point.', 404));

  //     }else if(session == 'open'){
  //        checkSession = true
  //     }

  //   }

  //     const preSession = {
  //           "invoiceId": details.invoiceId,
  //           "hostedInvoiceUrl":details.hostedInvoiceUrl,
  //           "invoicePdf": ""
  //       }

  //     const invoice = !checkSession ? await Stripe.createInvoiceWithItems({customerId:details.stripeCustomerId , order:details}) : preSession

  //     if(!checkSession)await order.update(invoice,{where:{id:details.id}})
  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.sendInvoiceMultiple = catchAsync(async (req, res, next) => {
  const listOrder = Array.isArray(req.body?.order) ? req.body.order : [];
  if (listOrder.length > 0) {
    const ids = listOrder.map((ele) => Number(ele?.orderId)).filter(Boolean);
    const found = await order.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "salesRepId"],
      raw: true,
    });
    if (found.length !== new Set(ids).size || found.some((o) => !canAccessOrder(req.user, o.salesRepId, { action: "create" }))) {
      return next(new AppError("You do not have permission to send one or more of these invoices.", 403));
    }
    console.log("🚀 ~ sendInvoiceMultiple ~ listOrder:", listOrder);
    for (const ele of listOrder) {
      console.log("🚀 ~ sendInvoiceMultiple ~ orderId:", ele);
      sentPaymentInvoiceEvent({
        orderId: ele.orderId,
        orderType: ele.orderType || "customer",
      });

      await order.update(pickFields(ele, SEND_INVOICE_FIELDS), {
        where: { id: ele.orderId },
      });
    }
  }

  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.fetchInvoice = catchAsync(async (req, res, next) => {
  const orderType = req.body?.orderType || "customer";
  const model = orderType === "local-partner" ? partnerOrder : order;

  const { details, email } = await dataForEmailAndNotifications(
    req.params.orderId,
    orderType,
  );

  if (details?.paymentIntentId || details?.paymentStatus == "done") {
    return res.status(200).json({
      status: "already-paid",
      message:
        "As the payment for the order has already been made, we are unable to send an invoice at this point.",
      data: {},
    });
  }

  let checkSession = false;

  if (details?.invoiceId) {
    const session = await Stripe.checkCheckoutSessionStatus(details?.invoiceId);
    console.log("🚀 ~ exports.fetchInvoice=catchAsync ~ session:", session);

    if (session == "paid") {
      await model.update(
        { paymentMethod: "card", paymentStatus: "done" },
        { where: { id: req.params.orderId } },
      );

      return res.status(200).json({
        status: "already-paid",
        message:
          "As the payment for the order has already been made, we are unable to send an invoice at this point.",
        data: {},
      });
    } else if (session == "open") {
      checkSession = true;
    }
  }

  const preSession = {
    invoiceId: details.invoiceId,
    hostedInvoiceUrl: details.hostedInvoiceUrl,
    invoicePdf: "",
  };

  const invoice = !checkSession
    ? await Stripe.createInvoiceWithItems({
        customerId: details.stripeCustomerId,
        order: details,
      })
    : preSession;

  console.log("🚀 ~ exports.fetchInvoice=catchAsync ~ checkSession:", invoice);

  if (!checkSession) await model.update(invoice, { where: { id: details.id } });

  // Payment link tracking: count and first/last opened at (when pay-online URL is requested)
  // Use DB-level increment so count is correct even when details omits these columns
  await model.increment(
    { paymentLinkOpenCount: 1 },
    { where: { id: details.id } },
  );
  await model.update(
    {
      paymentLinkFirstOpenedAt: literal(
        "COALESCE(paymentLinkFirstOpenedAt, NOW())",
      ),
      paymentLinkLastOpenedAt: new Date(),
    },
    { where: { id: details.id } },
  );

  console.log(
    "🚀 ~ exports.fetchInvoice=catchAsync ~ checkSession:",
    checkSession,
  );

  // sentPaymentInvoiceEvent({email:to,data:details,invoice})
  return res.status(200).json({
    status: "success",
    data: {
      order: invoice,
    },
  });
});

exports.createPaymentIntentForUser = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const { orderType } = req.body;

  if (!orderId) {
    return next(new AppError("Order ID is required", 400));
  }

  const model = orderType == "local-partner" ? partnerOrder : order;

  const orderData = await model.findOne({
    where: { id: orderId },
    attributes: ["id", "type"],
  });

  if (!orderData) {
    return next(new AppError("Order not found", 404));
  }

  const { details } = await dataForEmailAndNotifications(orderId, orderType);

  if (!details) {
    return next(new AppError("Order details not found", 404));
  }

  if (details?.paymentIntentId || details?.paymentStatus == "done") {
    return res.status(200).json({
      status: "already-paid",
      message:
        "As the payment for the order has already been made, we are unable to create a payment intent at this point.",
      data: {},
    });
  }

  try {
    const paymentIntent = await Stripe.paymentIntentForWebsitePayments({
      order: details,
    });

    return res.status(200).json({
      status: "success",
      data: {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        proportionalStripeFee: paymentIntent.proportionalStripeFee,
        connectAccountId: paymentIntent.connectAccountId || null,
        isDirectPartner: paymentIntent.isDirectPartner || false,
        localPatnerCommission: details?.localPatnerCommission || 0,
        adminReceivableAmount: details?.adminReceivableAmount || 0,
      },
    });
  } catch (error) {
    console.error("❌ Payment Intent creation failed:", error);
    return next(
      new AppError(error?.message || "Payment Intent creation failed", 400),
    );
  }
});

exports.confirmPaymentForInvoiceIntent = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  // Amounts and commissions are computed here, never taken from the browser.
  const { paymentIntentId, orderType } = req.body || {};

  if (!orderId) {
    return next(new AppError("Order ID is required", 400));
  }

  if (!paymentIntentId) {
    return next(new AppError("Payment Intent ID is required", 400));
  }

  const model = orderType == "local-partner" ? partnerOrder : order;

  // Check if order exists
  const orderData = await model.findOne({
    where: { id: orderId },
    attributes: ["id", "paymentStatus", "salesRepId"],
  });

  if (!orderData) {
    return next(new AppError("Order not found", 404));
  }

  if (orderData.paymentStatus === "done") {
    return res.status(200).json({
      status: "already-paid",
      message: "Payment has already been processed for this order.",
      data: {},
    });
  }

  // Stripe must confirm this payment succeeded, for this order, covering the invoice total.
  const { details } = await dataForEmailAndNotifications(orderId, orderType || "customer");
  const total = invoiceTotal(details);
  const verdict = await verifyInvoicePayment({ paymentIntentId, orderId, expectedTotal: total });
  if (!verdict.ok) {
    console.warn(`[invoice-payment] order ${orderId} not marked paid: ${verdict.reason}`);
    return next(new AppError(verdict.message, 400));
  }
  const reused = await model.findOne({
    where: { paymentIntentId, id: { [Op.ne]: orderId } },
    attributes: ["id"],
    raw: true,
  });
  if (reused) {
    return next(new AppError("This payment was already used for another invoice.", 400));
  }
  if (verdict.shortByCents > 0) {
    // Invoice raised after the customer started paying: paid, but staff must collect the difference.
    const paid = Number(verdict.paymentIntent.amount_received || 0) / 100;
    console.warn(`[invoice-payment] order ${orderId} paid ${paid} but the invoice total is ${total}`);
    await logOrderActivity({
      req,
      [orderType === "local-partner" ? "partnerOrderId" : "orderId"]: orderId,
      action: "payment_short",
      summary: `Card payment ${activityMoney(paid)} is ${activityMoney(verdict.shortByCents / 100)} less than the invoice total ${activityMoney(total)} (invoice changed after payment started)`,
      details: { paymentIntentId, paid, invoiceTotal: total },
    });
  }
  const localPatnerCommission = Number(details?.localPatnerCommission || 0);
  const adminReceivableAmount = Number(details?.adminReceivableAmount || 0);
  const proportionalStripeFee = estimateStripeFee(details?.totalBill || total);

  // Prepare update data
  const updateData = {
    paymentIntentId: paymentIntentId || null,
    paymentMethod: "card",
    paymentStatus: "done",
    invoicePaidDate: new Date(),
    pulloutDate: Date.now(),
  };
  if (paymentIntentId) {
    updateData.pulloutIntentId = paymentIntentId;
  }

  // Add optional fields if provided

  updateData.adminReceivableStatus = true;

  updateData.localPatnerCommission = localPatnerCommission || 0;

  updateData.adminReceivableAmount = adminReceivableAmount || 0;

  updateData.proportionalStripeFee = proportionalStripeFee || 0;

  // Update the order
  await model.update(updateData, {
    where: { id: orderId },
  });

  // Process employee payout branch if this is a customer order (not local-partner)
  if (orderType !== "local-partner") {
    try {
      if (!orderData?.salesRepId) {
        // Admin flow (existing)
        await calculateAndSaveEmployeeCommission({
          orderId: orderId,
          employeeOf: "admin",
        });
      } else {
        const partner = await salesRep.findOne({
          where: { id: orderData.salesRepId },
          attributes: ["id", "partnerType"],
        });

        if (partner?.partnerType === "direct-partner") {
          await calculateAndPayoutDirectPartnerEmployeeCommission({
            orderId: orderId,
            triggerSource: "confirm-payment",
          });
        }
      }
    } catch (error) {
      // Log error but don't fail the payment confirmation
      console.error(
        "❌ Error processing employee payout in confirmPaymentForInvoiceIntent:",
        error.message,
      );
    }
  }

  // Invoice paid email (from events)
  try {
    await paidInvoiceAdminOrLocalPatnerEventAndCustomer({
      orderId,
      orderType: "customer",
    });
  } catch (error) {
    console.error(
      "❌ Error sending invoice paid email in confirmPaymentForInvoiceIntent:",
      error.message,
    );
  }

  // QBO invoice payment sync
  try {
    await syncPaymentToQuickBooks({
      orderId,
      orderType: orderType || "customer",
    });
  } catch (error) {
    console.error(
      "❌ Error syncing payment to QBO in confirmPaymentForInvoiceIntent:",
      error.message,
    );
  }

  return res.status(200).json({
    status: "success",
    message: "Payment confirmed successfully",
    data: {
      orderId,
    },
  });
});

exports.getAllSalesRep = factory.getAll(statuses);

exports.allOrder = catchAsync(async (req, res, next) => {
  // Build manual conditions based on query/params

  let condition = {};
  if (req.user?.localPartnerId) condition.salesRepId = req.user.localPartnerId;

  if (req.params.id) condition.id = req.params.id;

  console.log("🚀 ~ condition:", req.query);

  if (req?.params?.qbo == "not-synced") {
    if (["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceId = { [Op.or]: [null, ""] };
      condition[Op.and] = [
        literal(
          // [QBO-POLICY-2026] Admin QBO list: only direct customers (no local partner on order).
          `(order.salesRepId IS NULL)`,
        ),
      ];
    } else if (["localPartner", "partnerEmployee"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceIdPartner = { [Op.or]: [null, ""] };
    }
    condition[Op.or] = [
      { invoiceDate: { [Op.ne]: null } },
      { paymentStatus: "done" },
    ];
  } else if (req?.params?.qbo == "synced") {
    if (["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceId = { [Op.ne]: null };
    } else if (["localPartner", "partnerEmployee"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceIdPartner = { [Op.ne]: null };
    }
  } else if (req.params.qbo == "unsynced-paid") {
    if (["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
      console.log("🚀 ~ exports.allOrder ~ req.params.qbo:");
      condition.quickBooksInvoiceId = { [Op.ne]: null };
      condition.quickBooksPaymentId = null;
    } else if (["localPartner", "partnerEmployee"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceIdPartner = { [Op.ne]: null };
      condition.quickBooksPaymentIdPartner = { [Op.or]: [null, ""] };
    }
    condition.paymentStatus = "done";
  } else if (req?.params?.qbo == "synced-paid") {
    if (["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
      condition.quickBooksPaymentId = { [Op.ne]: null };
    } else if (["localPartner", "partnerEmployee"].includes(req.user?.entity)) {
      condition.quickBooksPaymentIdPartner = { [Op.ne]: null };
    }
  } else {
    condition.type = req.query?.type || "regular-order";
    if (req.query?.type == "all") {
      delete condition.type;
      delete req.query.type;
    }
  }

  // Build API features (filter, sort, fields, pagination)

  // If user entity is 'user', filter by userId
  if (req.user?.entity === "user") {
    condition.userId = req.user.id;
  }

  console.log("🚀 ~ condition----:", condition);

  // Define searchable columns for orders
  const searchableFields = [
    "id",
    "invoiceNumber",
    "poNumber",
    "note",
    "paymentMethod",
    "shippingCompany",
  ];

  // Extract and remove employee filter so it's not applied as Order column (handled via include below)
  const employeeFilter = req.query?.employee;
  if (req.query?.employee !== undefined) delete req.query.employee;

  applyOpsOrderDateFloor(req, condition);
  applyInvoiceException(req, condition, "order");

  const features = new APIFeatures(order, req.query)
    .filter()
    .search(searchableFields) // Add search functionality
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order, etc.)
  const queryOptions = features.getQuery();

  APIFeatures.appendSearchOrConditions(
    queryOptions,
    APIFeatures.relatedNameSearchConditions(order.sequelize, req.query?.search, {
      tableAlias: "order",
      companyName: true,
      orderType: true,
    }),
  );

  // Merge manual filter conditions with existing where conditions
  // Handle both simple object merge and Op.and structure
  if (Object.keys(condition).length > 0) {
    if (queryOptions.where && queryOptions.where[Op.and]) {
      // If where already has Op.and structure, add condition to it
      queryOptions.where[Op.and].push(condition);
    } else if (queryOptions.where) {
      // If where exists but no Op.and, create Op.and structure
      queryOptions.where = {
        [Op.and]: [queryOptions.where, condition],
      };
    } else {
      // If no existing where, just use condition
      queryOptions.where = condition;
    }
  }

  // Add your custom includes
  queryOptions.include = [
    {
      model: address,
      attributes: {
        exclude: ["createdAt", "updatedAt", "userId", "deleted", "deletedAt"],
      },
    },
    {
      model: item,
      attributes: [
        "id",
        [
          literal(
            `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
          ),
          "product",
        ],
        [
          literal(
            `(SELECT products.image FROM products WHERE products.id = items.productId LIMIT 1)`,
          ),
          "image",
        ],
        "qty",
        "price",
        "discount",
        "orderId",
        "productId",
        "wholesalePrice",
      ],
    },
  ];

  if (employeeFilter) {
    let empCondition = {};
    if (employeeFilter == "assigned") {
      empCondition.employeeId = { [Op.ne]: null };
    } else if (employeeFilter == "not-assigned") {
      empCondition.employeeId = { [Op.is]: null };
    } else {
      empCondition.employeeId = employeeFilter;
    }
    queryOptions.include.push({
      model: user,
      where: empCondition,
      attributes: [],
    });
  }
  console.log("🚀 ~ req.user.entity:", req.user.entity);

  if (
    req.user.entity == "adminEmployee" ||
    req.user.entity == "partnerEmployee"
  ) {
    queryOptions.include.push({
      model: user,
      where: { employeeId: req.user?.employeeId },
      attributes: [],
    });
  }
  // Custom attributes with literal fields

  queryOptions.attributes = [
    "id",
    "type",
    [
      literal(
        `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
      ),
      "customerName",
    ],
    [
      literal(
        `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
      ),
      "companyName",
    ],
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
      ),
      "orderCurrentStatus",
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      "totalSalerCommission",
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      "totalQuantity",
    ],
    [
      literal(`
        COALESCE(order.totalBill, 0) - COALESCE((
          SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id
        ), 0)
      `),
      "adminEarnings",
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      "wholesalePrice",
    ],
    [
      literal(
        `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
      ),
      "salesRepName",
    ],
    [
      literal(
        `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.orderId = order.id LIMIT 1)`,
      ),
      "deliveredOn",
    ],
    "totalBill",
    "subTotal",
    "discountPrice",
    "discountPercentage",
    "itemsPrice",
    "vat",
    "totalWeight",
    "note",
    "paymentMethod",
    "poNumber",
    "frequency",
    "paymentStatus",
    "statusId",
    "adminReceivableStatus",
    "adminReceivableAmount",
    "localPatnerCommission",
    "invoicePdf",
    "invoiceId",
    "createdBy",
    "on",
    "createdAt",
    "shippingCharges",
    "invoiceNumber",
    "invoiceDate",
    "invoiceReminder",
    "invoicePaidDate",
    "termDays",
    "pulloutIntentId",
    "paymentIntentId",
    "pulloutDate",
    [
      literal(
        `CASE WHEN \`on\` <= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END`,
      ),
      "overdueInvoice",
    ],
  ];

  // Get pagination metadata using APIFeatures
  // Note: search conditions are already in queryOptions.where, we just need to pass the additional condition
  const pagination = await features.getPaginationMetadata(order, {
    include: queryOptions.include,
    where: condition, // Pass additional where conditions (will be merged with filter and search conditions)
  });

  // Execute the query
  queryOptions.where;

  console.log("🚀 ~ queryOptions.where:", queryOptions.where);
  console.log("🚀 ~ pagination:", pagination);

  const doc = await order.findAll(queryOptions);
  console.log("🚀 ~ doc.length:", doc.length);

  // Return response
  res.status(200).json({
    status: "success",
    results: doc.length,
    pagination: pagination,
    data: {
      data: doc,
    },
  });
});

exports.ordersPendingPullouts = catchAsync(async (req, res, next) => {
  let condition = {
    // paymentStatus: 'done',
    adminReceivableStatus: false,
    // Only orders with commission and positive admin receivable (totalBill - salerCommission)
    [Op.and]: [
      //   literal(`(
      //             SELECT COALESCE(SUM(salerCommission), 0)
      //             FROM items
      //             WHERE items.orderId = \`order\`.id
      //         ) > 0`),
      literal(`(
                COALESCE(\`order\`.totalBill, 0) - COALESCE((
                    SELECT SUM(salerCommission)
                    FROM items
                    WHERE items.orderId = \`order\`.id
                ), 0)
            ) > 0`),
    ],
    // paymentMethod: { [Op.not]: 'card'},
    salesRepId: req.params.srId,
    // statusId: {
    //   [Op.in]: [4, 5],
    // },
  };
  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition);

  const doc = await order.findAll({
    where: condition,
    include: [
      {
        model: item,
        attributes: [
          "id",
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            "product",
          ],
          "qty",
          "price",
          "discount",
          "orderId",
          "productId",
          "wholesalePrice",
        ],
      },
    ],
    attributes: [
      "id",
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "customerName",
      ],
      [
        literal(
          `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "companyName",
      ],
      [
        literal(
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
        ),
        "orderCurrentStatus",
      ],
      [
        literal(`COALESCE(
            (SELECT SUM(salerCommission)
            FROM items
            WHERE items.orderId = order.id ), 0)`),
        "localPatnerCommission",
      ],
      [
        literal(`
            COALESCE(order.totalBill, 0) - COALESCE((
            SELECT SUM(salerCommission)
            FROM items
            WHERE items.orderId = order.id
            ), 0)
        `),
        "adminReceivableAmount",
      ],
      [
        literal(`COALESCE(
            (SELECT SUM(qty)
            FROM items
            WHERE items.orderId = order.id ), 0)`),
        "totalQuantity",
      ],
      [
        literal(`COALESCE(
            (SELECT SUM(wholesalePrice)
            FROM items
            WHERE items.orderId = order.id ), 0)`),
        "wholesalePrice",
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
        ),
        "salesRepName",
      ],
      "totalBill",
      "subTotal",
      "discountPrice",
      "discountPercentage",
      "itemsPrice",
      "vat",
      "totalWeight",
      "note",
      "paymentMethod",
      "poNumber",
      "frequency",
      "statusId",
      "trackingNumber",
      "paymentStatus",
      "adminReceivableStatus",
      "invoicePdf",
      "invoiceId",
      "createdBy",
      "on",
      "createdAt",
      "shippingCharges",
      "invoiceNumber",
      "invoiceDate",
      "invoiceReminder",
      "invoicePaidDate",
      "termDays",
      "pulloutIntentId",
      "pulloutDate",
      [
        literal(
          `CASE WHEN \`on\` <= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END`,
        ),
        "overdueInvoice",
      ],
    ],
  });
  if (!doc) {
    return next(new AppError("Data not found!", 400));
  }
  res.status(200).json({
    status: "success",
    data: {
      order: doc,
    },
  });
});

exports.orderDetails = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;

  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition);

  const doc = await order.findOne({
    where: condition,
    include: [
      {
        model: address,
        attributes: {
          exclude: ["createdAt", "updatedAt", "userId", "deleted", "deletedAt"],
        },
      },
      {
        model: supplier,
        attributes: {
          exclude: [
            "createdAt",
            "updatedAt",
            "deleted",
            "deletedAt",
            "password",
          ],
        },
      },
      {
        model: salesRep,
        attributes: {
          exclude: [
            "createdAt",
            "updatedAt",
            "deleted",
            "deletedAt",
            "password",
          ],
        },
      },
      {
        model: chequeDetail,
        attributes: {
          exclude: ["createdAt", "updatedAt", "deletedAt"],
        },
      },
      {
        model: user,
        attributes: {
          exclude: [
            "createdAt",
            "updatedAt",
            "latestOtp",
            "password",
            "deleted",
            "deletedAt",
            "stripeCustomerId",
            "verifiedAt",
            "status",
          ],
        },
        include: {
          model: billingAddress,
          attributes: {
            exclude: [
              "createdAt",
              "updatedAt",
              "userId",
              "deleted",
              "deletedAt",
            ],
          },
        },
      },
      {
        model: item,
        attributes: [
          "id",
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            "product",
          ],
          [
            literal(
              `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            "singleUnitWeight",
          ],
          ["weight", "itemWeights"],
          [
            literal(
              `(SELECT products.productCode FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            "productCode",
          ],
          [
            literal(
              `(SELECT products.grind FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            "grind",
          ],
          [
            literal(`
            (SELECT supplierSku
            FROM skuSuppliers
            WHERE skuSuppliers.productId = items.productId
              AND skuSuppliers.supplierId = order.supplierId
            LIMIT 1)
          `),
            "supplierSku",
          ],
          "qty",
          "productName",
          "price",
          "discount",
          "orderId",
          "productId",
          "wholesalePrice",
          "type",
          "unitPrice",
          "priceOverride",
          "catalogUnitPrice",
        ],
      },
      {
        model: orderHistory,
        attributes: [
          "id",
          [
            literal(
              `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = orderHistories.statusId LIMIT 1)`,
            ),
            "orderStatus",
          ],
          [
            literal(
              `(SELECT statuses.discription FROM statuses WHERE statuses.id = orderHistories.statusId LIMIT 1)`,
            ),
            "discription",
          ],
          "on",
          "statusId",
        ],
      },
    ],
    attributes: [
      "id",
      "type",
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "customerName",
      ],
      [
        literal(
          `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "companyName",
      ],
      [
        literal(
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
        ),
        "orderCurrentStatus",
      ],
      [
        literal(`COALESCE(
         (SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        "totalSalerCommission",
      ],
      [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        "adminEarnings",
      ],
      [
        literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        "totalQuantity",
      ],
      [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        "wholesalePrice",
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
        ),
        "salesRepName",
      ],
      "totalBill",
      "subTotal",
      "discountPrice",
      "discountPercentage",
      "itemsPrice",
      "vat",
      "totalWeight",
      "note",
      "paymentMethod",
      "poNumber",
      "frequency",
      "statusId",
      "trackingNumber",
      "paymentStatus",
      "adminReceivableStatus",
      "adminReceivableAmount",
      "localPatnerCommission",
      "invoicePdf",
      "invoiceId",
      "paymentLinkOpenCount",
      "paymentLinkFirstOpenedAt",
      "paymentLinkLastOpenedAt",
      "invoiceEmailSentCount",
      "createdBy",
      "on",
      "createdAt",
      "shippingCompany",
      "shippingCharges",
      "invoiceNumber",
      "invoiceDate",
      "invoiceReminder",
      "invoicePaidDate",
      "termDays",
      "salesRepId",
      "pulloutIntentId",
      "paymentIntentId",
      "pulloutDate",
      "quickBooksInvoiceId",
    ],
  });
  if (!doc) {
    return next(new AppError("Data not found!", 400));
  }

  importCustomersToQuickBooks({ limitIds: [doc?.user?.id], req });

  const adm = await account.findOne({
    attributes: [
      "email",
      "supportEmail",
      "phoneNumber",
      "countryCode",
      "address",
      "city",
      "state",
      "zipCode",
      "country",
    ],
  });

  const plain = doc.toJSON();
  const pricing = await invoicePricingInfo(req.user, { ...plain, userId: plain.user?.id });
  if (req.user?.entity === "user") {
    // Customers get the invoice as before (line totals); unit-price bookkeeping is internal.
    for (const line of plain.items || []) {
      delete line.unitPrice;
      delete line.priceOverride;
      delete line.catalogUnitPrice;
    }
  }
  // Shareable pay link for unpaid orders (callers already passed the order access checks).
  const payToken =
    plain.paymentStatus !== "done" ? await ensurePayToken(order, plain.id).catch(() => null) : null;

  res.status(200).json({
    status: "success",
    data: {
      order: plain,
      adminAddress: adm,
      // Invoice screens: may this user set unit prices; per-product minimum (partner wholesale).
      pricing,
      payToken,
      payUrl: payToken ? payUrl({ id: plain.id, orderType: "customer", payToken }) : null,
    },
  });
});

exports.invoiceTracking = catchAsync(async (req, res, next) => {
  const { orderId, orderType } = req.params;

  if (!orderId) {
    return next(new AppError("Order ID is required", 400));
  }

  const model =
    orderType === "customer-order"
      ? order
      : orderType === "partner-order"
        ? partnerOrder
        : null;

  if (!model) {
    return next(
      new AppError(
        "Invalid orderType. Use 'customer-order' or 'partner-order'.",
        400,
      ),
    );
  }

  const doc = await model.findOne({
    where: { id: orderId },
    attributes: [
      "id",
      "paymentLinkOpenCount",
      "paymentLinkFirstOpenedAt",
      "paymentLinkLastOpenedAt",
      "invoiceEmailSentCount",
      "invoiceDate",
      "invoiceReminder",
      "invoicePaidDate",
    ],
  });

  if (!doc) {
    return next(new AppError("Order not found", 404));
  }

  return res.status(200).json({
    status: "success",
    data: {
      order: doc,
    },
  });
});

//* UPDATE TRACKING NUMBER
exports.updateTrackingNumber = catchAsync(async (req, res, next) => {
  const { orderId, orderType, trackingNumber } = req.body;

  if (!orderId) {
    return next(new AppError("Order ID is required", 400));
  }

  if (trackingNumber === undefined || trackingNumber === null) {
    return next(new AppError("Tracking number is required", 400));
  }

  const model =
    orderType === "partner-order" || orderType === "local-partner"
      ? partnerOrder
      : order;

  const doc = await model.findOne({
    where: { id: orderId },
    attributes: ["id", "trackingNumber"],
  });

  if (!doc) {
    return next(new AppError("Order not found", 404));
  }

  await model.update(
    { trackingNumber: String(trackingNumber).trim() },
    { where: { id: orderId } },
  );

  return res.status(200).json({
    status: "success",
    message: "Tracking number updated successfully",
    data: {
      orderId: Number(orderId),
      trackingNumber: String(trackingNumber).trim(),
    },
  });
});

//*
//! dont need this now
// if(req.body?.orderData?.statusId == 4)processTransferToLocalPartner({orderId:orderId})
exports.orderJourneryComplete = catchAsync(async (req, res, next) => {
  const { orderId, partnerOrderId } = req.body;
  console.log("🚀 ~ partnerOrderId:", partnerOrderId);

  const Model = partnerOrderId ? partnerOrder : order;
  const isPartnerOrder = partnerOrderId ? true : false;

  const qry = {
    where: { id: orderId || partnerOrderId },
  };

  if (isPartnerOrder) {
    qry.raw = true;
    qry.attributes = [
      "id",
      "type",
      "totalBill",
      "invoiceNumber",
      "statusId",
      "quickBooksInvoiceId",
      "quickBooksPaymentId",
      "paymentStatus",
      [
        literal(
          `(SELECT stripeCustomerId FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
        ),
        "stripeCustomerId",
      ],
      [
        literal(
          `(SELECT defaultBankAccount FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
        ),
        "defaultBankAccount",
      ],
      [
        literal(
          `(SELECT srName FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
        ),
        "srName",
      ],
      [
        literal(
          `(SELECT territoryName FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
        ),
        "territoryName",
      ],
    ];
  }
  const doc = await Model.findOne(qry);

  if (!doc) {
    return next(new AppError("Order not found.", 404));
  }
  const statusId = Number(req.body?.orderData?.statusId);
  const userId = Number(doc?.userId || 0);
  let paidInvoiceEventFired = false;

  //because customers and localpart6ner already have order invoice in
  //main issue status alreqady 4 hoga jin order ka 5 py unki payment ho jaye gi or f
  0;
  console.log("🚀 ~ statusId:", statusId);
  console.log("🚀 ~ isPartnerOrder:", isPartnerOrder);
  console.log("🚀 ~ doc?.paymentStatus :", doc?.paymentStatus);
  if (statusId == 5 && isPartnerOrder && doc?.paymentStatus != "done") {
    //HERE we try to collect payment if order type is local Patrner
    console.log("🚀 ~ doc?.defaultBankAccount:", doc?.defaultBankAccount);
    if (!doc?.defaultBankAccount) {
      await Model.update(req.body?.orderData, {
        where: { id: orderId || partnerOrderId },
      });

      return next(
        new AppError(
          "Invalid Bank Account! Order has been shipped but cannot collect payment. ",
          404,
        ),
      );
    }
    const pullouts = await Stripe.pullAmountPaymentIntentFromBankAccount({
      amount: doc.totalBill || 0,
      customerId: doc?.stripeCustomerId,
      savedPaymentMethodId: doc?.defaultBankAccount,
      orders: [doc?.id],
      invoiceNumbers: [doc?.invoiceNumber],
      partner: { srName: doc?.srName, territoryName: doc?.territoryName },
    });

    console.log("🚀 ~ pullouts:", pullouts);
    if (!pullouts) {
      await Model.update(req.body?.orderData, {
        where: { id: orderId || partnerOrderId },
      });
      return next(
        new AppError(
          "Invalid Bank Account! Order has been shipped but cannot collect payment. ",
          404,
        ),
      );
    }
    req.body.orderData.adminReceivableStatus = true;
    req.body.orderData.pulloutDate = Date.now();
    req.body.orderData.pulloutIntentId = pullouts?.paymentIntentId;
    req.body.orderData.paymentIntentId = pullouts?.paymentIntentId;
    req.body.orderData.paymentStatus = "done";
    console.log("🚀 ~ doc?.quickBooksInvoiceId:", doc?.quickBooksInvoiceId);
    await Model.update(
      { paymentStatus: "done" },
      {
        where: { id: orderId || partnerOrderId },
      },
    );
    if (doc?.quickBooksInvoiceId && !doc?.quickBooksPaymentId) {
      syncPaymentToQuickBooks({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "local-partner" : "customer",
      });
      console.log("🚀 ~ syncPaymentToQuickBooks:  ~TRUE");
    } else if (!doc.quickBooksInvoiceId) {
      console.log("🚀 ~ syncInvoiceOnQuikBooks:  ~FALSE");
      syncInvoiceOnQuikBooks({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "local-partner" : "customer",
      });
    }
    paidInvoiceAdminOrLocalPatnerEventAndCustomer({
      orderId: orderId || partnerOrderId,
      orderType: isPartnerOrder ? "local-partner" : "customer",
    });
    paidInvoiceEventFired = true;
  }
  if (req.body?.orderData) {
    req.body.orderData.shippingCompany = "UPS";

    if (statusId === 2 && [267, 279].includes(userId)) {
      req.body.orderData.supplierId = 17;
    }
    let manualPaymentEmail = false;
    if (req.body?.orderData?.paymentStatus == "done") {
      console.log("🚀 ~ doc.doc :", JSON.parse(JSON.stringify(doc)));
      console.log("🚀 ~ quickBookInvoiceId:", doc.quickBooksInvoiceId);
      console.log("🚀 ~ doc.quickBooksPaymentId:", doc.quickBooksPaymentId);
      const shouldSyncPaidQbo =
        !isPartnerOrder || doc?.type === "direct-invoice";
      if (
        shouldSyncPaidQbo &&
        doc?.quickBooksInvoiceId &&
        !doc?.quickBooksPaymentId
      ) {
        console.log(
          "🚀 ~ doc?.quickBooksInvoiceId && !doc?.quickBooksPaymentId:",
          doc?.quickBooksInvoiceId && !doc?.quickBooksPaymentId,
        );
        await Model.update(
          { paymentStatus: "done" },
          {
            where: { id: orderId || partnerOrderId },
          },
        );
        syncPaymentToQuickBooks({
          orderId: orderId || partnerOrderId,
          orderType: isPartnerOrder ? "local-partner" : "customer",
        });
        console.log("🚀 ~ syncPaymentToQuickBooks:  ~TRUE");
      } else if (shouldSyncPaidQbo && !doc.quickBooksInvoiceId) {
        console.log("🚀 ~ syncInvoiceOnQuikBooks:  ~FALSE");
        syncInvoiceOnQuikBooks({
          orderId: orderId || partnerOrderId,
          orderType: isPartnerOrder ? "local-partner" : "customer",
        });
      }
      if (!isPartnerOrder) {
        req.body.orderData.invoicePaidDate = new Date();
        req.body.orderData.paymentMethod = "Bank Check";
        manualPaymentEmail = true;
      }
    }

    await Model.update(req.body?.orderData, {
      where: { id: orderId || partnerOrderId },
    });

    // [QBO-POLICY-2026] Disabled: no longer push pulloutIntentId to admin QBO after pullout (DB fields still saved above).
    // if (paidInvoiceEventFired) {
    //   try {
    //     await reconcilePulloutSyncStateForOrder({
    //       orderId: orderId || partnerOrderId,
    //       orderType: isPartnerOrder ? "local-partner" : "customer",
    //     });
    //   } catch (stateErr) {
    //     console.warn(
    //       "[pullout-state] reconcile failed (journey pullout):",
    //       stateErr?.message,
    //     );
    //   }
    // }

    // Paid invoice event after order update so email sees updated paymentStatus
    if (
      req.body?.orderData?.paymentStatus == "done" &&
      !paidInvoiceEventFired
    ) {
      paidInvoiceAdminOrLocalPatnerEventAndCustomer({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "local-partner" : "customer",
      });
      if (!isPartnerOrder && orderId) {
        try {
          if (!doc?.salesRepId) {
            await calculateAndSaveEmployeeCommission({
              orderId: orderId,
              employeeOf: "admin",
            });
          } else {
            const partner = await salesRep.findOne({
              where: { id: doc.salesRepId },
              attributes: ["id", "partnerType"],
            });

            if (partner?.partnerType === "direct-partner") {
              await calculateAndPayoutDirectPartnerEmployeeCommission({
                orderId: orderId,
                triggerSource: "order-journey-complete",
              });
            }
          }
        } catch (error) {
          console.error(
            "❌ Error processing employee payout in orderJourneryComplete:",
            error?.message || error,
          );
        }
      }
    }
  }
  if (req.body?.cheque) {
    req.body.cheque.orderId = orderId;
    req.body.cheque.partnerOrderId = partnerOrderId;
    await chequeDetail.create(req.body?.cheque);
  }

  console.log(
    "🚀 ~ exports.orderJourneryComplete ~ req.body?.orderData?.statusId :",
    req.body?.orderData?.statusId,
  );

  if (req.body?.orderData?.statusId) {
    if (req.body?.orderData?.statusId == 2) {
      supplierNewOrderEvent({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "local-partner" : "customer",
      });
    }

    // if (req.body?.orderData?.statusId == 4) {
    // }

    if (req.body?.orderData?.statusId == 5) {
      //    HERE we try to collect payment if order type is local Patrner
      orderShippedEvent({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "local-partner" : "customer",
      });
      orderDispatchEvent({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "local-partner" : "customer",
      });
    }

    if (req.body?.orderData?.statusId == 6) {
      if (doc?.invoiceId) {
        let checkSession = false;
        const session = await Stripe.checkCheckoutSessionStatus(doc?.invoiceId);
        console.log("🚀 ~ exports.fetchInvoice=catchAsync ~ session:", session);

        if (session == "paid") {
          await Model.update(
            { paymentMethod: "card", paymentStatus: "done" },
            { where: { id: doc.id } },
          );
          return next(
            new AppError(
              "As the payment for the order has already been made, we are unable to cancel.",
              404,
            ),
          );
        } else if (session == "open") {
          checkSession = true;
        }

        if (checkSession) await Stripe.blockCheckoutSession(doc?.invoiceId);
      }

      const pdfFilename = `order#${order?.id}.pdf`; // or `inv-${order.id}.pdf` if you're using dash
      const pdfPath = path.join(
        __dirname,
        "../../public/invoicePDFs",
        pdfFilename,
      );

      // Check if file exists, then delete
      fs.access(pdfPath, fs.constants.F_OK, (err) => {
        if (!err) {
          fs.unlink(pdfPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error(
                `❌ Failed to delete invoice PDF for order ${order.id}:`,
                unlinkErr,
              );
            } else {
              console.log(`🗑️ Deleted invoice PDF: ${pdfFilename}`);
            }
          });
        } else {
          console.warn(
            `⚠️ No invoice PDF found for order ${order.id} at ${pdfPath}`,
          );
        }
      });
    }

    await orderHistory.create({
      statusId: req.body?.orderData?.statusId,
      orderId: orderId || null,
      partnerOrderId: partnerOrderId || null,
      on: Date.now(),
    });
  }

  return res.status(200).json({
    status: "success",
    data: {},
  });
});

//* Assigin Supplier will Confirm order from admin side
exports.supplierAcknowledgement = catchAsync(async (req, res, next) => {
  const { supplierId, orderId } = req.body;

  const doc = await order.findOne({
    where: { id: orderId },
    attributes: ["id", "supplierId"],
  });

  if (!doc) {
    return next(new AppError("Order not found.", 404));
  }

  doc.supplierId = supplierId;
  await doc.save();

  return res.status(200).json({
    status: "success",
    data: {
      data: doc,
    },
  });
});

//* Edit Cheque Information
exports.eidtCheque = catchAsync(async (req, res, next) => {
  const { cheque, chequeId } = req.body;
  await chequeDetail.update(cheque, { where: { id: chequeId } });

  return res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.findShippingCompanyForWeight = catchAsync(async (req, res, next) => {
  const weight = req.body?.weight || 0; // Weight from req.body
  console.log(
    "🚀 ~ exports.findShippingCompanyForWeight=catchAsync ~ weight:",
    weight,
  );

  let customerInfo, customer;
  if (req.body?.userType != "local-partner") {
    customerInfo = await user.findOne({
      where: { id: req.params?.id || req.user?.id },
      attributes: [
        "id",
        "salesRepId",
        "defaultDiscount",
        [
          literal(
            `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "salesRepName",
        ],
        [
          literal(
            `(SELECT salesReps.partnerType FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "partnerType",
        ],
      ],
      raw: true,
    });

    customer = customerInfo?.id
      ? await userDiscount.findAll({
          where: { userId: customerInfo?.id },
          attributes: [
            "categoryId",
            "percentage",
            // [
            //   literal(
            //     `(SELECT categories.name FROM categories WHERE userDiscount.categoryId= categories.id LIMIT 1)`,
            //   ),
            //   'categoryName',
            // ],
          ],
        })
      : [];
    console.log("🚀 ~ customerInfo:", customerInfo);
    console.log("🚀 ~ req.params?.id:", req.user?.id);
    // Find the shipping company where the weight is between weightFrom and weightTo
  }
  const shippingCompany = await shippingCompanies.findOne({
    where: {
      weightFrom: {
        [Op.lte]: weight, // Less than or equal to the weight
      },
      weightTo: {
        [Op.gte]: weight, // Greater than or equal to the weight
      },
    },
    attributes: ["charges"],
  });

  if (!shippingCompany && customerInfo?.partnerType != "direct-partner") {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        200,
      ),
    );
  }

  return res.status(200).json({
    status: "success",
    data: {
      charges:
        customerInfo?.partnerType != "direct-partner"
          ? shippingCompany?.charges
          : 0,
      discountPercentage: customer || [],
    },
  });
});

//* UPDATE ORDER
/**
 * Product attributes for pricing a customer order's lines: list price and wholesale (the local
 * partner's price list when it has the product, else the product's own), weight, category and the
 * customer's category discount.
 */
function catalogProductAttributes({ userId, salesRepId }) {
  const attributes = [
    "id",
    "name",
    "quantity",
    "categoryId",
    "weight",
    "sku",
    "grind",
    "productCode",
    [
      literal(`(SELECT percentage FROM userDiscounts WHERE userDiscounts.categoryId = product.categoryId AND userDiscounts.userId = ${Number(userId) || 0} LIMIT 1)`),
      "discountPercentage",
    ],
  ];
  if (salesRepId) {
    const rep = Number(salesRepId) || 0;
    attributes.push(
      [
        literal(`COALESCE((SELECT srpp.price FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${rep} AND srpp.deleted = 0 LIMIT 1), product.price)`),
        "price",
      ],
      [
        literal(`COALESCE((SELECT srpp.wholesalePrice FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${rep} AND srpp.deleted = 0 LIMIT 1), product.wholesalePrice)`),
        "wholesalePrice",
      ],
    );
  } else {
    attributes.push("price", "wholesalePrice");
  }
  return attributes;
}

/** Order-details extras for the invoice screens: may this user set unit prices, and the minimums. */
async function invoicePricingInfo(user, doc) {
  const info = {
    canEditUnitPrice: canEditUnitPrice(user, { partnerCustomer: Boolean(doc?.salesRepId) }),
    minUnitPrices: {},
    // Today's catalog unit price per product ("Reset to catalog" shows exactly what the server charges).
    catalogUnitPrices: {},
  };
  const productIds = [
    ...new Set((doc?.items || []).filter((i) => i.type !== "charges" && i.productId).map((i) => i.productId)),
  ];
  if (!productIds.length) return info;
  let orderInfo = { salesRepId: null };
  if (doc.salesRepId) {
    const rep = await salesRep.findOne({ where: { id: doc.salesRepId }, attributes: ["partnerType"], raw: true });
    orderInfo = { salesRepId: doc.salesRepId, partnerType: rep?.partnerType };
  }
  const rows = await product.findAll({
    where: { id: { [Op.in]: productIds } },
    attributes: catalogProductAttributes({ userId: doc.userId, salesRepId: doc.salesRepId }),
    raw: true,
  });
  for (const row of rows) {
    info.catalogUnitPrices[row.id] = catalogUnitPriceOf(row);
    const min = minUnitPrice(orderInfo, row.wholesalePrice);
    if (min !== null) info.minUnitPrices[row.id] = min;
  }
  return info;
}

/**
 * Edit a customer order's invoice: product lines (quantities, custom unit prices with the "Edit unit
 * price" permission — utils/invoiceLinePricing.js), extra charges, invoice fields; then cancel the
 * open payment link, rebuild the PDF / QuickBooks invoice and optionally email or charge the
 * customer. All checks run before anything is changed.
 */
exports.updateOrder = catchAsync(async (req, res, next) => {
  const fetchedOrder = await order.findOne({
    where: { id: req.params.orderId },
    attributes: [
      "id",
      "supplierId",
      "paymentStatus",
      "paymentIntentId",
      "pulloutIntentId",
      "salesRepId",
      "invoiceId",
      "orderFrequencyId",
      "invoiceDate",
      "invoiceReminder",
      "invoicePaidDate",
      "invoiceNumber",
      "userId",
      "quickBooksInvoiceId",
      "shippingCharges",
      "vat",
      "totalBill",
      "itemsPrice",
      [
        literal(
          `(SELECT users.stripeCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "stripeCustomerId",
      ],
      [
        literal(
          `(SELECT users.stripeCustomerIdForPartner FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        "stripeCustomerIdForPartner",
      ],
      [
        literal(
          `(SELECT salesReps.connectAccountId FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        "connectAccountId",
      ],
      [
        literal(
          `(SELECT salesReps.partnerType FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        "partnerType",
      ],
    ],
  });

  const placedOrder = JSON.parse(JSON.stringify(fetchedOrder));

  if (!placedOrder) {
    return next(new AppError("Order not found.", 404));
  }
  if (!canAccessOrder(req.user, placedOrder.salesRepId)) {
    return next(new AppError("You do not have permission to edit this order.", 403));
  }
  if (paymentLocked(placedOrder)) {
    return next(
      new AppError(
        "This order is already paid or a payment is in progress, so the invoice can no longer be changed.",
        400,
      ),
    );
  }

  const body = req.body || {};
  const orderInput = body.order && typeof body.order === "object" ? body.order : {};
  const inputItems = Array.isArray(body.items) ? body.items : [];
  // Screens without a charges section (invoice PDF "Update") leave the extra charges as they are.
  const chargesProvided = Array.isArray(body.typeCharges);

  const existingLines = await item.findAll({
    where: { orderId: placedOrder.id },
    raw: true,
  });
  const existingProductLines = existingLines.filter((l) => l.type !== "charges");
  const existingChargeLines = existingLines.filter((l) => l.type === "charges");

  const chargeInputs = chargesProvided
    ? body.typeCharges
    : existingChargeLines.map((l) => ({ code: l.code, qty: l.qty, total: l.price, name: l.productName }));

  if (inputItems.length < 1 && chargeInputs.length < 1) {
    return next(new AppError("Add at least one product or charge to the invoice.", 400));
  }

  // 1) Product lines: catalog, kept or custom prices (permission + minimums checked here).
  const productIds = [...new Set(inputItems.map((i) => Number(i.productId)).filter(Boolean))];
  const products = productIds.length
    ? await product.findAll({
        where: { id: { [Op.in]: productIds } },
        attributes: catalogProductAttributes(placedOrder),
        raw: true,
      })
    : [];
  let priced;
  try {
    priced = priceInvoiceLines({
      inputItems,
      products: new Map(products.map((p) => [Number(p.id), p])),
      existingLines: existingProductLines,
      order: { salesRepId: placedOrder.salesRepId, partnerType: placedOrder.partnerType },
      canEdit: canEditUnitPrice(req.user, { partnerCustomer: Boolean(placedOrder.salesRepId) }),
    });
  } catch (error) {
    if (error instanceof PricingError) return next(new AppError(error.message, error.status));
    throw error;
  }
  // Manually set / changed unit prices must be confirmed on the invoice screen (checkbox).
  const manualPriceChanges = priced.changes.filter((c) => c.action !== "reset");
  if (manualPriceChanges.length && body.confirmPriceChanges !== true) {
    return next(new AppError("Please confirm the unit price changes before saving the invoice.", 400));
  }

  const finalItems = priced.lines.map((line) => ({
    ...line,
    orderId: placedOrder.id,
    orderFrequencyId: placedOrder.orderFrequencyId,
  }));
  let itemsPrice = priced.totals.itemsPrice;
  let totalLocalPatnerCommission = priced.totals.commission;

  // 2) Extra charges (delivery, setup, ...): any non-negative amount.
  for (const obj of chargeInputs) {
    const amount = Number(obj?.total ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      return next(new AppError("Extra charge amounts must be 0 or more.", 400));
    }
    const element = {
      code: obj.code,
      qty: obj.qty,
      price: amount,
      productName: obj.name,
      orderId: placedOrder.id,
      type: "charges",
      orderFrequencyId: placedOrder.orderFrequencyId,
      discount: 0,
    };
    itemsPrice += amount;
    if (placedOrder?.salesRepId) {
      element.salerCommission = amount;
      totalLocalPatnerCommission += amount;
    } else {
      element.wholesalePrice = 0;
      element.salerCommission = 0;
    }
    finalItems.push(element);
  }

  // 3) Shipping: entered amount, else by weight (direct partners keep their current shipping).
  const totalWeight = priced.totals.weight;
  let shippingCompany;
  if (!orderInput.shippingCharges) {
    shippingCompany = await shippingCompanies.findOne({
      where: {
        weightFrom: { [Op.lte]: totalWeight },
        weightTo: { [Op.gte]: totalWeight },
      },
      attributes: ["charges"],
    });
    if (!shippingCompany && placedOrder?.partnerType != "direct-partner") {
      return next(
        new AppError(
          "Not dealing in such weights. Contact customer support for this order.",
          400,
        ),
      );
    }
  }
  const shippingCharges =
    placedOrder?.partnerType == "direct-partner"
      ? orderInput.shippingCharges || placedOrder?.shippingCharges || 0
      : orderInput.shippingCharges || shippingCompany?.charges || 0;
  const vat = parseFloat(orderInput.vat ?? placedOrder.vat ?? 0) || 0;

  // 4) The open payment link (if any) is for the old amount: stop it (or notice it was paid).
  if (placedOrder?.invoiceId) {
    const session = await Stripe.checkCheckoutSessionStatus(placedOrder?.invoiceId);
    if (session == "paid") {
      await order.update(
        { paymentMethod: "card", paymentStatus: "done" },
        { where: { id: placedOrder.id } },
      );
      return next(
        new AppError(
          "As the payment for the order has already been made, we are unable to update an invoice at this point.",
          400,
        ),
      );
    } else if (session == "open") {
      await Stripe.blockCheckoutSession(placedOrder?.invoiceId);
    }
  }

  const orderUpdate = {
    ...pickFields(orderInput, EDITABLE_ORDER_FIELDS),
    invoiceId: null,
    hostedInvoiceUrl: null,
    itemsPrice,
    discountPrice: priced.totals.discount,
    totalWeight: parseFloat(totalWeight),
    shippingCompany: totalWeight > 400 ? `Shipping By Truck` : "UPS",
    invoicePdf: 1,
    shippingCharges,
    subTotal: itemsPrice + vat,
    totalBill: itemsPrice + vat + parseFloat(shippingCharges || 0),
  };
  if (placedOrder.invoiceDate || !orderInput.emailInvoiceToCustomer) {
    delete orderUpdate.invoiceDate;
  }

  await sequelize.transaction(async (transaction) => {
    await order.update(orderUpdate, { where: { id: placedOrder.id }, transaction });
    await item.destroy({ where: { orderId: placedOrder.id }, transaction });
    await item.bulkCreate(finalItems, { transaction });
    if (priced.changes.length) {
      await orderItemPriceLog.bulkCreate(
        priced.changes.map((change) => ({
          ...change,
          orderId: placedOrder.id,
          changedByEntity: req.user?.entity || null,
          changedById: req.user?.id || null,
          changedByName: req.user?.name || req.user?.srName || req.user?.email || null,
        })),
        { transaction },
      );
    }
  });

  const lineSummary = (lines) =>
    lines.map((l) => ({ productId: l.productId ?? null, name: l.productName ?? null, type: l.type || "product", qty: Number(l.qty), total: Number(l.price || 0) }));
  await logOrderActivity({
    req,
    orderId: placedOrder.id,
    action: "invoice_edited",
    summary: `Invoice edited: total ${activityMoney(placedOrder.totalBill)} → ${activityMoney(orderUpdate.totalBill)}`,
    details: {
      before: { totalBill: Number(placedOrder.totalBill || 0), itemsPrice: Number(placedOrder.itemsPrice || 0), shippingCharges: Number(placedOrder.shippingCharges || 0), lines: lineSummary(existingLines) },
      after: { totalBill: orderUpdate.totalBill, itemsPrice: orderUpdate.itemsPrice, shippingCharges: Number(orderUpdate.shippingCharges || 0), lines: lineSummary(finalItems) },
      priceChanges: priced.changes.length,
      priceChangesConfirmed: manualPriceChanges.length ? true : undefined,
      emailToCustomer: Boolean(orderInput.emailInvoiceToCustomer),
      chargeSavedCard: Boolean(orderInput.paymentCardId),
    },
  });

  const pdfFilename = `invoice-00${placedOrder.id}.pdf`;
  const pdfPath = path.join(__dirname, "../../public/invoicePDFs", pdfFilename);
  fs.access(pdfPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(`❌ Failed to delete invoice PDF for order ${placedOrder.id}:`, unlinkErr);
        }
      });
    }
  });

  if (orderInput.paymentCardId) {
    const payment = await Stripe.createPaymentIntent({
      adminReceivableAmount: orderUpdate.totalBill,
      hasLocalPatner: placedOrder.salesRepId,
      localPartnerAccountId: placedOrder.connectAccountId,
      localPatnerCommission: totalLocalPatnerCommission,
      paymentMethodId: orderInput.paymentCardId,
      stripeCustomer: placedOrder?.stripeCustomerId,
      connectedCustomerForPartner: placedOrder?.stripeCustomerIdForPartner,
      partnerType: placedOrder?.partnerType,
      metadata: {
        orderId: placedOrder.id,
        invoiceNumber: placedOrder.invoiceNumber,
      },
    });

    if (payment && payment?.status) {
      await order.update(payment?.data, { where: { id: placedOrder?.id } });
      paidInvoiceAdminOrLocalPatnerEventAndCustomer({
        orderId: placedOrder?.id,
        orderType: "customer",
      });
      try {
        // Admin payout branch
        if (!placedOrder?.salesRepId) {
          await calculateAndSaveEmployeeCommission({
            orderId: placedOrder?.id,
            employeeOf: "admin",
          });
        } else if (placedOrder?.partnerType === "direct-partner") {
          // Direct-partner payout branch
          await calculateAndPayoutDirectPartnerEmployeeCommission({
            orderId: placedOrder?.id,
            triggerSource: "order-update-payment-capture",
          });
        }
      } catch (error) {
        // Log error but don't disrupt the overall API flow
        console.error(
          "❌ Error processing employee payout in payment capture:",
          error.message,
        );
      }
      return res.status(200).json({
        status: "success",
        message: "Payment capture success",
        data: { id: req.params.orderId },
      });
    }
    return res.status(200).json({
      status: "success",
      message: payment?.message || "Payment failed",
      data: { id: req.params.orderId },
    });
  }

  if (orderInput.emailInvoiceToCustomer && !orderInput.attemptImmediatePayment) {
    sentPaymentInvoiceEvent({
      orderId: placedOrder?.id,
      orderType: "customer",
    });
  }

  syncInvoiceOnQuikBooks({ orderId: placedOrder.id, updateRequest: true });

  return res.status(200).json({
    status: "success",
    message: "success",
    data: { id: req.params.orderId, priceChanges: priced.changes.length },
  });
});

/**
 * Delete invoice: set invoice date/reminder to null, clear checkout session if not paid, delete PDF.
 * Body: { orderType: "order" | "partnerOrder", id: number }
 * - If invoiceId is a Stripe checkout session: check status; if paid → error; if open → expire session.
 * - Then set invoiceDate, invoiceReminder, invoiceId, hostedInvoiceUrl, invoicePdf to null and delete PDF file.
 */
exports.deleteInvoice = catchAsync(async (req, res, next) => {
  const { orderType, id } = req.body;

  if (!id) {
    throw new AppError("Order id is required in body.", 400);
  }

  const model =
    orderType === "partnerOrder" || orderType === "local-partner"
      ? partnerOrder
      : order;

  const placedOrder = await model.findOne({
    where: { id },
    attributes: [
      "id",
      "invoiceId",
      "invoiceDate",
      "invoiceReminder",
      "invoicePdf",
      "paymentStatus",
    ],
  });

  if (!placedOrder) {
    throw new AppError(
      `Order with id ${id} not found for type ${orderType || "order"}.`,
      404,
    );
  }
  console.log("🚀 ~ placedOrder?.paymentStatus:", placedOrder?.paymentStatus);
  if (placedOrder?.paymentStatus === "done") {
    throw new AppError("Invoice is already paid. Cannot delete invoice.", 400);
  }
  const invoiceId = placedOrder.invoiceId;

  if (invoiceId && invoiceId.startsWith("cs_")) {
    const sessionStatus = await Stripe.checkCheckoutSessionStatus(invoiceId);

    if (sessionStatus === "paid") {
      throw new AppError(
        "Invoice is already paid. Cannot delete invoice.",
        400,
      );
    }

    if (sessionStatus === "open") {
      await Stripe.blockCheckoutSession(invoiceId);
    }
  }

  // Delete QuickBooks invoice(s) for admin orders (service updates quickBooksInvoiceId etc. on order)
  if (model === order) {
    try {
      await quickBooksInvocieDelete({ orderId: id, orderType });
    } catch (err) {
      const msg =
        err.response?.data?.Fault?.Error?.[0]?.Message ||
        err.response?.data?.message ||
        err.message;
      throw new AppError(
        `QuickBooks invoice delete failed: ${msg}`,
        err.response?.status || 500,
      );
    }
  }

  await model.update(
    {
      invoiceDate: null,
      invoiceReminder: null,
      invoiceId: null,
      hostedInvoiceUrl: null,
      invoicePdf: null,
    },
    { where: { id } },
  );

  const pdfFilename = `invoice-00${placedOrder.id}.pdf`;
  const pdfPath = path.join(__dirname, "../../public/invoicePDFs", pdfFilename);

  try {
    await fs.promises.access(pdfPath, fs.constants.F_OK);
    await fs.promises.unlink(pdfPath);
    console.log(`🗑️ Deleted invoice PDF: ${pdfFilename}`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(
        `❌ Failed to delete invoice PDF for order ${placedOrder.id}:`,
        err.message,
      );
    }
  }

  return res.status(200).json({
    status: "success",
    message: "Invoice deleted successfully.",
    data: { id: placedOrder.id },
  });
});

exports.orderNavigationCounts = catchAsync(async (req, res, next) => {
  let employeeId = null;
  if (req.user.entity == "adminEmployee") {
    employeeId = req.user?.id;
  }

  // Query to count orders based on employeeId
  const data = await statuses.findAll({
    attributes: [
      "id",
      "orderStatus",
      [
        literal(
          `(SELECT COUNT(orders.id) 
           FROM orders
           JOIN users ON users.id = orders.userId 
           WHERE orders.statusId = statuses.id
           AND orders.type = 'regular-order'
           ${opsOrderOnSql("orders")}
           ${employeeId ? `AND users.employeeId = ${employeeId}` : ""})`,
        ),
        "count",
      ],
    ],
  });

  let condition = {};
  if (req.params.srId) condition.salesRepId = req.params.srId;

  // Add visibilityDate condition
  condition.visibilityDate = {
    [Op.lte]: new Date(), // or moment().toDate()
  };

  const upcommingOrderCount = employeeId
    ? await orderFrequency.count({
        where: {
          ...condition,
          nextOrderDate: {
            [Op.not]: literal(`
        (SELECT DATE(orders.on)
         FROM orders
         JOIN users ON users.id = orders.userId 
         WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate)
         AND orders.orderFrequencyId = orderFrequency.id
         ${employeeId ? `AND users.employeeId = ${employeeId}` : ""})
      `),
          },
        },
      })
    : await orderFrequency.count({
        where: {
          ...condition,
          nextOrderDate: {
            [Op.notIn]: literal(`
          (SELECT DATE(orders.on)
          FROM orders
          WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate)
          AND orders.orderFrequencyId = orderFrequency.id)
        `),
          },
        },
      });

  const output = JSON.parse(JSON.stringify(data));

  output.push({
    id: 7,
    orderStatus: "Upcomming Orders",
    count: upcommingOrderCount,
  });

  return res.status(200).json({
    status: "success",
    data: output,
  });
});

exports.orderNavigationCountsLocalPatner = catchAsync(
  async (req, res, next) => {
    let employeeId = null;
    if (req.user.entity === "partnerEmployee") {
      employeeId = req.user?.id;
    }

    // Define the literals for both scenarios
    const employeeFilterLiteral = employeeId
      ? `AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`
      : `AND orders.salesRepId = ${req.params?.srId}`; // If employeeId is null, check for salesRepId

    const upcomingOrderCountLiteral = employeeId
      ? `AND orders.userId IN (SELECT id FROM users WHERE employeeId = ${employeeId})`
      : `AND orders.salesRepId = ${req.params?.srId}`; // If employeeId is null, check for salesRepId

    // Query to count orders based on employeeId (handling both cases for employeeId)
    const data = await statuses.findAll({
      attributes: [
        "id",
        "orderStatus",
        [
          literal(
            `(SELECT COUNT(orders.id) 
             FROM orders 
             WHERE orders.statusId = statuses.id 
             ${opsOrderOnSql("orders")}
             ${employeeFilterLiteral})`,
          ),
          "count",
        ],
      ],
    });

    let condition = {};
    if (req.params.srId) condition.salesRepId = req.params?.srId;

    // Add visibilityDate condition
    condition.visibilityDate = {
      [Op.lte]: new Date(), // or moment().toDate()
    };

    // Handle upcoming order count based on employeeId
    const upcommingOrderCount = await orderFrequency.count({
      where: {
        ...condition,
        nextOrderDate: {
          [Op.notIn]: literal(`
            (SELECT DATE(orders.on)
             FROM orders
             WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate)
             AND orders.orderFrequencyId = orderFrequency.id
             ${upcomingOrderCountLiteral})
          `),
        },
      },
    });

    const output = JSON.parse(JSON.stringify(data));

    output.push({
      id: 7,
      orderStatus: "Upcomming Orders",
      count: upcommingOrderCount,
    });

    return res.status(200).json({
      status: "success",
      data: output,
    });
  },
);

exports.orderNavigationCountsSupplier = catchAsync(async (req, res, next) => {
  const data = await statuses.findAll({
    attributes: [
      "id",
      "orderStatus",
      [
        literal(
          `(SELECT COUNT(id) FROM orders WHERE orders.statusId = statuses.id AND orders.supplierId = ${req.params?.id} ${opsOrderOnSql("orders")})`,
        ),
        "count",
      ],
    ],
  });

  const output = JSON.parse(JSON.stringify(data));

  return res.status(200).json({
    status: "success",
    data: output,
  });
});

exports.deleteOrder = catchAsync(async (req, res, next) => {
  const placedOrder = await order.findOne({
    where: { id: req.params.orderId },
    attributes: [
      "id",
      "supplierId",
      "paymentStatus",
      "salesRepId",
      "invoiceId",
      "orderFrequencyId",
      "invoiceDate",
      "invoiceReminder",
      "invoicePaidDate",
      "statusId",
    ],
  });

  if (!placedOrder) {
    return next(new AppError("Order not found.", 404));
  } else if (placedOrder.paymentStatus === "done") {
    return next(
      new AppError(
        "This order has already been paid for and cannot be deleted.",
        400,
      ),
    );
  } else if (placedOrder.statusId >= 4 && placedOrder.statusId <= 5) {
    return next(
      new AppError(
        "This order has already been dispatched and cannot be deleted.",
        400,
      ),
    );
  }

  Stripe.blockCheckoutSession(placedOrder?.invoiceId);

  await order.destroy({ where: { id: placedOrder?.id } });

  await item.destroy({
    where: { orderId: { [Op.is]: null } },
  });

  // Update rows where orderId IS NULL
  await orderHistory.destroy({ where: { orderId: { [Op.is]: null } } });

  const pdfFilename = `invoice-00${placedOrder.id}.pdf`; // or `inv-${order.id}.pdf` if you're using dash
  const pdfPath = path.join(__dirname, "../../public/invoicePDFs", pdfFilename);
  fs.access(pdfPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `❌ ~ Failed to delete invoice PDF for order ${placedOrder.id}:`,
            unlinkErr,
          );
        } else {
          console.log(`🗑️ ~ Deleted invoice PDF: ${pdfFilename}`);
        }
      });
    } else {
      console.warn(
        `⚠️ ~ No invoice PDF found for order ${placedOrder.id} at ${pdfPath}`,
      );
    }
  });

  return res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.listAdminQboSyncedOrdersBeforeMarch2026 = catchAsync(
  async (req, res, next) => {
    if (!["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403),
      );
    }

    const { cutoff, date } = req.query;
    const cutoffInput = date ?? cutoff;
    let data;
    try {
      data = await listAdminQboSyncedOrdersBeforeCutoff(cutoffInput);
    } catch (err) {
      if (err.message === "Invalid cutoffDate") {
        return next(new AppError("Invalid cutoff query parameter.", 400));
      }
      throw err;
    }

    return res.status(200).json({
      status: "success",
      results: data.counts.total,
      data,
    });
  },
);

/**
 * POST /api/v1/admin/qbo/payments/delete-admin
 * Body: { orderIds: number[], orderType?: 'customer' | 'local-partner' }
 * Deletes admin QBO payment for each order and clears quickBooksPaymentId in DB.
 */
exports.deleteAdminQboPaymentsForOrders = catchAsync(async (req, res, next) => {
  if (!["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
    return next(
      new AppError("You do not have permission to perform this action.", 403),
    );
  }

  const { orderIds, orderType = "customer" } = req.body || {};
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return next(new AppError("orderIds must be a non-empty array.", 400));
  }

  if (orderType !== "customer" && orderType !== "local-partner") {
    return next(
      new AppError("orderType must be 'customer' or 'local-partner'.", 400),
    );
  }

  let result;
  try {
    result = await deleteAdminQboPaymentsForOrders({ orderIds, orderType });
  } catch (err) {
    if (
      err.message === "orderIds must be a non-empty array." ||
      err.message === "orderIds must contain valid numeric ids." ||
      err.message.includes("Admin QuickBooks is not connected")
    ) {
      return next(new AppError(err.message, 400));
    }
    throw err;
  }

  const { summary } = result;
  const message =
    summary.paymentsFailed === 0
      ? `Removed ${summary.paymentsDeleted} admin QBO payment(s); ${summary.ordersUpdated} order row(s) updated.`
      : `Removed ${summary.paymentsDeleted} payment(s); ${summary.paymentsFailed} failed. ${summary.ordersUpdated} order row(s) updated.`;

  return res.status(200).json({
    status: "success",
    message,
    data: result,
  });
});

/**
 * POST /api/v1/admin/qbo/invoices/delete-admin
 * Body: { orderIds: number[], orderType?: 'customer' | 'local-partner' }
 * Deletes admin QBO invoice per order; clears quickBooksInvoiceId, quickBooksPaymentId, paymentSyncedToQBO.
 */
exports.deleteAdminQboInvoicesForOrders = catchAsync(async (req, res, next) => {
  if (!["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
    return next(
      new AppError("You do not have permission to perform this action.", 403),
    );
  }

  const { orderIds, orderType = "customer" } = req.body || {};
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return next(new AppError("orderIds must be a non-empty array.", 400));
  }

  if (orderType !== "customer" && orderType !== "local-partner") {
    return next(
      new AppError("orderType must be 'customer' or 'local-partner'.", 400),
    );
  }

  let result;
  try {
    result = await deleteAdminQboInvoicesForOrders({ orderIds, orderType });
  } catch (err) {
    if (
      err.message === "orderIds must be a non-empty array." ||
      err.message === "orderIds must contain valid numeric ids." ||
      err.message.includes("Admin QuickBooks is not connected") ||
      err.message.includes("QBO credentials missing")
    ) {
      return next(new AppError(err.message, 400));
    }
    throw err;
  }

  const { summary } = result;
  const message =
    summary.invoicesFailed === 0
      ? `Removed ${summary.invoicesDeleted} admin QBO invoice(s); ${summary.ordersUpdated} order row(s) updated.`
      : `Removed ${summary.invoicesDeleted} invoice(s); ${summary.invoicesFailed} failed. ${summary.ordersUpdated} order row(s) updated.`;

  return res.status(200).json({
    status: "success",
    message,
    data: result,
  });
});

/**
 * POST /api/v1/admin/qbo/invoices/update-admin
 * Body: { orderIds: number[], orderType?: 'customer' | 'local-partner' }
 * Updates existing **admin** QBO invoices only (partner QBO untouched).
 */
exports.updateAdminQboInvoicesForOrders = catchAsync(async (req, res, next) => {
  if (!["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
    return next(
      new AppError("You do not have permission to perform this action.", 403),
    );
  }

  const { orderIds, orderType = "customer" } = req.body || {};
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return next(new AppError("orderIds must be a non-empty array.", 400));
  }

  if (orderType !== "customer" && orderType !== "local-partner") {
    return next(
      new AppError("orderType must be 'customer' or 'local-partner'.", 400),
    );
  }

  let result;
  try {
    result = await updateAdminQboInvoicesForOrders({ orderIds, orderType });
  } catch (err) {
    if (
      err.message === "orderIds must be a non-empty array" ||
      err.message === "orderIds must contain valid numeric ids"
    ) {
      return next(new AppError(`${err.message}.`, 400));
    }
    throw err;
  }

  const { summary } = result;
  const message = `Admin QBO invoice update: ${summary.updated} updated, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.ordersNotFound} id(s) not found.`;

  return res.status(200).json({
    status: "success",
    message,
    data: result,
  });
});

/**
 * POST /api/v1/admin/qbo/payments/sync-admin
 * Body: { orderIds: number[], orderType?: 'customer' | 'local-partner' }
 * Creates/links **admin** QBO payment only (partner QBO untouched).
 */
exports.syncAdminQboPaymentsForOrders = catchAsync(async (req, res, next) => {
  if (!["admin", "adminEmployee", "subAdmin"].includes(req.user?.entity)) {
    return next(
      new AppError("You do not have permission to perform this action.", 403),
    );
  }

  const { orderIds, orderType = "customer" } = req.body || {};
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return next(new AppError("orderIds must be a non-empty array.", 400));
  }

  if (orderType !== "customer" && orderType !== "local-partner") {
    return next(
      new AppError("orderType must be 'customer' or 'local-partner'.", 400),
    );
  }

  let result;
  try {
    result = await syncAdminPaymentsForOrders({ orderIds, orderType });
  } catch (err) {
    if (
      err.message === "orderIds must be a non-empty array" ||
      err.message === "orderIds must contain valid numeric ids" ||
      err.message === "Admin account not found"
    ) {
      return next(new AppError(`${err.message}.`, 400));
    }
    throw err;
  }

  const { summary } = result;
  const message = `Admin QBO payment sync: ${summary.synced} synced, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.ordersNotFound} id(s) not found.`;

  return res.status(200).json({
    status: "success",
    message,
    data: result,
  });
});
