const {
  supplier,
  order,
  salesRep,
  user,
  item,
  product,
  partnerOrder,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { isHqOperator } = require("../../utils/hqOperator");

const { Op, literal, where, fn } = require("sequelize");

exports.partnerCommissionReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build date filter condition for SQL queries
  const dateFilter = `AND orders.on >= '${startDate}' AND orders.on <= '${endDate}'`;

  const doc = await salesRep.findAll({
    where: { partnerType: "dropship-partner" },
    attributes: [
      "id",
      "srName",
      [
        fn(
          "FORMAT",
          literal(
            `(SELECT SUM(orders.totalBill) FROM orders WHERE orders.salesRepId = salesRep.id  AND orders.statusId != 6 ${dateFilter})`,
          ),
          2,
        ),
        "totalSales",
      ],
      [
        fn(
          "FORMAT",
          literal(`
            (
              SELECT SUM(items.wholesalePrice)
              FROM orders
              JOIN items ON items.orderId = orders.id
              WHERE orders.salesRepId = salesRep.id
              AND  orders.statusId != 6
              ${dateFilter}
            )
          `),
          2,
        ),
        "wholesalePriceCost",
      ],
      [
        fn(
          "FORMAT",
          literal(`
            (
              SELECT SUM(items.price - items.wholesalePrice)
              FROM orders
              JOIN items ON items.orderId = orders.id
              WHERE orders.salesRepId = salesRep.id
                AND orders.statusId != 6
              ${dateFilter}
            )
          `),
          2,
        ),
        "totalCommission",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.statusId != 6 ${dateFilter})`,
        ),
        "ordersPlaced",
      ],
    ],
  });

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.partnerCreaditLimit = catchAsync(async (req, res, next) => {
  const doc = await salesRep.findAll({
    where: { partnerType: "dropship-partner" },
    attributes: [
      "id",
      "srName",
      "creditLimit",
      [
        fn(
          "FORMAT",
          literal(`
              (
                SELECT SUM(items.wholesalePrice)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                    AND orders.paymentStatus = 'pending'
              )
            `),
          1,
        ),
        "creditUsed",
      ],
    ],
  });

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.unpaidPartnerbalanceReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, ...otherQueryParams } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build date filter conditions for SQL queries
  const orderDateFilter = `AND orders.on >= '${startDate}' AND orders.on <= '${endDate}'`;
  const partnerOrderDateFilter = `AND partnerOrders.on >= '${startDate}' AND partnerOrders.on <= '${endDate}'`;

  const condition = { ...otherQueryParams };
  console.log("🚀 ~ condition:", condition);

  const doc = await salesRep.findAll({
    where: condition,
    attributes: [
      "id",
      "srName",
      "partnerType",
      "territoryName",
      [
        literal(`
              (
                SELECT SUM(items.wholesalePrice)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                    AND orders.adminReceivableStatus = false
                ${orderDateFilter}
              )
            `),
        "outstandingBalance",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.adminReceivableStatus = false ${orderDateFilter})`,
        ),
        "ordersOnCredit",
      ],
      [
        literal(
          `(SELECT SUM(partnerOrders.totalBill) FROM partnerOrders WHERE partnerOrders.salesRepId = salesRep.id AND partnerOrders.paymentStatus = 'pending' ${partnerOrderDateFilter})`,
        ),
        "selfOrdersOutstandingBalance",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM partnerOrders WHERE partnerOrders.salesRepId = salesRep.id AND partnerOrders.paymentStatus = 'pending' ${partnerOrderDateFilter})`,
        ),
        "selfOrdersOnCredit",
      ],
    ],
  });

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.directPartnerReportSummary = catchAsync(async (req, res, next) => {
  const { startDate, endDate, ...otherQueryParams } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build date filter conditions for SQL queries
  const orderDateFilter = `AND orders.on >= '${startDate}' AND orders.on <= '${endDate}'`;
  const partnerOrderDateFilter = `AND partnerOrders.on >= '${startDate}' AND partnerOrders.on <= '${endDate}'`;

  const condition = { ...otherQueryParams };

  const doc = await salesRep.findAll({
    where: condition,
    attributes: [
      "id",
      "srName",
      "partnerType",
      "territoryName",
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id ${orderDateFilter})`,
        ),
        "clientOrdersCount",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM partnerOrders WHERE partnerOrders.salesRepId = salesRep.id ${partnerOrderDateFilter})`,
        ),
        "selfOrdersCount",
      ],
    ],
  });
  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.customerReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build date filter condition for SQL queries
  const dateFilter = `AND orders.on >= '${startDate}' AND orders.on <= '${endDate}'`;

  const doc = await user.findAll({
    where: literal(`
        EXISTS (
          SELECT 1
          FROM orders 
          WHERE orders.userId = user.id
          ${dateFilter}
        )
      `),
    attributes: [
      "id",
      "name",
      "companyName",
      [
        fn(
          "FORMAT",
          literal(`
              (
                SELECT SUM(totalBill)
                FROM orders WHERE orders.userID = user.id
                ${dateFilter}
              )
            `),
          1,
        ),
        "totatSpent",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.userID = user.id ${dateFilter})`,
        ),
        "numberOfOrders",
      ],
      [
        fn(
          "FORMAT",
          literal(`
              (
                SELECT SUM(totalBill) / NULLIF(COUNT(*), 0)
                FROM orders WHERE orders.userID = user.id
                ${dateFilter}
              )
            `),
          1,
        ),
        "avgSpent",
      ],
      [
        literal(`
              (
                SELECT orders.on
                FROM orders 
                WHERE orders.userID = user.id
                ${dateFilter}
                ORDER BY orders.on DESC
                LIMIT 1
              )
            `),
        "lastOrderDate",
      ],
      [
        literal(
          `(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id AND orders.paymentStatus = 'pending' ${dateFilter})`,
        ),
        "outstandingBalance",
      ],
    ],
  });

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.productSalesReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build date filter conditions for SQL queries
  const orderDateFilter = `AND orders.on >= '${startDate}' AND orders.on <= '${endDate}'`;
  const partnerOrderDateFilter = `AND partnerOrders.on >= '${startDate}' AND partnerOrders.on <= '${endDate}'`;

  const doc = await product.findAll({
    attributes: [
      "id",
      "name",
      [
        literal(`
              (
                SELECT SUM(qty)
                FROM items 
                JOIN orders ON orders.id = items.orderId
                WHERE items.productId = product.id
                ${orderDateFilter}
              )
            `),
        "unitsSoldToCustomer",
      ],
      [
        literal(`
              (
                SELECT SUM(price)
                FROM items 
                JOIN orders ON orders.id = items.orderId
                WHERE items.productId = product.id AND items.wholesalePrice < 1
                ${orderDateFilter}
              )
            `),
        "customerPriceTotal",
      ],
      [
        literal(`
              (
                SELECT SUM(wholesalePrice)
                FROM items 
                JOIN orders ON orders.id = items.orderId
                WHERE items.productId = product.id AND items.wholesalePrice > 0
                ${orderDateFilter}
              )
            `),
        "wholesalePriceTotal",
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
            JOIN orders ON orders.id = items.orderId
            WHERE items.productId = product.id
            ${orderDateFilter}
          )
        `),
        "revenueFromCustomers",
      ],
      [
        literal(`
          (
            SELECT SUM(price)
            FROM partnerOrderItems 
            JOIN partnerOrders ON partnerOrders.id = partnerOrderItems.partnerOrderId
            WHERE partnerOrderItems.productId = product.id
            ${partnerOrderDateFilter}
          )
        `),
        "revenueFromLocalPartners",
      ],
      [
        literal(`
              (
                SELECT SUM(qty)
                FROM partnerOrderItems 
                JOIN partnerOrders ON partnerOrders.id = partnerOrderItems.partnerOrderId
                WHERE partnerOrderItems.productId = product.id
                ${partnerOrderDateFilter}
              )
            `),
        "unitsSoldToPartners",
      ],
    ],
  });

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

// exports.productSalesReportss = catchAsync(async (req, res, next) => {
//   const doc = await product.findAll({
//     attributes: [
//       "id",
//       "name",
//       [
//         literal(`
//               (
//                 SELECT SUM(qty)
//                 FROM items WHERE items.productId = product.id
//               )
//             `),
//         "unitsSold",
//       ],
//       [
//         literal(`
//               (
//                 SELECT SUM(price)
//                 FROM items WHERE items.productId = product.id  AND items.wholesalePrice < 1
//               )
//             `),
//         "customerPriceTotal",
//       ],
//       [
//         literal(`
//               (
//                 SELECT SUM(wholesalePrice)
//                 FROM items WHERE items.productId = product.id AND items.wholesalePrice > 0
//               )
//             `),
//         "wholesalePriceTotal",
//       ],
//       [
//         literal(`
//           (
//             SELECT SUM(
//               CASE
//                 WHEN wholesalePrice > 0 THEN wholesalePrice
//                 ELSE price
//               END
//             )
//             FROM items
//             WHERE items.productId = product.id
//           )
//         `),
//         "revenue",
//       ],
//       [
//         literal(`(
//           SELECT srName
//           FROM salesReps
//           WHERE salesReps.id = (
//             SELECT orders.salesRepId
//             FROM items
//             JOIN orders ON orders.id = items.orderId
//             WHERE items.productId = product.id
//             GROUP BY orders.salesRepId
//             ORDER BY COUNT(*) DESC
//             LIMIT 1
//           )
//         )`),
//         "topSalesRepName",
//       ],
//     ],
//   });

//   res.status(200).json({
//     status: "success",
//     data: doc,
//   });
// });

//   [s

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

exports.customerSalesSummary = catchAsync(async (req, res, next) => {
  const { startDate, endDate, salesRepId, userType, employeeId } = req.query;
  const salesRepNe = req.query["salesRep[ne]"];
  const employeeIdNe = req.query["employeeId[ne]"];

  console.log("🚀 ~ customerSalesSummary ~ req.query:", req.query);
  console.log("🚀 ~ customerSalesSummary ~ startDate:", startDate);
  console.log("🚀 ~ customerSalesSummary ~ endDate:", endDate);
  console.log("🚀 ~ customerSalesSummary ~ salesRepId:", salesRepId);
  console.log("🚀 ~ customerSalesSummary ~ userType:", userType);
  console.log("🚀 ~ customerSalesSummary ~ salesRepNe:", salesRepNe);
  console.log("🚀 ~ customerSalesSummary ~ employeeId:", employeeId);
  console.log("🚀 ~ customerSalesSummary ~ employeeIdNe:", employeeIdNe);
  console.log("🚀 ~ customerSalesSummary ~ req.user.entity:", req.user?.entity);

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build entity-based filters
  const isAdmin = isHqOperator(req.user?.entity);
  const isAdminEmployee = req.user?.entity === "adminEmployee";
  const isLocalPartner =
    req.user?.entity === "localPartner" ||
    req.user?.entity === "partnerEmployee";

  // Validate: Only admin can use salesRepId query parameter to view specific local partner
  if (salesRepId && !isAdmin) {
    return next(
      new AppError("Only admin users can filter by specific salesRepId", 403),
    );
  }

  // Check if admin is requesting a specific local partner's data
  const requestedSalesRepId = salesRepId
    ? Array.isArray(salesRepId)
      ? salesRepId[0]
      : typeof salesRepId === "string" && salesRepId.includes(",")
        ? null
        : parseInt(salesRepId)
    : null;
  const isAdminViewingLocalPartner =
    isAdmin && requestedSalesRepId && !userType;

  // Check if admin wants to see only direct admin orders (salesRepId IS NULL)
  const isAdminOnlyCondition = isAdmin && userType === "admin";

  // Build salesRep filter condition
  let salesRepFilter = "";
  let employeeIdFilter = "";

  // Apply entity-based filtering
  // IMPORTANT: Admin users see ALL data - no entity filtering applied
  // EXCEPTION: If userType=admin, admin will see only direct admin orders (salesRepId IS NULL) - takes highest precedence
  // EXCEPTION: If salesRepId is provided (and userType is not admin), admin will see data for that local partner only
  // Priority: userType=admin > entity-based filters > query parameter filters
  // Only admin can use employeeId query parameter to filter by specific employee(s).
  if (employeeId && !isAdmin) {
    return next(
      new AppError("Only admin users can filter by specific employeeId", 403),
    );
  }

  // Check userType=admin FIRST - takes highest precedence for admin users
  if (isAdminOnlyCondition) {
    salesRepFilter = "AND orders.salesRepId IS NULL";
    console.log(
      "🚀 ~ customerSalesSummary ~ Applied userType=admin filter (highest precedence)",
    );
  }
  // Apply entity-based filtering (only if userType=admin is not set)
  else if (!isAdmin || isAdminViewingLocalPartner) {
    // For local partners: filter by their own salesRepId
    if (isLocalPartner && req.user?.localPartnerId) {
      const localPartnerSalesRepId = req.user.localPartnerId;
      salesRepFilter = `AND orders.salesRepId = ${localPartnerSalesRepId}`;
      console.log(
        "🚀 ~ customerSalesSummary ~ Applied local partner salesRepId filter:",
        localPartnerSalesRepId,
      );
    }
    // For admin viewing a specific local partner's data
    else if (isAdminViewingLocalPartner && requestedSalesRepId) {
      salesRepFilter = `AND orders.salesRepId = ${requestedSalesRepId}`;
      console.log(
        "🚀 ~ customerSalesSummary ~ Admin viewing local partner, salesRepId filter:",
        requestedSalesRepId,
      );
    }
    // For employees (adminEmployee or partnerEmployee): filter by employeeId
    if (
      req.user?.entity === "adminEmployee" ||
      req.user?.entity === "partnerEmployee"
    ) {
      const currentUserEmployeeId = req.user?.employeeId || req.user?.id;
      employeeIdFilter = `AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${currentUserEmployeeId})`;
      console.log(
        "🚀 ~ customerSalesSummary ~ Applied employeeId filter:",
        currentUserEmployeeId,
      );
    }
  } else {
    // Admin without entity filters and without userType=admin - apply query parameter filters if provided
    // Handle salesRep[ne]=null (salesRepId IS NOT NULL)
    if (salesRepNe === "null" || salesRepNe === null) {
      salesRepFilter = "AND orders.salesRepId IS NOT NULL";
      console.log(
        "🚀 ~ customerSalesSummary ~ Applied salesRep[ne]=null filter",
      );
    }
    // Handle salesRepId array [29,27] or comma-separated string
    else if (salesRepId) {
      let salesRepIds = [];

      // Handle array format: [29,27] or "29,27"
      if (Array.isArray(salesRepId)) {
        salesRepIds = salesRepId
          .map((id) => parseInt(id))
          .filter((id) => !isNaN(id));
        console.log(
          "🚀 ~ customerSalesSummary ~ salesRepId is Array:",
          salesRepIds,
        );
      } else if (typeof salesRepId === "string") {
        // Handle string format like "[29,27]" or "29,27" or "[28]"
        let cleaned = salesRepId.trim();
        // Remove brackets if present
        if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
          cleaned = cleaned.slice(1, -1);
        }
        // Split by comma and parse each ID
        const parts = cleaned.split(",");
        salesRepIds = parts
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id) && id > 0);
        console.log(
          "🚀 ~ customerSalesSummary ~ salesRepId is String, original:",
          salesRepId,
        );
        console.log("🚀 ~ customerSalesSummary ~ salesRepId cleaned:", cleaned);
        console.log(
          "🚀 ~ customerSalesSummary ~ Parsed salesRepIds:",
          salesRepIds,
        );
      } else if (typeof salesRepId === "number") {
        // Handle single number
        salesRepIds = [parseInt(salesRepId)];
        console.log(
          "🚀 ~ customerSalesSummary ~ salesRepId is Number:",
          salesRepIds,
        );
      }

      if (salesRepIds.length > 0) {
        const placeholders = salesRepIds.map((id) => `${id}`).join(", ");
        salesRepFilter = `AND orders.salesRepId IN (${placeholders})`;
        console.log(
          "🚀 ~ customerSalesSummary ~ Applied salesRepId IN filter:",
          salesRepFilter,
        );
      } else {
        console.log(
          "🚀 ~ customerSalesSummary ~ WARNING: salesRepIds array is empty after parsing!",
        );
      }
    }

    // Handle employeeId[ne]=null (only orders where customer has employeeId IS NOT NULL)
    if (employeeIdNe === "null" || employeeIdNe === null) {
      employeeIdFilter =
        "AND orders.userId IN (SELECT id FROM users WHERE users.employeeId IS NOT NULL)";
      console.log(
        "🚀 ~ customerSalesSummary ~ Applied employeeId[ne]=null filter",
      );
    }
    // Handle employeeId: single value, array [1,2], or comma-separated "1,2"
    else if (employeeId) {
      let employeeIds = [];

      if (Array.isArray(employeeId)) {
        employeeIds = employeeId
          .map((id) => parseInt(id))
          .filter((id) => !isNaN(id));
        console.log(
          "🚀 ~ customerSalesSummary ~ employeeId is Array:",
          employeeIds,
        );
      } else if (typeof employeeId === "string") {
        let cleaned = employeeId.trim();
        if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
          cleaned = cleaned.slice(1, -1);
        }
        const parts = cleaned.split(",");
        employeeIds = parts
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id) && id > 0);
        console.log(
          "🚀 ~ customerSalesSummary ~ employeeId is String, parsed:",
          employeeIds,
        );
      } else if (
        typeof employeeId === "number" ||
        (typeof employeeId === "string" && !employeeId.includes(","))
      ) {
        const id = parseInt(employeeId);
        if (!isNaN(id) && id > 0) employeeIds = [id];
      }

      if (employeeIds.length > 0) {
        const placeholders = employeeIds.map((id) => `${id}`).join(", ");
        employeeIdFilter = `AND orders.userId IN (SELECT id FROM users WHERE users.employeeId IN (${placeholders}))`;
        console.log(
          "🚀 ~ customerSalesSummary ~ Applied employeeId IN filter:",
          employeeIdFilter,
        );
      } else {
        console.log(
          "🚀 ~ customerSalesSummary ~ WARNING: employeeIds array is empty after parsing!",
        );
      }
    }
  }

  // Combine filters
  const combinedFilter = `${salesRepFilter} ${employeeIdFilter}`.trim();
  const finalFilter = combinedFilter ? combinedFilter : "";

  console.log("🚀 ~ customerSalesSummary ~ Final filter:", finalFilter);

  // Build date filter condition for SQL queries
  // Match dashboard filters: statusId != 6 (exclude cancelled orders)
  const dateFilter = `AND orders.on >= '${startDate}' AND orders.on <= '${endDate}' AND orders.statusId != 6 ${finalFilter}`;
  console.log("🚀 ~ customerSalesSummary ~ dateFilter:", dateFilter);

  // Build the WHERE clause with filter
  const whereClause = `
          EXISTS (
            SELECT 1
            FROM orders 
            WHERE orders.userId = user.id
            ${dateFilter}
          )
        `;
  console.log("🚀 ~ customerSalesSummary ~ whereClause:", whereClause);

  // Build the totalSpent subquery with filter
  const totalSpentQuery = `
                (
                  SELECT SUM(totalBill)
                  FROM orders WHERE orders.userID = user.id
                  ${dateFilter}
                )
              `;
  console.log("🚀 ~ customerSalesSummary ~ totalSpentQuery:", totalSpentQuery);

  // Build the numberOfOrders subquery with filter
  const numberOfOrdersQuery = `(SELECT COUNT(*) FROM orders WHERE orders.userID = user.id ${dateFilter})`;
  console.log(
    "🚀 ~ customerSalesSummary ~ numberOfOrdersQuery:",
    numberOfOrdersQuery,
  );

  // Build the avgSpent subquery with filter
  const avgSpentQuery = `
                (
                  SELECT SUM(totalBill) / NULLIF(COUNT(*), 0)
                  FROM orders WHERE orders.userID = user.id
                  ${dateFilter}
                )
              `;
  console.log("🚀 ~ customerSalesSummary ~ avgSpentQuery:", avgSpentQuery);

  console.log("🚀 ~ customerSalesSummary ~ Executing query...");
  const doc = await user.findAll({
    where: literal(whereClause),
    attributes: [
      "id",
      "name",
      "companyName",
      [literal(totalSpentQuery), "totatSpent"],
      [literal(numberOfOrdersQuery), "numberOfOrders"],
      [fn("FORMAT", literal(avgSpentQuery), 1), "avgSpent"],
    ],
  });

  console.log("🚀 ~ customerSalesSummary ~ Query result count:", doc?.length);
  console.log("🚀 ~ customerSalesSummary ~ First result:", doc?.[0]);

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.customerDetailsSummary = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const { userId } = req.params;

  if (!userId) {
    return next(new AppError("userId is required", 400));
  }

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build entity-based filters
  const isAdmin = isHqOperator(req.user?.entity);
  const isAdminEmployee = req.user?.entity === "adminEmployee";
  const isLocalPartner =
    req.user?.entity === "localPartner" ||
    req.user?.entity === "partnerEmployee";

  // Build entity-based access control filters
  let entityFilter = "";

  // For local partners: verify customer belongs to them and filter orders
  if (isLocalPartner && req.user?.localPartnerId) {
    const localPartnerSalesRepId = req.user.localPartnerId;

    // Verify that the requested userId has orders with this local partner
    const hasAccess = await order.findOne({
      where: {
        userId: userId,
        salesRepId: localPartnerSalesRepId,
      },
      attributes: ["id"],
    });

    if (!hasAccess) {
      return next(
        new AppError(
          "You do not have access to view this customer's details",
          403,
        ),
      );
    }

    entityFilter = `AND orders.salesRepId = ${localPartnerSalesRepId}`;
    console.log(
      "🚀 ~ customerDetailsSummary ~ Applied local partner filter:",
      localPartnerSalesRepId,
    );
  }
  // For employees: verify customer is assigned to them and filter orders
  else if (
    req.user?.entity === "adminEmployee" ||
    req.user?.entity === "partnerEmployee"
  ) {
    const employeeId = req.user?.employeeId || req.user?.id;

    // Verify that the requested userId is assigned to this employee
    const customerUser = await user.findOne({
      where: {
        id: userId,
        employeeId: employeeId,
      },
      attributes: ["id"],
    });

    if (!customerUser) {
      return next(
        new AppError(
          "You do not have access to view this customer's details",
          403,
        ),
      );
    }

    entityFilter = `AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
    console.log(
      "🚀 ~ customerDetailsSummary ~ Applied employee filter:",
      employeeId,
    );
  }

  // Build the SQL query using raw SQL
  // Returns both product items, charges, and shipping charges from orders.shippingCharges
  // No type filter - shows all items regardless of type (product or charges)
  const query = `
    SELECT 
      items.id,
      items.qty AS quantity,
      items.price,
      items.type,
      items.productId,
      CASE 
        WHEN items.type = 'charges' THEN items.productName
        ELSE products.name
      END AS productName,
      CASE 
        WHEN items.type = 'charges' THEN 'Charges'
        ELSE (SELECT categories.name FROM categories WHERE categories.id = products.categoryId LIMIT 1)
      END AS categoryName,
      CASE 
        WHEN items.type = 'charges' THEN items.productName
        ELSE (SELECT categories.name FROM categories WHERE categories.id = products.categoryId LIMIT 1)
      END AS memo,
      orders.invoiceNumber,
      orders.on AS transactionDate,
      'Invoice' AS transactionType,
      (items.price / NULLIF(CAST(items.qty AS DECIMAL(10,2)), 0)) AS unitPrice,
      items.price AS amount
    FROM items
    INNER JOIN orders ON orders.id = items.orderId
    LEFT JOIN products ON products.id = items.productId AND items.type = 'product'
    WHERE orders.userId = :userId
      AND orders.on >= :startDate
      AND orders.on <= :endDate
      AND orders.statusId != 6
      AND items.deleted = 0
      ${entityFilter}
    
    UNION ALL
    
    SELECT 
      CONCAT(orders.id, '-shipping') AS id,
      1 AS quantity,
      orders.shippingCharges AS price,
      'shipping' AS type,
      NULL AS productId,
      'Shipping' AS productName,
      'Shipping' AS categoryName,
      CONCAT('Shipping Charges', CASE WHEN orders.shippingCompany IS NOT NULL THEN CONCAT(' (', orders.shippingCompany, ')') ELSE '' END) AS memo,
      orders.invoiceNumber,
      orders.on AS transactionDate,
      'Invoice' AS transactionType,
      orders.shippingCharges AS unitPrice,
      orders.shippingCharges AS amount
    FROM orders
    WHERE orders.userId = :userId
      AND orders.on >= :startDate
      AND orders.on <= :endDate
      AND orders.statusId != 6
      AND orders.shippingCharges > 0
      AND orders.deleted = 0
      ${entityFilter}
    
    ORDER BY transactionDate DESC, invoiceNumber, id
  `;

  const doc = await order.sequelize.query(query, {
    replacements: { userId, startDate, endDate },
    type: order.sequelize.QueryTypes.SELECT,
  });

  res.status(200).json({
    status: "success",
    data: doc,
  });
});

exports.categoryWiseProductSalesSummary = catchAsync(async (req, res, next) => {
  const { startDate, endDate, salesRepId, userType, productId } = req.query;
  const salesRepNe = req.query["salesRep[ne]"];

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build entity-based filters
  const isAdmin = isHqOperator(req.user?.entity);
  const isAdminEmployee = req.user?.entity === "adminEmployee";
  const isLocalPartner =
    req.user?.entity === "localPartner" ||
    req.user?.entity === "partnerEmployee";

  // Validate: Only admin can use salesRepId query parameter to view specific local partner
  if (salesRepId && !isAdmin) {
    return next(
      new AppError("Only admin users can filter by specific salesRepId", 403),
    );
  }

  // Check if admin is requesting a specific local partner's data
  const requestedSalesRepId = salesRepId
    ? Array.isArray(salesRepId)
      ? salesRepId[0]
      : typeof salesRepId === "string" && salesRepId.includes(",")
        ? null
        : parseInt(salesRepId)
    : null;
  const isAdminViewingLocalPartner =
    isAdmin && requestedSalesRepId && !userType;

  // Check if admin wants to see only direct admin orders (salesRepId IS NULL)
  const isAdminOnlyCondition = isAdmin && userType === "admin";

  // Build salesRep filter conditions
  let orderSalesRepFilter = "";
  let partnerOrderSalesRepFilter = "";
  let orderEmployeeIdFilter = "";
  let partnerOrderEmployeeIdFilter = "";
  const replacements = { startDate, endDate };

  // Build productId filter condition
  let productIdFilter = "";
  if (productId) {
    const productIdNum = parseInt(productId);
    if (!isNaN(productIdNum) && productIdNum > 0) {
      productIdFilter = "AND items.productId = :productId";
      replacements.productId = productIdNum;
    }
  }

  // Build productId filter for partner orders
  let partnerProductIdFilter = "";
  if (productId) {
    const productIdNum = parseInt(productId);
    if (!isNaN(productIdNum) && productIdNum > 0) {
      partnerProductIdFilter = "AND partnerOrderItems.productId = :productId";
      // productId already added to replacements above
    }
  }

  // Apply entity-based filtering
  // IMPORTANT: Admin users see ALL data - no entity filtering applied
  // EXCEPTION: If userType=admin, admin will see only direct admin orders (salesRepId IS NULL) - takes highest precedence
  // EXCEPTION: If salesRepId is provided (and userType is not admin), admin will see data for that local partner only
  // Priority: userType=admin > entity-based filters > query parameter filters

  // Check userType=admin FIRST - takes highest precedence for admin users
  if (isAdminOnlyCondition) {
    orderSalesRepFilter = "AND orders.salesRepId IS NULL";
    partnerOrderSalesRepFilter = "AND partnerOrders.salesRepId IS NULL";
    console.log(
      "🚀 ~ categoryWiseProductSalesSummary ~ Applied userType=admin filter (highest precedence)",
    );
  }
  // Apply entity-based filtering (only if userType=admin is not set)
  else if (!isAdmin || isAdminViewingLocalPartner) {
    // For local partners: filter by their own salesRepId
    if (isLocalPartner && req.user?.localPartnerId) {
      const localPartnerSalesRepId = req.user.localPartnerId;
      orderSalesRepFilter = `AND orders.salesRepId = ${localPartnerSalesRepId}`;
      partnerOrderSalesRepFilter = `AND partnerOrders.salesRepId = ${localPartnerSalesRepId}`;
      console.log(
        "🚀 ~ categoryWiseProductSalesSummary ~ Applied local partner salesRepId filter:",
        localPartnerSalesRepId,
      );
    }
    // For admin viewing a specific local partner's data
    else if (isAdminViewingLocalPartner && requestedSalesRepId) {
      orderSalesRepFilter = `AND orders.salesRepId = ${requestedSalesRepId}`;
      partnerOrderSalesRepFilter = `AND partnerOrders.salesRepId = ${requestedSalesRepId}`;
      console.log(
        "🚀 ~ categoryWiseProductSalesSummary ~ Admin viewing local partner, salesRepId filter:",
        requestedSalesRepId,
      );
    }
    // For employees (adminEmployee or partnerEmployee): filter by employeeId
    if (
      req.user?.entity === "adminEmployee" ||
      req.user?.entity === "partnerEmployee"
    ) {
      const employeeId = req.user?.employeeId || req.user?.id;
      orderEmployeeIdFilter = `AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
      // Note: partnerOrders don't have employeeId filtering like customer orders
      console.log(
        "🚀 ~ categoryWiseProductSalesSummary ~ Applied employeeId filter:",
        employeeId,
      );
    }
  } else {
    // Admin without entity filters and without userType=admin - apply query parameter filters if provided
    // Handle salesRep[ne]=null (salesRepId IS NOT NULL)
    if (salesRepNe === "null" || salesRepNe === null) {
      orderSalesRepFilter = "AND orders.salesRepId IS NOT NULL";
      partnerOrderSalesRepFilter = "AND partnerOrders.salesRepId IS NOT NULL";
      console.log(
        "🚀 ~ categoryWiseProductSalesSummary ~ Applied salesRep[ne]=null filter",
      );
    }
    // Handle salesRepId array [29,27] or comma-separated string
    else if (salesRepId) {
      let salesRepIds = [];

      // Handle array format: [29,27] or "29,27"
      if (Array.isArray(salesRepId)) {
        salesRepIds = salesRepId
          .map((id) => parseInt(id))
          .filter((id) => !isNaN(id));
      } else if (typeof salesRepId === "string") {
        // Handle string format like "[29,27]" or "29,27"
        const cleaned = salesRepId.replace(/[\[\]]/g, "");
        salesRepIds = cleaned
          .split(",")
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id));
      }

      if (salesRepIds.length > 0) {
        const placeholders = salesRepIds
          .map((_, index) => `:salesRepId${index}`)
          .join(", ");
        orderSalesRepFilter = `AND orders.salesRepId IN (${placeholders})`;
        partnerOrderSalesRepFilter = `AND partnerOrders.salesRepId IN (${placeholders})`;

        // Add replacements for each salesRepId
        salesRepIds.forEach((id, index) => {
          replacements[`salesRepId${index}`] = id;
        });
        console.log(
          "🚀 ~ categoryWiseProductSalesSummary ~ Applied salesRepId IN filter",
        );
      }
    }
  }

  // Build the SQL query to get category-wise product sales summary
  // Combining data from both items (customer orders) and partnerOrderItems (partner orders)
  const query = `
    SELECT 
      COALESCE(cat.id, cat_po.id) AS categoryId,
      COALESCE(cat.name, cat_po.name) AS categoryName,
      COALESCE(prod.id, prod_po.id) AS productId,
      COALESCE(prod.name, poi.productName) AS productName,
      COALESCE(SUM(CAST(i.qty AS DECIMAL(10,2))), 0) + 
      COALESCE(SUM(CAST(poi.qty AS DECIMAL(10,2))), 0) AS quantity,
      COALESCE(SUM(i.price), 0) + COALESCE(SUM(poi.price), 0) AS amount,
      -- COGS: Use wholesalePrice if exists (wholesale customer), otherwise use price (regular customer)
      -- For partnerOrderItems, price is always wholesale cost
      -- All values are already totals (qty * unit price), so we just SUM them
      COALESCE(SUM(COALESCE(i.wholesalePrice, i.price)), 0) + 
      COALESCE(SUM(poi.price), 0) AS costOfGoodsSold
    FROM (
      SELECT 
        items.id,
        items.qty,
        items.price,
        items.wholesalePrice,
        items.productId,
        items.type,
        items.deleted
      FROM items
      INNER JOIN orders ON orders.id = items.orderId
      WHERE orders.on >= :startDate
        AND orders.on <= :endDate
        AND items.deleted = 0
        AND items.type = 'product'
    ) AS i
    LEFT JOIN products AS prod ON prod.id = i.productId
    LEFT JOIN categories AS cat ON cat.id = prod.categoryId
    FULL OUTER JOIN (
      SELECT 
        partnerOrderItems.id,
        partnerOrderItems.qty,
        partnerOrderItems.price,
        partnerOrderItems.productId,
        partnerOrderItems.productName,
        partnerOrderItems.type,
        partnerOrderItems.deleted
      FROM partnerOrderItems
      INNER JOIN partnerOrders ON partnerOrders.id = partnerOrderItems.partnerOrderId
      WHERE partnerOrders.on >= :startDate
        AND partnerOrders.on <= :endDate
        AND partnerOrderItems.deleted = 0
        AND partnerOrderItems.type = 'product'
    ) AS poi ON poi.productId = i.productId
    LEFT JOIN products AS prod_po ON prod_po.id = poi.productId
    LEFT JOIN categories AS cat_po ON cat_po.id = prod_po.categoryId
    WHERE (i.id IS NOT NULL OR poi.id IS NOT NULL)
    GROUP BY 
      COALESCE(cat.id, cat_po.id),
      COALESCE(cat.name, cat_po.name),
      COALESCE(prod.id, prod_po.id),
      COALESCE(prod.name, poi.productName)
    ORDER BY 
      COALESCE(cat.id, cat_po.id),
      COALESCE(prod.id, prod_po.id)
  `;

  // Since MySQL doesn't support FULL OUTER JOIN, we'll use UNION approach
  const queryUnion = `
    SELECT 
      categories.id AS categoryId,
      categories.name AS categoryName,
      products.id AS productId,
      products.name AS productName,
      COALESCE(SUM(CAST(items.qty AS DECIMAL(10,2))), 0) AS quantity,
      COALESCE(SUM(items.price), 0) AS amount,
      -- COGS: Use wholesalePrice if exists (wholesale customer), otherwise use price (regular customer)
      COALESCE(SUM(COALESCE(items.wholesalePrice, items.price)), 0) AS costOfGoodsSold
    FROM items
    INNER JOIN orders ON orders.id = items.orderId
    LEFT JOIN products ON products.id = items.productId
    LEFT JOIN categories ON categories.id = products.categoryId
    WHERE orders.on >= :startDate
      AND orders.on <= :endDate
      AND items.deleted = 0
      AND items.type = 'product'
      AND products.id IS NOT NULL
    GROUP BY categories.id, categories.name, products.id, products.name
    
    UNION ALL
    
    SELECT 
      categories.id AS categoryId,
      categories.name AS categoryName,
      products.id AS productId,
      COALESCE(partnerOrderItems.productName, products.name) AS productName,
      COALESCE(SUM(CAST(partnerOrderItems.qty AS DECIMAL(10,2))), 0) AS quantity,
      COALESCE(SUM(partnerOrderItems.price), 0) AS amount,
      -- partnerOrderItems.price is already total wholesale cost (can vary per partner), so we just SUM it
      COALESCE(SUM(partnerOrderItems.price), 0) AS costOfGoodsSold
    FROM partnerOrderItems
    INNER JOIN partnerOrders ON partnerOrders.id = partnerOrderItems.partnerOrderId
    LEFT JOIN products ON products.id = partnerOrderItems.productId
    LEFT JOIN categories ON categories.id = products.categoryId
    WHERE partnerOrders.on >= :startDate
      AND partnerOrders.on <= :endDate
      AND partnerOrderItems.deleted = 0
      AND partnerOrderItems.type = 'product'
      AND products.id IS NOT NULL
    GROUP BY categories.id, categories.name, products.id, partnerOrderItems.productName, products.name
  `;

  // Final query to aggregate the unioned results
  const finalQuery = `
    SELECT 
      categoryId,
      categoryName,
      productId,
      productName,
      SUM(quantity) AS quantity,
      SUM(amount) AS amount,
      SUM(costOfGoodsSold) AS costOfGoodsSold
    FROM (
      SELECT 
        categories.id AS categoryId,
        categories.name COLLATE utf8mb4_unicode_ci AS categoryName,
        products.id AS productId,
        products.name COLLATE utf8mb4_unicode_ci AS productName,
        COALESCE(SUM(CAST(items.qty AS DECIMAL(10,2))), 0) AS quantity,
        COALESCE(SUM(items.price), 0) AS amount,
        -- COGS: Use wholesalePrice if exists (wholesale customer), otherwise use price (regular customer)
        -- Both are already totals (qty * unit price), so we just SUM them
        COALESCE(SUM(COALESCE(items.wholesalePrice, items.price)), 0) AS costOfGoodsSold
      FROM items
      INNER JOIN orders ON orders.id = items.orderId
      LEFT JOIN products ON products.id = items.productId
      LEFT JOIN categories ON categories.id = products.categoryId
      WHERE orders.on >= :startDate
        AND orders.on <= :endDate
        AND orders.statusId != 6
        ${orderSalesRepFilter}
        ${orderEmployeeIdFilter}
        AND items.deleted = 0
        AND items.type = 'product'
        ${productIdFilter}
        AND products.id IS NOT NULL
      GROUP BY categories.id, categories.name, products.id, products.name
      
      UNION ALL
      
      SELECT 
        categories.id AS categoryId,
        categories.name COLLATE utf8mb4_unicode_ci AS categoryName,
        products.id AS productId,
        COALESCE(partnerOrderItems.productName, products.name) COLLATE utf8mb4_unicode_ci AS productName,
        COALESCE(SUM(CAST(partnerOrderItems.qty AS DECIMAL(10,2))), 0) AS quantity,
        COALESCE(SUM(partnerOrderItems.price), 0) AS amount,
        -- partnerOrderItems.price is already total wholesale cost (can vary per partner), so we just SUM it
        COALESCE(SUM(partnerOrderItems.price), 0) AS costOfGoodsSold
      FROM partnerOrderItems
      INNER JOIN partnerOrders ON partnerOrders.id = partnerOrderItems.partnerOrderId
      LEFT JOIN products ON products.id = partnerOrderItems.productId
      LEFT JOIN categories ON categories.id = products.categoryId
      WHERE partnerOrders.on >= :startDate
        AND partnerOrders.on <= :endDate
        AND partnerOrders.statusId != 6
        ${partnerOrderSalesRepFilter}
        ${partnerOrderEmployeeIdFilter}
        AND partnerOrderItems.deleted = 0
        AND partnerOrderItems.type = 'product'
        ${partnerProductIdFilter}
        AND products.id IS NOT NULL
      GROUP BY categories.id, categories.name, products.id, partnerOrderItems.productName, products.name
    ) AS combined
    GROUP BY categoryId, categoryName, productId, productName
    ORDER BY categoryId, productId
  `;

  const rawData = await order.sequelize.query(finalQuery, {
    replacements: replacements,
    type: order.sequelize.QueryTypes.SELECT,
  });

  // Transform the data into the required structure
  const categoryMap = {};

  rawData.forEach((row) => {
    const categoryId = row.categoryId;
    const categoryName = row.categoryName;

    if (!categoryMap[categoryId]) {
      categoryMap[categoryId] = {
        categoryId: categoryId,
        categoryName: categoryName,
        items: [],
      };
    }

    categoryMap[categoryId].items.push({
      id: row.productId,
      productId: row.productId,
      productName: row.productName,
      quantity: parseFloat(row.quantity) || 0,
      amount: parseFloat(row.amount) || 0,
      costOfGoodsSold: parseFloat(row.costOfGoodsSold) || 0,
    });
  });

  const result = Object.values(categoryMap);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

exports.pulledOrdersReceivableReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, salesRepId } = req.query;
  const page = Math.max(parseInt(req.query.page || 1, 10), 1);
  const limit = Math.max(parseInt(req.query.limit || 20, 10), 1);
  const offset = (page - 1) * limit;

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400,
      ),
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build optional salesRep filter
  let salesRepFilter = "";
  const replacements = {
    startDate,
    endDate,
    limit,
    offset,
  };

  if (salesRepId !== undefined && salesRepId !== null && salesRepId !== "") {
    const parsedSalesRepId = parseInt(salesRepId, 10);
    if (isNaN(parsedSalesRepId) || parsedSalesRepId <= 0) {
      return next(new AppError("Invalid salesRepId", 400));
    }
    salesRepFilter = "AND orders.salesRepId = :salesRepId";
    replacements.salesRepId = parsedSalesRepId;
  }

  const baseWhere = `
    orders.on >= :startDate
    AND orders.on <= :endDate
    AND orders.deleted = 0
    AND orders.adminReceivableStatus = true
    AND orders.salesRepId IS NOT NULL 
    AND COALESCE(orders.adminReceivableAmount, 0) > 0
    AND COALESCE(NULLIF(orders.pulloutIntentId, ''), NULLIF(orders.paymentIntentId, '')) IS NOT NULL
    ${salesRepFilter}
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM orders
    WHERE ${baseWhere}
  `;

  const dataQuery = `
    SELECT
      orders.id,
      orders.invoiceNumber,
      orders.totalBill,
      orders.on,
      orders.salesRepId,
      (
        SELECT users.companyName
        FROM users
        WHERE users.id = orders.userId
        LIMIT 1
      ) AS companyName,
      (
        SELECT salesReps.srName
        FROM salesReps
        WHERE salesReps.id = orders.salesRepId
        LIMIT 1
      ) AS salesRepName,
      orders.adminReceivableStatus,
      orders.adminReceivableAmount,
      orders.localPatnerCommission,
      orders.pulloutIntentId,
      orders.paymentIntentId,
      COALESCE(NULLIF(orders.pulloutIntentId, ''), NULLIF(orders.paymentIntentId, '')) AS effectivePulloutIntentId,
      orders.pulloutDate,
      orders.paymentStatus
    FROM orders
    WHERE ${baseWhere}
    ORDER BY orders.on DESC, orders.id DESC
    LIMIT :limit OFFSET :offset
  `;

  const countRows = await order.sequelize.query(countQuery, {
    replacements,
    type: order.sequelize.QueryTypes.SELECT,
  });
  const total = parseInt(countRows?.[0]?.total || 0, 10);

  const rows = await order.sequelize.query(dataQuery, {
    replacements,
    type: order.sequelize.QueryTypes.SELECT,
  });

  res.status(200).json({
    status: "success",
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    data: rows,
  });
});

// NOTE: `pulloutIntentUnsyncedOrdersReport` moved to
// `controllers/admin/qboCustomFieldSyncController.js` so the read endpoint
// and its companion bulk-sync action live together.
