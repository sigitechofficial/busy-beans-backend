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
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { Op, literal, fn, col, where } = require("sequelize");
const APIFeatures = require("../../utils/apiFeatures");
const {
  orderEvents,
  orderEventsToLocalPatnerOrAdmin,
} = require("../events/orderEvents");
exports.bookNewPartnerOrder = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log("🚀 ~ exports.bookNewOrder=catchAsync ~ input:", input);
  // if (input?.items?.length < 1) {
  //   throw new AppError('Cart is empty add products to place order', 404);
  // }

  //   console.log("🚀 ~ exports.bookNewOrder=customer ~ customer:", customer?.id);
  //   if (!customer) {
  //     return next(new AppError("Customer not found.", 404));
  //   }

  if (!input?.order?.shippingCharges) {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400
      )
    );
  }

  input.order.statusId = input.order?.invoiceOnly ? 5 : 1;

  let itemsPrice = 0;
  let discountOnItemsPrice = 0;
  let totalWeight = 0;
  let productIds = input?.items.map((item) => item.productId);
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
      //   [
      //     literal(`
      //          (SELECT percentage
      //          FROM userDiscounts
      //          WHERE userDiscounts.categoryId = product.categoryId
      //            AND userDiscounts.userId = ${customer.id}
      //          LIMIT 1)
      //        `),
      //     "discountPercentage",
      //   ],
    ],
  });
  // return res.json(products)
  console.log(
    "🚀 ~ exports.bookOrder=catchAsync ~ products:",
    products?.length
  );
  // let percentageDiscount = input?.order?.discountPercentage
  //   ? parseFloat(input?.order?.discountPercentage)
  //   : parseFloat(customer?.defaultDiscount);

  const finalItems = products.map((obj) => {
    const element = {};
    const percentageDiscount = parseFloat(
      obj.dataValues?.discountPercentage || 0
    );
    element.productId = obj.id;
    element.categoryId = obj?.categoryId;
    // console.log("🚀 ~ finalItems ~ obj:", obj)

    // Find the matching product in input.items based on productId
    let prod = input?.items.find((item) => item.productId == obj.id);

    // Set the qty from input.items or default to 1 if not found
    let qty = prod ? parseInt(prod.qty) : 1;
    console.log("🚀 ~ finalItems ~ qty:", qty);
    element.qty = qty;
    element.price = obj.wholesalePrice * qty;
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

  const shippingCompany = input.order?.invoiceOnly
    ? { charges: 0 }
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
        400
      )
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

  await partnerOrderItem.bulkCreate(finalItems);

  //   if (newOrder.frequency != "just-onces")
  //     setOrderFrequency({
  //       orderData: newOrder,
  //       salesRepId: customer?.salesRepId,
  //     });

  if (input?.items && input.items?.length > 0) {
    orderEventsToLocalPatnerOrAdmin({
      orderId: newOrder?.id,
      orderType: "local-partner",
    });
    orderEvents({ orderId: newOrder?.id, orderType: "local-partner" });
  }
  return res.status(200).json({
    status: "success",
    data: { id: newOrder?.id },
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
  let condition = {};
  if (req.params.id) condition.id = req.params.id;

  // Build API features (filter, sort, fields, pagination)
  const features = new APIFeatures(partnerOrder, req.query)
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
      model: partnerOrderItem,
      attributes: [
        "id",
        [
          literal(
            `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
          ),
          "product",
        ],
        [
          literal(
            `(SELECT products.image FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
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
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = partnerOrder.statusId LIMIT 1)`
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
        `(SELECT salesReps.srName FROM salesReps WHERE partnerOrder.salesRepId = salesReps.id LIMIT 1)`
      ),
      "salesRepName",
    ],
    [
      literal(
        `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = partnerOrder.statusId AND orderHistories.partnerOrderId = partnerOrder.id LIMIT 1)`
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
  const doc = await partnerOrder.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: "success",
    results: doc.length,
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
              `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
            ),
            "product",
          ],
          [
            literal(
              `(SELECT products.weight FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
            ),
            "singleUnitWeight",
          ],
          ["weight", "itemWeights"],
          [
            literal(
              `(SELECT products.productCode FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
            ),
            "productCode",
          ],
          [
            literal(
              `(SELECT products.grind FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
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
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = partnerOrder.statusId LIMIT 1)`
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
          `(SELECT salesReps.srName FROM salesReps WHERE partnerOrder.salesRepId = salesReps.id LIMIT 1)`
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
