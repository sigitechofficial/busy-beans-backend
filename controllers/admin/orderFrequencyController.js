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
const {
  orderEvents,
  orderEventsToLocalPatnerOrAdmin,
} = require("../events/orderEvents");
const { supplierNewOrderEvent } = require("../events/orderToSupplierEvents");

exports.setOrderFrequency = async ({ orderData, salesRepId }) => {
  //orderData is
  try {
    if (!orderData) return false;

    const input = JSON.parse(JSON.stringify(orderData));

    const { nextOrderDate, visibilityDate } = nextFrequencyDate({
      currentDate: new Date(),
      frequency: input.frequency,
    });
    input.orderId = orderData.id;
    input.orderId = orderData.id;
    input.salesRepId = salesRepId;
    input.orderDate = new Date();
    input.nextOrderDate = nextOrderDate;
    input.visibilityDate = visibilityDate;

    const frequency = await orderFrequency.create(input);
    order.update(
      { orderFrequencyId: frequency?.id },
      { where: { id: orderData?.id } }
    );
    item.update(
      { orderFrequencyId: frequency?.id },
      { where: { orderId: orderData?.id } }
    );

    return true;
  } catch (error) {
    console.log("ðŸš€ ~ exports.onlineAppointmentConfirm= ~ error:", error);
  }
};

//* Pending order according to their frequency cycle

const { setOrderFrequency } = require("../admin/orderFrequencyController");
console.log(typeof setOrderFrequency);

exports.orderAccordingToFrequency = catchAsync(async (req, res, next) => {
  const included = [
    {
      model: item,
      attributes: [
        [
          literal(
            `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
          ),
          "product",
        ],
        [
          literal(
            `(SELECT products.price FROM products WHERE products.id = items.productId LIMIT 1)`
          ),
          "price",
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

  const doc = await orderFrequency.findAll({
    where: {
      ...condition,
      nextOrderDate: {
        [Op.notIn]: literal(`
          (SELECT DATE(orders.on) FROM orders WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate) AND orders.orderFrequencyId = orderFrequency.id)
        `),
      },
    },
    include: included,
    attributes: [
      "id",
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`
        ),
        "customerName",
      ],
      [
        literal(
          `(SELECT users.companyName FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`
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
          `(SELECT users.email FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`
        ),
        "email",
      ],
      "status",
      "orderDate",
      "nextOrderDate",
      "frequency",
      "visibilityDate",
    ],
  });

  res.status(200).json({
    status: "success",
    data: {
      order: doc,
    },
  });
});

exports.bookNewOrder = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log(
    "🚀 ~ exports.bookNewOrder=catchAsync ~ input:",
    input?.order?.userId
  );
  // if (input?.items?.length < 1) {
  //   throw new AppError('Cart is empty add products to place order', 404);
  // }

  const customer = await user.findOne({ where: { id: input?.order?.userId } });
  console.log("🚀 ~ exports.bookNewOrder=customer ~ customer:", customer?.id);
  if (!customer) {
    return next(new AppError("Customer not found.", 404));
  }

  if (!input?.order?.shippingCharges) {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400
      )
    );
  }

  if (customer?.salesRepId) {
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
      credit?.dataValues?.creditUsed
    );
    console.log(
      "---------------------------------creditLimit",
      credit?.creditLimit
    );

    if (percentage >= 80) {
      throw new AppError(
        `You've used over 80% of your credit limit. Please clear your balance before placing further orders.`,
        404
      );
    }
  }

  input.order.statusId = input.order?.invoiceOnly ? 5 : 1;
  input.order.userId = customer.id;
  input.order.salesRepId = customer?.salesRepId;
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
    // Calculate price, wholesalePrice, and weight for the item
    element.price = obj.price * qty;
    element.wholesalePrice = obj.wholesalePrice * qty;
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
    if (customer?.salesRepId) {
      element.salerCommission =
        parseFloat(element.price) - parseFloat(element.wholesalePrice || 0);
    } else {
      element.wholesalePrice = 0;
    }
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

  const newOrder = await order.create(input?.order);
  newOrder.invoiceNumber = `INV00${newOrder?.id}`;
  await newOrder.save();

  await orderHistory.bulkCreate([
    {
      statusId: 1,
      orderId: newOrder.id,
      on: Date.now(),
    },
  ]);

  finalItems.forEach((element) => {
    element.orderId = newOrder.id;
  });

  await item.bulkCreate(finalItems);

  if (newOrder.frequency != "just-onces")
    setOrderFrequency({
      orderData: newOrder,
      salesRepId: customer?.salesRepId,
    });

  if (input?.items && input.items?.length > 0) {
    orderEventsToLocalPatnerOrAdmin({ orderId: newOrder?.id });
    orderEvents({ orderId: newOrder?.id });
  }
  return res.status(200).json({
    status: "success",
    data: { id: newOrder?.id },
  });
});

// exports.bookNewOrder = catchAsync(async (req, res, next) => {
//   const input = req.body;
//   console.log(
//     '🚀 ~ exports.bookNewOrder=catchAsync ~ input:',
//     input?.order?.userId,
//   );
//   if (input?.items?.length < 1) {
//     throw new AppError('Cart is empty add products to place order', 404);
//   }

//   const customer = await user.findOne({ where: { id: input?.order?.userId } });
//   console.log('🚀 ~ exports.bookNewOrder=customer ~ customer:', customer?.id);
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

const frequencyBookOrder = async ({ id }) => {
  //orderData is
  // let productsPrice = 0;
  try {
    const doc = await orderFrequency.findByPk(id, {
      include: [
        {
          model: item,
          // where: { productId: { [Op.ne]: null } },
          attributes: [
            [
              literal(
                `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.price FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              "price",
            ],
            [
              literal(
                `(SELECT products.wholesalePrice FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              "wholesalePrice",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              "weight",
            ],
            "qty",
            "productId",
            "categoryId",
            [
              literal(
                `(SELECT percentage FROM userDiscounts WHERE userDiscounts.categoryId = items.categoryId AND userDiscounts.userId = orderFrequency.userId LIMIT 1)`
              ),
              "percentageDiscount",
            ],
            ["price", "servicePrice"],
            "productName",
            "type",
          ],
          raw: true,
        },
      ],
      attributes: [
        ["id", "orderFrequencyId"],
        [
          literal(
            `(SELECT orders.addressId FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
          ),
          "addressId",
        ],
        [
          literal(
            `(SELECT orders.orderFrequencyId FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
          ),
          "orderFrequencyId",
        ],
        [
          literal(
            `(SELECT orders.paymentMethodId FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
          ),
          "paymentMethodId",
        ],
        [
          literal(
            `(SELECT orders.paymentMethod FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
          ),
          "paymentMethod",
        ],
        [
          literal(
            `(SELECT orders.on FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
          ),
          "on",
        ],
        [
          literal(
            `(SELECT orders.vat FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
          ),
          "vat",
        ],
        ["nextOrderDate", "on"],
        "frequency",
        "userId",
        "salesRepId",
      ],
    });

    const result = JSON.parse(JSON.stringify(doc));
    // console.log('🚀 ~ frequencyBookOrder ~ result:', result);
    const customer = await user.findOne({
      where: { id: result.userId, deleted: 0 },
      attributes: ["salesRepId", "defaultDiscount"],
    });
    if (!customer) {
      await orderFrequency.update(
        { status: 0 },
        { where: { id: result.orderFrequencyId } }
      );
      return false;
    }
    let productsPrice = 0;
    // let percentageDiscount = parseFloat(customer?.defaultDiscount) || 0;
    let totalWeight = 0;
    let discountOnItemsPrice = 0;

    result?.items.forEach((item) => {
      const percentageDiscount = parseFloat(item.percentageDiscount || 0);
      item.weight = parseFloat(item?.weight || 0) * (item?.qty * 1);
      console.log("🚀 ~ frequencyBookOrder BEFORE ~ item?.price:", item?.price);
      item.price = item?.price
        ? parseFloat(item?.price) * (item?.qty * 1)
        : parseFloat(item?.servicePrice);
      console.log("🚀 ~ frequencyBookOrder AFTER ~ item?.price:", item?.price);
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
        console.log(
          "🚀 ~ frequencyBookOrder DISCOUNTED ~ item?.price:",
          item?.price
        );
        console.log(
          "🚀 ~ frequencyBookOrder DISCOUNTED ~ item?.price:",
          item?.price
        );
        console.log(
          "🚀 ~ frequencyBookOrder DISCOUNTED ~ item?.price:",
          item?.price
        );
        console.log(
          "🚀 ~ frequencyBookOrder DISCOUNTED ~ item?.price:",
          item?.price
        );
        const currentPrice = item?.price
          ? item?.price
          : parseFloat(item?.servicePrice);
        item.salerCommission =
          currentPrice - parseFloat(item?.wholesalePrice || 0) * item?.qty; // Multiply weight by quantity
        item.wholesalePrice = parseFloat(item?.wholesalePrice || 0) * item?.qty;
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

    result.shippingCharges = shippingCompany?.charges || 0;
    // console.log('🚀 ~ frequencyBookOrder ~ shippingCompany:', shippingCompany);
    // console.log('🚀 ~ frequencyBookOrder ~ totalWeight:', totalWeight);
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
    result.statusId = 1;
    result.salesRepId = result?.salesRepId;
    result.createdBy = "sales-rep";
    console.log("🚀 ~ frequencyBookOrder ~ result:", result);

    // return true;
    const newOrder = await order.create(result);
    newOrder.invoiceNumber = `INV00${newOrder?.id}`;
    await newOrder.save();

    result?.items.forEach((item) => {
      item.orderId = newOrder.id;
    });

    console.log("🚀 ~ frequencyBookOrder ~ result.items:", result.items);
    item.bulkCreate(result.items);

    orderHistory.create({
      statusId: 1,
      orderId: newOrder?.id,
      on: Date.now(),
    });

    const { nextOrderDate, visibilityDate } = nextFrequencyDate({
      currentDate: result?.on,
      frequency: result.frequency,
    });
    console.log(
      "🚀 ~ frequencyBookOrder ~ nextOrderDate, visibilityDate:",
      nextOrderDate,
      visibilityDate
    );

    const updateFrequencyData = {
      nextOrderDate,
      visibilityDate,
      orderDate: result?.on,
    };
    await orderFrequency.update(updateFrequencyData, { where: { id: id } });

    console.log("ðŸš€ ~ frequencyBookOrder ~ result:", updateFrequencyData);
    return true;
  } catch (error) {
    console.log("ðŸš€ ~ exports.frequencyBookOrder = ~ error:", error);
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
    console.log("🚀🚀🚀🚀🚀🚀 ~ today:", today);
    const pendingOrders = await orderFrequency.findAll({
      where: { visibilityDate: today, status: 1 },
      attributes: ["id"],
    });
    console.log("🚀 ~ pendingOrders:", pendingOrders);

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log("❌ No pending frequency orders for today.");
      return res.status(200).json({
        status: "fail",
        message: "No pending frequency orders for today.",
        processed: 0,
      });
    }

    for (const order of pendingOrders) {
      console.log("🔁~processing order", order?.id);
      await frequencyBookOrder({ id: order?.id });
    }

    return res.status(200).json({
      status: "success",
      message: "Orders booked according to frequency successfully.",
      processed: pendingOrders.length,
    });
  }
);
