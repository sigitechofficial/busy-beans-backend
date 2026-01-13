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
  partnerOrder,
  partnerOrderItem,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");

const { Op, literal, where, fn, col } = require("sequelize");

exports.unpaidPartnerbalanceReport = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.adminDashboard = catchAsync(async (req, res, next) => {
  const clientSalesSummary = await item.findOne({
    // where: { id: { [Op.gte]: 2500 } },
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
        "sales",
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
        "wholesalePriceTotal",
      ],
      // Customer Price Total
      [
        literal(`
        SUM(
          CASE 
            WHEN item.wholesalePrice < 0.1 THEN item.price
            ELSE 0
          END
        )
      `),
        "customerPriceTotal",
      ],
      [
        literal(`
        SUM(item.qty)
      `),
        "numberOfItems",
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

  const partnerSalesSummary = await partnerOrderItem.findOne({
    attributes: [
      // Revenue
      [
        literal(`
        SUM(partnerOrderItem.price)
      `),
        "sales",
      ],
      [
        literal(`
        SUM(partnerOrderItem.qty)
      `),
        "numberOfItems",
      ],
    ],
    include: [
      {
        model: partnerOrder, // make sure your association is set: items.belongsTo(orders)
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

  const revenueSummaryClient = await order.findOne({
    where: { paymentStatus: "done" },
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
        "revenueCollectedClient",
      ],
    ],
    raw: true,
  });
  const revenueSummaryPartners = await partnerOrder.findOne({
    where: { paymentStatus: "done" },
    attributes: [[literal(`SUM(totalBill)`), "revenueCollectedPartners"]],
    raw: true,
  });
  const clientOrdersSummary = await order.findOne({
    attributes: [
      [literal(`SUM(CASE WHEN statusId = 1 THEN 1 ELSE 0 END)`), "orderPlaced"],
      [
        literal(`SUM(CASE WHEN statusId = 2 THEN 1 ELSE 0 END)`),
        "assignedToSupplier",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 3 THEN 1 ELSE 0 END)`),
        "supplierAcknowledged",
      ],
      //   [
      //     literal(`SUM(CASE WHEN statusId = 4 THEN 1 ELSE 0 END)`),
      //     "dispatchedOrders",
      //   ],
      [
        literal(`SUM(CASE WHEN statusId IN (4, 5) THEN 1 ELSE 0 END)`),
        "dispatchedOrders",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 6 THEN 1 ELSE 0 END)`),
        "CanceledOrders",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`
        ),
        "paymentPending",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`
        ),
        "paymentDone",
      ],
    ],
    raw: true,
  });

  const partnersOrdersSummary = await partnerOrder.findOne({
    attributes: [
      [literal(`SUM(CASE WHEN statusId = 1 THEN 1 ELSE 0 END)`), "orderPlaced"],
      [
        literal(`SUM(CASE WHEN statusId = 2 THEN 1 ELSE 0 END)`),
        "assignedToSupplier",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 3 THEN 1 ELSE 0 END)`),
        "supplierAcknowledged",
      ],
      //   [
      //     literal(`SUM(CASE WHEN statusId = 4 THEN 1 ELSE 0 END)`),
      //     "dispatchedOrders",
      //   ],
      [
        literal(`SUM(CASE WHEN statusId IN (4, 5) THEN 1 ELSE 0 END)`),
        "dispatchedOrders",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 6 THEN 1 ELSE 0 END)`),
        "CanceledOrders",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`
        ),
        "paymentPending",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`
        ),
        "paymentDone",
      ],
    ],
    raw: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      clientSalesSummary,
      partnerSalesSummary,
      partnersOrdersSummary,
      clientOrdersSummary,
      revenueSummaryClient,
      revenueSummaryPartners,
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
        "sales",
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
        "wholesalePriceTotal",
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
        "customerPriceTotal",
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
    where: { paymentStatus: "done", salesRepId: req.params.srId },
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
        "revenueCollected",
      ],
    ],
    raw: true,
  });

  const ordersSummary = await order.findOne({
    where: { salesRepId: req.params.srId },
    attributes: [
      [literal(`SUM(CASE WHEN statusId = 1 THEN 1 ELSE 0 END)`), "orderPlaced"],
      [
        literal(`SUM(CASE WHEN statusId = 2 THEN 1 ELSE 0 END)`),
        "assignedToSupplier",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 3 THEN 1 ELSE 0 END)`),
        "supplierAcknowledged",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 4 THEN 1 ELSE 0 END)`),
        "dispatchedOrders",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 5 THEN 1 ELSE 0 END)`),
        "deliveredOrders",
      ],
      [
        literal(`SUM(CASE WHEN statusId = 6 THEN 1 ELSE 0 END)`),
        "CanceledOrders",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`
        ),
        "paymentPending",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`
        ),
        "paymentDone",
      ],
    ],
    raw: true,
  });

  const totalUser = await user.count({
    where: { deleted: 0, salesRepId: req.params.srId },
  });

  res.status(200).json({
    status: "success",
    data: { salesSummary, ordersSummary, revenueSummary, totalUser },
  });
});

exports.supplierDashboard = catchAsync(async (req, res, next) => {
  const dashboard = await supplier.findOne({
    where: { id: req.params.id },
    attributes: [
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id)`
        ),
        "totalOrders",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 2)`
        ),
        "dispatchedToSupplierOrders",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 3)`
        ),
        "acknowledgedOrders",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 4)`
        ),
        "shippedOrders",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 5)`
        ),
        "deliveredOrders",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.supplierId = supplier.id AND orders.statusId = 6)`
        ),
        "cancelledOrders",
      ],
    ],
    raw: true,
  });

  const topProducts = await item.findAll({
    attributes: [
      "productId",
      [
        literal(
          `(SELECT products.name FROM products WHERE products.id = item.productId)`
        ),
        "productName",
      ],
      [fn("SUM", col("qty")), "totalSold"],
    ],
    group: ["productId"],
    order: [[fn("SUM", col("qty")), "DESC"]],
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
    status: "success",
    data: { dashboard, topProducts },
  });
});

exports.employeeDashboardAdmin = catchAsync(async (req, res, next) => {
  let employeeId = req.user?.id;

  // Query to count orders based on employeeId
  const data = await statuses.findAll({
    attributes: [
      "id",
      "orderStatus",
      [
        literal(
          `(SELECT COUNT(orders.id) 
           FROM orders
           JOIN users ON users.id = orders.userId 
           WHERE orders.statusId = statuses.id
           ${employeeId ? `AND users.employeeId = ${employeeId}` : ""})`
        ),
        "count",
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
         ${employeeId ? `AND users.employeeId = ${employeeId}` : ""})
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
      paymentStatus: "pending",
    },
    include: { model: user, where: { employeeId: req.user.id } },
  });

  output.push({
    id: 7,
    orderStatus: "Upcomming Orders",
    count: upcommingOrderCount,
  });
  output.push({
    id: 8,
    orderStatus: "Overdue Invoices",
    count: overDueInvoices,
  });

  res.status(200).json({
    status: "success",
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
      "id",
      "orderStatus",
      [
        literal(
          `(SELECT COUNT(orders.id) 
             FROM orders 
             WHERE orders.statusId = statuses.id 
             ${employeeFilterLiteral})`
        ),
        "count",
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
      paymentStatus: "pending",
      salesRepId: worker.salesRepId,
    },
    include: { model: user, where: { employeeId: req.user.id } },
  });

  output.push({
    id: 7,
    orderStatus: "Upcomming Orders",
    count: upcommingOrderCount,
  });

  output.push({
    id: 8,
    orderStatus: "Overdue Invoices",
    count: overDueInvoices,
  });

  return res.status(200).json({
    status: "success",
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

// Get Sales Dashboard with MTD and Last Month Sales
// exports.getSalesDashboard = catchAsync(async (req, res, next) => {
//   const now = new Date();
//   const currentYear = now.getFullYear();
//   const currentMonth = now.getMonth();
//   const currentDay = now.getDate();

//   // Month-to-Date: First day of current month to today
//   const mtdStart = new Date(currentYear, currentMonth, 1);
//   const mtdEnd = new Date(currentYear, currentMonth, currentDay);

//   // Last Month: First day of last month to last day of last month
//   const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
//   const lastMonthEnd = new Date(currentYear, currentMonth, 0);

//   // Format dates for SQL (YYYY-MM-DD) - matching report format exactly
//   const mtdStartStr = "2026-01-01";
//   const mtdEndStr = "2026-01-31  ";
//   const lastMonthStartStr = "2025-12-01";
//   const lastMonthEndStr = "2025-12-31";

//   console.log("ðŸš€ ~ getSalesDashboard ~ mtdStartStr:", mtdStartStr);
//   console.log("ðŸš€ ~ getSalesDashboard ~ mtdEndStr:", mtdEndStr);

//   // Month-to-Date Sales Summary - Using same approach as customerSalesSummary report
//   // Note: Report uses 'orders.on >= startDate AND orders.on <= endDate' (inclusive on both ends)
//   // orders.on is DATEONLY type, so direct comparison works
//   const mtdDateFilter = `AND orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'`;
//   console.log("ðŸš€ ~ getSalesDashboard ~ mtdDateFilter:", mtdDateFilter);
//   // Note: Report doesn't filter by deleted field - matching report exactly
//   // The report query structure uses user.findAll with subqueries, but we're querying orders directly
//   const mtdSalesSummaryResult = await order.sequelize.query(
//     `SELECT
//         COALESCE(SUM(totalBill), 0) as totalSales,
//         COUNT(*) as orders,
//         COALESCE(SUM(totalBill) / NULLIF(COUNT(*), 0), 0) as avgOrderValue
//       FROM orders
//       WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'`,
//     {
//       type: order.sequelize.QueryTypes.SELECT,
//     }
//   );
//   const mtdSalesSummary = mtdSalesSummaryResult?.[0] || {
//     totalSales: 0,
//     orders: 0,
//     avgOrderValue: 0,
//   };

//   // Last Month Sales Summary - Using same approach as customerSalesSummary report
//   const lastMonthDateFilter = `AND orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}'`;
//   const lastMonthSalesSummaryResult = await order.sequelize.query(
//     `SELECT
//         COALESCE(SUM(totalBill), 0) as totalSales,
//         COUNT(*) as orders,
//         COALESCE(SUM(totalBill) / NULLIF(COUNT(*), 0), 0) as avgOrderValue
//       FROM orders
//       WHERE orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}'`,
//     {
//       type: order.sequelize.QueryTypes.SELECT,
//     }
//   );
//   const lastMonthSalesSummary = lastMonthSalesSummaryResult?.[0] || {
//     totalSales: 0,
//     orders: 0,
//     avgOrderValue: 0,
//   };

//   // Calculate percentage change vs last month (MTD)
//   const mtdTotalSales = parseFloat(mtdSalesSummary?.totalSales || 0);
//   const lastMonthTotalSales = parseFloat(
//     lastMonthSalesSummary?.totalSales || 0
//   );
//   const lastMonthMTDStart = new Date(currentYear, currentMonth - 1, 1);
//   const lastMonthMTDEnd = new Date(
//     currentYear,
//     currentMonth - 1,
//     Math.min(currentDay, new Date(currentYear, currentMonth, 0).getDate())
//   );
//   const lastMonthMTDStartStr = lastMonthMTDStart.toISOString().split("T")[0];
//   const lastMonthMTDEndStr = lastMonthMTDEnd.toISOString().split("T")[0];

//   const lastMonthMTDDateFilter = `AND orders.on >= '${lastMonthMTDStartStr}' AND orders.on <= '${lastMonthMTDEndStr}'`;
//   const lastMonthMTDSales = await order.sequelize.query(
//     `SELECT SUM(totalBill) as totalSales
//       FROM orders
//       WHERE 1=1 ${lastMonthMTDDateFilter}`,
//     {
//       type: order.sequelize.QueryTypes.SELECT,
//     }
//   );

//   const lastMonthMTDTotalSales = parseFloat(lastMonthMTDSales?.totalSales || 0);
//   const vsLastMonthPercent =
//     lastMonthMTDTotalSales > 0
//       ? ((mtdTotalSales - lastMonthMTDTotalSales) / lastMonthMTDTotalSales) *
//         100
//       : 0;

//   // MTD Sales by Franchisee - Only orders with salesRepId (franchisee orders)
//   // Using raw SQL to ensure date filter works correctly
//   const mtdSalesByFranchisee = await order.sequelize.query(
//     `SELECT
//       orders.salesRepId as franchiseeId,
//       orders.salesRepId as salesRepId,
//       COALESCE(salesReps.srName, '') as franchiseeName,
//       COALESCE(salesReps.territoryName, '') as territoryName,
//       SUM(orders.totalBill) as totalSales
//     FROM orders
//     INNER JOIN salesReps ON salesReps.id = orders.salesRepId
//     WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'
//       AND orders.salesRepId IS NOT NULL
//     GROUP BY orders.salesRepId, salesReps.srName, salesReps.territoryName
//     ORDER BY totalSales DESC
//     LIMIT 5`,
//     {
//       type: order.sequelize.QueryTypes.SELECT,
//     }
//   );

//   // YTD Sales by Franchisee - Only orders with salesRepId (franchisee orders)
//   // Using raw SQL to ensure date filter works correctly
//   const ytdStart = new Date(currentYear, 0, 1);
//   const ytdEnd = new Date(currentYear, currentMonth, currentDay);
//   const ytdStartStr = ytdStart.toISOString().split("T")[0];
//   const ytdEndStr = ytdEnd.toISOString().split("T")[0];

//   const ytdSalesByFranchisee = await order.sequelize.query(
//     `SELECT
//       orders.salesRepId as franchiseeId,
//       orders.salesRepId as salesRepId,
//       COALESCE(salesReps.srName, '') as franchiseeName,
//       COALESCE(salesReps.territoryName, '') as territoryName,
//       SUM(orders.totalBill) as totalSales
//     FROM orders
//     INNER JOIN salesReps ON salesReps.id = orders.salesRepId
//     WHERE orders.on >= '${ytdStartStr}' AND orders.on <= '${ytdEndStr}'
//       AND orders.salesRepId IS NOT NULL
//     GROUP BY orders.salesRepId, salesReps.srName, salesReps.territoryName
//     ORDER BY totalSales DESC
//     LIMIT 5`,
//     {
//       type: order.sequelize.QueryTypes.SELECT,
//     }
//   );

//   // MTD Sales by Customer (Top 5) - Using same approach as customerSalesSummary report
//   const mtdSalesByCustomer = await order.sequelize.query(
//     `SELECT
//         orders.userId,
//         COALESCE(users.companyName, users.name) as customerName,
//         SUM(orders.totalBill) as totalSales
//       FROM orders
//       INNER JOIN users ON users.id = orders.userId
//       WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'
//       GROUP BY orders.userId
//       ORDER BY totalSales DESC
//       LIMIT 5`,
//     {
//       type: order.sequelize.QueryTypes.SELECT,
//     }
//   );

//   // Last Month Sales by Customer (Top 5) - Using same approach as customerSalesSummary report
//   const lastMonthSalesByCustomer = await order.sequelize.query(
//     `SELECT
//         orders.userId,
//         COALESCE(users.companyName, users.name) as customerName,
//         SUM(orders.totalBill) as totalSales
//       FROM orders
//       INNER JOIN users ON users.id = orders.userId
//       WHERE orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}'
//       GROUP BY orders.userId
//       ORDER BY totalSales DESC
//       LIMIT 5`,
//     {
//       type: order.sequelize.QueryTypes.SELECT,
//     }
//   );

//   res.status(200).json({
//     status: "success",
//     data: {
//       monthToDateSales: {
//         totalSales: mtdSalesSummary?.totalSales || 0,
//         orders: mtdSalesSummary?.orders || 0,
//         avgOrderValue: mtdSalesSummary?.avgOrderValue || 0,
//         vsLastMonthPercent: parseFloat(vsLastMonthPercent.toFixed(2)),
//       },
//       mtdSalesByCustomer: mtdSalesByCustomer.map((customer) => ({
//         customerId: customer.userId,
//         customerName: customer.customerName,
//         totalSales: parseFloat(customer.totalSales || 0),
//       })),
//       lastMonthSales: {
//         totalSales: lastMonthSalesSummary?.totalSales || 0,
//         orders: lastMonthSalesSummary?.orders || 0,
//         avgOrderValue: lastMonthSalesSummary?.avgOrderValue || 0,
//         monthClosed: "Completed",
//       },
//       lastMonthSalesByCustomer: lastMonthSalesByCustomer.map((customer) => ({
//         customerId: customer.userId,
//         customerName: customer.customerName,
//         totalSales: parseFloat(customer.totalSales || 0),
//       })),
//       mtdSalesByFranchisee: mtdSalesByFranchisee.map((franchisee) => ({
//         franchiseeId: franchisee.franchiseeId,
//         salesRepId: franchisee.salesRepId,
//         franchiseeName: franchisee.franchiseeName,
//         territoryName: franchisee.territoryName,
//         totalSales: parseFloat(franchisee.totalSales || 0),
//       })),
//       ytdSalesByFranchisee: ytdSalesByFranchisee.map((franchisee) => ({
//         franchiseeId: franchisee.franchiseeId,
//         salesRepId: franchisee.salesRepId,
//         franchiseeName: franchisee.franchiseeName,
//         territoryName: franchisee.territoryName,
//         totalSales: parseFloat(franchisee.totalSales || 0),
//       })),
//     },
//   });
// });

// Get Franchisee Sales Dashboard with MTD and YTD Sales
exports.getFranchiseeSalesDashboard = catchAsync(async (req, res, next) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // Month-to-Date: First day of current month to today
  const mtdStart = new Date(currentYear, currentMonth, 1);
  const mtdEnd = new Date(currentYear, currentMonth, currentDay);

  // Year-to-Date: First day of current year to today
  const ytdStart = new Date(currentYear, 0, 1);
  const ytdEnd = new Date(currentYear, currentMonth, currentDay);

  // Format dates for SQL (YYYY-MM-DD)
  const mtdStartStr = mtdStart.toISOString().split("T")[0];
  const mtdEndStr = mtdEnd.toISOString().split("T")[0];
  const ytdStartStr = ytdStart.toISOString().split("T")[0];
  const ytdEndStr = ytdEnd.toISOString().split("T")[0];

  // MTD Sales by Franchisee
  const mtdSalesByFranchisee = await order.findAll({
    where: {
      on: {
        [Op.between]: [mtdStartStr, mtdEndStr],
      },
      salesRepId: { [Op.ne]: null },
    },
    attributes: [
      "salesRepId",
      [
        literal(`
          (SELECT salesReps.id 
           FROM salesReps 
           WHERE salesReps.id = order.salesRepId)
        `),
        "franchiseeId",
      ],
      [
        literal(`
          (SELECT salesReps.srName 
           FROM salesReps 
           WHERE salesReps.id = order.salesRepId)
        `),
        "franchiseeName",
      ],
      [
        literal(`
          (SELECT salesReps.territoryName 
           FROM salesReps 
           WHERE salesReps.id = order.salesRepId)
        `),
        "territoryName",
      ],
      [
        literal(`
          SUM(
            CASE 
              WHEN order.salesRepId IS NULL THEN order.totalBill
              ELSE order.totalBill - (
                SELECT COALESCE(SUM(items.price - items.wholesalePrice), 0)
                FROM items 
                WHERE items.orderId = order.id
              )
            END
          )
        `),
        "totalSales",
      ],
    ],
    group: ["salesRepId"],
    order: [[literal("totalSales"), "DESC"]],
    limit: 5,
    raw: true,
  });

  // YTD Sales by Franchisee
  const ytdSalesByFranchisee = await order.findAll({
    where: {
      on: {
        [Op.between]: [ytdStartStr, ytdEndStr],
      },
      salesRepId: { [Op.ne]: null },
    },
    attributes: [
      "salesRepId",
      [
        literal(`
          (SELECT salesReps.id 
           FROM salesReps 
           WHERE salesReps.id = order.salesRepId)
        `),
        "franchiseeId",
      ],
      [
        literal(`
          (SELECT salesReps.srName 
           FROM salesReps 
           WHERE salesReps.id = order.salesRepId)
        `),
        "franchiseeName",
      ],
      [
        literal(`
          (SELECT salesReps.territoryName 
           FROM salesReps 
           WHERE salesReps.id = order.salesRepId)
        `),
        "territoryName",
      ],
      [
        literal(`
          SUM(
            CASE 
              WHEN order.salesRepId IS NULL THEN order.totalBill
              ELSE order.totalBill - (
                SELECT COALESCE(SUM(items.price - items.wholesalePrice), 0)
                FROM items 
                WHERE items.orderId = order.id
              )
            END
          )
        `),
        "totalSales",
      ],
    ],
    group: ["salesRepId"],
    order: [[literal("totalSales"), "DESC"]],
    limit: 5,
    raw: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      mtdSalesByFranchisee: mtdSalesByFranchisee.map((franchisee) => ({
        franchiseeId: franchisee.franchiseeId,
        salesRepId: franchisee.salesRepId,
        franchiseeName: franchisee.franchiseeName,
        territoryName: franchisee.territoryName,
        totalSales: parseFloat(franchisee.totalSales || 0),
      })),
      ytdSalesByFranchisee: ytdSalesByFranchisee.map((franchisee) => ({
        franchiseeId: franchisee.franchiseeId,
        salesRepId: franchisee.salesRepId,
        franchiseeName: franchisee.franchiseeName,
        territoryName: franchisee.territoryName,
        totalSales: parseFloat(franchisee.totalSales || 0),
      })),
    },
  });
});

// Get Local Partner Sales Dashboard (without franchisee section)
exports.getLocalPartnerSalesDashboard = catchAsync(async (req, res, next) => {
  const salesRepId = req.params.srId || req.query.srId;

  if (!salesRepId) {
    return res.status(400).json({
      status: "error",
      message: "Sales Rep ID is required",
    });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // Month-to-Date: First day of current month to today
  const mtdStart = new Date(currentYear, currentMonth, 1);
  const mtdEnd = new Date(currentYear, currentMonth, currentDay);

  // Last Month: First day of last month to last day of last month
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0);

  // Format dates for SQL (YYYY-MM-DD)
  const mtdStartStr = mtdStart.toISOString().split("T")[0];
  const mtdEndStr = mtdEnd.toISOString().split("T")[0];
  const lastMonthStartStr = lastMonthStart.toISOString().split("T")[0];
  const lastMonthEndStr = lastMonthEnd.toISOString().split("T")[0];

  // Month-to-Date Sales Summary (filtered by salesRepId)
  const mtdSalesSummary = await order.findOne({
    where: {
      on: {
        [Op.between]: [mtdStartStr, mtdEndStr],
      },
      salesRepId: salesRepId,
    },
    attributes: [
      [literal(`SUM(totalBill)`), "totalSales"],
      [literal(`COUNT(*)`), "orders"],
      [literal(`SUM(totalBill) / NULLIF(COUNT(*), 0)`), "avgOrderValue"],
    ],
    raw: true,
  });

  // Last Month Sales Summary (filtered by salesRepId)
  const lastMonthSalesSummary = await order.findOne({
    where: {
      on: {
        [Op.between]: [lastMonthStartStr, lastMonthEndStr],
      },
      salesRepId: salesRepId,
    },
    attributes: [
      [literal(`SUM(totalBill)`), "totalSales"],
      [literal(`COUNT(*)`), "orders"],
      [literal(`SUM(totalBill) / NULLIF(COUNT(*), 0)`), "avgOrderValue"],
    ],
    raw: true,
  });

  // Calculate percentage change vs last month (MTD)
  const mtdTotalSales = parseFloat(mtdSalesSummary?.totalSales || 0);
  const lastMonthMTDStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthMTDEnd = new Date(
    currentYear,
    currentMonth - 1,
    Math.min(currentDay, new Date(currentYear, currentMonth, 0).getDate())
  );
  const lastMonthMTDStartStr = lastMonthMTDStart.toISOString().split("T")[0];
  const lastMonthMTDEndStr = lastMonthMTDEnd.toISOString().split("T")[0];

  const lastMonthMTDSales = await order.findOne({
    where: {
      on: {
        [Op.between]: [lastMonthMTDStartStr, lastMonthMTDEndStr],
      },
      salesRepId: salesRepId,
    },
    attributes: [[literal(`SUM(totalBill)`), "totalSales"]],
    raw: true,
  });

  const lastMonthMTDTotalSales = parseFloat(lastMonthMTDSales?.totalSales || 0);
  const vsLastMonthPercent =
    lastMonthMTDTotalSales > 0
      ? ((mtdTotalSales - lastMonthMTDTotalSales) / lastMonthMTDTotalSales) *
        100
      : 0;

  // MTD Sales by Customer (Top 5) - filtered by salesRepId
  const mtdSalesByCustomer = await order.findAll({
    where: {
      on: {
        [Op.between]: [mtdStartStr, mtdEndStr],
      },
      salesRepId: salesRepId,
    },
    attributes: [
      "userId",
      [
        literal(`
          (SELECT COALESCE(users.companyName, users.name) 
           FROM users 
           WHERE users.id = order.userId)
        `),
        "customerName",
      ],
      [literal(`SUM(totalBill)`), "totalSales"],
    ],
    group: ["userId"],
    order: [[literal("totalSales"), "DESC"]],
    limit: 5,
    raw: true,
  });

  // Last Month Sales by Customer (Top 5) - filtered by salesRepId
  const lastMonthSalesByCustomer = await order.findAll({
    where: {
      on: {
        [Op.between]: [lastMonthStartStr, lastMonthEndStr],
      },
      salesRepId: salesRepId,
    },
    attributes: [
      "userId",
      [
        literal(`
          (SELECT COALESCE(users.companyName, users.name) 
           FROM users 
           WHERE users.id = order.userId)
        `),
        "customerName",
      ],
      [literal(`SUM(totalBill)`), "totalSales"],
    ],
    group: ["userId"],
    order: [[literal("totalSales"), "DESC"]],
    limit: 5,
    raw: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      monthToDateSales: {
        totalSales: mtdSalesSummary?.totalSales || 0,
        orders: mtdSalesSummary?.orders || 0,
        avgOrderValue: mtdSalesSummary?.avgOrderValue || 0,
        vsLastMonthPercent: parseFloat(vsLastMonthPercent.toFixed(2)),
      },
      mtdSalesByCustomer: mtdSalesByCustomer.map((customer) => ({
        customerId: customer.userId,
        customerName: customer.customerName,
        totalSales: parseFloat(customer.totalSales || 0),
      })),
      lastMonthSales: {
        totalSales: lastMonthSalesSummary?.totalSales || 0,
        orders: lastMonthSalesSummary?.orders || 0,
        avgOrderValue: lastMonthSalesSummary?.avgOrderValue || 0,
        monthClosed: "Completed",
      },
      lastMonthSalesByCustomer: lastMonthSalesByCustomer.map((customer) => ({
        customerId: customer.userId,
        customerName: customer.customerName,
        totalSales: parseFloat(customer.totalSales || 0),
      })),
    },
  });
});

exports.getSalesDashboard = catchAsync(async (req, res, next) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // Month-to-Date: First day of current month to today
  const mtdStart = new Date(currentYear, currentMonth, 1);
  const mtdEnd = new Date(currentYear, currentMonth, currentDay);

  // Last Month: First day of last month to last day of last month
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0);

  // Format dates for SQL (YYYY-MM-DD) - matching report format exactly
  const mtdStartStr =
    req.query.mtdStart || mtdStart.toISOString().split("T")[0];
  const mtdEndStr = req.query.mtdEnd || mtdEnd.toISOString().split("T")[0];
  const lastMonthStartStr =
    req.query.lastMonthStart || lastMonthStart.toISOString().split("T")[0];
  const lastMonthEndStr =
    req.query.lastMonthEnd || lastMonthEnd.toISOString().split("T")[0];

  console.log("🚀 ~ getSalesDashboardAllEntities ~ mtdStartStr:", mtdStartStr);
  console.log("🚀 ~ getSalesDashboardAllEntities ~ mtdEndStr:", mtdEndStr);
  console.log(
    "🚀 ~ getSalesDashboardAllEntities ~ req.user.entity:",
    req.user.entity
  );

  // Build entity-based filters
  let entityFilter = "";
  let salesRepIdFilter = "";
  let employeeIdFilter = "";

  const isAdmin =
    req.user.entity === "admin" || req.user.entity === "adminEmployee";
  const isLocalPartner =
    req.user.entity === "localPartner" || req.user.entity === "partnerEmployee";

  // For local partners: filter by salesRepId
  if (isLocalPartner && req.user.localPartnerId) {
    const salesRepId = req.user.localPartnerId;
    salesRepIdFilter = `AND orders.salesRepId = ${salesRepId}`;
    console.log(
      "🚀 ~ getSalesDashboard ~ Applied salesRepId filter:",
      salesRepId
    );
  }

  // For employees (adminEmployee or partnerEmployee): filter by employeeId
  if (
    req.user.entity === "adminEmployee" ||
    req.user.entity === "partnerEmployee"
  ) {
    const employeeId = req.user.employeeId || req.user.id;
    employeeIdFilter = `AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
    console.log(
      "🚀 ~ getSalesDashboard ~ Applied employeeId filter:",
      employeeId
    );
  }

  // Combine filters
  entityFilter = `${salesRepIdFilter} ${employeeIdFilter}`.trim();
  if (entityFilter) {
    entityFilter = entityFilter.startsWith("AND")
      ? entityFilter
      : `AND ${entityFilter}`;
  }

  // Month-to-Date Sales Summary - Using same approach as customerSalesSummary report
  // Note: Report uses 'orders.on >= startDate AND orders.on <= endDate' (inclusive on both ends)
  // orders.on is DATEONLY type, so direct comparison works
  const mtdDateFilter = `AND orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'`;
  console.log("🚀 ~ getSalesDashboard ~ mtdDateFilter:", mtdDateFilter);
  // Note: Report doesn't filter by deleted field - matching report exactly
  // The report query structure uses user.findAll with subqueries, but we're querying orders directly
  const mtdSalesSummaryResult = await order.sequelize.query(
    `SELECT 
        COALESCE(SUM(totalBill), 0) as totalSales,
        COUNT(*) as orders,
        COALESCE(SUM(totalBill) / NULLIF(COUNT(*), 0), 0) as avgOrderValue
      FROM orders
      WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}' ${entityFilter}`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    }
  );
  const mtdSalesSummary = mtdSalesSummaryResult?.[0] || {
    totalSales: 0,
    orders: 0,
    avgOrderValue: 0,
  };

  // Last Month Sales Summary - Using same approach as customerSalesSummary report
  const lastMonthDateFilter = `AND orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}'`;
  const lastMonthSalesSummaryResult = await order.sequelize.query(
    `SELECT 
        COALESCE(SUM(totalBill), 0) as totalSales,
        COUNT(*) as orders,
        COALESCE(SUM(totalBill) / NULLIF(COUNT(*), 0), 0) as avgOrderValue
      FROM orders
      WHERE orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}' ${entityFilter}`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    }
  );
  const lastMonthSalesSummary = lastMonthSalesSummaryResult?.[0] || {
    totalSales: 0,
    orders: 0,
    avgOrderValue: 0,
  };

  // Calculate percentage change vs last month (MTD)
  const mtdTotalSales = parseFloat(mtdSalesSummary?.totalSales || 0);
  const lastMonthTotalSales = parseFloat(
    lastMonthSalesSummary?.totalSales || 0
  );
  const lastMonthMTDStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthMTDEnd = new Date(
    currentYear,
    currentMonth - 1,
    Math.min(currentDay, new Date(currentYear, currentMonth, 0).getDate())
  );
  const lastMonthMTDStartStr = lastMonthMTDStart.toISOString().split("T")[0];
  const lastMonthMTDEndStr = lastMonthMTDEnd.toISOString().split("T")[0];

  const lastMonthMTDDateFilter = `AND orders.on >= '${lastMonthMTDStartStr}' AND orders.on <= '${lastMonthMTDEndStr}'`;
  const lastMonthMTDSales = await order.sequelize.query(
    `SELECT SUM(totalBill) as totalSales
      FROM orders
      WHERE orders.on >= '${lastMonthMTDStartStr}' AND orders.on <= '${lastMonthMTDEndStr}' ${entityFilter}`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    }
  );

  const lastMonthMTDTotalSales = parseFloat(lastMonthMTDSales?.totalSales || 0);
  const vsLastMonthPercent =
    lastMonthMTDTotalSales > 0
      ? ((mtdTotalSales - lastMonthMTDTotalSales) / lastMonthMTDTotalSales) *
        100
      : 0;

  // MTD Sales by Franchisee - Only orders with salesRepId (franchisee orders)
  // Build entity filter for franchisee query
  let franchiseeEntityFilter = "";
  if (isLocalPartner && req.user.localPartnerId) {
    franchiseeEntityFilter = `AND orders.salesRepId = ${req.user.localPartnerId}`;
  }
  if (
    req.user.entity === "adminEmployee" ||
    req.user.entity === "partnerEmployee"
  ) {
    const employeeId = req.user.employeeId || req.user.id;
    franchiseeEntityFilter += ` AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
  }

  const mtdSalesByFranchisee = await order.sequelize.query(
    `SELECT 
      orders.salesRepId as franchiseeId,
      orders.salesRepId as salesRepId,
      COALESCE(salesReps.srName, '') as franchiseeName,
      COALESCE(salesReps.territoryName, '') as territoryName,
      SUM(orders.totalBill) as totalSales
    FROM orders
    INNER JOIN salesReps ON salesReps.id = orders.salesRepId
    WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'
      AND orders.salesRepId IS NOT NULL
      ${franchiseeEntityFilter}
    GROUP BY orders.salesRepId, salesReps.srName, salesReps.territoryName
    ORDER BY totalSales DESC
    LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    }
  );

  // YTD Sales by Franchisee - Only orders with salesRepId (franchisee orders)
  const ytdStart = new Date(currentYear, 0, 1);
  const ytdEnd = new Date(currentYear, currentMonth, currentDay);
  const ytdStartStr = ytdStart.toISOString().split("T")[0];
  const ytdEndStr = mtdEndStr || ytdEnd.toISOString().split("T")[0];

  // Reuse the same entity filter logic for YTD
  let ytdFranchiseeEntityFilter = "";
  if (isLocalPartner && req.user.localPartnerId) {
    ytdFranchiseeEntityFilter = `AND orders.salesRepId = ${req.user.localPartnerId}`;
  }
  if (
    req.user.entity === "adminEmployee" ||
    req.user.entity === "partnerEmployee"
  ) {
    const employeeId = req.user.employeeId || req.user.id;
    ytdFranchiseeEntityFilter += ` AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
  }

  const ytdSalesByFranchisee = await order.sequelize.query(
    `SELECT 
      orders.salesRepId as franchiseeId,
      orders.salesRepId as salesRepId,
      COALESCE(salesReps.srName, '') as franchiseeName,
      COALESCE(salesReps.territoryName, '') as territoryName,
      SUM(orders.totalBill) as totalSales
    FROM orders
    INNER JOIN salesReps ON salesReps.id = orders.salesRepId
    WHERE orders.on >= '${ytdStartStr}' AND orders.on <= '${ytdEndStr}'
      AND orders.salesRepId IS NOT NULL
      ${ytdFranchiseeEntityFilter}
    GROUP BY orders.salesRepId, salesReps.srName, salesReps.territoryName
    ORDER BY totalSales DESC
    LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    }
  );

  // MTD Sales by Customer (Top 5) - Using same approach as customerSalesSummary report
  const mtdSalesByCustomer = await order.sequelize.query(
    `SELECT 
        orders.userId,
        COALESCE(users.companyName, users.name) as customerName,
        SUM(orders.totalBill) as totalSales
      FROM orders
      INNER JOIN users ON users.id = orders.userId
      WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}' ${entityFilter}
      GROUP BY orders.userId
      ORDER BY totalSales DESC
      LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    }
  );

  // Last Month Sales by Customer (Top 5) - Using same approach as customerSalesSummary report
  const lastMonthSalesByCustomer = await order.sequelize.query(
    `SELECT 
        orders.userId,
        COALESCE(users.companyName, users.name) as customerName,
        SUM(orders.totalBill) as totalSales
      FROM orders
      INNER JOIN users ON users.id = orders.userId
      WHERE orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}' ${entityFilter}
      GROUP BY orders.userId
      ORDER BY totalSales DESC
      LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    }
  );

  res.status(200).json({
    status: "success",
    data: {
      monthToDateSales: {
        totalSales: mtdSalesSummary?.totalSales || 0,
        orders: mtdSalesSummary?.orders || 0,
        avgOrderValue: mtdSalesSummary?.avgOrderValue || 0,
        vsLastMonthPercent: parseFloat(vsLastMonthPercent.toFixed(2)),
      },
      mtdSalesByCustomer: mtdSalesByCustomer.map((customer) => ({
        customerId: customer.userId,
        customerName: customer.customerName,
        totalSales: parseFloat(customer.totalSales || 0),
      })),
      lastMonthSales: {
        totalSales: lastMonthSalesSummary?.totalSales || 0,
        orders: lastMonthSalesSummary?.orders || 0,
        avgOrderValue: lastMonthSalesSummary?.avgOrderValue || 0,
        monthClosed: "Completed",
      },
      lastMonthSalesByCustomer: lastMonthSalesByCustomer.map((customer) => ({
        customerId: customer.userId,
        customerName: customer.customerName,
        totalSales: parseFloat(customer.totalSales || 0),
      })),
      // Only include franchisee data for admin and adminEmployee users
      ...((req.user.entity === "admin" ||
        req.user.entity === "adminEmployee") && {
        mtdSalesByFranchisee: mtdSalesByFranchisee.map((franchisee) => ({
          franchiseeId: franchisee.franchiseeId,
          salesRepId: franchisee.salesRepId,
          franchiseeName: franchisee.franchiseeName,
          territoryName: franchisee.territoryName,
          totalSales: parseFloat(franchisee.totalSales || 0),
        })),
        ytdSalesByFranchisee: ytdSalesByFranchisee.map((franchisee) => ({
          franchiseeId: franchisee.franchiseeId,
          salesRepId: franchisee.salesRepId,
          franchiseeName: franchisee.franchiseeName,
          territoryName: franchisee.territoryName,
          totalSales: parseFloat(franchisee.totalSales || 0),
        })),
      }),
    },
  });
});
