const {
  countryInSystem,
  stateInSystem,
  territory,
  cityInSystem,
  address,
  billingAddress,
  product,
  user,
  partnerOrder,
  partnerOrderItem,
  orderHistory,
  shippingCompanies,
  supplier,
  salesRep,
  chequeDetail,
  statuses,
  orderFrequency,
  account,
} = require("../../models");

const fs = require("fs");
const path = require("path");
const Stripe = require("../stripe");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { Op, literal, fn, col, where, or } = require("sequelize");
const APIFeatures = require("../../utils/apiFeatures");
const {
  orderEvents,
  orderEventsToLocalPatnerOrAdmin,
} = require("../events/orderEvents");

const {
  syncInvoiceOnQuikBooks,
  updateInvoiceOnQuickBooks,
} = require("../../services/syncInvoiceOnQBO");

const {
  importCustomersToQuickBooks,
} = require("../../services/qboCustomerService");

const {
  syncPaymentToQuickBooks,
} = require("../../services/paymentSyncService");

const {
  paidInvoiceAdminOrLocalPatnerEventAndCustomer,
} = require("../events/paymentInvoicePaidEvent");

const {
  sentPaymentInvoiceEvent,
} = require("../events/sentPaymentInvoiceEvent");

exports.bookNewPartnerOrder = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log("🚀 ~ exports.bookNewOrder=catchAsync ~ input:", input);

  const isLocalPartnerOrEmployee =
    req.user?.entity === "localPartner" ||
    req.user?.entity === "partnerEmployee";
  const isAdminOrEmployee =
    req.user?.entity === "admin" || req.user?.entity === "adminEmployee";

  let salesRepId;
  if (isLocalPartnerOrEmployee) {
    if (!req.user?.localPartnerId) {
      return next(
        new AppError("Local partner ID not found in user data.", 403),
      );
    }
    salesRepId = req.user.localPartnerId;
  } else if (isAdminOrEmployee) {
    const fromBody = req.body?.order?.salesRepId ?? req.query?.salesRepId;
    if (!fromBody) {
      return next(
        new AppError(
          "salesRepId (in body order or query) is required for admin users.",
          400,
        ),
      );
    }
    salesRepId = fromBody;
  } else {
    return next(
      new AppError("This route is only accessible to authorized users.", 403),
    );
  }

  if (!input?.order) input.order = {};
  input.order.salesRepId = salesRepId;

  if (!input?.order?.shippingCharges) {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400,
      ),
    );
  }

  input.order.statusId = input.order?.invoiceOnly ? 5 : 1;

  let itemsPrice = 0;
  let discountOnItemsPrice = 0;
  let totalWeight = 0;
  let productIds = input?.items.map((item) => item.productId);
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds);
  const productAttributes = [
    "id",
    "name",
    "quantity",
    "price",
    "categoryId",
    "weight",
    "sku",
    "grind",
    "productCode",
  ];
  productAttributes.push([
    literal(
      `(SELECT COALESCE(
        (SELECT srpp.wholesalePrice FROM salesRepProductPrices srpp 
         WHERE srpp.productId = product.id 
           AND srpp.salesRepId = ${salesRepId} 
           AND srpp.deleted = 0 
         LIMIT 1),
        product.wholesalePrice
      ))`,
    ),
    "wholesalePrice",
  ]);

  const products = await product.findAll({
    where: {
      id: {
        [Op.in]: productIds,
      },
    },
    attributes: productAttributes,
  });

  const finalItems = products.map((obj) => {
    const element = {};
    const percentageDiscount = parseFloat(
      obj.dataValues?.discountPercentage || 0,
    );
    element.productId = obj.id;
    element.categoryId = obj?.categoryId;

    // Find the matching product in input.items based on productId
    let prod = input?.items.find((item) => item.productId == obj.id);

    // Set the qty from input.items or default to 1 if not found
    let qty = prod ? parseInt(prod.qty) : 1;
    console.log("🚀 ~ finalItems ~ qty:", qty);
    element.qty = qty;
    const wholesalePrice = parseFloat(obj.wholesalePrice ?? 0);
    element.price = wholesalePrice * qty;
    element.weight = obj.weight * qty;
    element.categoryId = obj.categoryId;
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
    totalWeight += element.weight;
    // Handle salesRep commission if applicable
    // if (customer?.salesRepId) {
    //   element.salerCommission =
    //     parseFloat(element.price) - parseFloat(element.wholesalePrice || 0);
    // } else {
    //   element.wholesalePrice = 0;
    // }
    return element; // Return the transformed element
  });

  // Handle typeCharges if provided
  if (input?.typeCharges?.length > 0) {
    console.log(
      "🚀 ~ req.body?.typeCharges?.length:",
      input?.typeCharges?.length,
    );
    input?.typeCharges.forEach((obj) => {
      const element = {};
      element.code = obj.code;
      element.qty = obj.qty;
      element.price = obj.total;
      console.log("🚀 ~  element.price = obj.total;:", obj.total);
      element.productName = obj.name;
      element.type = "charges";
      element.discount = 0;

      itemsPrice += parseFloat(element?.price || 0);
      console.log("🚀 ~ itemsPrice TYPE CHARGES:", itemsPrice);

      // Handle salesRep commission if applicable
      // For partner orders, commission handling may differ
      element.wholesalePrice = 0;
      element.salerCommission = 0;

      finalItems.push(element);
    });
  }

  const shippingCompany = input.order?.invoiceOnly
    ? { charges: req.body?.order?.shippingCharges || 0 }
    : await shippingCompanies.findOne({
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
        400,
      ),
    );
  }

  console.log("🚀 ~ shippingCompany:", shippingCompany);
  input.order.itemsPrice = itemsPrice;
  input.order.discountPrice = discountOnItemsPrice;
  // input.order.discountPercentage = percentageDiscount;
  input.order.shippingCharges = shippingCompany?.charges;
  input.order.totalWeight = parseFloat(totalWeight || 0);
  input.order.shippingCompany =
    input.order.totalWeight > 400 ? `Shipping By Truck` : "UPS";
  input.order.subTotal = itemsPrice + parseFloat(input.order.vat || 0);
  input.order.totalBill =
    parseFloat(itemsPrice) +
    parseFloat(input?.order?.vat || 0) +
    parseFloat(shippingCompany?.charges || 0);

  const newOrder = await partnerOrder.create(input?.order);
  newOrder.invoiceNumber = `INV00${newOrder?.id}`;
  await newOrder.save();

  await orderHistory.bulkCreate([
    {
      statusId: 1,
      partnerOrderId: newOrder.id,
      on: Date.now(),
    },
  ]);

  finalItems.forEach((element) => {
    element.partnerOrderId = newOrder.id;
  });
  console.log("🚀 ~ finalItems:", finalItems);

  const allitems = await partnerOrderItem.bulkCreate(finalItems);

  //   if (newOrder.frequency != "just-onces")
  //     setOrderFrequency({
  //       orderData: newOrder,
  //       salesRepId: customer?.salesRepId,
  //     });

  if (finalItems && finalItems?.length > 0) {
    orderEventsToLocalPatnerOrAdmin({
      orderId: newOrder?.id,
      orderType: "local-partner",
    });
    orderEvents({ orderId: newOrder?.id, orderType: "local-partner" });
  }

  return res.status(200).json({
    status: "success",
    data: { id: newOrder?.id, allitems },
  });
});

exports.allPartnerOrder = catchAsync(async (req, res, next) => {
  // Build manual conditions based on query/params
  if (
    req.user.entity == "adminEmployee" ||
    req.user.entity == "partnerEmployee"
  ) {
    if (req.query.salesRepId) delete req.query.salesRepId;
  }

  // Handle type parameter BEFORE APIFeatures processes it
  // Logic:
  // - If type is not sent → default to "regular-order"
  // - If type === "all" → don't filter by type (remove from query)
  // - If type has any other value → use that value
  let typeCondition = null;
  const hasTypeParam =
    req.query?.type !== undefined && req.query?.type !== null;

  if (hasTypeParam) {
    if (req.query.type === "all") {
      delete req.query.type; // Remove from query so APIFeatures doesn't process it
      // typeCondition remains null, so we won't set type in condition
    } else {
      typeCondition = req.query.type;
      delete req.query.type; // Remove from query, we'll handle it manually
    }
  }

  let condition = {};
  if (req.params.id) condition.id = req.params.id;

  // Define searchable columns for partner orders
  const searchableFields = [
    "id",
    "invoiceNumber",
    "poNumber",
    "note",
    "paymentMethod",
    "shippingCompany",
    "trackingNumber",
  ];

  // Build API features (filter, search, sort, fields, pagination)
  const features = new APIFeatures(partnerOrder, req.query)
    .filter()
    .search(searchableFields) // Add search functionality
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order, etc.)
  const queryOptions = features.getQuery();

  if (req?.params?.qbo == "not-synced") {
    if (["admin", "adminEmployee"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceId = { [Op.or]: [null, ""] };
    }
    condition[Op.or] = [
      { invoiceDate: { [Op.ne]: null } },
      { paymentStatus: "done" },
    ];
  } else if (req?.params?.qbo == "synced") {
    if (["admin", "adminEmployee"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceId = { [Op.ne]: null };
    }
  } else if (req?.params?.qbo == "unsynced-paid") {
    if (["admin", "adminEmployee"].includes(req.user?.entity)) {
      condition.quickBooksInvoiceId = { [Op.ne]: null };
      condition.quickBooksPaymentId = { [Op.or]: [null, ""] };
    }
    condition.paymentStatus = "done";
  } else if (req?.params?.qbo == "synced-paid") {
    if (["admin", "adminEmployee"].includes(req.user?.entity)) {
      condition.quickBooksPaymentId = { [Op.ne]: null };
    }
  } else {
    // Handle type condition:
    // - If type was not sent → default to "regular-order"
    // - If type === "all" → don't set type (no filter)
    // - If type has other value → use that value
    if (!hasTypeParam) {
      // Type parameter was not sent, default to "regular-order"
      condition.type = "regular-order";
    } else if (typeCondition) {
      // Type was sent and has a value (not "all"), use that value
      condition.type = typeCondition;
    }
    // If type === "all", typeCondition is null, so we don't set condition.type (no filter)
  }

  // Remove type from queryOptions.where if it was added by APIFeatures (shouldn't happen now, but safety check)
  if (queryOptions.where?.type === "all") {
    delete queryOptions.where.type;
  }

  // Merge manual filter conditions
  if (req.user.entity == "localPartner") {
    condition.salesRepId = req.user.localPartnerId;
  }

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
  console.log("🚀 ~ queryOptions.where:", queryOptions.where);
  // Add your custom includes
  queryOptions.include = [
    {
      model: partnerOrderItem,
      attributes: [
        "id",
        [
          literal(
            `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
          ),
          "product",
        ],
        [
          literal(
            `(SELECT products.image FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
          ),
          "image",
        ],
        "qty",
        "price",
        "discount",
        "partnerOrderId",
        "productId",
      ],
    },
  ];
  // Custom attributes with literal fields

  queryOptions.attributes = [
    "id",
    "type",
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = partnerOrder.statusId LIMIT 1)`,
      ),
      "orderCurrentStatus",
    ],

    [
      literal(`COALESCE(
         (SELECT SUM(qty)
          FROM partnerOrderItems
          WHERE partnerOrderItems.partnerOrderId = partnerOrder.id ), 0)`),
      "totalQuantity",
    ],
    [
      literal(
        `(SELECT salesReps.srName FROM salesReps WHERE partnerOrder.salesRepId = salesReps.id LIMIT 1)`,
      ),
      "salesRepName",
    ],
    [
      literal(
        `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = partnerOrder.statusId AND orderHistories.partnerOrderId = partnerOrder.id LIMIT 1)`,
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
  const pagination = await features.getPaginationMetadata(partnerOrder, {
    include: queryOptions.include,
    where: condition, // Pass additional where conditions (will be merged with filter and search conditions)
  });

  // Execute the query
  const doc = await partnerOrder.findAll(queryOptions);

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

exports.partnerOrderDetails = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;

  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition);

  const doc = await partnerOrder.findOne({
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
        model: chequeDetail,
        attributes: {
          exclude: ["createdAt", "updatedAt", "deletedAt"],
        },
      },
      {
        model: partnerOrderItem,
        attributes: [
          "id",
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
            ),
            "product",
          ],
          [
            literal(
              `(SELECT products.weight FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
            ),
            "singleUnitWeight",
          ],
          ["weight", "itemWeights"],
          [
            literal(
              `(SELECT products.productCode FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
            ),
            "productCode",
          ],
          [
            literal(
              `(SELECT products.grind FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
            ),
            "grind",
          ],
          [
            literal(`
            (SELECT supplierSku
            FROM skuSuppliers
            WHERE skuSuppliers.productId = partnerOrderItems.productId
              AND skuSuppliers.supplierId = partnerOrder.supplierId
            LIMIT 1)
          `),
            "supplierSku",
          ],
          "qty",
          "productName",
          "price",
          "discount",
          "partnerOrderId",
          "productId",
          "type",
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
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = partnerOrder.statusId LIMIT 1)`,
        ),
        "orderCurrentStatus",
      ],
      [
        literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE partnerOrderItems.partnerOrderId = partnerOrder.id ), 0)`),
        "totalQuantity",
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE partnerOrder.salesRepId = salesReps.id LIMIT 1)`,
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
      "paymentLinkOpenCount",
      "paymentLinkFirstOpenedAt",
      "paymentLinkLastOpenedAt",
      "invoiceEmailSentCount",
    ],
  });

  if (!doc) {
    return next(new AppError("Data not found!", 400));
  }
  if (!doc?.salesRep?.qboCustomerId) {
    importCustomersToQuickBooks({
      limitIds: [doc?.salesRep?.id],
      userType: "local-partner",
      req,
    });
  }

  const output = JSON.parse(JSON.stringify(doc));
  output.items = output.partnerOrderItems;
  output.partnerOrderItems = undefined;
  output.partnerOrderDetail = true;
  if (req?.user?.entity == "localPartner") {
    output.selfOrder = true;
  }

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

  res.status(200).json({
    status: "success",
    data: {
      order: output,
      adminAddress: adm,
    },
  });
});

//* UPDATE ORDER
exports.updatePartnerOrder = catchAsync(async (req, res, next) => {
  console.log("🚀 ~ req.body:", req.body);
  const fetchedOrder = await partnerOrder.findOne({
    where: { id: req.params.orderId },
    attributes: [
      "id",
      "supplierId",
      "paymentStatus",
      "salesRepId",
      "invoiceId",
      //   "orderFrequencyId",
      "quickBooksInvoiceId",
      "invoiceDate",
      "invoiceReminder",
      "invoicePaidDate",
      "invoiceNumber",
      //   "userId",
      [
        literal(
          `(SELECT stripeCustomerId FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
        ),
        "stripeCustomerId",
      ],
      //   [
      //     literal(
      //       `(SELECT salesReps.connectAccountId FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`
      //     ),
      //     "connectAccountId",
      //   ],
    ],
  });

  const placedOrder = JSON.parse(JSON.stringify(fetchedOrder));

  if (!placedOrder) {
    return next(new AppError("Order not found.", 404));
  } else if (placedOrder.paymentStatus == "done") {
    return next(
      new AppError(
        "The order payment has already been made. You may proceed with the update.",
        404,
      ),
    );
  }

  if (req.body?.order) {
    await partnerOrder.update(req.body?.order, {
      where: { id: placedOrder.id },
    });
  }

  let checkSession = false;

  if (placedOrder?.invoiceId) {
    const session = await Stripe.checkCheckoutSessionStatus(
      placedOrder?.invoiceId,
    );

    if (session == "paid") {
      await partnerOrder.update(
        { paymentMethod: "card", paymentStatus: "done" },
        { where: { id: placedOrder.id } },
      );

      return next(
        new AppError(
          "As the payment for the order has already been made, we are unable to update an invoice at this point.",
          404,
        ),
      );
    } else if (session == "open") {
      checkSession = true;
    }
  }

  if (checkSession) await Stripe.blockCheckoutSession(placedOrder?.invoiceId);

  const input = req.body;
  console.log("🚀 ~ input:", input);
  input.order.invoiceId = null;
  input.order.hostedInvoiceUrl = null;
  input.items = req.body.items;

  // console.log('🚀 ~ exports.bookOrder=catchAsync ~ input:', input);

  if (input?.items?.length < 1 && input?.typeCharges?.length < 1) {
    throw new AppError("Update possible, but no changes were made.", 404);
  }

  let productIds = input?.items.map((item) => item.productId);
  console.log("🚀 ~  input?.items:", input?.items);
  let totalWeight = 0;
  let itemsPrice = 0;
  let discountOnItemsPrice = 0;
  let totalLocalPatnerCommission = 0;

  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds);
  const productAttributes = [
    "id",
    "name",
    "quantity",
    "price",
    "categoryId",
    "weight",
    "sku",
    "grind",
    "productCode",
  ];
  productAttributes.push([
    literal(
      `(SELECT COALESCE(
        (SELECT srpp.wholesalePrice FROM salesRepProductPrices srpp 
         WHERE srpp.productId = product.id 
           AND srpp.salesRepId = ${placedOrder.salesRepId} 
           AND srpp.deleted = 0 
         LIMIT 1),
        product.wholesalePrice
      ))`,
    ),
    "wholesalePrice",
  ]);

  const products = await product.findAll({
    where: {
      id: {
        [Op.in]: productIds,
      },
    },
    attributes: productAttributes,
  });

  console.log(
    "🚀 ~ exports.bookOrder=catchAsync ~ products:",
    products?.length,
  );

  const finalItems = products.map((obj) => {
    const element = {};
    const percentageDiscount = parseFloat(
      obj.dataValues?.discountPercentage || 0,
    );
    element.productId = obj.id;
    element.categoryId = obj?.categoryId;

    // Find the matching product in input.items based on productId
    let prod = input?.items.find((item) => item.productId == obj.id);

    // Set the qty from input.items or default to 1 if not found
    let qty = prod ? parseInt(prod.qty) : 1;
    console.log("🚀 ~ finalItems ~ qty:", qty);
    element.qty = qty;
    element.partnerOrderId = placedOrder?.id;
    const wholesalePrice = parseFloat(obj.wholesalePrice ?? 0);
    element.price = wholesalePrice * qty;
    element.weight = obj.weight * qty;
    element.categoryId = obj.categoryId;
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
    totalWeight += element.weight;
    // Handle salesRep commission if applicable
    // if (customer?.salesRepId) {
    //   element.salerCommission =
    //     parseFloat(element.price) - parseFloat(element.wholesalePrice || 0);
    // } else {
    //   element.wholesalePrice = 0;
    // }
    return element; // Return the transformed element
  });

  if (req.body?.typeCharges?.length > 0) {
    console.log(
      "🚀 ~ req.body?.typeCharges?.length:",
      req.body?.typeCharges?.length,
    );
    req.body?.typeCharges.forEach((obj) => {
      const element = {};
      element.code = obj.code;
      element.qty = obj.qty;
      element.partnerOrderId = placedOrder?.id;
      element.price = obj.total;
      console.log("🚀 ~  element.price = obj.typeCharges;:", obj.price);
      element.productName = obj.name;
      element.type = "charges";
      //   element.orderFrequencyId = placedOrder?.orderFrequencyId;
      element.discount = 0;

      itemsPrice += parseFloat(element?.price || 0);
      console.log("🚀 ~ itemsPrice TYPR CHARGES:", itemsPrice);

      // Handle salesRep commission if applicable

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
      if (totalWeight > 400) {
        shippingCompany = { charges: 400 };
      } else {
        return next(
          new AppError(
            "Not dealing in such weights. Contact customer support for this order.",
            400,
          ),
        );
      }
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

  if (placedOrder?.invoiceDate) {
    delete input.order.invoiceDate;
  }
  await partnerOrder.update(input?.order, { where: { id: placedOrder?.id } });
  await partnerOrderItem.destroy({
    where: { partnerOrderId: placedOrder?.id },
  });
  console.log("🚀 ~ finalItems:", finalItems);
  await partnerOrderItem.bulkCreate(finalItems);
  const pdfFilename = `invoice-00${placedOrder.id}.pdf`; // or `inv-${order.id}.pdf` if you're using dash
  const pdfPath = path.join(__dirname, "../../public/invoicePDFs", pdfFilename);

  // Check if file exists, then delete
  fs.access(pdfPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(
            `❌ Failed to delete invoice PDF for order ${placedOrder.id}:`,
            unlinkErr,
          );
        } else {
          console.log(`🗑️ Deleted invoice PDF: ${pdfFilename}`);
        }
      });
    } else {
      console.warn(
        `⚠️ No invoice PDF found for order ${placedOrder.id} at ${pdfPath}`,
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
      await partnerOrder.update(payment?.data, {
        where: { id: placedOrder?.id },
      });
      paidInvoiceAdminOrLocalPatnerEventAndCustomer({
        orderId: placedOrder?.id,
        orderType: "local-partner",
      });
      syncPaymentToQuickBooks({
        orderId: placedOrder.id,
        orderType: "local-partner",
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

  if (true) {
    console.log("🚀 ~ true:", true);
    sentPaymentInvoiceEvent({
      orderId: placedOrder?.id,
      orderType: "local-partner",
    });
  }

  console.log(
    "🚀 ~ placedOrder?.quickBooksInvoiceId:",
    placedOrder?.quickBooksInvoiceId,
  );
  console.log(
    "🚀 ~ placedOrder?.quickBooksInvoiceId:",
    placedOrder?.quickBooksInvoiceId,
  );

  if (!placedOrder?.quickBooksInvoiceId) {
    syncInvoiceOnQuikBooks({
      orderId: placedOrder.id,
      orderType: "local-partner",
    });
  } else {
    console.log("🚀 ~ syncInvoiceOnQuikBooks ------ ~FALSE:");
    updateInvoiceOnQuickBooks({
      orderId: placedOrder.id,
      orderType: "local-partner",
    });
  }

  return res.status(200).json({
    status: "success",
    message: "success",
    data: { id: req.params.orderId },
  });
});

exports.fetchSavedPaymentMethods = async (req, res, next) => {
  const userId = req.params.id;

  const partner = await salesRep.findByPk(req.params.id, {
    attributes: ["email", "stripeCustomerId"],
  });
  if (partner.stripeCustomerId === null || partner.stripeCustomerId === "") {
    const output = response({ message: "All cards", data: { cards: [] } });
    return res.status(200).json(output);
  }
  const customerId = partner.stripeCustomerId;
  const allCards = await Stripe.cards(customerId);
  console.log("🚀 ~ ~ customerId:", customerId);

  const stripeCards = allCards.data.map((obj) => ({
    id: obj.id,
    name: obj.billing_details.name,
    brand: obj.card.brand,
    expMonth: obj.card.exp_month,
    expYear: obj.card.exp_year,
    last4: obj.card.last4,
    funding: obj.card.funding,
  }));

  console.log("🚀 ~ stripeCards ~ stripeCards:", stripeCards);

  const output = response({ data: { cards: stripeCards } });

  return res.status(200).json(output);
};

exports.partnerOrderNavigationCounts = catchAsync(async (req, res, next) => {
  let employeeId = null;
  //   if (req.user.entity == "adminEmployee") {
  //     employeeId = req.user?.id;
  //   }

  // Query to count orders based on employeeId
  const data = await statuses.findAll({
    attributes: [
      "id",
      "orderStatus",
      [
        literal(
          `(SELECT COUNT(partnerOrders.id) 
           FROM partnerOrders  WHERE partnerOrders.statusId = statuses.id
           AND partnerOrders.type = 'regular-order'
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

  //   const upcommingOrderCount = employeeId
  //     ? await orderFrequency.count({
  //         where: {
  //           ...condition,
  //           nextOrderDate: {
  //             [Op.not]: literal(`
  //         (SELECT DATE(partnerOrders.on)
  //          FROM partnerOrders
  //          JOIN users ON users.id = partnerOrders.userId
  //          WHERE DATE(partnerOrders.on) = DATE(orderFrequency.nextOrderDate)
  //          AND partnerOrders.orderFrequencyId = orderFrequency.id
  //          ${employeeId ? `AND users.employeeId = ${employeeId}` : ""})
  //       `),
  //           },
  //         },
  //       })
  //     : await orderFrequency.count({
  //         where: {
  //           ...condition,
  //           nextOrderDate: {
  //             [Op.notIn]: literal(`
  //           (SELECT DATE(orders.on)
  //           FROM orders
  //           WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate)
  //           AND orders.orderFrequencyId = orderFrequency.id)
  //         `),
  //           },
  //         },
  //       });

  const output = JSON.parse(JSON.stringify(data));

  //   output.push({
  //     id: 7,
  //     orderStatus: "Upcomming Orders",
  //     count: upcommingOrderCount,
  //   });

  return res.status(200).json({
    status: "success",
    data: output,
  });
});

exports.partnerOrderNavigationCountsLocalPatner = catchAsync(
  async (req, res, next) => {
    let employeeId = null;
    if (req.user.entity === "partnerEmployee") {
      employeeId = req.user?.id;
    }

    // Define the literals for both scenarios
    const employeeFilterLiteral = employeeId
      ? ``
      : `AND partnerOrders.salesRepId = ${req.params?.srId}`; // If employeeId is null, check for salesRepId

    const upcomingOrderCountLiteral = employeeId
      ? ``
      : `AND partnerOrders.salesRepId = ${req.params?.srId}`; // If employeeId is null, check for salesRepId

    // Query to count orders based on employeeId (handling both cases for employeeId)
    const data = await statuses.findAll({
      attributes: [
        "id",
        "orderStatus",
        [
          literal(
            `(SELECT COUNT(partnerOrders.id) 
             FROM partnerOrders 
             WHERE partnerOrders.statusId = statuses.id 
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
    // const upcommingOrderCount = await orderFrequency.count({
    //   where: {
    //     ...condition,
    //     nextOrderDate: {
    //       [Op.notIn]: literal(`
    //         (SELECT DATE(partnerOrders.on)
    //          FROM partnerOrders
    //          WHERE DATE(partnerOrders.on) = DATE(orderFrequency.nextOrderDate)
    //          AND partnerOrders.orderFrequencyId = orderFrequency.id
    //          ${upcomingOrderCountLiteral})
    //       `),
    //     },
    //   },
    // });
    const output = JSON.parse(JSON.stringify(data));
    // output.push({
    //   id: 7,
    //   orderStatus: "Upcomming Orders",
    //   count: upcommingOrderCount,
    // });

    return res.status(200).json({
      status: "success",
      data: output,
    });
  },
);

exports.partnerOrderNavigationCountsSupplier = catchAsync(
  async (req, res, next) => {
    const data = await statuses.findAll({
      attributes: [
        "id",
        "orderStatus",
        [
          literal(
            `(SELECT COUNT(id) FROM partnerOrders WHERE partnerOrders.statusId = statuses.id AND partnerOrders.supplierId = ${req.params?.id})`,
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
  },
);

exports.pullPartnerOrderPayment = catchAsync(async (req, res, next) => {
  const { partnerOrderId } = req.params;
  console.log("🚀 ~ req.params:", req.params);
  console.log("🚀 ~ req.params:", req.params);
  console.log("🚀 ~ req.params:", req.params);
  console.log("🚀 ~ req.params:", req.params);
  console.log("🚀 ~ req.params:", req.params);
  console.log("🚀 ~ req.params:", req.params);

  const isPartnerOrder = true;

  const qry = {
    where: { id: partnerOrderId },
  };

  if (isPartnerOrder) {
    qry.raw = true;
    qry.attributes = [
      "id",
      "totalBill",
      "invoiceNumber",
      "statusId",
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

  const doc = await partnerOrder.findOne(qry);
  console.log("🚀 ~ doc:", doc);
  console.log("🚀 ~ doc:", doc);

  if (doc.paymentStatus == "done") {
    return next(
      new AppError(
        "This order has already been paid for and cannot be deleted.",
        400,
      ),
    );
  }

  if (isPartnerOrder && doc?.paymentStatus != "done") {
    //HERE we try to collect payment if order type is local Patrner
    console.log("🚀 ~ doc?.defaultBankAccount:", doc?.defaultBankAccount);
    console.log("🚀 ~ doc?.defaultBankAccount:", doc?.defaultBankAccount);
    if (!doc?.defaultBankAccount) {
      return next(
        new AppError("Invalid Bank Account! Cannot collect payment. ", 404),
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

    if (!pullouts) {
      return next(
        new AppError("Invalid Bank Account cannot collect payment. ", 404),
      );
    }
    const data = {};
    data.pulloutDate = Date.now();
    data.pulloutIntentId = pullouts?.paymentIntentId;
    data.paymentIntentId = pullouts?.paymentIntentId;
    data.paymentStatus = "done";

    await partnerOrder.update(data, {
      where: { id: partnerOrderId },
    });
    paidInvoiceAdminOrLocalPatnerEventAndCustomer({
      orderId: partnerOrderId,
      orderType: isPartnerOrder ? "local-partner" : "customer",
    });

    syncPaymentToQuickBooks({
      orderId: partnerOrderId,
      orderType: isPartnerOrder ? "local-partner" : "customer",
    });
  }

  return res.status(200).json({
    status: "success",
    data: {},
  });
});
