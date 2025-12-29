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
  const createdUsers = [];

  for (let i = 0; i < counter; i++) {
    // 1. Prepare the user info, customize the email
    const uniqueEmail = `newtestuser2+${i}@gmail.com`;
    const uniqueName = `New Test User 2 ${i}`;
    const uniqueCompanyName = `Test Company 2 ${i}`;
    const userInfo = {
      ...input.info,
      email: uniqueEmail,
      name: uniqueName,
      companyName: uniqueCompanyName,
    };

    // 2. Create the user
    const newUser = await user.create(userInfo);

    // 3. Prepare and create shipping (address) and billingAddress for the user
    const addressData = {
      ...input.address,
      userId: newUser.id,
    };
    const billingAddressData = {
      ...input.billingAddress,
      userId: newUser.id,
    };

    // Create shipping address
    await address.create(addressData);
    // Create billing address
    await billingAddress.create(billingAddressData);

    // createdUsers.push({ userId: newUser.id, email: uniqueEmail });
  }

  return res.status(200).json({
    status: "success",
    data: {
      //   createdUsersCount: createdUsers.length,
      //   createdUsers,
      //   input,
    },
  });
});

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

  let counter = 100; // Number of orders to create
  const createdOrders = [];

  for (let i = 0; i < counter; i++) {
    // 1. Create the order from input.order
    const newOrder = await order.create(input.order);

    // 2. Attach the orderId to items and create them
    const itemsWithOrderId = input.items.map((item) => ({
      ...item,
      orderId: newOrder.id,
    }));
    await item.bulkCreate(itemsWithOrderId);

    // 3. Create order status history records (you can customize as needed)
    await orderHistory.bulkCreate([
      {
        statusId: 1,
        orderId: newOrder.id,
        on: Date.now(),
      },
    ]);

    createdOrders.push({ orderId: newOrder.id });
  }

  return res.status(200).json({
    status: "success",
    data: { createdOrdersCount: createdOrders.length, createdOrders, input },
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
    input
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
          `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
        ),
        "salesRepName",
      ],
      [
        literal(
          `(SELECT salesReps.partnerType FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
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
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ products:", products);

  // let percentageDiscount = parseFloat(customer?.defaultDiscount) || 0;

  const finalItems = products.map((obj) => {
    const element = {};
    const percentageDiscount = parseFloat(
      obj.dataValues?.discountPercentage || 0
    );
    console.log(
      "🚀 ~ obj.dataValues?.percentageDiscount:",
      obj.dataValues?.percentageDiscount
    );
    console.log("🚀 ~ percentageDiscount:", percentageDiscount);
    console.log("🚀 ~ percentageDiscount:", percentageDiscount);
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
    element.discount = 0;
    if (percentageDiscount > 0) {
      // Calculate discount amount
      const discountAmount = (element.price * percentageDiscount) / 100;
      // Calculate final price after discount
      const discountedPrice = element.price - discountAmount;

      element.price = discountedPrice;
      element.discount = parseFloat(discountAmount);
    }
    // Accumulate the total weight and price
    discountOnItemsPrice += element.discount;
    itemsPrice += element.price;
    totalWeight += element.weight;
    // Handle salesRep commission if applicable
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
    return element; // Return the transformed element
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

  if (!shippingCompany) {
    return next(
      new AppError(
        "Not dealing in such weights. Contact customer support for this order.",
        400
      )
    );
  }

  input.order.itemsPrice = itemsPrice;
  input.order.discountPrice = discountOnItemsPrice;
  // input.order.discountPercentage = percentageDiscount;//!Later
  input.order.shippingCharges = shippingCompany?.charges;
  input.order.totalWeight = parseFloat(totalWeight);
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
    input
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
          `(SELECT salesReps.connectAccountId FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
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
    totalWeight
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
        400
      )
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
    shippingCompany?.charges
  );

  let adminReceivableAmount = input.order.totalBill;
  const localPatnerCommission = finalItems.reduce((sum, item) => {
    return sum + (item.salerCommission || 0);
  }, 0);
  let adminReceivableStatus = false;
  let localPartnerAccountId = customer.dataValues.connectAccountId;
  console.log(
    "🚀 ~ exports.paymentIntent=catchAsync ~ localPartnerAccountId:",
    localPartnerAccountId
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
    }
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
            { where: { id: item.id } }
          );
          console.log(`✅ Stripe customer created for ${item.email}`);
        } else {
          console.log(`⚠️ No customer ID returned for ${item.email}`);
        }
      } catch (innerErr) {
        console.error(
          `❌ Error creating Stripe customer for ${item.email}:`,
          innerErr.message
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
