const {
  user,
  address,
  order,
  billingAddress,
  item,
  userDiscount,
  category,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { response } = require("../../utils/response");
const REDIS = require("../../utils/redisHandling");
const { Op, literal, fn, col, where } = require("sequelize");
const Stripe = require("../stripe");

exports.customersList = catchAsync(async (req, res, next) => {
  const filters = { deleted: 0 };
  if (req.params?.sr == "not-assign") filters.salesRepId = null;
  else if (req.params?.sr == "assign") filters.salesRepId = { [Op.ne]: null };
  else if (req.params?.sr == "assigned-employee")
    filters.employeeId = { [Op.ne]: null };
  else if (req.params?.sr == "not-assigned-employee")
    filters.employeeId = { [Op.eq]: null };
  console.log("🚀 ~ filters:", filters);

  if (req.params?.srId) filters.salesRepId = req.params?.srId;
  if (req.params?.empId) filters.employeeId = req.params?.empId;
  if (req.params?.condition == "qbo-registered") {
    filters.qboCustomerId = { [Op.ne]: null };
  } else if (req.params?.condition == "qbo-not-registered") {
    filters.qboCustomerId = null;
  }

  if (req.user?.employeeOf == "Local Partner") {
    filters.salesRepId = req.user?.salesRepId;
  }
  console.log("🚀 ~ filters:", filters);

  const data = await user.findAll({
    where: filters,
    attributes: [
      [
        literal("(SELECT COUNT(id) FROM orders WHERE orders.userId = user.id)"),
        "totalOrderPlaced",
      ],
      [
        literal(
          "(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)"
        ),
        "totalOrderAmount",
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
        ),
        "salesRepName",
      ],
      [
        literal(
          `(SELECT salesReps.state FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
        ),
        "salesRepState",
      ],
      [
        literal(
          `(SELECT paymentMethod FROM orders WHERE user.id = orders.userId LIMIT 1)`
        ),
        "preferredPaymentMethod",
      ],
      [
        literal(
          `(SELECT employees.name FROM employees WHERE user.employeeId = employees.id LIMIT 1)`
        ),
        "employee",
      ],
      `id`,
      `name`,
      `email`,
      `status`,
      `image`,
      `phoneNumber`,
      `countryCode`,
      `saleTaxNumber`,
      `emailToSendInvoices`,
      `companyName`,
    ],
    include: [{ model: address }],
  });

  res.status(200).json({
    status: "success",
    data: { data },
  });
});

exports.InvoiceCustomers = catchAsync(async (req, res, next) => {
  const filters = { deleted: 0 };

  if (req.params?.srId) filters.salesRepId = req.params?.srId;

  if (
    req.user.entity == "adminEmployee" ||
    req.user.entity == "partnerEmployee"
  ) {
    filters.employeeId = req.user?.id;
    // if (filters.salesRepId) delete filters.salesRepId;
  }

  const data = await user.findAll({
    where: filters,
    attributes: [
      [
        literal(`
          (
            SELECT SUM(totalBill)
            FROM orders
            WHERE orders.userId = user.id
              AND orders.paymentStatus = 'pending'
              AND orders.statusId != 6
          )
        `),
        "totalBalance",
      ],
      [
        literal(`
          (
            SELECT COUNT(id)
            FROM orders
            WHERE orders.userId = user.id
              AND orders.paymentStatus = 'pending'
              AND orders.statusId != 6
          )
        `),
        "numberOfOrders",
      ],
      [
        literal(`
        (
          SELECT COUNT(id)
          FROM orders
          WHERE orders.userId = user.id
            AND orders.paymentStatus = 'pending'
            AND orders.statusId != 6
            AND orders.on <= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        )
      `),
        "overDueOrders",
      ],
      `id`,
      `name`,
      `email`,
      `image`,
      `phoneNumber`,
      `saleTaxNumber`,
      `emailToSendInvoices`,
      "companyName",
      "defaultDiscount",
    ],
  });

  res.status(200).json({
    status: "success",
    data: { data },
  });
});

exports.assignSalesRep = catchAsync(async (req, res, next) => {
  const id = req.params?.id == "remove" ? null : req.params?.id;

  await user.update({ salesRepId: id }, { where: { id: req.body?.id } });
  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.viewCustomersManagement = catchAsync(async (req, res, next) => {
  const today = new Date();

  // Subtract 30 days from the current date
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 30);

  const totalCustomer = await user.count({ where: { deleted: 0 } });
  const activeCustomer = await user.count({
    where: { deleted: 0, status: true },
  });
  const inactiveCustomer = await user.count({
    where: { deleted: 0, status: false },
  });
  const newCustomer = await user.count({
    where: {
      deleted: 0,
      verifiedAt: {
        [Op.gte]: last30Days, // Assuming `last30Days` is a valid Date object
      },
    },
  });

  res.status(200).json({
    status: "success",
    data: {
      data: {
        totalCustomer,
        activeCustomer,
        inactiveCustomer,
        newCustomer,
      },
    },
  });
});

exports.customerDetail = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;

  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition);

  const doc = await user.findOne({
    where: condition,
    attributes: [
      [
        literal("(SELECT COUNT(id) FROM orders WHERE orders.userId = user.id)"),
        "totalOrderPlaced",
      ],
      [
        literal(
          "(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)"
        ),
        "totalOrderAmount",
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
        ),
        "salesRepName",
      ],
      [
        literal(
          `(SELECT employees.name FROM employees WHERE user.employeeId = employees.id LIMIT 1)`
        ),
        "employee",
      ],
      [
        literal(
          `(SELECT employeeOf FROM employees WHERE user.employeeId = employees.id LIMIT 1)`
        ),
        "employeeOf",
      ],
      [
        literal(
          `(SELECT salesReps.state FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`
        ),
        "salesRepState",
      ],
      [
        literal(
          `(SELECT paymentMethod FROM orders WHERE user.id = orders.userId LIMIT 1)`
        ),
        "preferredPaymentMethod",
      ],
      `id`,
      `name`,
      `email`,
      `status`,
      `image`,
      `phoneNumber`,
      `countryCode`,
      `saleTaxNumber`,
      `emailToSendInvoices`,
      `companyName`,
      "dispatchEmail",
      "salesRepId",
      "defaultDiscount",
      "employeeId",
    ],
    include: [
      {
        model: address,
        attributes: {
          exclude: ["createdAt", "updatedAt", "userId", "deleted", "deletedAt"],
        },
      },
      {
        model: billingAddress,
        attributes: {
          exclude: ["createdAt", "updatedAt", "userId", "deleted", "deletedAt"],
        },
      },
      {
        model: userDiscount,
        attributes: [
          "categoryId",
          "percentage",
          [
            literal(
              `(SELECT categories.name FROM categories WHERE userDiscounts.categoryId= categories.id LIMIT 1)`
            ),
            "categoryName",
          ],
        ],
      },
    ],
  });

  if (!doc) {
    return next(new AppError("Data not found!", 400));
  }
  res.status(200).json({
    status: "success",
    data: {
      customer: doc,
    },
  });
});

// exports.getAllProducts = factory.getAll(product);
// exports.getProduct = factory.getOne(product);
exports.updateCutomer = catchAsync(async (req, res, next) => {
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);
  console.log("🚀 ~ req.body:", req.body);
  if (req.body?.info) {
    if (req.body.info?.status == false)
      REDIS.revokeAllTokensForUser(req.params.id);
    await user.update(req.body.info, {
      where: { id: req.params.id },
      individualHooks: true,
    });
  }

  if (req.body?.newAddressess) {
    await address.bulkCreate(req.body?.newAddressess);
  }

  if (req.body?.addresses) {
    await address.update(req.body.addresses, {
      where: { id: req.body?.addresses?.id },
    });
  }
  if (req.body?.billingAddress) {
    await billingAddress.update(req.body.billingAddress, {
      where: { userId: req.params.id },
    });
  }

  if (req.body?.userDiscount && req.body?.userDiscount.length > 0) {
    req.body?.userDiscount.forEach((obj) => {
      obj.userId = req.params.id;
    });
    await userDiscount.destroy({
      where: { deleted: 0, userId: req.params.id },
    });
    await userDiscount.bulkCreate(req.body?.userDiscount);
  }

  res.status(200).json({
    status: "success",
    data: {},
  });
});
// exports.deleteProduct = factory.deleteOne(product);

exports.deleteCustomer = catchAsync(async (req, res, next) => {
  const doc = await user.update(
    { deleted: 1 },
    {
      where: { id: req.params.id },
    }
  );

  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.fetchSavedCards = async (req, res, next) => {
  const userId = req.params.id;
  console.log("🚀 ~ ~ userId:", userId);
  const customer = await user.findByPk(userId, {
    attributes: ["email", "stripeCustomerId"],
  });
  if (customer.stripeCustomerId === null || customer.stripeCustomerId === "") {
    const output = response({ message: "All cards", data: { cards: [] } });
    return res.status(200).json(output);
  }
  const customerId = customer.stripeCustomerId;
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

exports.dicounts = catchAsync(async (req, res, next) => {
  const data = await userDiscount.findAll({
    where: { userId: req.params?.id },
    attributes: [
      "id",
      "categoryId",
      "percentage",
      [
        literal(
          `(SELECT categories.name FROM categories WHERE userDiscount.categoryId= categories.id LIMIT 1)`
        ),
        "categoryName",
      ],
    ],
  });

  return res.status(200).json({
    status: "success",
    data: data,
  });
});
