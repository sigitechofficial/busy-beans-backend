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
        400
      )
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
            `(SELECT SUM(orders.totalBill) FROM orders WHERE orders.salesRepId = salesRep.id  AND orders.statusId != 6 ${dateFilter})`
          ),
          2
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
          2
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
          2
        ),
        "totalCommission",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.statusId != 6 ${dateFilter})`
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
          1
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
        400
      )
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
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.adminReceivableStatus = false ${orderDateFilter})`
        ),
        "ordersOnCredit",
      ],
      [
        literal(
          `(SELECT SUM(partnerOrders.totalBill) FROM partnerOrders WHERE partnerOrders.salesRepId = salesRep.id AND partnerOrders.paymentStatus = 'pending' ${partnerOrderDateFilter})`
        ),
        "selfOrdersOutstandingBalance",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM partnerOrders WHERE partnerOrders.salesRepId = salesRep.id AND partnerOrders.paymentStatus = 'pending' ${partnerOrderDateFilter})`
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
        400
      )
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
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id ${orderDateFilter})`
        ),
        "clientOrdersCount",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM partnerOrders WHERE partnerOrders.salesRepId = salesRep.id ${partnerOrderDateFilter})`
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
        400
      )
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
          1
        ),
        "totatSpent",
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.userID = user.id ${dateFilter})`
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
          1
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
          `(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id AND orders.paymentStatus = 'pending' ${dateFilter})`
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
        400
      )
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
  const { startDate, endDate, salesRepId, userType } = req.query;
  const salesRepNe = req.query["salesRep[ne]"];

  console.log("🚀 ~ customerSalesSummary ~ req.query:", req.query);
  console.log("🚀 ~ customerSalesSummary ~ startDate:", startDate);
  console.log("🚀 ~ customerSalesSummary ~ endDate:", endDate);
  console.log("🚀 ~ customerSalesSummary ~ salesRepId:", salesRepId);
  console.log("🚀 ~ customerSalesSummary ~ userType:", userType);
  console.log("🚀 ~ customerSalesSummary ~ salesRepNe:", salesRepNe);

  if (!startDate || !endDate) {
    return next(new AppError("startDate and endDate are required", 400));
  }

  // Validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return next(
      new AppError(
        "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS",
        400
      )
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build salesRep filter condition
  let salesRepFilter = "";

  // Handle userType=admin (salesRepId IS NULL) - takes precedence
  if (userType === "admin") {
    salesRepFilter = "AND orders.salesRepId IS NULL";
    console.log("🚀 ~ customerSalesSummary ~ Applied userType=admin filter");
  }
  // Handle salesRep[ne]=null (salesRepId IS NOT NULL)
  else if (salesRepNe === "null" || salesRepNe === null) {
    salesRepFilter = "AND orders.salesRepId IS NOT NULL";
    console.log("🚀 ~ customerSalesSummary ~ Applied salesRep[ne]=null filter");
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
        salesRepIds
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
        salesRepId
      );
      console.log("🚀 ~ customerSalesSummary ~ salesRepId cleaned:", cleaned);
      console.log(
        "🚀 ~ customerSalesSummary ~ Parsed salesRepIds:",
        salesRepIds
      );
    } else if (typeof salesRepId === "number") {
      // Handle single number
      salesRepIds = [parseInt(salesRepId)];
      console.log(
        "🚀 ~ customerSalesSummary ~ salesRepId is Number:",
        salesRepIds
      );
    }

    if (salesRepIds.length > 0) {
      const placeholders = salesRepIds.map((id) => `${id}`).join(", ");
      salesRepFilter = `AND orders.salesRepId IN (${placeholders})`;
      console.log(
        "🚀 ~ customerSalesSummary ~ Applied salesRepId IN filter:",
        salesRepFilter
      );
    } else {
      console.log(
        "🚀 ~ customerSalesSummary ~ WARNING: salesRepIds array is empty after parsing!"
      );
    }
  }

  console.log(
    "🚀 ~ customerSalesSummary ~ Final salesRepFilter:",
    salesRepFilter
  );

  // Build date filter condition for SQL queries
  const dateFilter = `AND orders.on >= '${startDate}' AND orders.on <= '${endDate}' ${salesRepFilter}`;
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
    numberOfOrdersQuery
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
        400
      )
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build the SQL query using raw SQL
  // Returns both product items and shipping charges (items.type = 'charges')
  const query = `
    SELECT 
      items.id,
      items.qty AS quantity,
      items.price,
      CASE 
        WHEN items.type = 'product' THEN 'product'
        WHEN items.type = 'charges' THEN 'shipping'
        ELSE items.type
      END AS type,
      items.productId,
      CASE 
        WHEN items.type = 'product' THEN products.name
        WHEN items.type = 'charges' THEN 'Shipping'
        ELSE items.productName
      END AS productName,
      CASE 
        WHEN items.type = 'product' THEN 
          (SELECT categories.name FROM categories WHERE categories.id = products.categoryId LIMIT 1)
        WHEN items.type = 'charges' THEN 'Shipping'
        ELSE NULL
      END AS categoryName,
      CASE 
        WHEN items.type = 'product' THEN 
          (SELECT categories.name FROM categories WHERE categories.id = products.categoryId LIMIT 1)
        WHEN items.type = 'charges' THEN COALESCE(items.productName, 'Shipping Charges')
        ELSE NULL
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
      AND items.deleted = 0
      -- No type filter - includes both 'product' and 'charges' (shipping) items
    ORDER BY orders.on DESC, orders.invoiceNumber, items.id
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
  const { startDate, endDate, salesRepId, userType } = req.query;
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
        400
      )
    );
  }

  // Validate that dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return next(new AppError("Invalid date values", 400));
  }

  // Build salesRep filter conditions
  let orderSalesRepFilter = "";
  let partnerOrderSalesRepFilter = "";
  const replacements = { startDate, endDate };

  // Handle userType=admin (salesRepId IS NULL) - takes precedence
  if (userType === "admin") {
    orderSalesRepFilter = "AND orders.salesRepId IS NULL";
    partnerOrderSalesRepFilter = "AND partnerOrders.salesRepId IS NULL";
  }
  // Handle salesRep[ne]=null (salesRepId IS NOT NULL)
  else if (salesRepNe === "null" || salesRepNe === null) {
    orderSalesRepFilter = "AND orders.salesRepId IS NOT NULL";
    partnerOrderSalesRepFilter = "AND partnerOrders.salesRepId IS NOT NULL";
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
        ${orderSalesRepFilter}
        AND items.deleted = 0
        AND items.type = 'product'
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
        ${partnerOrderSalesRepFilter}
        AND partnerOrderItems.deleted = 0
        AND partnerOrderItems.type = 'product'
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
