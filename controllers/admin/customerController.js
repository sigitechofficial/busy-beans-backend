const { user } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');
const { Op, literal, fn, col, where } = require('sequelize');

exports.customersList = catchAsync(async (req, res, next) => {
  const filters = {}
  if (req.params.sr == 'not-assign')filters.salesRepId = null
  else if (req.params.sr == 'assign')filters.salesRepId = { [Op.ne]: null }

  const data = await user.findAll({
    where: { deleted: 0 },
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
      // [
      //   literal(
      //     '(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)',
      //   ),
      //   'totalOrderAmount',
      // ],
      `id`,
      `name`,
      `email`,
      `status`,
      `image`,
      `phoneNumber`,
      `saleTaxNumber`,
      `emailToSendInvoices`,
    ],
  });

  res.status(200).json({
    status: 'success',
    data: { data },
  });
});

exports.assignSalesRep = catchAsync(async (req, res, next) => {
  
  user.update(req?.body,{where:{userid :req.params?.id}})

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

// exports.getAllProducts = factory.getAll(product);
// exports.getProduct = factory.getOne(product);
// exports.updateProduct = factory.updateOne(product);
// exports.deleteProduct = factory.deleteOne(product);
