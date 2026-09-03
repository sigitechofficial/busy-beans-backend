const {
  orderFrequency,
  order,
  item,
  address,
  orderHistory,
  user,
  salesRep,
  shippingCompanies,
  product,
  employee,
} = require("../../models");

const catchAsync = require("../../utils/catchAsync");

const AppError = require("../../utils/appError");
const { nextFrequencyDate } = require("../../utils/nextFrequencyDate");
const factory = require("../handlerFactory");
const { Op, literal, fn, col, where } = require("sequelize");
const APIFeatures = require("../../utils/apiFeatures");
const {
  orderEvents,
  orderEventsToLocalPatnerOrAdmin,
} = require("../events/orderEvents");

// const { supplierNewOrderEvent } = require("../events/orderToSupplierEvents");
const {
  sentPaymentInvoiceEvent,
} = require("../events/sentPaymentInvoiceEvent");
exports.setOrderFrequency = async ({ orderData, salesRepId }) => {
  try {
    if (!orderData) return false;

    const input = JSON.parse(JSON.stringify(orderData));
    // Never carry source PK/audit fields into orderFrequency PK.
    delete input.id;
    delete input.createdAt;
    delete input.updatedAt;
    delete input.deletedAt;

    const { nextOrderDate, visibilityDate } = nextFrequencyDate({
      currentDate: new Date(),
      frequency: input.frequency,
    });
    input.orderId = orderData.id;
    input.salesRepId = salesRepId;
    input.orderDate = new Date();
    input.nextOrderDate = nextOrderDate;
    input.visibilityDate = visibilityDate;

    const frequency = await orderFrequency.create(input);
    await Promise.all([
      order.update(
        { orderFrequencyId: frequency?.id },
        { where: { id: orderData?.id } },
      ),
      item.update(
        { orderFrequencyId: frequency?.id },
        { where: { orderId: orderData?.id } },
      ),
    ]);

    return true;
  } catch (error) {
    console.log("[SET_ORDER_FREQUENCY][ERROR]", error);
    return false;
  }
};

const { setOrderFrequency } = require("../admin/orderFrequencyController");

//* Pending order according to their frequency cycle

exports.orderAccordingToFrequency = catchAsync(async (req, res, next) => {
  // Build manual filter conditions (preserve existing logic)
  const included = [
    {
      model: item,
      attributes: [
        [
          literal(
            `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
          ),
          "product",
        ],
        [
          literal(
            `(SELECT products.price FROM products WHERE products.id = items.productId LIMIT 1)`,
          ),
          "price",
        ],
        [
          literal(
            `(SELECT products.wholesalePrice FROM products WHERE products.id = items.productId LIMIT 1)`,
          ),
          "wholesalePrice",
        ],
        [
          literal(
            `(SELECT srpp.price FROM salesRepProductPrices srpp WHERE srpp.productId = items.productId AND srpp.salesRepId = orderFrequency.salesRepId AND srpp.deleted = 0 LIMIT 1)`,
          ),
          "customPrice",
        ],
        [
          literal(
            `(SELECT srpp.wholesalePrice FROM salesRepProductPrices srpp WHERE srpp.productId = items.productId AND srpp.salesRepId = orderFrequency.salesRepId AND srpp.deleted = 0 LIMIT 1)`,
          ),
          "customWholesalePrice",
        ],
        "qty",
        "productId",
      ],
    },
  ];
  let condition = {};
  if (req.params.srId) condition.salesRepId = req.params.srId;

  if (
    req.user.entity == "adminEmployee" ||
    req.user.entity == "partnerEmployee"
  ) {
    included.push({
      model: user,
      where: { employeeId: req.user?.id },
      attributes: [],
    });
    const worker = await employee.findOne({ where: { id: req.user?.id } });
    if (worker && worker?.salesRepId) condition.salesRepId = worker?.salesRepId;
    // if (condition.salesRepId) delete condition.salesRepId;
  }
  // Add visibilityDate condition
  condition.visibilityDate = {
    [Op.lte]: new Date(), // or moment().toDate()
  };

  // Define searchable columns for orderFrequency
  const searchableFields = ["id", "frequency", "orderId", "userId"];

  // Build API features (filter, search, sort, fields, pagination)
  const features = new APIFeatures(orderFrequency, req.query)
    .filter()
    .search(searchableFields) // Add search functionality
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options
  const queryOptions = features.getQuery();

  APIFeatures.appendSearchOrConditions(
    queryOptions,
    APIFeatures.relatedNameSearchConditions(
      orderFrequency.sequelize,
      req.query?.search,
      {
        tableAlias: "orderFrequency",
        companyName: true,
      },
    ),
  );

  // Add the complex nextOrderDate condition to condition object first
  const nextOrderDateCondition = {
    nextOrderDate: {
      [Op.notIn]: literal(`
          (SELECT DATE(orders.on) FROM orders WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate) AND orders.orderFrequencyId = orderFrequency.id)
        `),
    },
  };

  // Merge manual filter conditions with existing where conditions
  // Handle both simple object merge and Op.and structure
  if (Object.keys(condition).length > 0) {
    if (queryOptions.where && queryOptions.where[Op.and]) {
      // If where already has Op.and structure, add condition to it
      queryOptions.where[Op.and].push({
        ...condition,
        ...nextOrderDateCondition,
      });
    } else if (queryOptions.where) {
      // If where exists but no Op.and, create Op.and structure
      queryOptions.where = {
        [Op.and]: [
          queryOptions.where,
          {
            ...condition,
            ...nextOrderDateCondition,
          },
        ],
      };
    } else {
      // If no existing where, just use condition with nextOrderDate
      queryOptions.where = {
        ...condition,
        ...nextOrderDateCondition,
      };
    }
  } else {
    // If no condition object, just add nextOrderDate
    if (queryOptions.where && queryOptions.where[Op.and]) {
      queryOptions.where[Op.and].push(nextOrderDateCondition);
    } else if (queryOptions.where) {
      queryOptions.where = {
        [Op.and]: [queryOptions.where, nextOrderDateCondition],
      };
    } else {
      queryOptions.where = nextOrderDateCondition;
    }
  }

  // Add custom includes
  queryOptions.include = included;

  // Custom attributes with literal fields
  queryOptions.attributes = [
    "id",
    "salesRepId",
    [
      literal(
        `(SELECT users.name FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`,
      ),
      "customerName",
    ],
    [
      literal(
        `(SELECT users.companyName FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`,
      ),
      "companyName",
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = orderFrequency.orderId ), 0)`),
      "totalQuantity",
    ],
    [
      literal(
        `(SELECT users.email FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`,
      ),
      "email",
    ],
    "status",
    "orderDate",
    "nextOrderDate",
    "frequency",
    "visibilityDate",
  ];

  // Get pagination metadata using APIFeatures
  // Need to include the nextOrderDate condition in count query too
  const paginationCondition = {
    ...condition,
    ...nextOrderDateCondition,
  };

  const pagination = await features.getPaginationMetadata(orderFrequency, {
    include: queryOptions.include,
    where: paginationCondition, // Pass complete condition including nextOrderDate
  });

  // Execute the query
  const doc = await orderFrequency.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: "success",
    results: doc.length,
    pagination: pagination,
    data: {
      order: doc,
    },
  });
});

exports.bookNewOrder = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log("[bookNewOrder] step:1 start", {
    userId: input?.order?.userId,
    itemsCount: input?.items?.length ?? 0,
    typeChargesCount: input?.typeCharges?.length ?? 0,
    orderType: input?.orderType,
    orderKeys: input?.order ? Object.keys(input.order) : [],
  });
  // if (input?.items?.length < 1) {
  //   throw new AppError('Cart is empty add products to place order', 404);
  // }

  const customer = await user.findOne({
    where: { id: input?.order?.userId },
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
  console.log("[bookNewOrder] step:2 customer loaded", {
    id: customer?.id,
    salesRepId: customer?.salesRepId,
    partnerType: customer?.partnerType,
  });
  if (!customer) {
    return next(new AppError("Customer not found.", 404));
  }

  if (!input?.order?.shippingCharges) {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400,
      ),
    );
  }
  console.log("[bookNewOrder] step:3 shippingCharges present", {
    shippingCharges: input?.order?.shippingCharges,
  });

  if (customer?.salesRepId && customer?.partnerType == "dropship-partner") {
    console.log("[bookNewOrder] step:4 dropship credit check", {
      salesRepId: customer.salesRepId,
    });
    const credit = await salesRep.findOne({
      where: {
        id: customer?.salesRepId,
      },
      attributes: [
        "creditLimit",
        [
          literal(`
                  (
                    SELECT SUM(items.price)
                    FROM orders
                    JOIN items ON items.orderId = orders.id
                    WHERE orders.salesRepId = salesRep.id
                      AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
                  )
                `),
          "creditUsed",
        ],
      ],
    });

    let percentage =
      (credit?.dataValues?.creditUsed / credit?.creditLimit) * 100;
    console.log(
      "---------------------------------creaditUed",
      credit?.dataValues?.creditUsed,
    );
    console.log(
      "---------------------------------creditLimit",
      credit?.creditLimit,
    );

    if (percentage >= 80) {
      throw new AppError(
        `You've used over 80% of your credit limit. Please clear your balance before placing further orders.`,
        404,
      );
    }
    console.log("[bookNewOrder] step:4 dropship credit ok", {
      percentage: Number.isFinite(percentage) ? percentage : null,
    });
  } else {
    console.log("[bookNewOrder] step:4 dropship credit skipped");
  }

  input.order.statusId = input.order?.invoiceOnly ? 5 : 1;
  input.order.userId = customer.id;
  input.order.salesRepId = customer?.salesRepId;
  console.log("[bookNewOrder] step:5 order header normalized", {
    statusId: input.order.statusId,
    userId: input.order.userId,
    salesRepId: input.order.salesRepId,
    invoiceOnly: input.order?.invoiceOnly,
  });
  let itemsPrice = 0;
  let discountOnItemsPrice = 0;
  let totalWeight = 0;
  let productIds = input?.items.map((item) => item.productId);
  console.log("[bookNewOrder] step:6 productIds", productIds);
  const productAttributes = [
    `id`,
    `name`,
    `quantity`,
    `categoryId`,
    `weight`,
    `sku`,
    `grind`,
    `productCode`,
    [
      literal(`
              (SELECT percentage
              FROM userDiscounts
              WHERE userDiscounts.categoryId = product.categoryId
                AND userDiscounts.userId = ${customer.id}
              LIMIT 1)
            `),
      "discountPercentage",
    ],
  ];
  if (customer?.salesRepId) {
    console.log(
      "ðŸš€ ~ exports.bookNewOrder=catchAsync ~ CASE LOCALPARTNER INVENTORY PRICE & WHOLESALE APPLIED:",
      customer?.salesRepId,
    );
    productAttributes.push(
      [
        literal(
          `(SELECT COALESCE(srpp.price, product.price) FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${customer?.salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
        ),
        "price",
      ],
      [
        literal(
          `(SELECT COALESCE(srpp.wholesalePrice, product.wholesalePrice) FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${customer?.salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
        ),
        "wholesalePrice",
      ],
    );
  } else {
    console.log(
      "ðŸš€ ~ exports.bookNewOrder=catchAsync ~ CASE ADMIN INVENTORY PRICE APPLIED:",
      customer?.salesRepId,
    );
    productAttributes.push(`price`, `wholesalePrice`);
  }

  const products = await product.findAll({
    where: {
      id: {
        [Op.in]: productIds,
      },
    },
    attributes: productAttributes,
    raw: true,
  });

  console.log("[bookNewOrder] step:7 products fetched", {
    count: products?.length,
    ids: products?.map((p) => p.id),
  });

  // let percentageDiscount = input?.order?.discountPercentage
  //   ? parseFloat(input?.order?.discountPercentage)
  //   : parseFloat(customer?.defaultDiscount);

  const finalItems = products.map((obj, productIndex) => {
    const element = {};
    const percentageDiscount = parseFloat(obj?.discountPercentage || 0);
    element.productId = obj.id;
    element.categoryId = obj?.categoryId;

    let prod = input?.items.find((item) => item.productId == obj.id);
    let qty = prod ? parseInt(prod.qty) : 1;

    console.log("[bookNewOrder] product:start", {
      index: productIndex,
      productId: obj.id,
      name: obj?.name,
      sku: obj?.sku,
      categoryId: obj?.categoryId,
      dbUnitPrice: obj?.price,
      dbUnitWholesale: obj?.wholesalePrice,
      dbUnitWeight: obj?.weight,
      discountPercentageFromUserDiscounts: percentageDiscount,
      cartLineMatched: !!prod,
      cartLine: prod
        ? { productId: prod.productId, qty: prod.qty, raw: prod }
        : null,
      resolvedQty: qty,
    });

    element.qty = qty;
    element.price = obj.price * qty;
    element.wholesalePrice = obj.wholesalePrice * qty;
    element.weight = obj.weight * qty;
    element.categoryId = obj.categoryId;
    element.discount = 0;

    const lineGrossPrice = element.price;
    const lineGrossWholesale = element.wholesalePrice;
    const lineGrossWeight = element.weight;

    console.log("[bookNewOrder] product:preDiscountLine", {
      productId: obj.id,
      linePriceNoDiscount: lineGrossPrice,
      lineWholesaleNoDiscount: lineGrossWholesale,
      lineWeight: lineGrossWeight,
    });

    if (percentageDiscount > 0) {
      const discountAmount = (element.price * percentageDiscount) / 100;
      const discountedPrice = element.price - discountAmount;

      console.log("[bookNewOrder] product:discountApply", {
        productId: obj.id,
        pct: percentageDiscount,
        lineBeforeDiscount: element.price,
        discountAmount,
        lineAfterDiscount: discountedPrice,
      });

      element.price = discountedPrice;
      element.discount = discountAmount;
    } else {
      console.log("[bookNewOrder] product:discountSkip", {
        productId: obj.id,
        reason: "category discount % is 0 or missing",
      });
    }

    discountOnItemsPrice += element.discount;
    itemsPrice += element.price;
    totalWeight += element.weight;

    console.log("[bookNewOrder] product:afterDiscountAccum", {
      productId: obj.id,
      linePrice: element.price,
      lineDiscount: element.discount,
      runningItemsPrice: itemsPrice,
      runningDiscountOnItems: discountOnItemsPrice,
      runningTotalWeight: totalWeight,
    });

    if (customer?.salesRepId) {
      if (customer.partnerType == "direct-partner") {
        element.salerCommission = parseFloat(element.price);
        element.wholesalePrice = 0;
        console.log("[bookNewOrder] product:commission", {
          productId: obj.id,
          branch: "direct-partner",
          salerCommission: element.salerCommission,
          wholesalePriceCleared: true,
        });
      } else {
        element.salerCommission =
          input?.order?.type === "direct-invoice"
            ? parseFloat(element.price)
            : parseFloat(element.price) -
              parseFloat(element.wholesalePrice || 0);
        console.log("[bookNewOrder] product:commission", {
          productId: obj.id,
          branch:
            input?.order?.type === "direct-invoice"
              ? "dropship/other + direct-invoice"
              : "dropship/other (price - wholesale)",
          orderType: input?.order?.type,
          linePrice: element.price,
          lineWholesale: element.wholesalePrice,
          salerCommission: element.salerCommission,
        });
      }
    } else {
      element.wholesalePrice = 0;
      console.log("[bookNewOrder] product:commission", {
        productId: obj.id,
        branch: "no salesRep",
        salerCommission: 0,
        wholesalePriceCleared: true,
      });
    }

    console.log("[bookNewOrder] product:finalRow", {
      productId: element.productId,
      categoryId: element.categoryId,
      qty: element.qty,
      price: element.price,
      discount: element.discount,
      wholesalePrice: element.wholesalePrice,
      weight: element.weight,
      salerCommission: element.salerCommission,
    });

    return element;
  });
  console.log("[bookNewOrder] step:8 line items built", {
    finalItemsCount: finalItems.length,
    itemsPrice,
    discountOnItemsPrice,
    totalWeight,
  });

  // Handle typeCharges if provided
  if (input?.typeCharges?.length > 0) {
    console.log(
      "ðŸš€ ~ req.body?.typeCharges?.length:",
      input?.typeCharges?.length,
    );
    input?.typeCharges.forEach((obj, chargeIndex) => {
      console.log("[bookNewOrder] typeCharge:start", {
        index: chargeIndex,
        raw: obj,
      });
      const element = {};
      element.code = obj.code;
      element.qty = obj.qty;
      element.price = obj.total;
      element.productName = obj.name;
      element.type = "charges";
      element.discount = 0;

      const chargeAmount = parseFloat(element?.price || 0);
      itemsPrice += chargeAmount;

      if (customer?.salesRepId) {
        element.salerCommission = parseFloat(element?.price);
      } else {
        element.wholesalePrice = 0;
        element.salerCommission = 0;
      }

      console.log("[bookNewOrder] typeCharge:built", {
        index: chargeIndex,
        code: element.code,
        name: element.productName,
        qty: element.qty,
        price: element.price,
        salerCommission: element.salerCommission,
        runningItemsPrice: itemsPrice,
      });

      finalItems.push(element);
    });
    console.log("[bookNewOrder] step:9 typeCharges merged", {
      finalItemsCount: finalItems.length,
      itemsPrice,
    });
  } else {
    console.log("[bookNewOrder] step:9 typeCharges none");
  }

  const shippingCompany = input.order?.invoiceOnly
    ? { charges: input?.order?.shippingCharges || 0 }
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

  if (!shippingCompany && customer?.partnerType != "direct-partner") {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400,
      ),
    );
  }

  console.log("[bookNewOrder] step:10 shipping resolved", {
    invoiceOnly: !!input.order?.invoiceOnly,
    charges: shippingCompany?.charges,
    totalWeight,
  });

  input.order.itemsPrice = itemsPrice;
  input.order.statusId = customer?.partnerType == "direct-partner" ? 3 : 1;
  input.order.discountPrice = discountOnItemsPrice;
  // input.order.discountPercentage = percentageDiscount;
  input.order.shippingCharges =
    customer?.partnerType == "direct-partner" ? 0 : shippingCompany?.charges;
  input.order.totalWeight = parseFloat(totalWeight || 0);
  input.order.shippingCompany =
    input.order.totalWeight > 400 ? `Shipping By Truck` : "UPS";
  input.order.subTotal = itemsPrice + parseFloat(input.order.vat || 0);
  input.order.totalBill =
    parseFloat(itemsPrice) +
    parseFloat(input?.order?.vat || 0) +
    parseFloat(input.order.shippingCharges || 0);

  if (
    input?.orderType == "direct-invoice" &&
    input?.order?.emailInvoiceToCustomer
  ) {
    input.order.invoiceDate = new Date();
  }
  console.log("[bookNewOrder] step:11 totals before create", {
    itemsPrice: input.order.itemsPrice,
    statusId: input.order.statusId,
    discountPrice: input.order.discountPrice,
    shippingCharges: input.order.shippingCharges,
    subTotal: input.order.subTotal,
    totalBill: input.order.totalBill,
    totalWeight: input.order.totalWeight,
    shippingCompany: input.order.shippingCompany,
  });
  const newOrder = await order.create(input?.order);
  newOrder.invoiceNumber = `INV00${newOrder?.id}`;
  await newOrder.save();
  console.log("[bookNewOrder] step:12 order persisted", {
    id: newOrder?.id,
    invoiceNumber: newOrder?.invoiceNumber,
    frequency: newOrder?.frequency,
  });

  const historyEntry = [
    {
      statusId: 1,
      orderId: newOrder.id,
      on: Date.now(),
    },
    // {
    //   statusId: 2,
    //   orderId: newOrder.id,
    //   on: Date.now(),
    // },
  ];

  if (customer.partnerType == "direct-partner") {
    historyEntry.push({
      statusId: 2,
      orderId: newOrder.id,
      on: Date.now(),
    });
    historyEntry.push({
      statusId: 3,
      orderId: newOrder.id,
      on: Date.now(),
    });
  }
  await orderHistory.bulkCreate(historyEntry);
  console.log("[bookNewOrder] step:13 order history created", {
    entries: historyEntry.length,
    orderId: newOrder.id,
  });

  finalItems.forEach((element) => {
    element.orderId = newOrder.id;
  });

  await item.bulkCreate(finalItems);
  console.log("[bookNewOrder] step:14 items bulk created", {
    count: finalItems.length,
    orderId: newOrder.id,
  });

  if (newOrder.frequency != "just-onces") {
    console.log("[bookNewOrder] step:15 setOrderFrequency", {
      frequency: newOrder.frequency,
      orderId: newOrder.id,
    });
    exports.setOrderFrequency({
      orderData: newOrder,
      salesRepId: customer?.salesRepId,
    });
  } else {
    console.log(
      "[bookNewOrder] step:15 setOrderFrequency skipped (just-onces)",
    );
  }

  if (
    input?.items &&
    input.items?.length > 0 &&
    input?.order?.type != "direct-invoice" &&
    !input?.order?.emailInvoiceToCustomer
  ) {
    console.log("[bookNewOrder] step:16 events standard order", {
      orderId: newOrder?.id,
    });
    orderEventsToLocalPatnerOrAdmin({ orderId: newOrder?.id });
    orderEvents({ orderId: newOrder?.id });
  } else if (
    input?.order?.type == "direct-invoice" &&
    input?.order?.emailInvoiceToCustomer
  ) {
    console.log("[bookNewOrder] step:16 events invoice email", {
      orderId: newOrder?.id,
    });
    sentPaymentInvoiceEvent({ orderId: newOrder?.id, orderType: "customer" });
  } else {
    console.log("[bookNewOrder] step:16 events skipped", {
      orderId: newOrder?.id,
      reason: "branch conditions not met",
    });
  }

  console.log("[bookNewOrder] step:17 done", { orderId: newOrder?.id });
  return res.status(200).json({
    status: "success",
    data: { id: newOrder?.id },
  });
});

// exports.bookNewOrder = catchAsync(async (req, res, next) => {
//     const input = req.body;
//     console.log(
//       "ðŸš€ ~ exports.bookNewOrder=catchAsync ~ input:",
//       input?.order?.userId
//     );
//     // if (input?.items?.length < 1) {
//     //   throw new AppError('Cart is empty add products to place order', 404);
//     // }

//     const customer = await user.findOne({
//       where: { id: input?.order?.userId },
//       attributes: [
//         "id",
//         "salesRepId",
//         "defaultDiscount",
//         [
//           literal(
//             `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
//           ),
//           "salesRepName",
//         ],
//         [
//           literal(
//             `(SELECT salesReps.partnerType FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
//           ),
//           "partnerType",
//         ],
//       ],
//       raw: true,
//     });
//     console.log("ðŸš€ ~ exports.bookNewOrder=customer ~ customer:", customer?.id);
//     if (!customer) {
//       return next(new AppError("Customer not found.", 404));
//     }

//     if (!input?.order?.shippingCharges) {
//       return next(
//         new AppError(
//           "Not dealing in such weights. Contact customer support for this order.",
//           400
//         )
//       );
//     }

//     if (customer?.salesRepId && customer?.partnerType == "dropship-partner") {
//       const credit = await salesRep.findOne({
//         where: {
//           id: customer?.salesRepId,
//         },
//         attributes: [
//           "creditLimit",
//           [
//             literal(`
//                 (
//                   SELECT SUM(items.price)
//                   FROM orders
//                   JOIN items ON items.orderId = orders.id
//                   WHERE orders.salesRepId = salesRep.id
//                     AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
//                 )
//               `),
//             "creditUsed",
//           ],
//         ],
//       });

//       let percentage =
//         (credit?.dataValues?.creditUsed / credit?.creditLimit) * 100;
//       console.log(
//         "---------------------------------creaditUed",
//         credit?.dataValues?.creditUsed
//       );
//       console.log(
//         "---------------------------------creditLimit",
//         credit?.creditLimit
//       );

//       if (percentage >= 80) {
//         throw new AppError(
//           `You've used over 80% of your credit limit. Please clear your balance before placing further orders.`,
//           404
//         );
//       }
//     }

//     input.order.statusId = input.order?.invoiceOnly ? 5 : 1;
//     input.order.userId = customer.id;
//     input.order.salesRepId = customer?.salesRepId;
//     let itemsPrice = 0;
//     let discountOnItemsPrice = 0;
//     let totalWeight = 0;
//     let productIds = input?.items.map((item) => item.productId);
//     console.log("ðŸš€ ~ exports.bookOrder=catchAsync ~ productIds:", productIds);
//     const products = await product.findAll({
//       where: {
//         id: {
//           [Op.in]: productIds,
//         },
//       },
//       attributes: [
//         `id`,
//         `name`,
//         `quantity`,
//         `price`,
//         `categoryId`,
//         `wholesalePrice`,
//         `weight`,
//         `sku`,
//         `grind`,
//         `productCode`,
//         [
//           literal(`
//               (SELECT percentage
//               FROM userDiscounts
//               WHERE userDiscounts.categoryId = product.categoryId
//                 AND userDiscounts.userId = ${customer.id}
//               LIMIT 1)
//             `),
//           "discountPercentage",
//         ],
//       ],
//     });

//     console.log(
//       "ðŸš€ ~ exports.bookOrder=catchAsync ~ products:",
//       products?.length
//     );

//     // let percentageDiscount = input?.order?.discountPercentage
//     //   ? parseFloat(input?.order?.discountPercentage)
//     //   : parseFloat(customer?.defaultDiscount);

//     const finalItems = products.map((obj) => {
//       const element = {};
//       const percentageDiscount = parseFloat(
//         obj.dataValues?.discountPercentage || 0
//       );
//       element.productId = obj.id;
//       element.categoryId = obj?.categoryId;
//       // console.log("ðŸš€ ~ finalItems ~ obj:", obj)

//       // Find the matching product in input.items based on productId
//       let prod = input?.items.find((item) => item.productId == obj.id);

//       // Set the qty from input.items or default to 1 if not found
//       let qty = prod ? parseInt(prod.qty) : 1;
//       console.log("ðŸš€ ~ finalItems ~ qty:", qty);
//       element.qty = qty;
//       // Calculate price, wholesalePrice, and weight for the item
//       element.price = obj.price * qty;
//       element.wholesalePrice = obj.wholesalePrice * qty;
//       element.weight = obj.weight * qty;
//       element.categoryId = obj.categoryId;
//       element.discount = 0;
//       if (percentageDiscount > 0) {
//         // Calculate discount amount
//         const discountAmount = (element.price * percentageDiscount) / 100;
//         // Calculate final price after discount
//         const discountedPrice = element.price - discountAmount;

//         element.price = discountedPrice;
//         element.discount = discountAmount;
//       }
//       // Accumulate the total weight and price
//       discountOnItemsPrice += element.discount;
//       itemsPrice += element.price;
//       totalWeight += element.weight;
//       // Handle salesRep commission if applicable
//       if (customer?.salesRepId) {
//         if (customer.partnerType == "direct-partner") {
//           element.salerCommission = parseFloat(element.price);
//           element.wholesalePrice = 0;
//         } else {
//           element.salerCommission =
//             parseFloat(element.price) - parseFloat(element.wholesalePrice || 0);
//         }
//       } else {
//         element.wholesalePrice = 0;
//       }
//       return element; // Return the transformed element
//     });

//     const shippingCompany = input.order?.invoiceOnly
//       ? { charges: 0 }
//       : await shippingCompanies.findOne({
//           where: {
//             weightFrom: {
//               [Op.lte]: totalWeight, // Less than or equal to the weight
//             },
//             weightTo: {
//               [Op.gte]: totalWeight, // Greater than or equal to the weight
//             },
//           },
//           attributes: ["charges"],
//         });

//     if (!shippingCompany) {
//       return next(
//         new AppError(
//           "Not dealing in such weights. Contact customer support for this order.",
//           400
//         )
//       );
//     }

//     console.log("ðŸš€ ~ shippingCompany:", shippingCompany);

//     input.order.itemsPrice = itemsPrice;
//     input.order.statusId = customer?.partnerType == "direct-partner" ? 3 : 1;
//     input.order.discountPrice = discountOnItemsPrice;
//     // input.order.discountPercentage = percentageDiscount;
//     input.order.shippingCharges = shippingCompany?.charges;
//     input.order.totalWeight = parseFloat(totalWeight || 0);
//     input.order.shippingCompany =
//       input.order.totalWeight > 400 ? `Shipping By Truck` : "UPS";
//     input.order.subTotal = itemsPrice + parseFloat(input.order.vat || 0);
//     input.order.totalBill =
//       parseFloat(itemsPrice) +
//       parseFloat(input?.order?.vat || 0) +
//       parseFloat(shippingCompany?.charges || 0);

//     if (
//       input?.orderType == "direct-invoice" &&
//       input?.order?.emailInvoiceToCustomer
//     ) {
//       input.order.invoiceDate = new Date();
//     }
//     const newOrder = await order.create(input?.order);
//     newOrder.invoiceNumber = `INV00${newOrder?.id}`;
//     await newOrder.save();

//     const historyEntry = [
//       {
//         statusId: 1,
//         orderId: newOrder.id,
//         on: Date.now(),
//       },
//       {
//         statusId: 2,
//         orderId: newOrder.id,
//         on: Date.now(),
//       },
//     ];

//     if (customer.partnerType == "direct-partner") {
//       historyEntry.push({
//         statusId: 3,
//         orderId: newOrder.id,
//         on: Date.now(),
//       });
//     }
//     await orderHistory.bulkCreate(historyEntry);

//     finalItems.forEach((element) => {
//       element.orderId = newOrder.id;
//     });

//     await item.bulkCreate(finalItems);

//     if (newOrder.frequency != "just-onces")
//       setOrderFrequency({
//         orderData: newOrder,
//         salesRepId: customer?.salesRepId,
//       });

//     if (
//       input?.items &&
//       input.items?.length > 0 &&
//       input?.order?.type != "direct-invoice" &&
//       !input?.order?.emailInvoiceToCustomer
//     ) {
//       orderEventsToLocalPatnerOrAdmin({ orderId: newOrder?.id });
//       orderEvents({ orderId: newOrder?.id });
//     } else if (
//       input?.order?.type == "direct-invoice" &&
//       input?.order?.emailInvoiceToCustomer
//     ) {
//       sentPaymentInvoiceEvent({ orderId: newOrder?.id, orderType: "customer" });
//     }

//     return res.status(200).json({
//       status: "success",
//       data: { id: newOrder?.id },
//     });
//   });
// exports.bookNewOrder = catchAsync(async (req, res, next) => {
//   const input = req.body;

//   if (input?.items?.length < 1) {
//     throw new AppError('Cart is empty add products to place order', 404);
//   }

//   const customer = await user.findOne({ where: { id: input?.order?.userId } });
//   console.log('ðŸš€ ~ exports.bookNewOrder=customer ~ customer:', customer?.id);
//   if (!customer) {
//     return next(new AppError('Customer not found.', 404));
//   }

//   if (!input?.order?.shippingCharges) {
//     return next(
//       new AppError(
//         'Not dealing in such weights. Contact customer support for this order.',
//         400,
//       ),
//     );
//   }

//   const shippingCompany = await shippingCompanies.findOne({
//     where: {
//       weightFrom: {
//         [Op.lte]: input?.order?.totalWeight, // Less than or equal to the weight
//       },
//       weightTo: {
//         [Op.gte]: input?.order?.totalWeight, // Greater than or equal to the weight
//       },
//     },
//     attributes: ['charges'],
//   });

//   if (!shippingCompany) {
//     return next(
//       new AppError(
//         'Not dealing in such weights. Contact customer support for this order.',
//         400,
//       ),
//     );
//   }

//   if (customer?.salesRepId) {
//     const credit = await salesRep.findOne({
//       where: {
//         id: customer?.salesRepId,
//       },
//       attributes: [
//         'creditLimit',
//         [
//           literal(`
//               (
//                 SELECT SUM(items.price)
//                 FROM orders
//                 JOIN items ON items.orderId = orders.id
//                 WHERE orders.salesRepId = salesRep.id
//                   AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
//               )
//             `),
//           'creditUsed',
//         ],
//       ],
//     });

//     let percentage =
//       (credit?.dataValues?.creditUsed / credit?.creditLimit) * 100;
//     console.log(
//       '---------------------------------creaditUed',
//       credit?.dataValues?.creditUsed,
//     );
//     console.log(
//       '---------------------------------creditLimit',
//       credit?.creditLimit,
//     );
//     if (percentage >= 80) {
//       throw new AppError(
//         `You've used over 80% of your credit limit. Please clear your balance before placing further orders.`,
//         404,
//       );
//     }
//   }

//   input.order.statusId = 1;
//   input.order.salesRepId = req.params?.srId || customer?.salesRepId;
//   input.order.createdBy = 'sales-rep';
//   input.order.totalBill =
//     parseFloat(input.order.totalBill) + parseFloat(input.order.shippingCharges);
//   const newOrder = await order.create(input?.order);
//   newOrder.invoiceNumber = `INV00${newOrder?.id}`;
//   await newOrder.save();

//   await orderHistory.bulkCreate([
//     {
//       statusId: 1,
//       orderId: newOrder.id,
//       on: Date.now(),
//     },
//   ]);

//   input?.items.forEach((element) => {
//     element.orderId = newOrder.id;
//     element.price = element.price * element.qty;
//     element.wholesalePrice = element.wholesalePrice * element.qty;
//     element.weight = element.weight * element.qty;

//     element.salerCommission =
//       parseFloat(element.price) - parseFloat(element.wholesalePrice);
//   });

//   await item.bulkCreate(input?.items);

//   if (newOrder?.frequency != 'just-onces')
//     setOrderFrequency({
//       orderData: newOrder,
//       salesRepId: req.params?.srId || customer.salesRepId,
//     });

//   orderEvents({ orderId: newOrder?.id });
//   return res.status(200).json({
//     status: 'success',
//     data: { id: newOrder?.id },
//   });
// });

const frequencyBookOrder = async ({ id, runId }) => {
  //orderData is
  // let productsPrice = 0;
  try {
    console.log(
      `[FREQ_ORDER][START] runId=${runId || "manual"} frequencyId=${id}`,
    );
    // STEP 1: First fetch orderFrequency to get salesRepId and orderId
    const orderFreqData = await orderFrequency.findByPk(id, {
      attributes: [
        ["id", "orderFrequencyId"],
        "orderId",
        "frequency",
        "userId",
        "salesRepId",
        "nextOrderDate",
      ],
      raw: true,
    });

    if (!orderFreqData) {
      console.log(
        `[FREQ_ORDER][SKIP] runId=${runId || "manual"} frequencyId=${id} reason=frequency_not_found`,
      );
      return {
        success: false,
        orderId: null,
        frequencyId: id,
        error: "Frequency record not found",
      };
    }

    const salesRepId = orderFreqData.salesRepId;
    const userId = orderFreqData.userId;

    // STEP 2: Build dynamic item attributes based on salesRepId (like bookNewOrder)
    const itemAttributes = [
      [
        literal(
          `(SELECT products.name FROM products WHERE products.id = item.productId LIMIT 1)`,
        ),
        "product",
      ],
      [
        literal(
          `(SELECT products.weight FROM products WHERE products.id = item.productId LIMIT 1)`,
        ),
        "weight",
      ],
      [
        literal(
          `(SELECT percentage FROM userDiscounts WHERE userDiscounts.categoryId = item.categoryId AND userDiscounts.userId = ${userId} LIMIT 1)`,
        ),
        "percentageDiscount",
      ],
      "qty",
      "productId",
      "categoryId",
      ["price", "servicePrice"],
      "productName",
      "type",
    ];

    // Conditional price & wholesalePrice based on salesRepId (SAME LOGIC AS bookNewOrder)
    if (salesRepId) {
      console.log(
        "ðŸš€ ~ frequencyBookOrder ~ CASE LOCALPARTNER INVENTORY PRICE & WHOLESALE APPLIED:",
        salesRepId,
      );
      itemAttributes.push(
        [
          literal(
            `(SELECT COALESCE(srpp.price, products.price) FROM salesRepProductPrices srpp WHERE srpp.productId = item.productId AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
          ),
          "price",
        ],
        [
          literal(
            `(SELECT COALESCE(srpp.wholesalePrice, products.wholesalePrice) FROM salesRepProductPrices srpp WHERE srpp.productId = item.productId AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
          ),
          "wholesalePrice",
        ],
      );
    } else {
      console.log(
        "ðŸš€ ~ frequencyBookOrder ~ CASE ADMIN INVENTORY PRICE APPLIED",
      );
      itemAttributes.push(
        [
          literal(
            `(SELECT products.price FROM products WHERE products.id = item.productId LIMIT 1)`,
          ),
          "price",
        ],
        [
          literal(
            `(SELECT products.wholesalePrice FROM products WHERE products.id = item.productId LIMIT 1)`,
          ),
          "wholesalePrice",
        ],
      );
    }

    // STEP 3: Fetch items with dynamic attributes
    const items = await item.findAll({
      where: {
        orderId: orderFreqData.orderId,
      },
      attributes: itemAttributes,
      raw: true,
    });
    console.log(
      `[FREQ_ORDER][ITEMS_FETCHED] runId=${runId || "manual"} frequencyId=${id} sourceOrderId=${orderFreqData.orderId} items=${items?.length || 0}`,
    );

    // STEP 4: Fetch additional order details from original order
    const orderDetails = await order.findOne({
      where: { id: orderFreqData.orderId },
      attributes: [
        "addressId",
        "orderFrequencyId",
        "paymentMethodId",
        "paymentMethod",
        "on",
        "vat",
        "type",
      ],
      raw: true,
    });

    // STEP 5: Combine into result object (maintain existing structure)
    const result = {
      ...orderFreqData,
      ...orderDetails,
      on: orderFreqData.nextOrderDate, // Use nextOrderDate as 'on' for new order
      items: items,
    };

    // console.log('ðŸš€ ~ frequencyBookOrder ~ result:', result);
    const customer = await user.findOne({
      where: { id: result.userId },
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
    if (!customer) {
      await orderFrequency.update(
        { status: 0 },
        { where: { id: result.orderFrequencyId } },
      );
      console.log(
        `[FREQ_ORDER][SKIP] runId=${runId || "manual"} frequencyId=${id} reason=customer_not_found status_set=0`,
      );
      return {
        success: false,
        orderId: null,
        frequencyId: id,
        error: "Customer not found for frequency order",
      };
    }
    let productsPrice = 0;
    // let percentageDiscount = parseFloat(customer?.defaultDiscount) || 0;
    let totalWeight = 0;
    let discountOnItemsPrice = 0;

    result?.items.forEach((item) => {
      const percentageDiscount = parseFloat(item.percentageDiscount || 0);
      item.weight = parseFloat(item?.weight || 0) * (item?.qty * 1);
      item.price = item?.price
        ? parseFloat(item?.price) * (item?.qty * 1)
        : parseFloat(item?.servicePrice);
      item.discount = 0;
      if (percentageDiscount > 0 && item?.productId) {
        // Calculate discount amount
        const discountAmount = (item.price * percentageDiscount) / 100;
        // Calculate final price after discount
        const discountedPrice = item.price - discountAmount;

        item.price = discountedPrice;
        item.discount = discountAmount;
      }
      discountOnItemsPrice += item.discount;
      productsPrice += item.price;
      totalWeight += item.weight;
      if (result?.salesRepId) {
        const currentPrice = item?.price
          ? item?.price
          : parseFloat(item?.servicePrice);

        if (customer.partnerType == "direct-partner") {
          item.salerCommission = currentPrice;
          item.wholesalePrice = 0;
        } else {
          item.salerCommission =
            result?.type === "direct-invoice"
              ? parseFloat(currentPrice)
              : currentPrice -
                parseFloat(item?.wholesalePrice || 0) * item?.qty;
          item.wholesalePrice =
            parseFloat(item?.wholesalePrice || 0) * item?.qty;
        }
      } else {
        item.wholesalePrice = 0;
      }
    });

    const shippingCompany = await shippingCompanies.findOne({
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

    if (!shippingCompany && customer?.partnerType != "direct-partner") {
      throw new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400,
      );
    }

    result.shippingCharges =
      customer?.partnerType == "direct-partner" ? 0 : shippingCompany?.charges;
    // console.log('ðŸš€ ~ frequencyBookOrder ~ shippingCompany:', shippingCompany);
    // console.log('ðŸš€ ~ frequencyBookOrder ~ totalWeight:', totalWeight);
    result.itemsPrice = productsPrice;
    result.discountPrice = discountOnItemsPrice;
    // result.discountPercentage = percentageDiscount;
    result.subTotal = productsPrice + parseFloat(result?.vat || 0);
    result.totalBill =
      productsPrice +
      parseFloat(result?.vat || 0) +
      parseFloat(shippingCompany?.charges || 0);
    result.totalWeight = parseFloat(totalWeight || 0);
    result.shippingCompany =
      result.totalWeight > 400 ? `Shipping By Truck` : "UPS";
    result.statusId = customer?.partnerType == "direct-partner" ? 3 : 1;
    result.salesRepId = result?.salesRepId;
    result.createdBy = "sales-rep";
    console.log(
      `[FREQ_ORDER][CALCULATED] runId=${runId || "manual"} frequencyId=${id} itemsPrice=${result.itemsPrice} discountPrice=${result.discountPrice} shippingCharges=${result.shippingCharges} totalBill=${result.totalBill} totalWeight=${result.totalWeight} type=${result?.type || "n/a"}`,
    );

    // return true;
    const newOrder = await order.create(result);
    newOrder.invoiceNumber = `INV00${newOrder?.id}`;
    await newOrder.save();

    result?.items.forEach((item) => {
      item.orderId = newOrder.id;
    });

    await item.bulkCreate(result.items);

    const historyEntry = [
      {
        statusId: 1,
        orderId: newOrder.id,
        on: Date.now(),
      },
      {
        statusId: 2,
        orderId: newOrder.id,
        on: Date.now(),
      },
    ];
    if (customer.partnerType == "direct-partner") {
      historyEntry.push({
        statusId: 3,
        orderId: newOrder.id,
        on: Date.now(),
      });
    }
    await orderHistory.bulkCreate(historyEntry);

    const { nextOrderDate, visibilityDate } = nextFrequencyDate({
      currentDate: result?.on,
      frequency: result.frequency,
    });
    console.log(
      "ðŸš€ ~ frequencyBookOrder ~ nextOrderDate, visibilityDate:",
      nextOrderDate,
      visibilityDate,
    );

    const updateFrequencyData = {
      nextOrderDate,
      visibilityDate,
      orderDate: result?.on,
    };
    await orderFrequency.update(updateFrequencyData, { where: { id: id } });

    if (result?.items && result.items?.length > 0) {
      orderEventsToLocalPatnerOrAdmin({ orderId: newOrder?.id });
      orderEvents({ orderId: newOrder?.id });
    }

    console.log(
      `[FREQ_ORDER][SUCCESS] runId=${runId || "manual"} frequencyId=${id} newOrderId=${newOrder.id} nextOrderDate=${nextOrderDate} visibilityDate=${visibilityDate}`,
    );
    return { success: true, orderId: newOrder.id, frequencyId: id };
  } catch (error) {
    console.log(
      `[FREQ_ORDER][ERROR] runId=${runId || "manual"} frequencyId=${id} message=${error?.message || "Unknown error"}`,
      error,
    );
    return {
      success: false,
      orderId: null,
      frequencyId: id,
      error: error?.message || "Unknown error",
    };
  }
};

exports.bookOrderAccordingToFrequency = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids || ids.length === 0) {
    return next(new AppError("No IDs provided!", 400));
  }

  //!USED IN LAMDA FUNCTION
  //  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  // const pendingOrder = await orderFrequency.findAll({
  //   where: { nextOrderDate: today },
  //   attributes:['id']
  // });

  ids.forEach((id) => {
    frequencyBookOrder({ id });
  });

  res.status(200).json({
    status: "success",
    message: "Orders booked according to frequency successfully.",
  });
});

exports.bookOrderAccordingToFrequencyLamdaFunction = catchAsync(
  async (req, res, next) => {
    const today = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'
    const runId = `freq-${Date.now()}`;
    console.log(`[FREQ_LAMBDA][START] runId=${runId} date=${today}`);
    const pendingOrders = await orderFrequency.findAll({
      where: { visibilityDate: today, status: 1 },
      attributes: ["id"],
    });
    console.log(
      `[FREQ_LAMBDA][FETCHED] runId=${runId} pendingOrders=${pendingOrders?.length || 0}`,
    );

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log(
        `[FREQ_LAMBDA][NOOP] runId=${runId} reason=no_pending_orders`,
      );
      return res.status(200).json({
        status: "fail",
        message: "No pending frequency orders for today.",
        processed: 0,
      });
    }

    const succeeded = [];
    const failed = [];
    for (const order of pendingOrders) {
      console.log(
        `[FREQ_LAMBDA][PROCESSING] runId=${runId} frequencyId=${order?.id}`,
      );
      const output = await frequencyBookOrder({ id: order?.id, runId });
      if (output?.success) {
        succeeded.push({
          frequencyId: order?.id,
          orderId: output?.orderId,
        });
      } else {
        failed.push({
          frequencyId: order?.id,
          error: output?.error || "Failed to process frequency order",
        });
      }
    }
    console.log(
      `[FREQ_LAMBDA][DONE] runId=${runId} processed=${pendingOrders.length} succeeded=${succeeded.length} failed=${failed.length}`,
    );

    return res.status(200).json({
      status: failed.length > 0 ? "partial-success" : "success",
      message:
        failed.length > 0
          ? "Some orders were not booked according to frequency."
          : "Orders booked according to frequency successfully.",
      processed: pendingOrders.length,
      succeeded: succeeded.length,
      failed: failed.length,
      failedOrders: failed,
    });
  },
);
