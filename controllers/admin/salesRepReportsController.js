const {
  supplier,
  order,
  salesRep,
  user,
  item,
  product,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { Op, literal, where, fn, col } = require('sequelize');
const APIFeatures = require('../../utils/apiFeatures');

exports.ordersPlacedReport = catchAsync(async (req, res, next) => {
  // Build manual conditions based on query/params
  let condition = {};
  if (req.params.srId) condition.salesRepId = req.params.srId;
  condition.createdBy = 'sales-rep';
  condition.statusId = {
    [Op.ne]: 6,
  };
  // Build API features (filter, sort, fields, pagination)
  const features = new APIFeatures(order, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order, etc.)
  const queryOptions = features.getQuery();

  // Merge manual filter conditions
  queryOptions.where = { ...(queryOptions.where || {}), ...condition };

  queryOptions.attributes = [
    'id',
    'vat',
    'totalBill',
    [
      literal(
        `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
      ),
      'customerName',
    ],
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
      ),
      'orderCurrentStatus',
    ],
    [
      literal(
        `(SELECT createdAt FROM orderHistories WHERE orderHistories.orderId = order.id AND orderHistories.statusId = order.statusId LIMIT 1)`,
      ),
      'assignedAt',
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      'totalQuantity',
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(price)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      'productsSellingPrice',
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      'productsWholesalePrice',
    ],
    [
      literal(`(
      SELECT GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ')
      FROM items i
      JOIN products p ON p.id = i.productId
      WHERE i.orderId = order.id
    )`),
      'productNames',
    ],
    ['on', 'orderDate'],
    'note',
  ];

  queryOptions.group = [
    literal('YEAR(orderDate)'),
    literal('MONTH(orderDate)'),
  ];
  queryOptions.order = [
    [literal('YEAR(orderDate)'), 'ASC'],
    [literal('MONTH(orderDate)'), 'ASC'],
  ];

  // Execute the query
  const doc = await order.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: 'success',
    results: doc.length,
    data: {
      data: doc.reverse(),
    },
  });
});

exports.commissionSummaryReport = catchAsync(async (req, res, next) => {
  const year = parseInt(req.query?.year) || '2025';
  const srid = req.params.srId;
  console.log('🚀 ~ exports.commissionSummaryReport=catchAsync ~ srid:', srid);

  const report = await order.findAll({
    attributes: [
      [fn('MONTH', col('order.on')), 'month'],
      [fn('YEAR', col('order.on')), 'year'],
      [fn('COUNT', fn('DISTINCT', col('order.id'))), 'orderCount'],
      [
        literal(`SUM(
        CASE 
          WHEN items.wholesalePrice > 0 THEN items.wholesalePrice
          ELSE 0
        END)`),
        'wholesaleTotal',
      ],
      [
        literal(`SUM(
        CASE 
          WHEN items.wholesalePrice > 0 THEN items.wholesalePrice
          ELSE items.price
        END)`),
        'totalSales',
      ],
      [
        literal(`SUM(
        CASE 
          WHEN items.wholesalePrice > 0 THEN (items.price - items.wholesalePrice)
          ELSE 0
        END)`),
        'commission',
      ],
      [
        literal(`ROUND(
        SUM(
          CASE 
            WHEN items.wholesalePrice > 0 THEN (items.price - items.wholesalePrice)
            ELSE 0
          END
        ) / COUNT(DISTINCT order.id), 2)`),
        'avgCommissionPerOrder',
      ],
    ],
    include: [
      {
        model: item,
        attributes: [],
      },
    ],
    where: {
      salesRepId: srid,
      createdAt: {
        [Op.gte]: new Date(`${year}-01-01`),
        [Op.lt]: new Date(`${year + 1}-01-01`),
      },
    },
    group: [fn('MONTH', col('order.createdAt'))],
    order: [[fn('MONTH', col('order.createdAt')), 'ASC']],
    raw: true,
  });

  res.status(200).json({
    status: 'success',
    data: report,
  });
});

exports.customerReport = catchAsync(async (req, res, next) => {
  const srid = req.params?.srId;

  const doc = await user.findAll({
    where: literal(`
        EXISTS (
          SELECT 1
          FROM orders 
          WHERE orders.userId = user.id
          AND orders.salesRepId = ${srid}
        )
      `),
    attributes: [
      'id',
      'name',
      [
        fn(
          'FORMAT',
          literal(`
              (
                SELECT SUM(totalBill)
                FROM orders WHERE orders.userID = user.id
              )
            `),
          1,
        ),
        'totatSpent',
      ],
      [
        literal(`(SELECT COUNT(*) FROM orders WHERE orders.userID = user.id)`),
        'numberOfOrders',
      ],
      [
        fn(
          'FORMAT',
          literal(`
              (
                SELECT SUM(totalBill) / NULLIF(COUNT(*), 0)
                FROM orders WHERE orders.userID = user.id
              )
            `),
          1,
        ),
        'avgSpent',
      ],
      [
        literal(`
              (
                SELECT orders.on
                FROM orders 
                WHERE orders.userID = user.id
                ORDER BY orders.on DESC
                LIMIT 1
              )
            `),
        'lastOrderDate',
      ],
      [
        literal(
          `(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id AND orders.paymentStatus = 'pending')`,
        ),
        'outstandingBalance',
      ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: doc,
  });
});

exports.partnerCreaditLimit = catchAsync(async (req, res, next) => {
  const doc = await salesRep.findOne({
    where: { id: req.params?.srId },
    attributes: [
      'id',
      'srName',
      'creditLimit',
      [
        fn(
          'FORMAT',
          literal(`
              (
                SELECT SUM(items.wholesalePrice)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                  AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
              )
            `),
          1,
        ),
        'creditUsed',
      ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: doc,
  });
});
