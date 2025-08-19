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
const { Op, literal, where, fn } = require('sequelize');
const APIFeatures = require('../../utils/apiFeatures');

exports.assignedOrdersReport = catchAsync(async (req, res, next) => {
  // Build manual conditions based on query/params
  let condition = {};
  if (req.params.supId) condition.supplierId = req.params.supId;
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

exports.topProductsOrderedReport = catchAsync(async (req, res, next) => {
  const doc = await product.findAll({
    attributes: [
      'id',
      'name',
      // [
      //     literal(`
      //       (
      //         SELECT SUM(qty)
      //         FROM items WHERE items.productId = product.id
      //       )
      //     `),
      //   'unitsSold',
      // ],
      [
        literal(`(
            SELECT SUM(i.qty)
            FROM items i
            JOIN orders o ON o.id = i.orderId
            WHERE i.productId = product.id AND o.statusId = 5 AND o.supplierId = ${req.params?.supId}
          )`),
        'dispatchedItems',
      ],
      //   [
      //   literal(`
      //     (
      //       SELECT SUM(
      //         CASE
      //           WHEN wholesalePrice > 0 THEN wholesalePrice
      //           ELSE price
      //         END
      //       )
      //       FROM items
      //       WHERE items.productId = product.id
      //     )
      //   `),
      //   'revenue',
      // ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: doc,
  });
});
