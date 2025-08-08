const { user, address, order, billingAddress, item } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');
const { Op, literal, fn, col, where } = require('sequelize');

exports.customersList = catchAsync(async (req, res, next) => {
  const filters = { deleted: 0 };
  if (req.params?.sr == 'not-assign') filters.salesRepId = null;
  else if (req.params?.sr == 'assign') filters.salesRepId = { [Op.ne]: null };

  if (req.params?.srId) filters.salesRepId = req.params?.srId;

  const data = await user.findAll({
    where: filters,
    attributes: [
      [
        literal('(SELECT COUNT(id) FROM orders WHERE orders.userId = user.id)'),
        'totalOrderPlaced',
      ],
      [
        literal(
          '(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)',
        ),
        'totalOrderAmount',
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepName',
      ],
      [
        literal(
          `(SELECT salesReps.state FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepState',
      ],
      [
        literal(
          `(SELECT paymentMethod FROM orders WHERE user.id = orders.userId LIMIT 1)`,
        ),
        'preferredPaymentMethod',
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
    status: 'success',
    data: { data },
  });
});

exports.InvoiceCustomers = catchAsync(async (req, res, next) => {
  const filters = { deleted: 0 };
  if (req.params?.sr == 'not-assign') filters.salesRepId = null;
  else if (req.params?.sr == 'assign') filters.salesRepId = { [Op.ne]: null };

  if (req.params?.srId) filters.salesRepId = req.params?.srId;

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
        'totalBalance',
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
        'numberOfOrders',
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
        'overDueOrders',
      ],
      `id`,
      `name`,
      `email`,
      `image`,
      `phoneNumber`,
      `saleTaxNumber`,
      `emailToSendInvoices`,
      'companyName',
      'defaultDiscount',
    ],
  });

  res.status(200).json({
    status: 'success',
    data: { data },
  });
});

exports.assignSalesRep = catchAsync(async (req, res, next) => {
  const id = req.params?.id == 'remove' ? null : req.params?.id;

  await user.update({ salesRepId: id }, { where: { id: req.body?.id } });
  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.viewCustomersManagement = catchAsync(async (req, res, next) => {
  const today = new Date();

  // Subtract 30 days from the current date
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 30);

  const data = await user.findOne({
    attributes: [
      // Count the total customers
      [fn('COUNT', col('id')), 'totalCustomer'],
      // Count the new customers (verified in the last 30 days)
      [
        fn(
          'COUNT',
          literal(
            `CASE WHEN "verifiedAt" >= '${last30Days.toISOString()}' THEN 1 ELSE NULL END`,
          ),
        ),
        'newCustomer',
      ],
      // Count active customers (status is true)
      [
        fn('COUNT', literal('CASE WHEN "status" = true THEN 1 ELSE NULL END')),
        'activeCustomer',
      ],
      // Count inactive customers (status is false)
      [
        fn('COUNT', literal('CASE WHEN "status" = false THEN 1 ELSE NULL END')),
        'inactiveCustomer',
      ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: { data },
  });
});

exports.customerDetail = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;

  console.log('ðŸš€ ~ exports.allOrder=catchAsync ~ condition:', condition);

  const doc = await user.findOne({
    where: condition,
    attributes: [
      [
        literal('(SELECT COUNT(id) FROM orders WHERE orders.userId = user.id)'),
        'totalOrderPlaced',
      ],
      [
        literal(
          '(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)',
        ),
        'totalOrderAmount',
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepName',
      ],
      [
        literal(
          `(SELECT salesReps.state FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepState',
      ],
      [
        literal(
          `(SELECT paymentMethod FROM orders WHERE user.id = orders.userId LIMIT 1)`,
        ),
        'preferredPaymentMethod',
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
      'dispatchEmail',
      'salesRepId',
      'defaultDiscount',
    ],
    include: [
      {
        model: address,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'userId', 'deleted', 'deletedAt'],
        },
      },
      {
        model: billingAddress,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'userId', 'deleted', 'deletedAt'],
        },
      },
    ],
  });

  if (!doc) {
    return next(new AppError('Data not found!', 400));
  }
  res.status(200).json({
    status: 'success',
    data: {
      customer: doc,
    },
  });
});

// exports.getAllProducts = factory.getAll(product);
// exports.getProduct = factory.getOne(product);
exports.updateCutomer = catchAsync(async (req, res, next) => {
  if (req.body?.info) {
    await user.update(req.body.info, {
      where: { id: req.params.id },
    });
  }
  if (req.body?.address) {
    await address.update(req.body.address, {
      where: { userId: req.params.id },
    });
  }
  if (req.body?.billingAddress) {
    await billingAddress.update(req.body.billingAddress, {
      where: { userId: req.params.id },
    });
  }

  res.status(200).json({
    status: 'success',
    data: {},
  });
});
// exports.deleteProduct = factory.deleteOne(product);

exports.deleteCustomer = catchAsync(async (req, res, next) => {
  const doc = await user.update(
    { deleted: 1 },
    {
      where: { id: req.params.id },
    },
  );

  res.status(200).json({
    status: 'success',
    data: {},
  });
});
