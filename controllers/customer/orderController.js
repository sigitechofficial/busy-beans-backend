const {
  order,
  item,
  orderHistory,
  orderFrequency,
  user,
  product,
  address,
  billingAddress,
  shippingCompanies,
  qboToken,
  sequelize,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const ThrowNotification = require("../../utils/throwNotification");
const factory = require("../handlerFactory");
const { response } = require("../../utils/response");
const { setOrderFrequency } = require("../admin/orderFrequencyController");
const {
  orderEvents,
  orderEventsToLocalPatnerOrAdmin,
} = require("../events/orderEvents");
const { createPaymentIntent } = require("../stripe");
const Stripe = require("../stripe");
const { Op, literal } = require("sequelize");
const { supplierNewOrderEvent } = require("../events/orderToSupplierEvents");
// discount;
const {
  paidInvoiceAdminOrLocalPatnerEventAndCustomer,
} = require("../events/paymentInvoicePaidEvent");
const {
  dataForEmailAndNotifications,
} = require("../../utils/emailsNotificationsData");
const {
  syncInvoiceOnQuikBooks,
  updateInvoiceOnQuickBooks,
} = require("../../services/syncInvoiceOnQBO");

const {
  syncPaymentToQuickBooks,
} = require("../../services/paymentSyncService");

// Service function to handle user bulk creation in background (fire-and-forget)
// Optimized for performance with transactions, chunking, and disabled validations
async function bulkCreateUsersBackground(input, counter) {
  const startTime = Date.now();
  const BATCH_SIZE = 500; // Process in batches to optimize memory and performance

  try {
    console.log(`🚀 Starting bulk creation of ${counter} users...`);

    // Process in batches for better memory management and performance
    for (let offset = 0; offset < counter; offset += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, counter - offset);
      const batchStartTime = Date.now();

      await processBatch(input, batchSize, offset, sequelize);

      const batchDuration = Date.now() - batchStartTime;
      console.log(
        `✅ Batch ${Math.floor(offset / BATCH_SIZE) + 1} completed: ${batchSize} users in ${batchDuration}ms (${(batchSize / (batchDuration / 1000)).toFixed(2)} users/sec)`,
      );
    }

    const totalDuration = Date.now() - startTime;
    console.log(
      `🎉 Bulk creation completed: ${counter} users in ${totalDuration}ms (${(counter / (totalDuration / 1000)).toFixed(2)} users/sec)`,
    );
  } catch (err) {
    console.error("❌ Error in bulkCreateUsersBackground:", err);
    throw err; // Re-throw to allow caller to handle if needed
  }
}

/**
 * Process a single batch of users with optimized bulk operations
 */
async function processBatch(input, batchSize, offset, sequelize) {
  const transaction = await sequelize.transaction();
  const bcrypt = require("bcryptjs");

  try {
    // 1. Pre-hash password ONCE (since all test users have the same password)
    // This avoids hashing 500 times in the beforeBulkCreate hook (which takes ~300ms each)
    // Hashing once saves ~150 seconds per batch of 500!
    const baseUserInfo = { ...input.info };
    let hashedPassword = baseUserInfo.password;
    if (baseUserInfo.password) {
      const SALT_ROUNDS = 12;
      hashedPassword = bcrypt.hashSync(baseUserInfo.password, SALT_ROUNDS);
      console.log(
        `🔐 Pre-hashed password once for batch (saved ${batchSize} hash operations)`,
      );
    }

    // 2. Prepare user creation array (pre-allocated for better performance)
    const userInfos = new Array(batchSize);

    for (let i = 0; i < batchSize; i++) {
      const index = offset + i;
      userInfos[i] = {
        ...baseUserInfo,
        password: hashedPassword, // Use pre-hashed password
        email: `newtestuser2+${index}@gmail.com`,
        name: `New Test User 2 ${index}`,
        companyName: `Test Company 2 ${index}`,
      };
    }

    // 3. Bulk create users with optimizations
    // - returning: true to get IDs for addresses
    // - validate: false for faster inserts (test data)
    // - transaction: for atomicity and better performance
    // - hooks: false to skip beforeBulkCreate hook (we already hashed passwords)
    const newUsers = await user.bulkCreate(userInfos, {
      returning: true,
      validate: false, // Skip validation for test data - much faster
      hooks: false, // Skip hooks - we already hashed passwords, saves ~150 seconds!
      transaction,
    });

    // 3. Pre-allocate address arrays (faster than dynamic push)
    const addressesToCreate = new Array(batchSize);
    const billingAddressesToCreate = new Array(batchSize);
    const baseAddress = { ...input.address };
    const baseBillingAddress = { ...input.billingAddress };

    // Fill arrays directly (faster than forEach with push)
    for (let i = 0; i < batchSize; i++) {
      addressesToCreate[i] = {
        ...baseAddress,
        userId: newUsers[i].id,
      };
      billingAddressesToCreate[i] = {
        ...baseBillingAddress,
        userId: newUsers[i].id,
      };
    }

    // 4. Bulk create addresses in parallel (already optimized)
    // validate: false for faster inserts
    await Promise.all([
      address.bulkCreate(addressesToCreate, {
        validate: false,
        transaction,
      }),
      billingAddress.bulkCreate(billingAddressesToCreate, {
        validate: false,
        transaction,
      }),
    ]);

    // Commit transaction for this batch
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    console.error(`❌ Error processing batch (offset: ${offset}):`, err);
    throw err;
  }
}

exports.createUsersBulk = catchAsync(async (req, res, next) => {
  const input = {
    info: {
      password: "123456",
      status: true,
      phoneNumber: "3227765654",
      countryCode: "+1",
      saleTaxNumber: "da",
      dispatchEmail: "sigidevelopers@gmail.com",
      emailToSendInvoices: "sigidevelopers@gmail.com",
      defaultDiscount: null,
    },
    address: {
      companyaddress: "",
      addressLineOne: "Dharampura",
      addressLineTwo: "house no 123",
      town: "Lahore",
      country: "United States",
      state: "Texas",
      zipCode: "51000",
      status: true,
    },
    billingAddress: {
      addressLineOne: "Dharampura",
      addressLineTwo: "house no 123",
      town: "Lahore",
      country: "United States",
      state: "Texas",
      zipCode: "51000",
      status: true,
    },
  };

  let counter = 1000; // Number of users to create

  // Kick off background task - don't await
  bulkCreateUsersBackground(input, counter);

  // Immediately respond to client
  return res.status(202).json({
    status: "processing",
    message: `Bulk user creation started for ${counter} users. Users will be created in the background.`,
  });
});
/**
 * Process a single batch of orders with optimized bulk operations
 */
async function processOrderBatch(input, batchSize, offset, sequelize) {
  const transaction = await sequelize.transaction();

  try {
    const baseOrder = { ...input.order };
    const baseItems = input.items;
    const itemsPerOrder = baseItems.length;

    // 1. Prepare orders array with unique invoice numbers
    const ordersToCreate = new Array(batchSize);
    for (let i = 0; i < batchSize; i++) {
      const index = offset + i;
      ordersToCreate[i] = {
        ...baseOrder,
        invoiceNumber: `INV11${index}`,
      };
    }

    // 2. Bulk create orders
    const newOrders = await order.bulkCreate(ordersToCreate, {
      returning: true,
      validate: false, // Skip validation for test data - faster
      transaction,
    });

    // 3. Prepare items array (flattened for all orders)
    const itemsToCreate = new Array(batchSize * itemsPerOrder);
    let itemIndex = 0;
    for (let i = 0; i < batchSize; i++) {
      const orderId = newOrders[i].id;
      for (let j = 0; j < itemsPerOrder; j++) {
        itemsToCreate[itemIndex] = {
          ...baseItems[j],
          orderId: orderId,
        };
        itemIndex++;
      }
    }

    // 4. Prepare order history array
    const orderHistoriesToCreate = new Array(batchSize);
    const currentTime = Date.now();
    for (let i = 0; i < batchSize; i++) {
      orderHistoriesToCreate[i] = {
        statusId: 1,
        orderId: newOrders[i].id,
        on: currentTime,
      };
    }

    // 5. Bulk create items and order histories in parallel
    await Promise.all([
      item.bulkCreate(itemsToCreate, {
        validate: false,
        transaction,
      }),
      orderHistory.bulkCreate(orderHistoriesToCreate, {
        validate: false,
        transaction,
      }),
    ]);

    await transaction.commit();

    // Return order IDs for response
    return newOrders.map((o) => ({ orderId: o.id }));
  } catch (err) {
    await transaction.rollback();
    console.error(`❌ Error processing order batch (offset: ${offset}):`, err);
    throw err;
  }
}
exports.createOrderDirect = catchAsync(async (req, res, next) => {
  const input = {
    order: {
      totalBill: "56.60",
      subTotal: "40.00",
      discountPrice: "0.00",
      discountPercentage: 0,
      itemsPrice: "40.00",
      vat: 0,
      totalWeight: 1,
      statusId: 1,
      note: "",
      paymentMethod: "bank check",
      poNumber: "",
      frequency: "just-onces",
      shippingCharges: "16.60",
      userId: 247,
      addressId: 379,
    },
    items: [
      {
        categoryId: 6,
        createdAt: "2025-12-02T10:24:47.000Z",
        deleted: false,
        desc: "demo description from test script",
        productId: 92,
        image: "public/products/product-1764671085918.png",
        name: "Coffee 2",
        price: "40.00",
        qty: 1,
        quantity: "3",
        status: true,
        unit: "lbs",
        updatedAt: "2025-12-02T10:24:47.000Z",
        weight: "1.00",
        wholesalePrice: "20.00",
      },
    ],
  };

  const counter = 100; // Number of orders to create
  const BATCH_SIZE = 50; // Process in batches for better performance
  const startTime = Date.now();
  const createdOrders = [];

  console.log(`🚀 Starting bulk creation of ${counter} orders...`);

  // Process in batches
  for (let offset = 0; offset < counter; offset += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, counter - offset);
    const batchStartTime = Date.now();

    const batchOrders = await processOrderBatch(
      input,
      batchSize,
      offset,
      sequelize,
    );

    createdOrders.push(...batchOrders);

    const batchDuration = Date.now() - batchStartTime;
    console.log(
      `✅ Batch ${Math.floor(offset / BATCH_SIZE) + 1} completed: ${batchSize} orders in ${batchDuration}ms (${(batchSize / (batchDuration / 1000)).toFixed(2)} orders/sec)`,
    );
  }

  const totalDuration = Date.now() - startTime;
  console.log(
    `🎉 Bulk order creation completed: ${counter} orders in ${totalDuration}ms (${(counter / (totalDuration / 1000)).toFixed(2)} orders/sec)`,
  );

  return res.status(200).json({
    status: "success",
    data: {
      createdOrdersCount: createdOrders.length,
      createdOrders,
      performance: {
        totalTime: totalDuration,
        ordersPerSecond: (counter / (totalDuration / 1000)).toFixed(2),
      },
    },
  });
});

// const { orderEvents } = require("../events/orderEvents");
exports.notificationTesting = async (req, res, next) => {
  //   const orderData = await dataForEmailAndNotifications(
  //     req.body.id,
  //     "local-partner"
  //   );

  //   paidInvoiceAdminOrLocalPatnerEventAndCustomer({
  //     orderId: 15,
  //     orderType: true ? "local-partner" : "customer",
  //   });
  //   //
  //   const row = await qboToken.findOne();
  //   syncInvoiceOnQuikBooks({ orderId: 525, orderType: "customer" });
  //   syncPaymentToQuickBooks({ orderId: 5, orderType: "customer" });
  syncInvoiceOnQuikBooks({ orderId: req.body?.id, updateRequest: false });
  //   updateInvoiceOnQuickBooks({ orderId: 21, orderType: "local-partner" });
  //   orderEvents({ orderId: req.body.id, orderType: "local-partner" });
  return res.status(200).json(response({ data: req.user }));
};

exports.bookOrder = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log(
    "🚀 ~ exports.bookOrderbookOrderbookOrderbookOrderbookOrderbookOrder=catchAsync ~ input:",
    input,
  );
  if (input?.items?.length < 1) {
    throw new AppError("Cart is empty add products to place order", 404);
  }
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

  input.order.statusId = 1;
  input.order.salesRepId = customer?.salesRepId;
  let itemsPrice = 0;
  let discountOnItemsPrice = 0;
  let totalWeight = 0;
  let productIds = input?.items.map((item) => item.productId);
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds);

  const productAttributes = [
    "id",
    "name",
    "quantity",
    "categoryId",
    "weight",
    "sku",
    "grind",
    "productCode",
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
    productAttributes.push("price", "wholesalePrice");
  }

  const products = await product.findAll({
    where: {
      id: { [Op.in]: productIds },
    },
    attributes: productAttributes,
    raw: true,
  });
  console.log(
    "🚀 ~ exports.bookOrder=catchAsync ~ products:",
    products?.length,
  );

  const finalItems = products.map((obj) => {
    const element = {};
    const percentageDiscount = parseFloat(obj?.discountPercentage || 0);
    element.productId = obj.id;
    element.categoryId = obj?.categoryId;

    let prod = input?.items.find((item) => item.productId == obj.id);
    let qty = prod ? parseInt(prod.qty) : 1;
    element.qty = qty;
    element.price = obj.price * qty;
    element.wholesalePrice = obj.wholesalePrice * qty;
    element.weight = obj.weight * qty;
    element.discount = 0;
    if (percentageDiscount > 0) {
      const discountAmount = (element.price * percentageDiscount) / 100;
      const discountedPrice = element.price - discountAmount;
      element.price = discountedPrice;
      element.discount = discountAmount;
    }
    discountOnItemsPrice += element.discount;
    itemsPrice += element.price;
    totalWeight += element.weight;
    if (customer?.salesRepId) {
      if (customer.partnerType == "direct-partner") {
        element.salerCommission = parseFloat(element.price);
        element.wholesalePrice = 0;
      } else {
        element.salerCommission =
          parseFloat(element.price) - parseFloat(element.wholesalePrice || 0);
      }
    } else {
      element.wholesalePrice = 0;
    }
    return element;
  });

  const shippingCompany = await shippingCompanies.findOne({
    where: {
      weightFrom: { [Op.lte]: totalWeight },
      weightTo: { [Op.gte]: totalWeight },
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

  input.order.itemsPrice = itemsPrice;
  input.order.discountPrice = discountOnItemsPrice;
  input.order.shippingCharges =
    customer?.partnerType != "direct-partner" ? shippingCompany?.charges : 0;
  input.order.totalWeight = parseFloat(totalWeight);
  input.order.shippingCompany =
    input.order.totalWeight > 400 ? `Shipping By Truck` : "UPS";
  input.order.subTotal = itemsPrice + parseFloat(input.order.vat || 0);
  input.order.totalBill =
    parseFloat(itemsPrice) +
    parseFloat(input?.order?.vat || 0) +
    parseFloat(input.order.shippingCharges || 0);

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
  orderEventsToLocalPatnerOrAdmin({ orderId: newOrder?.id });
  orderEvents({ orderId: newOrder?.id });
  return res.status(200).json({
    status: "success",
    data: { id: newOrder?.id },
  });
});

exports.SheetUplod = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log(
    "🚀 ~ exports.bookOrderbookOrderbookOrderbookOrderbookOrderbookOrder=catchAsync ~ input:",
    input,
  );
  if (input?.items?.length < 1) {
    throw new AppError("Cart is empty add products to place order", 404);
  }
  const customer = await user.findOne({
    where: { id: input?.order?.userId },
    attributes: ["salesRepId"],
  });
  input.order.statusId = 5;
  input.order.salesRepId = customer?.salesRepId;
  let itemsPrice = 0;
  let totalWeight = 0;
  let productIds = input?.items.map((item) => item.productId);
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds);
  const products = await product.findAll({
    where: {
      id: {
        [Op.in]: productIds,
      },
    },
  });
  // return res.json(products)
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ products:", products.length);
  const finalItems = products.map((obj) => {
    const element = {};
    element.productId = obj.id;
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

    // Accumulate the total weight and price
    itemsPrice += element.price;
    totalWeight += element.weight;

    // Handle salesRep commission if applicable
    if (customer?.salesRepId) {
      element.salerCommission =
        parseFloat(element.price) - parseFloat(element.wholesalePrice);
    } else {
      element.wholesalePrice = 0;
    }
    return element; // Return the transformed element
  });
  input.order.itemsPrice = itemsPrice;
  input.order.totalWeight = totalWeight;
  input.order.subTotal = itemsPrice + parseFloat(input.order.vat || 0);
  input.order.totalBill =
    parseFloat(itemsPrice) +
    parseFloat(input?.order?.vat || 0) +
    parseFloat(input.order.shippingCharges || 0);

  const newOrder = await order.create(input?.order);
  newOrder.invoiceNumber = input.order?.invoiceNumber
    ? input.order.invoiceNumber
    : `INV00${newOrder?.id}`;
  await newOrder.save();

  await orderHistory.bulkCreate([
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
    {
      statusId: 3,
      orderId: newOrder.id,
      on: Date.now(),
    },
    {
      statusId: 4,
      orderId: newOrder.id,
      on: Date.now(),
    },
    {
      statusId: 5,
      orderId: newOrder.id,
      on: Date.now(),
    },
  ]);

  finalItems.forEach((element) => {
    element.orderId = newOrder.id;
  });
  await item.bulkCreate(finalItems);
  // if(newOrder.frequency != 'just-onces')setOrderFrequency({orderData:newOrder,salesRepId:customer?.salesRepId})
  return res.status(200).json({
    status: "success",
    data: { id: newOrder?.id, input: input },
  });
});

exports.paymentIntent = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ input:", input);
  if (input?.items?.length < 1) {
    throw new AppError("Cart is empty add products to place order", 404);
  }
  const customer = await user.findOne({
    where: { id: input?.order?.userId },
    attributes: [
      "salesRepId",
      [
        literal(
          `(SELECT salesReps.connectAccountId FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
        ),
        "connectAccountId",
      ],
    ],
  });
  input.order.salesRepId = customer?.salesRepId;
  let itemsPrice = 0;
  let productIds = input?.items.map((item) => item.productId);
  let totalWeight = 0;
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds);
  const products = await product.findAll({
    where: {
      id: {
        [Op.in]: productIds,
      },
    },
  });
  // return res.json(products)

  // Find the shipping company where the weight is between weightFrom and weightTo

  const hasLocalPatner = customer?.salesRepId ? true : false;
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ products:", products.length);
  const finalItems = products.map((obj) => {
    const element = {};
    element.productId = obj.id;
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

    // Accumulate the total weight and price
    itemsPrice += element.price;
    totalWeight += element.weight;

    // Handle salesRep commission if applicable
    if (customer?.salesRepId) {
      element.salerCommission =
        parseFloat(element.price) - parseFloat(element.wholesalePrice);
    } else {
      element.wholesalePrice = 0;
      element.salerCommission = 0;
    }
    return element; // Return the transformed element
  });

  console.log(
    "🚀 ~ exports.paymentIntent=catchAsync ~ totalWeight:",
    totalWeight,
  );
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
  if (!shippingCompany) {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400,
      ),
    );
  }
  input.order.itemsPrice = itemsPrice;
  input.order.totalWeight = totalWeight;
  input.order.subTotal = itemsPrice + input.order.vat;
  input.order.totalBill =
    parseFloat(itemsPrice) +
    parseFloat(input?.order?.vat || 0) +
    parseFloat(shippingCompany?.charges || 0);
  console.log(
    "🚀 ~ exports.paymentIntent=catchAsync ~ shippingCompany?.charges:",
    shippingCompany?.charges,
  );

  let adminReceivableAmount = input.order.totalBill;
  const localPatnerCommission = finalItems.reduce((sum, item) => {
    return sum + (item.salerCommission || 0);
  }, 0);
  let adminReceivableStatus = false;
  let localPartnerAccountId = customer.dataValues.connectAccountId;
  console.log(
    "🚀 ~ exports.paymentIntent=catchAsync ~ localPartnerAccountId:",
    localPartnerAccountId,
  );

  if (hasLocalPatner && localPatnerCommission > 0) {
    adminReceivableAmount = adminReceivableAmount - localPatnerCommission;
    adminReceivableStatus = true;
  }

  console.log(
    `🚀 ~ exports.paymentIntent=catchAsync ~ {adminReceivableAmount,hasLocalPatner,localPartnerAccountId,localPatnerCommission}:`,
    {
      adminReceivableAmount,
      hasLocalPatner,
      localPartnerAccountId,
      localPatnerCommission,
    },
  );
  const output = await createPaymentIntent({
    adminReceivableAmount,
    hasLocalPatner,
    localPartnerAccountId,
    localPatnerCommission: input.order.totalBill,
  });

  return res.status(200).json({
    status: "success",
    data: {
      shippingCharges: shippingCompany?.charges,
      adminReceivableAmount,
      adminReceivableStatus,
      localPatnerCommission,
      ...output,
    },
  });
});

async function syncStripeCustomers({ usersWithoutCustomerId }) {
  try {
    for (const item of usersWithoutCustomerId) {
      try {
        const customer = await Stripe.addCustomer({
          email: item.email,
          name: item.name,
        });

        if (customer) {
          await user.update(
            { stripeCustomerId: customer },
            { where: { id: item.id } },
          );
          console.log(`✅ Stripe customer created for ${item.email}`);
        } else {
          console.log(`⚠️ No customer ID returned for ${item.email}`);
        }
      } catch (innerErr) {
        console.error(
          `❌ Error creating Stripe customer for ${item.email}:`,
          innerErr.message,
        );
      }
    }
  } catch (err) {
    console.error("❌ Failed to fetch users:", err.message);
  }
}

exports.createStripeCustomers = catchAsync(async (req, res, next) => {
  // const output = await address.findAll({where:{stripeCustomerId:null}})

  //   const output = await address.findAll()
  //  const input = JSON.parse(JSON.stringify(output))

  //  if(output && output?.length > 0) syncStripeCustomers({usersWithoutCustomerId:output})
  //  if(output && output?.length > 0) syncStripeCustomers({usersWithoutCustomerId:output})
  // billingAddress.bulkCreate(input)
  const StripeAccount = await Stripe.createStandardConnectAccount({
    email: req.body.email,
  });

  return res.status(200).json({
    status: "success",
    data: { userCount: StripeAccount },
  });
});
