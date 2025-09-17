const {
  supplier,
  order,
  salesRep,
  user,
  item,
  product,
  stateInSystem,
  cityInSystem,
  countryInSystem,
  skuSupplier,
  employee,
  statuses,
  orderFrequency,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

const { Op, literal, where, fn, col } = require('sequelize');

exports.unpaidPartnerbalanceReport = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: doc,
  });
});

exports.adminDashboard = catchAsync(async (req, res, next) => {
  const salesSummary = await item.findOne({
    attributes: [
      // Revenue
      [
        literal(`
        SUM(
          CASE 
            WHEN item.wholesalePrice > 0 THEN item.wholesalePrice
            ELSE item.price
          END
        )
      `),
        'sales',
      ],
      // Wholesale Total
      [
        literal(`
        SUM(
          CASE 
            WHEN item.wholesalePrice > 0 THEN item.wholesalePrice
            ELSE 0
          END
        )
      `),
        'wholesalePriceTotal',
      ],
      // Customer Price Total
      [
        literal(`
        SUM(
          CASE 
            WHEN item.wholesalePrice < 1 THEN item.price
            ELSE 0
          END
        )
      `),
        'customerPriceTotal',
      ],
    ],
    include: [
      {
        model: order, // make sure your association is set: items.belongsTo(orders)
        attributes: [],
        where: {
          statusId: { [Op.lt]: 6 },
        },
      },
    ],
    raw: true,
  });
  const totalCities = await cityInSystem.count({ where: { deleted: 0 } });
  const totalStates = await stateInSystem.count({ where: { deleted: 0 } });
  const totalCountries = await countryInSystem.count({ where: { deleted: 0 } });
  const totalUser = await user.count({ where: { deleted: 0 } });
  const totalSupplier = await supplier.count({ where: { deleted: 0 } });
  const totalPatners = await salesRep.count({ where: { deleted: 0 } });

  const revenueSummary = await order.findOne({
    where: { paymentStatus: 'done' },
    attributes: [
      [
        literal(`
        SUM(
          CASE 
            WHEN salesRepId IS NULL THEN totalBill
            ELSE totalBill - (
              SELECT COALESCE(SUM(price - wholesalePrice), 0)
              FROM items 
              WHERE items.orderId = order.id
            )
          END
        )
      `),
        'revenueCollected',
      ],
    ],
    raw: true,
  });

  const ordersSummary = await order.findOne({
    attributes: [
      [literal(`SUM(CASE WHEN statusId = 1 THEN 1 ELSE 0 END)`), 'orderPlaced'],
      [
        literal(`SUM(CASE WHEN statusId = 2 THEN 1 ELSE 0 END)`),
        'assignedToSupplier',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 3 THEN 1 ELSE 0 END)`),
        'supplierAcknowledged',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 4 THEN 1 ELSE 0 END)`),
        'dispatchedOrders',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 5 THEN 1 ELSE 0 END)`),
        'deliveredOrders',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 6 THEN 1 ELSE 0 END)`),
        'CanceledOrders',
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`,
        ),
        'paymentPending',
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`,
        ),
        'paymentDone',
      ],
    ],
    raw: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      salesSummary,
      ordersSummary,
      revenueSummary,
      totalPatners,
      totalUser,
      totalSupplier,
      totalCities,
      totalCountries,
      totalStates,
    },
  });
});

exports.salesRepDashboard = catchAsync(async (req, res, next) => {
  const salesSummary = await item.findOne({
    attributes: [
      // Revenue
      [
        literal(`
        SUM(
          CASE 
            WHEN item.wholesalePrice > 0 THEN item.wholesalePrice
            ELSE item.price
          END
        )
      `),
        'sales',
      ],
      // Wholesale Total
      [
        literal(`
        SUM(
          CASE 
            WHEN item.wholesalePrice > 0 THEN item.wholesalePrice
            ELSE 0
          END
        )
      `),
        'wholesalePriceTotal',
      ],
      // Customer Price Total
      [
        literal(`
        SUM(
          CASE 
            WHEN item.wholesalePrice < 1 THEN item.price
            ELSE 0
          END
        )
      `),
        'customerPriceTotal',
      ],
    ],
    include: [
      {
        model: order, // make sure your association is set: items.belongsTo(orders)
        attributes: [],
        where: {
          statusId: { [Op.lt]: 6 },
          salesRepId: req.params.srId,
        },
      },
    ],
    raw: true,
  });

  const revenueSummary = await order.findOne({
    where: { paymentStatus: 'done', salesRepId: req.params.srId },
    attributes: [
      [
        literal(`
        SUM(
          CASE 
            WHEN salesRepId IS NULL THEN totalBill
            ELSE totalBill - (
              SELECT COALESCE(SUM(price - wholesalePrice), 0)
              FROM items 
              WHERE items.orderId = order.id
            )
          END
        )
      `),
        'revenueCollected',
      ],
    ],
    raw: true,
  });

  const ordersSummary = await order.findOne({
    where: { salesRepId: req.params.srId },
    attributes: [
      [literal(`SUM(CASE WHEN statusId = 1 THEN 1 ELSE 0 END)`), 'orderPlaced'],
      [
        literal(`SUM(CASE WHEN statusId = 2 THEN 1 ELSE 0 END)`),
        'assignedToSupplier',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 3 THEN 1 ELSE 0 END)`),
        'supplierAcknowledged',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 4 THEN 1 ELSE 0 END)`),
        'dispatchedOrders',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 5 THEN 1 ELSE 0 END)`),
        'deliveredOrders',
      ],
      [
        literal(`SUM(CASE WHEN statusId = 6 THEN 1 ELSE 0 END)`),
        'CanceledOrders',
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`,
        ),
        'paymentPending',
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`,
        ),
        'paymentDone',
      ],
    ],
    raw: true,
  });

  const totalUser = await user.count({
    where: { deleted: 0, salesRepId: req.params.srId },
  });

  res.status(200).json({
    status: 'success',
    data: { salesSummary, ordersSummary, revenueSummary, totalUser },
  });
});

exports.supplierDashboard = catchAsync(async (req, res, next) => {
  const dashboard = await supplier.findOne({
    where: { id: req.params.id },
    attributes: [
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id)`,
        ),
        'totalOrders',
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 2)`,
        ),
        'dispatchedToSupplierOrders',
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 3)`,
        ),
        'acknowledgedOrders',
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 4)`,
        ),
        'shippedOrders',
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 5)`,
        ),
        'deliveredOrders',
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 6)`,
        ),
        'cancelledOrders',
      ],
    ],
    raw: true,
  });

  const topProducts = await item.findAll({
    attributes: [
      'productId',
      [
        literal(
          `(SELECT products.name FROM products WHERE products.id = item.productId)`,
        ),
        'productName',
      ],
      [fn('SUM', col('qty')), 'totalSold'],
    ],
    group: ['productId'],
    order: [[fn('SUM', col('qty')), 'DESC']],
    limit: 5,
    include: [
      {
        model: order,
        where: { supplierId: req.params?.id },
        attributes: [],
      },
    ],
  });

  res.status(200).json({
    status: 'success',
    data: { dashboard, topProducts },
  });
});

exports.employeeDashboardAdmin = catchAsync(async (req, res, next) => {
  let employeeId = req.user?.id;

  // Query to count orders based on employeeId
  const data = await statuses.findAll({
    attributes: [
      'id',
      'orderStatus',
      [
        literal(
          `(SELECT COUNT(orders.id) 
           FROM orders
           JOIN users ON users.id = orders.userId 
           WHERE orders.statusId = statuses.id
           ${employeeId ? `AND users.employeeId = ${employeeId}` : ''})`,
        ),
        'count',
      ],
    ],
  });

  let condition = {};
  if (req.params.srId) condition.salesRepId = req.params.srId;

  // Add visibilityDate condition
  condition.visibilityDate = {
    [Op.lte]: new Date(), // or moment().toDate()
  };

  const upcommingOrderCount = employeeId
    ? await orderFrequency.count({
        where: {
          ...condition,
          nextOrderDate: {
            [Op.not]: literal(`
        (SELECT DATE(orders.on)
         FROM orders
         JOIN users ON users.id = orders.userId 
         WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate)
         AND orders.orderFrequencyId = orderFrequency.id
         ${employeeId ? `AND users.employeeId = ${employeeId}` : ''})
      `),
          },
        },
      })
    : await orderFrequency.count({
        where: {
          ...condition,
          nextOrderDate: {
            [Op.notIn]: literal(`
          (SELECT DATE(orders.on)
          FROM orders
          WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate)
          AND orders.orderFrequencyId = orderFrequency.id)
        `),
          },
        },
      });

  const output = JSON.parse(JSON.stringify(data));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const overDueInvoices = await order.count({
    where: {
      createdAt: { [Op.gte]: thirtyDaysAgo }, // uses time too
      paymentStatus: 'pending',
    },
    include: { model: user, where: { employeeId: req.user.id } },
  });

  output.push({
    id: 7,
    orderStatus: 'Upcomming Orders',
    count: upcommingOrderCount,
  });
  output.push({
    id: 8,
    orderStatus: 'Overdue Invoices',
    count: overDueInvoices,
  });

  res.status(200).json({
    status: 'success',
    data: { output },
  });
});

exports.employeeDashboardlocalPartner = catchAsync(async (req, res, next) => {
  let employeeId = req.user?.id;
  const worker = await employee.findOne({ where: { id: employeeId } });

  // Define the literals for both scenarios
  const employeeFilterLiteral = employeeId
    ? `AND orders.salesRepId = ${worker.salesRepId} AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`
    : `AND orders.salesRepId = ${worker.salesRepId}`; // If employeeId is null, check for salesRepId

  const upcomingOrderCountLiteral = employeeId
    ? `AND orders.salesRepId = ${worker.salesRepId} AND orders.userId IN (SELECT id FROM users WHERE employeeId = ${employeeId})`
    : `AND orders.salesRepId = ${worker.salesRepId}`; // If employeeId is null, check for salesRepId

  // Query to count orders based on employeeId (handling both cases for employeeId)
  const data = await statuses.findAll({
    attributes: [
      'id',
      'orderStatus',
      [
        literal(
          `(SELECT COUNT(orders.id) 
             FROM orders 
             WHERE orders.statusId = statuses.id 
             ${employeeFilterLiteral})`,
        ),
        'count',
      ],
    ],
  });

  const condition = {};
  condition.salesRepId = worker.salesRepId;

  // Add visibilityDate condition
  condition.visibilityDate = {
    [Op.lte]: new Date(), // or moment().toDate()
  };

  // Handle upcoming order count based on employeeId
  const upcommingOrderCount = await orderFrequency.count({
    where: {
      ...condition,
      nextOrderDate: {
        [Op.notIn]: literal(`
            (SELECT DATE(orders.on)
             FROM orders
             WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate)
             AND orders.orderFrequencyId = orderFrequency.id
             ${upcomingOrderCountLiteral})
          `),
      },
    },
  });

  const output = JSON.parse(JSON.stringify(data));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const overDueInvoices = await order.count({
    where: {
      createdAt: { [Op.gte]: thirtyDaysAgo }, // uses time too
      paymentStatus: 'pending',
      salesRepId: worker.salesRepId,
    },
    include: { model: user, where: { employeeId: req.user.id } },
  });

  output.push({
    id: 7,
    orderStatus: 'Upcomming Orders',
    count: upcommingOrderCount,
  });

  output.push({
    id: 8,
    orderStatus: 'Overdue Invoices',
    count: overDueInvoices,
  });

  return res.status(200).json({
    status: 'success',
    data: output,
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
