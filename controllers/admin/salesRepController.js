const {
  salesRep,
  user,
  address,
  order,
  item,
  salesFromPatners,
  stateInSystem,
  billingAddress,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const Stripe = require("../stripe");
const factory = require("../handlerFactory");
const { sendQuotationEvent } = require("../events/sendQuotationEvents");
const {
  connectStripeAccountEvent,
} = require("../events/connectStripeAccountEvent");
const { response } = require("../../utils/response");
const { Op, literal, fn, col } = require("sequelize");
const {
  deleteDeviceTokenMultiple,
  deleteDeviceTokenSingle,
} = require("../../utils/deviceTokenDelete");

exports.getAllSalesRep = factory.getAll(salesRep);

exports.getSalesRepForOrderCreation = catchAsync(async (req, res, next) => {
  const condition = { partnerType: "direct-partner", deleted: 0 };
  if (req.query.salesRepId) {
    condition.id = req.query.salesRepId;
  }
  const data = await salesRep.findAll({
    where: condition,
    attributes: ["id", "srName", "email", "state", "territoryName"],
    include: [
      {
        model: address,
        attributes: { exclude: ["createdAt", "userId", "updatedAt"] },
      },
      //   {
      //     model: billingAddress,
      //     attributes: { exclude: ["createdAt", "userId", "updatedAt"] },
      //   },
    ],
  });

  res.status(200).json({
    status: "success",
    data: data,
  });
});

exports.getSalesRep = catchAsync(async (req, res, next) => {
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);

  const data = await salesRep.findOne({
    where: { id: req.params.id, deleted: 0 },
    attributes: { exclude: ["password", "updatedAt"] },
    include: [
      {
        model: address,
        attributes: { exclude: ["createdAt", "userId", "updatedAt"] },
      },
      {
        model: billingAddress,
        attributes: { exclude: ["createdAt", "userId", "updatedAt"] },
      },
    ],
  });

  res.status(200).json({
    status: "success",
    data: data,
  });
});

// exports.createSalesRep = factory.createOne(salesRep);
exports.updateAddresses = catchAsync(async (req, res, next) => {
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);

  if (req.body?.newAddressess) {
    await address.bulkCreate(req.body?.newAddressess);
  }

  if (req.body?.addresses) {
    await address.update(req.body.addresses, {
      where: { id: req.body?.addresses?.id },
    });
  }
  if (req.body?.billingAddress) {
    const userId = Number(req.params.id);
    const [affected] = await billingAddress.update(req.body.billingAddress, {
      where: { userId },
    });

    if (affected === 0) {
      await billingAddress.create({ userId, ...req.body.billingAddress });
    }
  }

  //   if (req.body?.userDiscount && req.body?.userDiscount.length > 0) {
  //     req.body?.userDiscount.forEach((obj) => {
  //       obj.userId = req.params.id;
  //     });
  //     await userDiscount.destroy({
  //       where: { deleted: 0, userId: req.params.id },
  //     });
  //     await userDiscount.bulkCreate(req.body?.userDiscount);
  //   }

  res.status(200).json({
    status: "success",
    data: {},
  });
});
exports.updateSalesRep = factory.updateOne(salesRep);

exports.createSalesRep = catchAsync(async (req, res, next) => {
  const input = req.body;
  console.log("ðŸš€ ~ exports.createSalesRep=catchAsync ~ input:", input);

  const condition = { deleted: 0 };
  condition.email = input?.email;
  // condition.state = input?.state
  const exist = await salesRep.findOne({
    where: condition,
    attributes: ["id"],
  });

  if (exist) {
    if (exist.email == input.email) {
      return next(new AppError("Email already exist", 400));
    }
    // else{
    //   return next(new AppError('State already has a local Patner', 400));
    // }
  }

  if (req.file) {
    // throw new  'Image not uploaded', 'Please upload image';
    const tmpPath = req.file.path;
    const imagePath = tmpPath.replace(/\\/g, "/");
    input.image = imagePath;
    console.log("ðŸš€ ~ catchAsync ~ nput.image:", input.image);
  } else {
    input.image = undefined;
    console.log("ðŸš€ ~ c ~ input.image:", input.image);
  }

  const stripeCustomer = await Stripe.addCustomer({
    name: input.srName,
    email: input.email,
  });
  input.stripeCustomerId = stripeCustomer;

  const doc = await salesRep.create(input);
  await stateInSystem.update(
    { salesRepId: doc?.id },
    { where: { name: input?.state } }
  );

  connectStripeAccountEvent({ patner: doc });

  return res.status(201).json({
    status: "success",
    data: {
      data: doc,
    },
  });
});

exports.createFinancialConnectionsSession = catchAsync(
  async (req, res, next) => {
    const patner = await salesRep.findOne({ where: { id: req.params.srId } });
    if (patner?.defaultBankAccount) {
      return res.status(200).json({
        status: "success",
        message: `Your bank account is connected. You're all set`,
        data: { clientSecret: null, setputIntendId: null },
      });
    }
    let stripeCustomerId = patner?.stripeCustomerId;
    if (!patner?.stripeCustomerId) {
      const stripeCustomer = await Stripe.addCustomer({
        name: patner.srName,
        email: patner.email,
      });
      patner.stripeCustomerId = stripeCustomer;
      await patner.save();
      stripeCustomerId = stripeCustomer;
    }
    console.log(
      "ðŸš€ ~ exports.createFinancialConnectionsSession=catchAsync ~ stripeCustomerId:",
      stripeCustomerId
    );

    const session = await Stripe.financialConnectionsSession({
      customerId: stripeCustomerId,
    });

    // console.log(
    //   'ðŸš€ ~ exports.createFinancialConnectionsSession=catchAsync ~ session:',
    //   session,
    // );

    return res.status(200).json({
      status: "success",
      data: {
        clientSecret: session?.client_secret,
        setputIntendId: session.id,
      },
    });
  }
);

exports.attachBankAccount = catchAsync(async (req, res, next) => {
  const { paymentMethodId } = req.body;
  const patner = await salesRep.findOne({ where: { id: req.params.srId } });

  const attach = await Stripe.attachBankAccountPaymentMethod({
    paymentMethodId,
    customerId: patner.stripeCustomerId,
  });

  patner.defaultBankAccount = attach.success ? attach.paymentMethodId : null;
  await patner.save();

  return res.status(200).json({
    status: "success",
    data: { attach },
  });
});

exports.deleteSalesRep = catchAsync(async (req, res, next) => {
  await salesRep.update(
    { deleted: true },
    {
      where: { id: req.params.id },
    }
  );

  await user.update(
    { salesRepId: null },
    {
      where: { salesRepId: req.params.id },
    }
  );

  return res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.addCustomer = catchAsync(async (req, res, next) => {
  req.body.info.verifiedAt = new Date();
  console.log("🚀 ~ exports.addCustomer=catchAsync ~ req.body:", req.body);
  req.body.info.salesRepId = req.params?.srId || null;
  req.body.info.createdBy = req.params?.srId ? "sales-rep" : "admin";
  const newUser = await user.create(req.body?.info);

  req.body.address.userId = newUser?.id;
  req.body.billingAddress.userId = newUser?.id;
  const defaultAddress = await address.create(req.body?.address);
  await billingAddress.create(req.body?.billingAddress);

  console.log(
    "🚀 ~ exports.signup=catchsasdsadasdasdasdsdAsync ~ req.body?.address:",
    defaultAddress
  );

  const stripeCustomerId = await Stripe.addCustomer({
    email: newUser?.email,
    name: newUser?.name,
  });
  newUser.stripeCustomerId = stripeCustomerId;
  await newUser.save();

  return res.status(200).json(
    response({
      data: {
        message: "Customer added successfully.",
        data: { id: newUser.id },
      },
    })
  );
});

exports.stripeConnectAccount = catchAsync(async (req, res, next) => {
  const sr = await salesRep.findOne({ where: { id: req.params.srId } });
  if (!sr) {
    return next(new AppError("Data not Found!", 404));
  }

  const connectAccount = await Stripe.createConnectAccount({
    email: sr.email,
    returnUrl: req.body.returnUrl,
  });

  sr.connectAccountId = connectAccount.accountId;

  await sr.save();
  return res.status(200).json(
    response({
      data: {
        message: "Connect Account.",
        data: connectAccount,
      },
    })
  );
});

exports.stripeConnectAccountLink = catchAsync(async (req, res, next) => {
  const sr = await salesRep.findOne({ where: { id: req.params.srId } });
  if (!sr) {
    return next(new AppError("Data not Found!", 404));
  }
  console.log("ðŸš€ ~ exports.stripeConnectAccount=catchAsync ~ sr:", sr);

  const connectAccount = await Stripe.createStripeAccountLink({
    accountId: sr.connectAccountId,
    returnUrl: req.body.returnUrl,
  });

  return res.status(200).json(
    response({
      data: {
        message: "Connect Account.",
        data: { connectAccount },
      },
    })
  );
});

exports.stripeConnectAccountDashboard = catchAsync(async (req, res, next) => {
  const sr = await salesRep.findOne({ where: { id: req.params.srId } });
  if (!sr) {
    return next(new AppError("Data not Found!", 404));
  }
  console.log("ðŸš€ ~ exports.stripeConnectAccount=catchAsync ~ sr:", sr);

  const connectAccount = await Stripe.createStripeLoginLink({
    accountId: sr.connectAccountId,
  });

  return res.status(200).json(
    response({
      data: {
        message: "Connect Account.",
        data: { connectAccount },
      },
    })
  );
});

exports.stripeConnectAccountRetrive = catchAsync(async (req, res, next) => {
  const sr = await salesRep.findOne({ where: { id: req.params.srId } });
  if (!sr) {
    return next(new AppError("Data not Found!", 404));
  }
  if (!sr.connectAccountId) {
    return next(new AppError("Stripe Account not connect!", 404));
  }
  console.log("ðŸš€ ~ exports.stripeConnectAccount=catchAsync ~ sr:", sr);

  const connectAccount = await Stripe.retrieveConnectAccount({
    accountId: sr.connectAccountId,
  });
  if (connectAccount)
    await salesRep.update(
      { isAccountConnected: true },
      { where: { id: req.params.srId } }
    );

  return res.status(200).json(
    response({
      message: "Connect Account.",
      data: { isAccountConnected: true, connectAccount: connectAccount.id },
    })
  );
});

exports.sendQuotation = catchAsync(async (req, res, next) => {
  console.log(req.body);

  console.log("🚀 ~ req.params?.srId:", req.params?.srId);
  const localPatner = req.params?.srId
    ? await salesRep.findOne({
        where: { id: req.params?.srId },
      })
    : null;

  req.body.order.items = req.body?.items;
  sendQuotationEvent({
    email: req.body?.email,
    data: req.body?.order,
    localPatner: localPatner,
  });

  return res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.salersMoney = catchAsync(async (req, res, next) => {
  const doc = await salesRep.findOne({
    where: {
      id: req.params.srId,
    },
    attributes: [
      [
        literal(`
          (
            SELECT SUM(adminReceivableAmount)
            FROM orders
            WHERE orders.salesRepId = salesRep.id
              AND orders.adminReceivableStatus = true
          )
        `),
        "paidToAdmin",
      ],
      // Total sales (offline)
      [
        literal(`
          (
            SELECT SUM(totalBill)
            FROM orders
            WHERE orders.salesRepId = salesRep.id
          )
        `),
        "totalSales",
      ],
      [
        fn(
          "FORMAT",
          literal(`
      (
        SELECT SUM(
          COALESCE(o.totalBill, 0) - COALESCE((
            SELECT SUM(i.salerCommission)
            FROM items i
            WHERE i.orderId = o.id
          ), 0)
        )
        FROM orders o
        WHERE o.salesRepId = salesRep.id
          AND o.paymentStatus = 'done'
            AND o.adminReceivableStatus = 0
      )
    `),
          2
        ),
        "toBePaid",
      ],

      // Wholesale price (offline)
      [
        literal(`
        (
          SELECT SUM(items.wholesalePrice)
          FROM orders
          JOIN items ON items.orderId = orders.id
          WHERE orders.salesRepId = salesRep.id 
        )
      `),
        "wholesalePrice",
      ],

      // Saler Commission (offline)
      [
        fn(
          "FORMAT",
          literal(`
          (
            SELECT SUM(items.price - items.wholesalePrice)
            FROM orders
            JOIN items ON items.orderId = orders.id
            WHERE orders.salesRepId = salesRep.id 
              AND orders.paymentStatus = 'done'
              AND orders.paymentMethod != 'card'
          )
        `),
          2
        ),
        "salerCommission",
      ],
      // Number of sold products (offline)
      [
        literal(`
          (
            SELECT SUM(items.qty)
            FROM orders
            JOIN items ON items.orderId = orders.id
            WHERE orders.salesRepId = salesRep.id 
          )
        `),
        "numberOfSoldProducts",
      ],

      // Total Sales (online)
      [
        fn(
          "FORMAT",
          literal(`
          (
            SELECT SUM(totalBill)
            FROM orders
            WHERE orders.salesRepId = salesRep.id
              AND orders.createdBy = 'customer'
          )
        `),
          2
        ),
        "totalSalesOnline",
      ],

      // Wholesale price (online)
      [
        literal(`
        (
          SELECT SUM(items.wholesalePrice)
          FROM orders
          JOIN items ON items.orderId = orders.id
          WHERE orders.salesRepId = salesRep.id
            AND orders.createdBy = 'customer'
        )
      `),
        "wholesalePriceOnline",
      ],

      // Saler Commission (online)
      [
        fn(
          "FORMAT",
          literal(`
          (
            SELECT SUM(items.price - items.wholesalePrice)
            FROM orders
            JOIN items ON items.orderId = orders.id
            WHERE orders.salesRepId = salesRep.id
              AND orders.createdBy = 'customer'
          )
        `),
          2
        ),
        "salerCommissionOnline",
      ],

      // Number of sold products (online)
      [
        fn(
          "FORMAT",
          literal(`
          (
            SELECT SUM(items.qty)
            FROM orders
            JOIN items ON items.orderId = orders.id
            WHERE orders.salesRepId = salesRep.id
              AND orders.createdBy = 'customer'
          )
        `),
          2
        ),
        "numberOfSoldProductsOnline",
      ],
    ],
  });

  if (!doc) {
    return next(new AppError("Data not Found!", 404));
  }

  const result = JSON.parse(JSON.stringify(doc));
  const paidToAdmin = await salesFromPatners.sum("amount", {
    where: {
      salesRepId: req.params.srId,
    },
  });

  const credit = await salesRep.findOne({
    where: {
      id: req.params.srId,
    },
    attributes: [
      "creditLimit",
      [
        fn(
          "FORMAT",
          literal(`
              (
                SELECT SUM(items.price)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                  AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
              )
            `),
          2
        ),
        "creditUsed",
      ],
    ],
  });

  // Return response
  res.status(200).json({
    status: "success",
    data: { ...result, credit },
  });
});
