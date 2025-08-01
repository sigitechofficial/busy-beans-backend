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

const { Op, literal, where, fn } = require('sequelize');

exports.partnerCommissionReport = catchAsync(async (req, res, next) => {
  const doc = await salesRep.findAll({
    attributes: [
      'id',
      'srName',
      [
        fn(
          'FORMAT',
          literal(
            `(SELECT SUM(orders.totalBill) FROM orders WHERE orders.salesRepId = salesRep.id  AND orders.statusId != 6)`,
          ),
          2,
        ),
        'totalSales',
      ],
      [
        fn(
          'FORMAT',
          literal(`
            (
              SELECT SUM(items.wholesalePrice)
              FROM orders
              JOIN items ON items.orderId = orders.id
              WHERE orders.salesRepId = salesRep.id
              AND  orders.statusId != 6
            )
          `),
          2,
        ),
        'wholesalePriceCost',
      ],
      [
        fn(
          'FORMAT',
          literal(`
            (
              SELECT SUM(items.price - items.wholesalePrice)
              FROM orders
              JOIN items ON items.orderId = orders.id
              WHERE orders.salesRepId = salesRep.id
                AND orders.statusId != 6
                
            )
          `),
          2,
        ),
        'totalCommission',
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.statusId != 6)`,
        ),
        'ordersPlaced',
      ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: doc,
  });
});

exports.partnerCreaditLimit = catchAsync(async (req, res, next) => {
  const doc = await salesRep.findAll({
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

exports.unpaidPartnerbalanceReport = catchAsync(async (req, res, next) => {
  const doc = await salesRep.findAll({
    attributes: [
      'id',
      'srName',
      [
        fn(
          'FORMAT',
          literal(`
              (
                SELECT SUM(items.wholesalePrice)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                  AND orders.createdBy = 'sales-rep' AND orders.adminReceivableStatus = false
              )
            `),
          1,
        ),
        'outstandingBalance',
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.createdBy = 'sales-rep' AND orders.adminReceivableStatus = false)`,
        ),
        'ordersOnCredit',
      ],
    ],
  });
  res.status(200).json({
    status: 'success',
    data: doc,
  });
});

exports.customerReport = catchAsync(async (req, res, next) => {
  const doc = await user.findAll({
    where: literal(`
        EXISTS (
          SELECT 1
          FROM orders 
          WHERE orders.userId = user.id
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

exports.productSalesReport = catchAsync(async (req, res, next) => {
  const doc = await product.findAll({
    attributes: [
      'id',
      'name',
      [
        literal(`
              (
                SELECT SUM(qty)
                FROM items WHERE items.productId = product.id
              )
            `),
        'unitsSold',
      ],
      [
        literal(`
              (
                SELECT SUM(price)
                FROM items WHERE items.productId = product.id  AND items.wholesalePrice < 1
              )
            `),
        'customerPriceTotal',
      ],
      [
        literal(`
              (
                SELECT SUM(wholesalePrice)
                FROM items WHERE items.productId = product.id AND items.wholesalePrice > 0
              )
            `),
        'wholesalePriceTotal',
      ],
      [
        literal(`
          (
            SELECT SUM(
              CASE 
                WHEN wholesalePrice > 0 THEN wholesalePrice 
                ELSE price 
              END
            )
            FROM items 
            WHERE items.productId = product.id
          )
        `),
        'revenue',
      ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: doc,
  });
});

exports.productSalesReport = catchAsync(async (req, res, next) => {
  const doc = await product.findAll({
    attributes: [
      'id',
      'name',
      [
        literal(`
              (
                SELECT SUM(qty)
                FROM items WHERE items.productId = product.id
              )
            `),
        'unitsSold',
      ],
      [
        literal(`
              (
                SELECT SUM(price)
                FROM items WHERE items.productId = product.id  AND items.wholesalePrice < 1
              )
            `),
        'customerPriceTotal',
      ],
      [
        literal(`
              (
                SELECT SUM(wholesalePrice)
                FROM items WHERE items.productId = product.id AND items.wholesalePrice > 0
              )
            `),
        'wholesalePriceTotal',
      ],
      [
        literal(`
          (
            SELECT SUM(
              CASE 
                WHEN wholesalePrice > 0 THEN wholesalePrice 
                ELSE price 
              END
            )
            FROM items 
            WHERE items.productId = product.id
          )
        `),
        'revenue',
      ],
      [
        literal(`(
          SELECT srName
          FROM salesReps
          WHERE salesReps.id = (
            SELECT orders.salesRepId
            FROM items
            JOIN orders ON orders.id = items.orderId
            WHERE items.productId = product.id
            GROUP BY orders.salesRepId
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        )`),
        'topSalesRepName',
      ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: doc,
  });
});

//   [
//     literal(
//       `(SELECT COUNT(*) FROM orders WHERE orders.userID = user.id)`
//     ),
//     'numberOfOrders',
//   ],
//   [
//     fn(
//       'FORMAT',
//       literal(`
//         (
//           SELECT SUM(totalBill) / NULLIF(COUNT(*), 0)
//           FROM orders WHERE orders.userID = user.id
//         )
//       `),
//       1
//     ),
//     'avgSpent',
//   ],
//   [
//       literal(`
//         (
//           SELECT orders.on
//           FROM orders
//           WHERE orders.userID = user.id
//           ORDER BY orders.on DESC
//           LIMIT 1
//         )
//       `),
//     'lastOrderDate',
//   ],
//   [
//     literal(
//      `(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id AND orders.paymentStatus = 'pending')`,
//     ),
//     'outstandingBalance',
// ],
