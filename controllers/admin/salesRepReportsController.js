const {
  supplier,
  order,
  salesRep,
  user,
  item,
  product,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { Op, literal, where, fn, col } = require("sequelize");
const APIFeatures = require("../../utils/apiFeatures");

exports.ordersPlacedReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, ...otherQueryParams } = req.query;

  // Validate date filters if provided
  if (startDate || endDate) {
    if (!startDate || !endDate) {
      return next(new AppError("Both startDate and endDate are required", 400));
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
  }

  // Build manual conditions based on query/params
  let condition = {};
  if (req.params.srId) condition.salesRepId = req.params.srId;
  condition.createdBy = "sales-rep";
  condition.statusId = {
    [Op.ne]: 6,
  };

  // Add date filter if provided
  // Note: 'on' field is DATEONLY, so we compare dates directly
  // For endDate, we want to include the entire day, so we can use lte with the date string
  if (startDate && endDate) {
    // Ensure dates are in YYYY-MM-DD format for DATEONLY comparison
    const startDateFormatted = startDate.split(" ")[0]; // Remove time if present
    const endDateFormatted = endDate.split(" ")[0]; // Remove time if present

    condition.on = {
      [Op.gte]: startDateFormatted,
      [Op.lte]: endDateFormatted,
    };
  }

  // Define searchable columns for orders
  const searchableFields = [
    "id",
    "invoiceNumber",
    "poNumber",
    "note",
    "paymentMethod",
    "shippingCompany",
  ];

  // Build API features (filter, search, sort, fields, pagination) - exclude date params
  const features = new APIFeatures(order, otherQueryParams)
    .filter()
    .search(searchableFields) // Add search functionality
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order etc.)
  const queryOptions = features.getQuery();

  // Add custom search for companyName (customerName) from related users table
  if (otherQueryParams.search && otherQueryParams.search.trim()) {
    const searchTerm = otherQueryParams.search.trim();
    // Escape search term to prevent SQL injection
    const escapedSearchTerm = order.sequelize.escape(`%${searchTerm}%`);
    const companyNameSearch = literal(
      `EXISTS (SELECT 1 FROM users WHERE users.id = order.userId AND users.companyName LIKE ${escapedSearchTerm})`
    );

    // Add companyName search to existing search conditions
    if (queryOptions.where && queryOptions.where[Op.and]) {
      // Find the Op.or search condition and add companyName search to it
      const andConditions = queryOptions.where[Op.and];
      const searchConditionIndex = andConditions.findIndex(
        (cond) => cond[Op.or]
      );

      if (searchConditionIndex !== -1) {
        // Add companyName search to existing Op.or condition
        andConditions[searchConditionIndex][Op.or].push(companyNameSearch);
      } else {
        // Add new Op.or condition with companyName search
        andConditions.push({
          [Op.or]: [companyNameSearch],
        });
      }
    } else if (queryOptions.where && queryOptions.where[Op.or]) {
      // If Op.or exists at root level, add companyName search to it
      queryOptions.where[Op.or].push(companyNameSearch);
    } else if (queryOptions.where) {
      // Create Op.and structure with existing where and companyName search
      queryOptions.where = {
        [Op.and]: [
          queryOptions.where,
          {
            [Op.or]: [companyNameSearch],
          },
        ],
      };
    } else {
      // No existing where, just add companyName search
      queryOptions.where = {
        [Op.or]: [companyNameSearch],
      };
    }
  }

  // Merge manual filter conditions with existing where conditions
  // Handle both simple object merge and Op.and structure
  // Use Object.assign to properly preserve Symbol keys (Sequelize operators)
  // Check both string keys and Symbol keys (Object.keys doesn't include Symbol keys)
  const hasCondition =
    Object.keys(condition).length > 0 ||
    Object.getOwnPropertySymbols(condition).length > 0;
  if (hasCondition) {
    if (queryOptions.where && queryOptions.where[Op.and]) {
      // If where already has Op.and structure, find and merge with simple conditions
      const existingAndConditions = queryOptions.where[Op.and];
      let merged = false;

      // Try to merge with existing simple object conditions
      for (let i = 0; i < existingAndConditions.length; i++) {
        const cond = existingAndConditions[i];
        if (
          typeof cond === "object" &&
          cond !== null &&
          !cond[Op.or] &&
          !cond[Op.and] &&
          !(cond instanceof literal)
        ) {
          // Use Object.assign to properly merge Symbol keys
          // For nested objects with Symbol keys (like statusId[Op.ne]), merge them properly
          const mergedCond = Object.assign({}, cond);
          for (const key in condition) {
            if (condition.hasOwnProperty(key)) {
              // If both have this key and both are objects, merge them
              if (
                mergedCond[key] &&
                typeof mergedCond[key] === "object" &&
                typeof condition[key] === "object" &&
                !Array.isArray(mergedCond[key]) &&
                !Array.isArray(condition[key])
              ) {
                mergedCond[key] = Object.assign(
                  {},
                  mergedCond[key],
                  condition[key]
                );
                // Also copy Symbol keys from nested object (e.g., condition.on[Op.gte])
                const nestedSymbols = Object.getOwnPropertySymbols(
                  condition[key]
                );
                for (const sym of nestedSymbols) {
                  mergedCond[key][sym] = condition[key][sym];
                }
              } else {
                mergedCond[key] = condition[key];
              }
            }
          }
          // Also copy Symbol keys
          const conditionSymbols = Object.getOwnPropertySymbols(condition);
          for (const sym of conditionSymbols) {
            mergedCond[sym] = condition[sym];
          }
          existingAndConditions[i] = mergedCond;
          merged = true;
          break;
        }
      }

      if (!merged) {
        // Add as new condition if couldn't merge
        queryOptions.where[Op.and].push(condition);
      }
    } else if (queryOptions.where) {
      // If where exists but no Op.and, check if we can merge directly
      if (
        typeof queryOptions.where === "object" &&
        queryOptions.where !== null &&
        !queryOptions.where[Op.or] &&
        !queryOptions.where[Op.and]
      ) {
        // Use Object.assign to properly merge Symbol keys
        // For nested objects with Symbol keys, merge them properly
        const mergedWhere = Object.assign({}, queryOptions.where);
        for (const key in condition) {
          if (condition.hasOwnProperty(key)) {
            // If both have this key and both are objects, merge them
            if (
              mergedWhere[key] &&
              typeof mergedWhere[key] === "object" &&
              typeof condition[key] === "object" &&
              !Array.isArray(mergedWhere[key]) &&
              !Array.isArray(condition[key])
            ) {
              mergedWhere[key] = Object.assign(
                {},
                mergedWhere[key],
                condition[key]
              );
              // Also copy Symbol keys from nested object (e.g., condition.on[Op.gte])
              const nestedSymbols = Object.getOwnPropertySymbols(
                condition[key]
              );
              for (const sym of nestedSymbols) {
                mergedWhere[key][sym] = condition[key][sym];
              }
            } else {
              mergedWhere[key] = condition[key];
            }
          }
        }
        // Also copy Symbol keys
        const conditionSymbols = Object.getOwnPropertySymbols(condition);
        for (const sym of conditionSymbols) {
          mergedWhere[sym] = condition[sym];
        }
        queryOptions.where = mergedWhere;
      } else {
        // Create Op.and structure
        queryOptions.where = {
          [Op.and]: [queryOptions.where, condition],
        };
      }
    } else {
      // If no existing where, just use condition
      queryOptions.where = condition;
    }
  }

  queryOptions.attributes = [
    "id",
    "vat",
    "shippingCharges",
    "invoiceNumber",
    "totalBill",
    [
      literal(
        `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
      ),
      "customerName",
    ],
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`
      ),
      "orderCurrentStatus",
    ],
    [
      literal(
        `(SELECT createdAt FROM orderHistories WHERE orderHistories.orderId = order.id AND orderHistories.statusId = order.statusId LIMIT 1)`
      ),
      "assignedAt",
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      "totalQuantity",
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(price)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      "productsSellingPrice",
    ],
    [
      literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
      "productsWholesalePrice",
    ],
    [
      literal(`(
      SELECT GROUP_CONCAT(
        DISTINCT CASE 
          WHEN i.type = 'charges' THEN i.productName
          ELSE p.name
        END
        SEPARATOR ', '
      )
      FROM items i
      LEFT JOIN products p ON p.id = i.productId AND i.type = 'product'
      WHERE i.orderId = order.id
    )`),
      "productNames",
    ],
    ["on", "orderDate"],
    "note",
  ];

  // Set default ordering if not provided
  //   if (!queryOptions.order || queryOptions.order.length === 0) {
  //     queryOptions.order = [
  //       ["on", "DESC"],
  //       ["id", "DESC"],
  //     ];
  //   }

  // Calculate pagination manually to ensure date filter is included
  // We can't rely on getPaginationMetadata because it merges conditions and loses Symbol keys
  const page = otherQueryParams.page * 1 || 1;
  const limit = otherQueryParams.limit * 1 || 10000;
  const offset = (page - 1) * limit;

  // Ensure queryOptions has correct limit and offset
  queryOptions.limit = limit;
  queryOptions.offset = offset;

  // Debug: Log the where clause to verify date filter
  console.log(
    "🔍 Query where clause:",
    JSON.stringify(queryOptions.where, null, 2)
  );
  console.log("🔍 Pagination:", { page, limit, offset });
  if (condition.on) {
    console.log("🔍 Date condition:", {
      startDate: condition.on[Op.gte],
      endDate: condition.on[Op.lte],
    });
  }

  // Debug: Check orders without date filter to see if they exist
  const ordersWithoutDateFilter = await order.count({
    where: {
      deleted: 0,
      salesRepId: req.params.srId || condition.salesRepId,
      createdBy: "sales-rep",
      statusId: { [Op.ne]: 6 },
    },
  });
  console.log("🔍 Orders count WITHOUT date filter:", ordersWithoutDateFilter);

  // Debug: Check orders with just date filter
  if (startDate && endDate) {
    const startDateFormatted = startDate.split(" ")[0];
    const endDateFormatted = endDate.split(" ")[0];
    const ordersWithOnlyDate = await order.count({
      where: {
        deleted: 0,
        on: {
          [Op.gte]: startDateFormatted,
          [Op.lte]: endDateFormatted,
        },
      },
    });
    console.log("🔍 Orders count with ONLY date filter:", ordersWithOnlyDate);
  }

  // Count total items using the exact same where clause as the main query
  const totalItems = await order.count({
    where: queryOptions.where,
    distinct: true,
  });

  console.log("🔍 Total items count with ALL filters:", totalItems);

  const totalPages = Math.ceil(totalItems / limit);

  const pagination = {
    page,
    limit,
    totalItems,
    totalPages,
  };

  // Execute the query
  const doc = await order.findAll(queryOptions);

  console.log("🔍 Query returned documents:", doc.length);

  // Return response
  res.status(200).json({
    status: "success",
    results: doc.length,
    pagination: pagination,
    data: {
      data: doc,
    },
  });
});

exports.commissionSummaryReport = catchAsync(async (req, res, next) => {
  const year = parseInt(req.query?.year) || "2025";
  const srid = req.params.srId;
  console.log("🚀 ~ exports.commissionSummaryReport=catchAsync ~ srid:", srid);

  const report = await order.findAll({
    attributes: [
      [fn("MONTH", col("order.on")), "month"],
      [fn("YEAR", col("order.on")), "year"],
      [fn("COUNT", fn("DISTINCT", col("order.id"))), "orderCount"],
      [
        literal(`SUM(
        CASE 
          WHEN items.wholesalePrice > 0 THEN items.wholesalePrice
          ELSE 0
        END)`),
        "wholesaleTotal",
      ],
      [
        literal(`SUM(
        CASE 
          WHEN items.wholesalePrice > 0 THEN items.wholesalePrice
          ELSE items.price
        END)`),
        "totalSales",
      ],
      [
        literal(`SUM(
        CASE 
          WHEN items.wholesalePrice > 0 THEN (items.price - items.wholesalePrice)
          ELSE 0
        END)`),
        "commission",
      ],
      [
        literal(`ROUND(
        SUM(
          CASE 
            WHEN items.wholesalePrice > 0 THEN (items.price - items.wholesalePrice)
            ELSE 0
          END
        ) / COUNT(DISTINCT order.id), 2)`),
        "avgCommissionPerOrder",
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
    group: [fn("MONTH", col("order.createdAt"))],
    order: [[fn("MONTH", col("order.createdAt")), "ASC"]],
    raw: true,
  });

  res.status(200).json({
    status: "success",
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
      "id",
      "name",
      [
        fn(
          "FORMAT",
          literal(`
              (
                SELECT SUM(totalBill)
                FROM orders WHERE orders.userID = user.id
              )
            `),
          1
        ),
        "totatSpent",
      ],
      [
        literal(`(SELECT COUNT(*) FROM orders WHERE orders.userID = user.id)`),
        "numberOfOrders",
      ],
      [
        fn(
          "FORMAT",
          literal(`
              (
                SELECT SUM(totalBill) / NULLIF(COUNT(*), 0)
                FROM orders WHERE orders.userID = user.id
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
                ORDER BY orders.on DESC
                LIMIT 1
              )
            `),
        "lastOrderDate",
      ],
      [
        literal(
          `(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id AND orders.paymentStatus = 'pending')`
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

exports.partnerCreaditLimit = catchAsync(async (req, res, next) => {
  const doc = await salesRep.findOne({
    where: { id: req.params?.srId },
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
                  AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
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
