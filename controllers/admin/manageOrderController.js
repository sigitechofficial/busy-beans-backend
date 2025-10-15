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
} = require("../../models");

const fs = require("fs");
const path = require("path");
const {
  paidInvoiceAdminOrLocalPatnerEventAndCustomer,
} = require("../events/paymentInvoicePaidEvent");
const { Op, literal, fn, col } = require("sequelize");
const APIFeatures = require("../../utils/apiFeatures");

const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const Stripe = require("../stripe");
const factory = require("../handlerFactory");
const { response } = require("../../utils/response");
const { supplierNewOrderEvent } = require("../events/orderToSupplierEvents");
const {
  sentPaymentInvoiceEvent,
} = require("../events/sentPaymentInvoiceEvent");
const { orderShippedEvent } = require("../events/orderShippedEvent");
const { orderDispatchEvent } = require("../events/orderDispatchEvent");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");

const {
  processTransferToLocalPartner,
} = require("../../utils/localPatnerCommissionTranfer");

exports.sendInvoice = catchAsync(async (req, res, next) => {
  const details = await order.findOne({
    where: { id: req.params?.orderId },
  });

  if (details?.paymentIntentId || details?.paymentStatus == "done") {
    return next(
      new AppError(
        "As the payment for the order has already been made, we are unable to send an invoice at this point.",
        404
      )
    );
  }
  console.log("🚀 ~ req.body:", req.body);
  await order.update(req.body.order, { where: { id: req.params?.orderId } });

  sentPaymentInvoiceEvent({ orderId: req.params?.orderId });

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
  const listOrder = req.body?.order;
  console.log("🚀 ~ sendInvoiceMultiple ~ Body:", listOrder);
  if (listOrder && listOrder.length > 0) {
    console.log("🚀 ~ sendInvoiceMultiple ~ listOrder:", listOrder);
    for (const ele of listOrder) {
      console.log("🚀 ~ sendInvoiceMultiple ~ orderId:", ele);
      sentPaymentInvoiceEvent({ orderId: ele.orderId });

      await order.update(ele, { where: { id: ele.orderId } });
    }
  }

  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.fetchInvoice = catchAsync(async (req, res, next) => {
  const { details, email } = await dataForEmailAndNotifications(
    req.params.orderId
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
      await order.update(
        { paymentMethod: "card", paymentStatus: "done" },
        { where: { id: req.params.orderId } }
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
  if (!checkSession) await order.update(invoice, { where: { id: details.id } });
  console.log(
    "🚀 ~ exports.fetchInvoice=catchAsync ~ checkSession:",
    checkSession
  );

  // sentPaymentInvoiceEvent({email:to,data:details,invoice})
  return res.status(200).json({
    status: "success",
    data: {
      order: invoice,
    },
  });
});

exports.getAllSalesRep = factory.getAll(statuses);

exports.allOrder = catchAsync(async (req, res, next) => {
  // Build manual conditions based on query/params

  if (
    req.user.entity == "adminEmployee" ||
    req.user.entity == "partnerEmployee"
  ) {
    if (req.query.salesRepId) delete req.query.salesRepId;
  }
  let condition = {};
  if (req.params.id) condition.id = req.params.id;
  console.log("🚀 ~ condition:", condition);
  console.log("🚀 ~ condition:", condition);
  console.log("🚀 ~ condition:", condition);
  console.log("🚀 ~ condition:", condition);
  console.log("🚀 ~ condition:", condition);
  console.log("🚀 ~ condition:", condition);
  console.log("🚀 ~ condition:", condition);
  // Build API features (filter, sort, fields, pagination)
  const features = new APIFeatures(order, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order, etc.)
  const queryOptions = features.getQuery();

  // Merge manual filter conditions
  queryOptions.where = { ...(queryOptions.where || {}), ...condition };

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
            `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
          ),
          "product",
        ],
        [
          literal(
            `(SELECT products.image FROM products WHERE products.id = items.productId LIMIT 1)`
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

  console.log("🚀 ~ req.user.entity:", req.user.entity);
  console.log("🚀 ~ req.user.entity:", req.user.entity);
  console.log("🚀 ~ req.user.entity:", req.user.entity);
  console.log("🚀 ~ req.user.entity:", req.user.entity);
  console.log("🚀 ~ req.user.entity:", req.user.entity);
  console.log("🚀 ~ req.user.entity:", req.user.entity);
  console.log("🚀 ~ req.user.entity:", req.user.entity);
  if (
    req.user.entity == "adminEmployee" ||
    req.user.entity == "partnerEmployee"
  ) {
    queryOptions.include.push({
      model: user,
      where: { employeeId: req.user?.id },
      attributes: [],
    });
  }
  // Custom attributes with literal fields

  queryOptions.attributes = [
    "id",
    [
      literal(
        `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
      ),
      "customerName",
    ],
    [
      literal(
        `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
      ),
      "companyName",
    ],
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`
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
        `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`
      ),
      "salesRepName",
    ],
    [
      literal(
        `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = order.statusId AND orderHistories.orderId = order.id LIMIT 1)`
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
        `CASE WHEN \`on\` <= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END`
      ),
      "overdueInvoice",
    ],
  ];

  // Execute the query
  const doc = await order.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: "success",
    results: doc.length,
    data: {
      data: doc,
    },
  });
});

exports.ordersPendingPullouts = catchAsync(async (req, res, next) => {
  let condition = {
    // paymentStatus: 'done',
    adminReceivableStatus: false,
    // localPatnerCommission: 0.0,
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
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
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
          `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
        ),
        "customerName",
      ],
      [
        literal(
          `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
        ),
        "companyName",
      ],
      [
        literal(
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`
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
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`
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
          `CASE WHEN \`on\` <= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END`
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
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
            ),
            "product",
          ],
          [
            literal(
              `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`
            ),
            "singleUnitWeight",
          ],
          ["weight", "itemWeights"],
          [
            literal(
              `(SELECT products.productCode FROM products WHERE products.id = items.productId LIMIT 1)`
            ),
            "productCode",
          ],
          [
            literal(
              `(SELECT products.grind FROM products WHERE products.id = items.productId LIMIT 1)`
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
        ],
      },
      {
        model: orderHistory,
        attributes: [
          "id",
          [
            literal(
              `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = orderHistories.statusId LIMIT 1)`
            ),
            "orderStatus",
          ],
          [
            literal(
              `(SELECT statuses.discription FROM statuses WHERE statuses.id = orderHistories.statusId LIMIT 1)`
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
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
        ),
        "customerName",
      ],
      [
        literal(
          `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
        ),
        "companyName",
      ],
      [
        literal(
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`
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
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`
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

//*
//! dont need this now
// if(req.body?.orderData?.statusId == 4)processTransferToLocalPartner({orderId:orderId})
exports.orderJourneryComplete = catchAsync(async (req, res, next) => {
  const { orderId, partnerOrderId } = req.body;

  const Model = partnerOrderId ? partnerOrder : order;
  const isPartnerOrder = partnerOrderId ? true : false;
  const doc = await Model.findOne({
    where: { id: orderId || partnerOrderId },
  });

  if (!doc) {
    return next(new AppError("Order not found.", 404));
  }
  const statusId = Number(req.body?.orderData?.statusId);
  const userId = Number(doc?.userId || 0);

  if (req.body?.orderData) {
    req.body.orderData.shippingCompany = "UPS";

    if (statusId === 2 && [267, 279].includes(userId)) {
      req.body.orderData.supplierId = 4;
    }

    await Model.update(req.body?.orderData, {
      where: { id: orderId || partnerOrderId },
    });
  }
  if (req.body?.cheque) {
    req.body.cheque.orderId = orderId;
    req.body.cheque.partnerOrderId = partnerOrderId;
    await chequeDetail.create(req.body?.cheque);
  }

  console.log(
    "🚀 ~ exports.orderJourneryComplete ~ req.body?.orderData?.statusId :",
    req.body?.orderData?.statusId
  );
  if (req.body?.orderData?.statusId) {
    if (req.body?.orderData?.statusId == 2) {
      supplierNewOrderEvent({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "partner-order" : "customer",
      });
    }

    // if (req.body?.orderData?.statusId == 4) {
    // }

    if (req.body?.orderData?.statusId == 5) {
      orderShippedEvent({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "partner-order" : "customer",
      });
      orderDispatchEvent({
        orderId: orderId || partnerOrderId,
        orderType: isPartnerOrder ? "partner-order" : "customer",
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
            { where: { id: doc.id } }
          );
          return next(
            new AppError(
              "As the payment for the order has already been made, we are unable to cancel.",
              404
            )
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
        pdfFilename
      );

      // Check if file exists, then delete
      fs.access(pdfPath, fs.constants.F_OK, (err) => {
        if (!err) {
          fs.unlink(pdfPath, (unlinkErr) => {
            if (unlinkErr) {
              console.error(
                `❌ Failed to delete invoice PDF for order ${order.id}:`,
                unlinkErr
              );
            } else {
              console.log(`🗑️ Deleted invoice PDF: ${pdfFilename}`);
            }
          });
        } else {
          console.warn(
            `⚠️ No invoice PDF found for order ${order.id} at ${pdfPath}`
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
    weight
  );
  const customer = req.params?.id
    ? await userDiscount.findAll({
        where: { userId: req.params?.id },
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
  console.log("🚀 ~ customer:", customer);
  console.log("🚀 ~ req.params?.id:", req.params?.id);
  // Find the shipping company where the weight is between weightFrom and weightTo
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

  if (!shippingCompany) {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        200
      )
    );
  }

  return res.status(200).json({
    status: "success",
    data: {
      charges: shippingCompany?.charges,
      discountPercentage: customer || [],
    },
  });
});

//* UPDATE ORDER
exports.updateOrder = catchAsync(async (req, res, next) => {
  console.log("🚀 ~ req.body:", req.body);
  const fetchedOrder = await order.findOne({
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
      "invoiceNumber",
      "userId",
      [
        literal(
          `(SELECT users.stripeCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`
        ),
        "stripeCustomerId",
      ],
      [
        literal(
          `(SELECT salesReps.connectAccountId FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`
        ),
        "connectAccountId",
      ],
    ],
  });

  const placedOrder = JSON.parse(JSON.stringify(fetchedOrder));

  if (!placedOrder) {
    return next(new AppError("Order not found.", 404));
  } else if (placedOrder.paymentStatus == "done") {
    return next(
      new AppError(
        "The order payment has already been made. You may proceed with the update.",
        404
      )
    );
  }

  if (req.body?.order) {
    await order.update(req.body?.order, { where: { id: placedOrder.id } });
  }

  let checkSession = false;

  if (placedOrder?.invoiceId) {
    const session = await Stripe.checkCheckoutSessionStatus(
      placedOrder?.invoiceId
    );
    console.log("🚀 ~ exports.fetchInvoice=catchAsync ~ session:", session);

    if (session == "paid") {
      await order.update(
        { paymentMethod: "card", paymentStatus: "done" },
        { where: { id: placedOrder.id } }
      );

      return next(
        new AppError(
          "As the payment for the order has already been made, we are unable to update an invoice at this point.",
          404
        )
      );
    } else if (session == "open") {
      checkSession = true;
    }
  }

  if (checkSession) await Stripe.blockCheckoutSession(placedOrder?.invoiceId);

  const input = req.body;
  input.order.invoiceId = null;
  input.order.hostedInvoiceUrl = null;
  input.items = req.body.items;

  // console.log('🚀 ~ exports.bookOrder=catchAsync ~ input:', input);

  if (input?.items?.length < 1 && input?.typeCharges?.length < 1) {
    throw new AppError("Update possible, but no changes were made.", 404);
  }

  let productIds = input?.items.map((item) => item.productId);
  let totalWeight = 0;
  let itemsPrice = 0;
  let discountOnItemsPrice = 0;
  let totalLocalPatnerCommission = 0;

  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds);
  const products = await product.findAll({
    where: {
      id: {
        [Op.in]: productIds,
      },
    },
    attributes: [
      `id`,
      `name`,
      `quantity`,
      `price`,
      `categoryId`,
      `wholesalePrice`,
      `weight`,
      `sku`,
      `grind`,
      `productCode`,
      [
        literal(`
            (SELECT percentage
            FROM userDiscounts
            WHERE userDiscounts.categoryId = product.categoryId
              AND userDiscounts.userId = ${placedOrder?.userId}
            LIMIT 1)
          `),
        "discountPercentage",
      ],
    ],
  });

  // let percentageDiscount = input?.order?.discountPercentage
  //   ? input.order?.discountPercentage
  //   : 0;

  console.log(
    "🚀 ~ exports.bookOrder=catchAsync ~ products:",
    products?.length
  );

  const finalItems = products.map((obj) => {
    const element = {};
    const percentageDiscount = parseFloat(
      obj.dataValues?.discountPercentage || 0
    );
    element.productId = obj.id;
    // console.log("🚀 ~ finalItems ~ obj:", obj)

    // Find the matching product in input.items based on productId
    let prod = input?.items.find((item) => item.productId == obj.id);

    // Set the qty from input.items or default to 1 if not found
    let qty = prod ? parseInt(prod.qty) : 1;
    console.log("🚀 ~ finalItems ~ qty:", qty);
    element.qty = qty;
    // Calculate price, wholesalePrice, and weight for the item
    element.categoryId = obj.categoryId;
    element.price = obj.price * qty;
    console.log("🚀 ~  element.price :", element.price);
    element.wholesalePrice = obj.wholesalePrice * qty;
    element.weight = obj.weight * qty;
    element.orderId = placedOrder?.id;
    element.orderFrequencyId = placedOrder?.orderFrequencyId;

    element.discount = 0;
    if (percentageDiscount > 0) {
      // Calculate discount amount
      const discountAmount = (element.price * percentageDiscount) / 100;
      // Calculate final price after discount
      const discountedPrice = element.price - discountAmount;

      element.price = discountedPrice;
      element.discount = discountAmount;
    }
    // Accumulate the total weight and price
    discountOnItemsPrice += element.discount;
    itemsPrice += element.price;
    console.log("🚀 ~ itemsPrice:", itemsPrice);
    totalWeight += element.weight;

    // Handle salesRep commission if applicable
    if (placedOrder?.salesRepId) {
      element.salerCommission =
        parseFloat(element.price) - parseFloat(element.wholesalePrice);
      totalLocalPatnerCommission += element.salerCommission || 0;
    } else {
      element.wholesalePrice = 0;
      element.salerCommission = 0;
    }

    return element; // Return the transformed element
  });

  if (req.body?.typeCharges?.length > 0) {
    console.log(
      "🚀 ~ req.body?.typeCharges?.length:",
      req.body?.typeCharges?.length
    );
    req.body?.typeCharges.forEach((obj) => {
      const element = {};
      element.code = obj.code;
      element.qty = obj.qty;
      element.price = obj.total;
      console.log("🚀 ~  element.price = obj.typeCharges;:", obj.price);
      element.productName = obj.name;
      element.orderId = placedOrder?.id;
      element.type = "charges";
      element.orderFrequencyId = placedOrder?.orderFrequencyId;
      element.discount = 0;

      itemsPrice += parseFloat(element?.price || 0);
      console.log("🚀 ~ itemsPrice TYPR CHARGES:", itemsPrice);

      // Handle salesRep commission if applicable
      if (placedOrder?.salesRepId) {
        element.salerCommission = parseFloat(element?.price);
        totalLocalPatnerCommission += element.salerCommission || 0;
      } else {
        element.wholesalePrice = 0;
        element.salerCommission = 0;
      }

      finalItems.push(element);
    });
  }

  console.log("🚀 ~ finalItems:", finalItems);

  let shippingCompany;
  if (!req.body?.order?.shippingCharges) {
    shippingCompany = await shippingCompanies.findOne({
      where: {
        weightFrom: {
          [Op.lte]: totalWeight, // Less than or equal to the weight
        },
        weightTo: {
          [Op.gte]: totalWeight, // Greater than or equal to the weight
        },
      },
      attributes: ["charges"],
    });
    if (!shippingCompany) {
      return next(
        new AppError(
          "Not dealing in such weights. Contact customer support for this order.",
          400
        )
      );
    }
  }

  input.order.itemsPrice = itemsPrice;
  input.order.discountPrice = discountOnItemsPrice;
  // input.order.discountPercentage = percentageDiscount;
  input.order.invoiceNumber = req.body?.order?.invoiceNumber;
  input.order.totalWeight = parseFloat(totalWeight);
  input.order.shippingCompany =
    input.order.totalWeight > 400 ? `Shipping By Truck` : "UPS";
  input.order.invoicePdf = 1;
  input.order.shippingCharges =
    req.body?.order?.shippingCharges || shippingCompany?.charges;
  input.order.subTotal = itemsPrice + parseFloat(input?.order?.vat || 0);
  input.order.totalBill =
    itemsPrice +
    parseFloat(input?.order?.vat || 0) +
    parseFloat(req.body?.order?.shippingCharges || shippingCompany?.charges);

  if (placedOrder.invoiceDate) {
    delete input.order.invoiceDate;
  }
  await order.update(input?.order, { where: { id: placedOrder?.id } });
  await item.destroy({ where: { orderId: placedOrder?.id } });
  await item.bulkCreate(finalItems);
  const pdfFilename = `invoice-00${placedOrder.id}.pdf`; // or `inv-${order.id}.pdf` if you're using dash
  const pdfPath = path.join(__dirname, "../../public/invoicePDFs", pdfFilename);

  // Check if file exists, then delete
  fs.access(pdfPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `❌ Failed to delete invoice PDF for order ${placedOrder.id}:`,
            unlinkErr
          );
        } else {
          console.log(`🗑️ Deleted invoice PDF: ${pdfFilename}`);
        }
      });
    } else {
      console.warn(
        `⚠️ No invoice PDF found for order ${placedOrder.id} at ${pdfPath}`
      );
    }
  });

  if (input?.order?.paymentCardId) {
    const payment = await Stripe.createPaymentIntent({
      adminReceivableAmount: input.order.totalBill,
      hasLocalPatner: placedOrder.salesRepId,
      localPartnerAccountId: placedOrder.connectAccountId,
      localPatnerCommission: totalLocalPatnerCommission,
      paymentMethodId: input?.order?.paymentCardId,
      stripeCustomer: placedOrder?.stripeCustomerId,
      metadata: {
        orderId: placedOrder.id,
        invoiceNumber: placedOrder.invoiceNumber,
      },
    });

    // console.log("🚀 ~ payment:", payment)

    if (payment && payment?.status) {
      await order.update(payment?.data, { where: { id: placedOrder?.id } });
      paidInvoiceAdminOrLocalPatnerEventAndCustomer({
        orderId: placedOrder?.id,
      });
      return res.status(200).json({
        status: "success",
        message: "Payment capture success",
        data: { id: req.params.orderId },
      });
    } else {
      return res.status(200).json({
        status: "success",
        message: payment?.message || "Payment failed",
        data: { id: req.params.orderId },
      });
    }
  }

  if (
    input?.order?.emailInvoiceToCustomer &&
    !input?.order?.attemptImmediatePayment
  ) {
    sentPaymentInvoiceEvent({ orderId: placedOrder?.id });
  }
  return res.status(200).json({
    status: "success",
    message: "success",
    data: { id: req.params.orderId },
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
           ${employeeId ? `AND users.employeeId = ${employeeId}` : ""})`
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
             ${employeeFilterLiteral})`
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
  }
);

exports.orderNavigationCountsSupplier = catchAsync(async (req, res, next) => {
  const data = await statuses.findAll({
    attributes: [
      "id",
      "orderStatus",
      [
        literal(
          `(SELECT COUNT(id) FROM orders WHERE orders.statusId = statuses.id AND orders.supplierId = ${req.params?.id})`
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
        400
      )
    );
  } else if (placedOrder.statusId >= 4) {
    return next(
      new AppError(
        "This order has already been dispatched and cannot be deleted.",
        400
      )
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
            `❌ Failed to delete invoice PDF for order ${placedOrder.id}:`,
            unlinkErr
          );
        } else {
          console.log(`🗑️ Deleted invoice PDF: ${pdfFilename}`);
        }
      });
    } else {
      console.warn(
        `⚠️ No invoice PDF found for order ${placedOrder.id} at ${pdfPath}`
      );
    }
  });

  return res.status(200).json({
    status: "success",
    data: {},
  });
});
