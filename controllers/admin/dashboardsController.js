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
const AppError = require("../../utils/appError");
const { isHqOperator, hasFeatureScope } = require("../../utils/hqOperator");
const { invoiceExceptionWhere } = require("../../utils/invoiceExceptionFilter");
const {
  mergeOpsOnWhere,
  opsOrderOnSql,
} = require("../../utils/opsOrderDateFloor");

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
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`,
        ),
        "paymentPending",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`,
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
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`,
        ),
        "paymentPending",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`,
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
          `SUM(CASE WHEN paymentStatus = 'pending' AND statusId < 6 THEN 1 ELSE 0 END)`,
        ),
        "paymentPending",
      ],
      [
        literal(
          `SUM(CASE WHEN paymentStatus = 'done' AND statusId < 6 THEN 1 ELSE 0 END)`,
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

const SUPPLIER_NEW_SLA_HOURS = 24;
const SUPPLIER_ACK_SLA_HOURS = 48;
const FULFILLMENT_LIST_LIMIT = 10;

const limitFulfillmentLists = (needsAttention, readyToShip) => ({
  needsAttentionCount: needsAttention.length,
  readyToShipCount: readyToShip.length,
  needsAttention: needsAttention.slice(0, FULFILLMENT_LIST_LIMIT),
  readyToShip: readyToShip.slice(0, FULFILLMENT_LIST_LIMIT),
});

const supplierPartnerDetailPath = (statusId, id) => {
  const sid = Number(statusId);
  if (sid === 2) return `/supplier/partner/new-orders/${id}`;
  if (sid === 3) return `/supplier/partner/acknowledged-orders/${id}`;
  return `/supplier/partner/shipped-orders/${id}`;
};

const supplierAgeHours = (statusAt) => {
  if (!statusAt) return 0;
  const then = new Date(statusAt).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 36e5));
};

const mapSupplierDashboardRow = (row, ownerType) => {
  const id = row.id;
  const statusId = Number(row.statusId);
  const companyName =
    ownerType === "partner"
      ? row.salesRepName || row.companyName || ""
      : row.companyName || row.customerName || "";
  return {
    id,
    ownerType,
    type: ownerType === "partner" ? "Partner" : "Customer",
    companyName,
    itemCount: Number(row.itemCount) || 0,
    statusId,
    status: row.orderCurrentStatus || "",
    ageHours: supplierAgeHours(row.statusAt || row.createdAt),
    createdAt: row.createdAt,
    detailPath:
      ownerType === "partner"
        ? supplierPartnerDetailPath(statusId, id)
        : `/supplier/order-detail/${id}`,
  };
};

const supplierAttentionReason = (statusId) => {
  if (statusId === 2) return "New sitting too long";
  if (statusId === 3) return "Acknowledged not shipped";
  if (statusId === 4) return "Mid-ship hang";
  return "";
};

const hqCustomerDetailPath = (id) => `/orders/detail/${id}`;
const hqPartnerDetailPath = (id) => `/orders/partnerOrders/detail/${id}`;

const mapHqFulfillmentRow = (row, ownerType) => {
  const mapped = mapSupplierDashboardRow(row, ownerType);
  return {
    ...mapped,
    detailPath:
      ownerType === "partner"
        ? hqPartnerDetailPath(mapped.id)
        : hqCustomerDetailPath(mapped.id),
  };
};

const hqFulfillmentCustomerAttributes = [
  "id",
  "statusId",
  "createdAt",
  [
    literal(
      `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
    ),
    "companyName",
  ],
  [
    literal(
      `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
    ),
    "customerName",
  ],
  [
    literal(
      `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
    ),
    "orderCurrentStatus",
  ],
  [
    literal(
      `COALESCE((SELECT SUM(qty) FROM items WHERE items.orderId = order.id), 0)`,
    ),
    "itemCount",
  ],
  [
    literal(
      `COALESCE(
          (SELECT createdAt FROM orderHistories
           WHERE orderHistories.orderId = order.id
             AND orderHistories.statusId = order.statusId
           LIMIT 1),
          order.createdAt
        )`,
    ),
    "statusAt",
  ],
];

const hqFulfillmentPartnerAttributes = [
  "id",
  "statusId",
  "createdAt",
  [
    literal(
      `(SELECT salesReps.srName FROM salesReps WHERE partnerOrder.salesRepId = salesReps.id LIMIT 1)`,
    ),
    "salesRepName",
  ],
  [
    literal(
      `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = partnerOrder.statusId LIMIT 1)`,
    ),
    "orderCurrentStatus",
  ],
  [
    literal(
      `COALESCE((SELECT SUM(qty) FROM partnerOrderItems WHERE partnerOrderItems.partnerOrderId = partnerOrder.id), 0)`,
    ),
    "itemCount",
  ],
  [
    literal(
      `COALESCE(
          (SELECT createdAt FROM orderHistories
           WHERE orderHistories.partnerOrderId = partnerOrder.id
             AND orderHistories.statusId = partnerOrder.statusId
           LIMIT 1),
          partnerOrder.createdAt
        )`,
    ),
    "statusAt",
  ],
];

const hqShippedLast7DaysSql = (tableName, historyFk, extraWhere) =>
  `SELECT COUNT(*) AS count
     FROM ${tableName}
     WHERE ${tableName}.statusId = 5
       ${extraWhere || ""}
       AND COALESCE(
         (SELECT createdAt FROM orderHistories
          WHERE orderHistories.${historyFk} = ${tableName}.id
            AND orderHistories.statusId = 5
          LIMIT 1),
         ${tableName}.updatedAt
       ) >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;

const emptyHqFulfillment = () => ({
  newCount: 0,
  acknowledgedCount: 0,
  shippedLast7Days: 0,
  needsAttentionCount: 0,
  readyToShipCount: 0,
  needsAttention: [],
  readyToShip: [],
});

const getHqInvoiceExceptionCounts = async (orderWhere) => {
  const [overdueShipped, shippedNotInvoiced] = await Promise.all([
    order.count({
      where: invoiceExceptionWhere("overdueShipped", "order", orderWhere),
    }),
    order.count({
      where: invoiceExceptionWhere("shippedNotInvoiced", "order", orderWhere),
    }),
  ]);

  return {
    overdueShipped: overdueShipped || 0,
    shippedNotInvoiced: shippedNotInvoiced || 0,
  };
};

const getHqFulfillmentPayload = async ({
  includeCustomerOrders,
  includePartnerOrders,
  customerWhere,
  partnerWhere,
  customerSqlFilter,
  partnerSqlFilter,
}) => {
  if (!includeCustomerOrders && !includePartnerOrders) {
    return emptyHqFulfillment();
  }

  customerWhere = mergeOpsOnWhere(customerWhere);
  partnerWhere = mergeOpsOnWhere(partnerWhere);
  customerSqlFilter = `${customerSqlFilter || ""} ${opsOrderOnSql("orders")}`;
  partnerSqlFilter = `${partnerSqlFilter || ""} ${opsOrderOnSql("partnerOrders")}`;

  const customerCountWhere = (statusId) =>
    includeCustomerOrders ? { ...customerWhere, statusId } : null;
  const partnerCountWhere = (statusId) =>
    includePartnerOrders ? { ...partnerWhere, statusId } : null;

  const [
    newCustomer,
    newPartner,
    acknowledgedCustomer,
    acknowledgedPartner,
    shippedCustomerRows,
    shippedPartnerRows,
    customerOpen,
    partnerOpen,
  ] = await Promise.all([
    includeCustomerOrders
      ? order.count({ where: customerCountWhere(2) })
      : 0,
    includePartnerOrders
      ? partnerOrder.count({ where: partnerCountWhere(2) })
      : 0,
    includeCustomerOrders
      ? order.count({ where: customerCountWhere(3) })
      : 0,
    includePartnerOrders
      ? partnerOrder.count({ where: partnerCountWhere(3) })
      : 0,
    includeCustomerOrders
      ? order.sequelize.query(
          hqShippedLast7DaysSql("orders", "orderId", customerSqlFilter),
          { type: order.sequelize.QueryTypes.SELECT },
        )
      : [{ count: 0 }],
    includePartnerOrders
      ? partnerOrder.sequelize.query(
          hqShippedLast7DaysSql(
            "partnerOrders",
            "partnerOrderId",
            partnerSqlFilter,
          ),
          { type: partnerOrder.sequelize.QueryTypes.SELECT },
        )
      : [{ count: 0 }],
    includeCustomerOrders
      ? order.findAll({
          where: { ...customerWhere, statusId: { [Op.in]: [2, 3, 4] } },
          attributes: hqFulfillmentCustomerAttributes,
          raw: true,
        })
      : [],
    includePartnerOrders
      ? partnerOrder.findAll({
          where: { ...partnerWhere, statusId: { [Op.in]: [2, 3, 4] } },
          attributes: hqFulfillmentPartnerAttributes,
          raw: true,
        })
      : [],
  ]);

  const openRows = [
    ...(customerOpen || []).map((row) => mapHqFulfillmentRow(row, "customer")),
    ...(partnerOpen || []).map((row) => mapHqFulfillmentRow(row, "partner")),
  ];

  const needsAttention = openRows
    .filter((row) => {
      if (row.statusId === 2) return row.ageHours > SUPPLIER_NEW_SLA_HOURS;
      if (row.statusId === 3) return row.ageHours > SUPPLIER_ACK_SLA_HOURS;
      return row.statusId === 4;
    })
    .sort((a, b) => b.ageHours - a.ageHours || Number(b.id) - Number(a.id))
    .map((row) => ({
      ...row,
      reason: supplierAttentionReason(row.statusId),
    }));

  const readyToShip = openRows
    .filter((row) => row.statusId === 3)
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return Number(b.id) - Number(a.id);
    });

  return {
    newCount: (newCustomer || 0) + (newPartner || 0),
    acknowledgedCount: (acknowledgedCustomer || 0) + (acknowledgedPartner || 0),
    shippedLast7Days:
      Number(shippedCustomerRows?.[0]?.count || 0) +
      Number(shippedPartnerRows?.[0]?.count || 0),
    ...limitFulfillmentLists(needsAttention, readyToShip),
  };
};

exports.supplierDashboard = catchAsync(async (req, res, next) => {
  const supplierId = Number(
    req.user?.entity === "supplier" ? req.user.id : req.params.id,
  );

  if (!supplierId) {
    return next(new AppError("Supplier id is required", 400));
  }

  const customerListAttributes = [
    "id",
    "statusId",
    "createdAt",
    [
      literal(
        `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
      ),
      "companyName",
    ],
    [
      literal(
        `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
      ),
      "customerName",
    ],
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
      ),
      "orderCurrentStatus",
    ],
    [
      literal(
        `COALESCE((SELECT SUM(qty) FROM items WHERE items.orderId = order.id), 0)`,
      ),
      "itemCount",
    ],
    [
      literal(
        `COALESCE(
          (SELECT createdAt FROM orderHistories
           WHERE orderHistories.orderId = order.id
             AND orderHistories.statusId = order.statusId
           LIMIT 1),
          order.createdAt
        )`,
      ),
      "statusAt",
    ],
  ];

  const partnerListAttributes = [
    "id",
    "statusId",
    "createdAt",
    [
      literal(
        `(SELECT salesReps.srName FROM salesReps WHERE partnerOrder.salesRepId = salesReps.id LIMIT 1)`,
      ),
      "salesRepName",
    ],
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = partnerOrder.statusId LIMIT 1)`,
      ),
      "orderCurrentStatus",
    ],
    [
      literal(
        `COALESCE((SELECT SUM(qty) FROM partnerOrderItems WHERE partnerOrderItems.partnerOrderId = partnerOrder.id), 0)`,
      ),
      "itemCount",
    ],
    [
      literal(
        `COALESCE(
          (SELECT createdAt FROM orderHistories
           WHERE orderHistories.partnerOrderId = partnerOrder.id
             AND orderHistories.statusId = partnerOrder.statusId
           LIMIT 1),
          partnerOrder.createdAt
        )`,
      ),
      "statusAt",
    ],
  ];

  const shippedLast7DaysSql = (tableName, historyFk) =>
    `SELECT COUNT(*) AS count
     FROM ${tableName}
     WHERE ${tableName}.supplierId = :supplierId
       AND ${tableName}.statusId = 5
       ${opsOrderOnSql(tableName)}
       AND COALESCE(
         (SELECT createdAt FROM orderHistories
          WHERE orderHistories.${historyFk} = ${tableName}.id
            AND orderHistories.statusId = 5
          LIMIT 1),
         ${tableName}.updatedAt
       ) >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;

  const [
    newCustomer,
    newPartner,
    acknowledgedCustomer,
    acknowledgedPartner,
    shippedCustomerRows,
    shippedPartnerRows,
    customerOpen,
    partnerOpen,
  ] = await Promise.all([
    order.count({ where: mergeOpsOnWhere({ supplierId, statusId: 2 }) }),
    partnerOrder.count({ where: mergeOpsOnWhere({ supplierId, statusId: 2 }) }),
    order.count({ where: mergeOpsOnWhere({ supplierId, statusId: 3 }) }),
    partnerOrder.count({ where: mergeOpsOnWhere({ supplierId, statusId: 3 }) }),
    order.sequelize.query(shippedLast7DaysSql("orders", "orderId"), {
      replacements: { supplierId },
      type: order.sequelize.QueryTypes.SELECT,
    }),
    partnerOrder.sequelize.query(
      shippedLast7DaysSql("partnerOrders", "partnerOrderId"),
      {
        replacements: { supplierId },
        type: partnerOrder.sequelize.QueryTypes.SELECT,
      },
    ),
    order.findAll({
      where: mergeOpsOnWhere({ supplierId, statusId: { [Op.in]: [2, 3, 4] } }),
      attributes: customerListAttributes,
      raw: true,
    }),
    partnerOrder.findAll({
      where: mergeOpsOnWhere({ supplierId, statusId: { [Op.in]: [2, 3, 4] } }),
      attributes: partnerListAttributes,
      raw: true,
    }),
  ]);

  const openRows = [
    ...(customerOpen || []).map((row) => mapSupplierDashboardRow(row, "customer")),
    ...(partnerOpen || []).map((row) => mapSupplierDashboardRow(row, "partner")),
  ];

  const needsAttention = openRows
    .filter((row) => {
      if (row.statusId === 2) return row.ageHours > SUPPLIER_NEW_SLA_HOURS;
      if (row.statusId === 3) return row.ageHours > SUPPLIER_ACK_SLA_HOURS;
      return row.statusId === 4;
    })
    .sort((a, b) => b.ageHours - a.ageHours || Number(b.id) - Number(a.id))
    .map((row) => ({
      ...row,
      reason: supplierAttentionReason(row.statusId),
    }));

  const readyToShip = openRows
    .filter((row) => row.statusId === 3)
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return Number(b.id) - Number(a.id);
    });

  res.status(200).json({
    status: "success",
    data: {
      newCount: (newCustomer || 0) + (newPartner || 0),
      acknowledgedCount: (acknowledgedCustomer || 0) + (acknowledgedPartner || 0),
      shippedLast7Days:
        Number(shippedCustomerRows?.[0]?.count || 0) +
        Number(shippedPartnerRows?.[0]?.count || 0),
      ...limitFulfillmentLists(needsAttention, readyToShip),
    },
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
           ${opsOrderOnSql("orders")}
           ${employeeId ? `AND users.employeeId = ${employeeId}` : ""})`,
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
             ${employeeFilterLiteral})`,
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
    Math.min(currentDay, new Date(currentYear, currentMonth, 0).getDate()),
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
  if (req.user?.entity === "supplier") {
    return next(
      new AppError("You do not have permission to access this resource", 403),
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // Month-to-Date: First day of current month to today
  const mtdStart = new Date(currentYear, currentMonth, 1);
  const mtdEnd = new Date(currentYear, currentMonth, currentDay);

  // Last Month MTD: First day of last month to the same day of last month (equivalent to current MTD)
  // Example: If today is Jan 19, then last month MTD is Dec 1 to Dec 19 (not Dec 1 to Dec 31)
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthEnd = new Date(
    currentYear,
    currentMonth - 1,
    Math.min(currentDay, new Date(currentYear, currentMonth, 0).getDate()),
  );

  // Format dates for SQL (YYYY-MM-DD) - Use query parameters if provided, otherwise use calculated dates
  // Query parameters: mtdStart, mtdEnd, lastMonthStart, lastMonthEnd
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
    req.user.entity,
  );

  // Build entity-based filters
  // IMPORTANT: Admin users see ALL data - no entity filtering applied
  // EXCEPTION: If req.query.salesRepId is provided, admin will see data for that local partner only
  let entityFilter = "";
  let salesRepIdFilter = "";
  let employeeIdFilter = "";

  const isAdmin = isHqOperator(req.user.entity);
  const isAdminEmployee = req.user.entity === "adminEmployee";
  const isLocalPartner =
    req.user.entity === "localPartner" || req.user.entity === "partnerEmployee";

  // Customer/admin-only sub-admins: omitted userType is Admin, not unfiltered HQ.
  // Partner-only sub-admins: omitted userType is Local Partner, not unfiltered HQ.
  // HQ admin and both-scope / legacy sub-admins stay unfiltered.
  if (
    req.user?.entity === "subAdmin" &&
    hasFeatureScope(req, "dashboard", "customer") &&
    !hasFeatureScope(req, "dashboard", "partner") &&
    !req.query.userType
  ) {
    req.query.userType = "admin";
  }
  if (
    req.user?.entity === "subAdmin" &&
    hasFeatureScope(req, "dashboard", "partner") &&
    !hasFeatureScope(req, "dashboard", "customer") &&
    !req.query.userType
  ) {
    req.query.userType = "salesRep";
  }

  // Validate: Only admin can use salesRepId query parameter to view specific local partner dashboard
  if (req.query.salesRepId && !isAdmin) {
    return next(
      new AppError(
        "Only admin users can view specific local partner dashboards",
        403,
      ),
    );
  }

  // Check if admin is requesting a specific local partner's dashboard
  const requestedSalesRepId = req.query.salesRepId
    ? parseInt(req.query.salesRepId)
    : null;
  const isAdminViewingLocalPartner = isAdmin && requestedSalesRepId;

  // Check if admin wants to see only direct admin orders (salesRepId IS NULL)
  // Uses req.query.userType === 'admin' to filter to admin-only orders
  const isAdminOnlyCondition = isAdmin && req.query.userType === "admin";

  // All local partners (userType=salesRep or salesRep[ne]=null, no specific id)
  const salesRepNeRaw = req.query["salesRep[ne]"];
  const isAllPartnersCondition =
    isAdmin &&
    !requestedSalesRepId &&
    (req.query.userType === "salesRep" ||
      salesRepNeRaw === "null" ||
      salesRepNeRaw === "");

  // Only apply filters if NOT admin (admin sees all data)
  // OR if admin is viewing a specific local partner's dashboard
  // OR if admin wants to see only direct admin orders (userType=admin)
  // OR if admin wants all partner-attributed orders (userType=salesRep)
  if (
    !isAdmin ||
    isAdminViewingLocalPartner ||
    isAdminOnlyCondition ||
    isAllPartnersCondition
  ) {
    // For local partners: filter by salesRepId
    if (isLocalPartner && req.user.localPartnerId) {
      const salesRepId = req.user.localPartnerId;
      salesRepIdFilter = `AND orders.salesRepId = ${salesRepId}`;
      console.log(
        "🚀 ~ getSalesDashboard ~ Applied salesRepId filter:",
        salesRepId,
      );
    }
    // For admin viewing a specific local partner's dashboard
    else if (isAdminViewingLocalPartner && requestedSalesRepId) {
      salesRepIdFilter = `AND orders.salesRepId = ${requestedSalesRepId}`;
      console.log(
        "🚀 ~ getSalesDashboard ~ Admin viewing local partner dashboard, salesRepId filter:",
        requestedSalesRepId,
      );
    }
    else if (isAllPartnersCondition) {
      salesRepIdFilter = `AND orders.salesRepId IS NOT NULL`;
      console.log(
        "🚀 ~ getSalesDashboard ~ All local partners (userType=salesRep): salesRepId IS NOT NULL",
      );
    }
    // For admin-only condition (userType=admin): show only direct admin orders (salesRepId IS NULL)
    else if (isAdminOnlyCondition) {
      salesRepIdFilter = `AND orders.salesRepId IS NULL`;
      console.log(
        "🚀 ~ getSalesDashboard ~ Admin-only (userType=admin): showing only direct admin orders (salesRepId IS NULL)",
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
        employeeId,
      );
    }

    // Combine filters
    entityFilter = `${salesRepIdFilter} ${employeeIdFilter}`.trim();
    if (entityFilter) {
      entityFilter = entityFilter.startsWith("AND")
        ? entityFilter
        : `AND ${entityFilter}`;
    }
  } else {
    console.log(
      "🚀 ~ getSalesDashboard ~ Admin user - No entity filters applied",
    );
  }

  // HQ/partner fulfillment: same userType / salesRepId / entity split as sales.
  // Admin-only = customer/admin orders. Partner filter = partnerOrders.
  // Unfiltered HQ = merge both. Local partner = their customer + partner orders.
  const includeCustomerOrders =
    isLocalPartner ||
    (!isAllPartnersCondition && !isAdminViewingLocalPartner);
  const includePartnerOrders = !isAdminOnlyCondition;

  const customerWhere = {};
  let customerSqlFilter = "";
  if (isLocalPartner && req.user.localPartnerId) {
    customerWhere.salesRepId = req.user.localPartnerId;
    customerSqlFilter = `AND orders.salesRepId = ${req.user.localPartnerId}`;
  } else if (isAdminViewingLocalPartner && requestedSalesRepId) {
    customerWhere.salesRepId = requestedSalesRepId;
    customerSqlFilter = `AND orders.salesRepId = ${requestedSalesRepId}`;
  } else if (isAdminOnlyCondition) {
    customerWhere.salesRepId = null;
    customerSqlFilter = "AND orders.salesRepId IS NULL";
  }
  if (
    req.user.entity === "adminEmployee" ||
    req.user.entity === "partnerEmployee"
  ) {
    const employeeId = req.user.employeeId || req.user.id;
    customerWhere.userId = {
      [Op.in]: literal(
        `(SELECT id FROM users WHERE users.employeeId = ${employeeId})`,
      ),
    };
    customerSqlFilter += ` AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
  }

  const partnerWhere = {};
  let partnerSqlFilter = "";
  if (isLocalPartner && req.user.localPartnerId) {
    partnerWhere.salesRepId = req.user.localPartnerId;
    partnerSqlFilter = `AND partnerOrders.salesRepId = ${req.user.localPartnerId}`;
  } else if (isAdminViewingLocalPartner && requestedSalesRepId) {
    partnerWhere.salesRepId = requestedSalesRepId;
    partnerSqlFilter = `AND partnerOrders.salesRepId = ${requestedSalesRepId}`;
  }

  const invoiceOrderWhere = mergeOpsOnWhere({
    ...customerWhere,
    ...(isAllPartnersCondition ? { salesRepId: { [Op.ne]: null } } : {}),
  });

  const [fulfillment, invoiceExceptions] = await Promise.all([
    getHqFulfillmentPayload({
      includeCustomerOrders,
      includePartnerOrders,
      customerWhere,
      partnerWhere,
      customerSqlFilter,
      partnerSqlFilter,
    }),
    getHqInvoiceExceptionCounts(invoiceOrderWhere),
  ]);

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
      WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}' 
        AND orders.statusId != 6 ${entityFilter}`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
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
      WHERE orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}' 
        AND orders.statusId != 6 ${entityFilter}`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );
  const lastMonthSalesSummary = lastMonthSalesSummaryResult?.[0] || {
    totalSales: 0,
    orders: 0,
    avgOrderValue: 0,
  };

  // Calculate percentage change vs last month (MTD)
  const mtdTotalSales = parseFloat(mtdSalesSummary?.totalSales || 0);
  const lastMonthTotalSales = parseFloat(
    lastMonthSalesSummary?.totalSales || 0,
  );
  const lastMonthMTDStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthMTDEnd = new Date(
    currentYear,
    currentMonth - 1,
    Math.min(currentDay, new Date(currentYear, currentMonth, 0).getDate()),
  );
  const lastMonthMTDStartStr = lastMonthMTDStart.toISOString().split("T")[0];
  const lastMonthMTDEndStr = lastMonthMTDEnd.toISOString().split("T")[0];

  const lastMonthMTDDateFilter = `AND orders.on >= '${lastMonthMTDStartStr}' AND orders.on <= '${lastMonthMTDEndStr}'`;
  const lastMonthMTDSales = await order.sequelize.query(
    `SELECT SUM(totalBill) as totalSales
      FROM orders
      WHERE orders.on >= '${lastMonthMTDStartStr}' AND orders.on <= '${lastMonthMTDEndStr}' 
        AND orders.statusId != 6 ${entityFilter}`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );

  const lastMonthMTDTotalSales = parseFloat(lastMonthMTDSales?.totalSales || 0);
  const vsLastMonthPercent =
    lastMonthMTDTotalSales > 0
      ? ((mtdTotalSales - lastMonthMTDTotalSales) / lastMonthMTDTotalSales) *
        100
      : 0;

  // MTD Sales by Franchisee - Only orders with salesRepId (franchisee orders)
  // Build entity filter for franchisee query
  // IMPORTANT: Admin users see ALL franchisee data - no filtering
  // EXCEPTION: If req.query.salesRepId is provided, admin will see data for that local partner only
  // EXCEPTION: If admin-only condition (userType=admin), franchisee data will be empty (query has salesRepId IS NOT NULL,
  //            but filter adds salesRepId IS NULL, resulting in no matches - which is correct)
  let franchiseeEntityFilter = "";
  if (!isAdmin || isAdminViewingLocalPartner || isAdminOnlyCondition) {
    if (isLocalPartner && req.user.localPartnerId) {
      franchiseeEntityFilter = `AND orders.salesRepId = ${req.user.localPartnerId}`;
    }
    // For admin viewing a specific local partner's dashboard
    else if (isAdminViewingLocalPartner && requestedSalesRepId) {
      franchiseeEntityFilter = `AND orders.salesRepId = ${requestedSalesRepId}`;
    }
    // For admin-only condition (userType=admin): exclude franchisee orders (only showing salesRepId IS NULL)
    else if (isAdminOnlyCondition) {
      franchiseeEntityFilter = `AND orders.salesRepId IS NULL`;
    }
    if (
      req.user.entity === "adminEmployee" ||
      req.user.entity === "partnerEmployee"
    ) {
      const employeeId = req.user.employeeId || req.user.id;
      franchiseeEntityFilter += ` AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
    }
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
      AND orders.statusId != 6
      ${franchiseeEntityFilter}
    GROUP BY orders.salesRepId, salesReps.srName, salesReps.territoryName
    ORDER BY totalSales DESC
    LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );

  // YTD Sales by Franchisee - Only orders with salesRepId (franchisee orders)
  const ytdStart = new Date(currentYear, 0, 1);
  const ytdEnd = new Date(currentYear, currentMonth, currentDay);
  const ytdStartStr = ytdStart.toISOString().split("T")[0];
  const ytdEndStr = mtdEndStr || ytdEnd.toISOString().split("T")[0];

  // Reuse the same entity filter logic for YTD
  // IMPORTANT: Admin users see ALL franchisee data - no filtering
  // EXCEPTION: If req.query.salesRepId is provided, admin will see data for that local partner only
  // EXCEPTION: If admin-only condition (userType=admin), franchisee data should be empty (only showing salesRepId IS NULL orders)
  let ytdFranchiseeEntityFilter = "";
  if (!isAdmin || isAdminViewingLocalPartner || isAdminOnlyCondition) {
    if (isLocalPartner && req.user.localPartnerId) {
      ytdFranchiseeEntityFilter = `AND orders.salesRepId = ${req.user.localPartnerId}`;
    }
    // For admin viewing a specific local partner's dashboard
    else if (isAdminViewingLocalPartner && requestedSalesRepId) {
      ytdFranchiseeEntityFilter = `AND orders.salesRepId = ${requestedSalesRepId}`;
    }
    // For admin-only condition (userType=admin): exclude franchisee orders (only showing salesRepId IS NULL)
    else if (isAdminOnlyCondition) {
      ytdFranchiseeEntityFilter = `AND orders.salesRepId IS NULL`;
    }
    if (
      req.user.entity === "adminEmployee" ||
      req.user.entity === "partnerEmployee"
    ) {
      const employeeId = req.user.employeeId || req.user.id;
      ytdFranchiseeEntityFilter += ` AND orders.userId IN (SELECT id FROM users WHERE users.employeeId = ${employeeId})`;
    }
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
      AND orders.statusId != 6
      ${ytdFranchiseeEntityFilter}
    GROUP BY orders.salesRepId, salesReps.srName, salesReps.territoryName
    ORDER BY totalSales DESC
    LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );

  // MTD Sales by Customer (Top 5) - Using same approach as customerSalesSummary report
  const mtdSalesByCustomer = await order.sequelize.query(
    `SELECT 
        orders.userId,
        COALESCE(users.companyName, users.name) as customerName,
        SUM(orders.totalBill) as totalSales
      FROM orders
      INNER JOIN users ON users.id = orders.userId
      WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}' 
        AND orders.statusId != 6 ${entityFilter}
      GROUP BY orders.userId
      ORDER BY totalSales DESC
      LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );

  // Last Month Sales by Customer (Top 5) - Using same approach as customerSalesSummary report
  const lastMonthSalesByCustomer = await order.sequelize.query(
    `SELECT 
        orders.userId,
        COALESCE(users.companyName, users.name) as customerName,
        SUM(orders.totalBill) as totalSales
      FROM orders
      INNER JOIN users ON users.id = orders.userId
      WHERE orders.on >= '${lastMonthStartStr}' AND orders.on <= '${lastMonthEndStr}' 
        AND orders.statusId != 6 ${entityFilter}
      GROUP BY orders.userId
      ORDER BY totalSales DESC
      LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );

  // MTD Products (Top 5) - Products sold month-to-date
  // Combine data from items (customer orders) and partnerOrderItems (partner orders)
  // Build entity filter for partner orders
  // IMPORTANT: Admin users see ALL data - no filtering
  // EXCEPTION: If req.query.salesRepId is provided, admin will see data for that local partner only
  // EXCEPTION: If admin-only condition (userType=admin), exclude partner orders (only showing admin direct orders)
  let mtdPartnerOrderEntityFilter = "";
  if (!isAdmin || isAdminViewingLocalPartner) {
    if (isLocalPartner && req.user.localPartnerId) {
      mtdPartnerOrderEntityFilter = `AND partnerOrders.salesRepId = ${req.user.localPartnerId}`;
    }
    // For admin viewing a specific local partner's dashboard
    else if (isAdminViewingLocalPartner && requestedSalesRepId) {
      mtdPartnerOrderEntityFilter = `AND partnerOrders.salesRepId = ${requestedSalesRepId}`;
    }
  }
  // Note: For admin-only condition (userType=admin), partner orders are excluded (mtdPartnerOrderEntityFilter remains empty)
  // This means the UNION ALL will include partner orders, but they'll be filtered out by the WHERE clause
  // Actually, we should exclude partner orders entirely in the UNION when admin-only condition (userType=admin) is active
  // Note: partnerOrders don't have employeeId filtering like customer orders

  const mtdProductsEntityFilter = entityFilter || "";
  console.log(
    "🚀 ~ MTD Products Query Date Range:",
    mtdStartStr,
    "to",
    mtdEndStr,
  );
  console.log("🚀 ~ MTD Products Entity Filter:", mtdProductsEntityFilter);
  console.log(
    "🚀 ~ MTD Partner Order Entity Filter:",
    mtdPartnerOrderEntityFilter,
  );

  // For admin-only condition (userType=admin), exclude partner orders (only show admin direct orders)
  const partnerOrdersUnion = isAdminOnlyCondition
    ? ""
    : `
        UNION ALL
        
        SELECT 
          partnerOrderItems.productId,
          COALESCE(products.name, partnerOrderItems.productName, 'Unknown Product') as productName,
          partnerOrderItems.qty,
          partnerOrderItems.price
        FROM partnerOrderItems
        INNER JOIN partnerOrders ON partnerOrders.id = partnerOrderItems.partnerOrderId
        LEFT JOIN products ON products.id = partnerOrderItems.productId
        WHERE partnerOrders.on >= '${mtdStartStr}' AND partnerOrders.on <= '${mtdEndStr}'
          AND partnerOrders.statusId != 6
          AND partnerOrderItems.deleted = 0
          AND partnerOrderItems.type = 'product'
          ${mtdPartnerOrderEntityFilter}`;

  const mtdSalesByProduct = await order.sequelize.query(
    `SELECT 
        productId,
        MAX(productName) as productName,
        SUM(qty) as totalQuantity,
        SUM(price) as totalSales
      FROM (
        SELECT 
          items.productId,
          COALESCE(products.name, items.productName, 'Unknown Product') as productName,
          items.qty,
          items.price
        FROM items
        INNER JOIN orders ON orders.id = items.orderId
        LEFT JOIN products ON products.id = items.productId
        WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'
          AND orders.statusId != 6
          AND items.deleted = 0
          AND items.type = 'product'
          ${mtdProductsEntityFilter}
        ${partnerOrdersUnion}
      ) AS combined_products
      GROUP BY productId
      ORDER BY totalSales DESC
      LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );

  console.log("🚀 ~ MTD Products Result Count:", mtdSalesByProduct.length);
  if (mtdSalesByProduct.length > 0) {
    console.log(
      "🚀 ~ MTD Products Sample:",
      JSON.stringify(mtdSalesByProduct[0], null, 2),
    );
  }

  // YTD Products (Top 5) - Products sold year-to-date
  // Combine data from items (customer orders) and partnerOrderItems (partner orders)
  // Build entity filter for partner orders
  // IMPORTANT: Admin users see ALL data - no filtering
  // EXCEPTION: If req.query.salesRepId is provided, admin will see data for that local partner only
  // EXCEPTION: If admin-only condition (userType=admin), exclude partner orders (only showing admin direct orders)
  let ytdPartnerOrderEntityFilter = "";
  if (!isAdmin || isAdminViewingLocalPartner) {
    if (isLocalPartner && req.user.localPartnerId) {
      ytdPartnerOrderEntityFilter = `AND partnerOrders.salesRepId = ${req.user.localPartnerId}`;
    }
    // For admin viewing a specific local partner's dashboard
    else if (isAdminViewingLocalPartner && requestedSalesRepId) {
      ytdPartnerOrderEntityFilter = `AND partnerOrders.salesRepId = ${requestedSalesRepId}`;
    }
  }
  // Note: For admin-only condition (userType=admin), partner orders are excluded (ytdPartnerOrderEntityFilter remains empty)
  // Note: partnerOrders don't have employeeId filtering like customer orders

  const ytdProductsEntityFilter = entityFilter || "";

  // For admin-only condition (userType=admin), exclude partner orders (only show admin direct orders)
  const ytdPartnerOrdersUnion = isAdminOnlyCondition
    ? ""
    : `
        UNION ALL
        
        SELECT 
          partnerOrderItems.productId,
          COALESCE(products.name, partnerOrderItems.productName, 'Unknown Product') as productName,
          partnerOrderItems.qty,
          partnerOrderItems.price
        FROM partnerOrderItems
        INNER JOIN partnerOrders ON partnerOrders.id = partnerOrderItems.partnerOrderId
        LEFT JOIN products ON products.id = partnerOrderItems.productId
        WHERE partnerOrders.on >= '${ytdStartStr}' AND partnerOrders.on <= '${ytdEndStr}'
          AND partnerOrders.statusId != 6
          AND partnerOrderItems.deleted = 0
          AND partnerOrderItems.type = 'product'
          ${ytdPartnerOrderEntityFilter}`;

  const ytdSalesByProduct = await order.sequelize.query(
    `SELECT 
        productId,
        MAX(productName) as productName,
        SUM(qty) as totalQuantity,
        SUM(price) as totalSales
      FROM (
        SELECT 
          items.productId,
          COALESCE(products.name, items.productName, 'Unknown Product') as productName,
          items.qty,
          items.price
        FROM items
        INNER JOIN orders ON orders.id = items.orderId
        LEFT JOIN products ON products.id = items.productId
        WHERE orders.on >= '${ytdStartStr}' AND orders.on <= '${ytdEndStr}'
          AND orders.statusId != 6
          AND items.deleted = 0
          AND items.type = 'product'
          ${ytdProductsEntityFilter}
        ${ytdPartnerOrdersUnion}
      ) AS combined_products
      GROUP BY productId
      ORDER BY totalSales DESC
      LIMIT 5`,
    {
      type: order.sequelize.QueryTypes.SELECT,
    },
  );

  // MTD Sales by Employee (Top 5) - Only for admin users
  let mtdSalesByEmployee = [];
  let ytdSalesByEmployee = [];
  if (isHqOperator(req.user.entity)) {
    mtdSalesByEmployee = await order.sequelize.query(
      `SELECT 
          users.employeeId,
          COALESCE(employees.name, 'Unknown Employee') as employeeName,
          COALESCE(employees.email, '') as employeeEmail,
          COUNT(*) as totalOrders,
          SUM(orders.totalBill) as totalSales
        FROM orders
        INNER JOIN users ON users.id = orders.userId
        LEFT JOIN employees ON employees.id = users.employeeId
        WHERE orders.on >= '${mtdStartStr}' AND orders.on <= '${mtdEndStr}'
          AND orders.statusId != 6
          AND users.employeeId IS NOT NULL
        GROUP BY users.employeeId, employees.name, employees.email
        ORDER BY totalSales DESC
        LIMIT 5`,
      {
        type: order.sequelize.QueryTypes.SELECT,
      },
    );

    // YTD Sales by Employee (Top 5) - Only for admin users
    ytdSalesByEmployee = await order.sequelize.query(
      `SELECT 
          users.employeeId,
          COALESCE(employees.name, 'Unknown Employee') as employeeName,
          COALESCE(employees.email, '') as employeeEmail,
          COUNT(*) as totalOrders,
          SUM(orders.totalBill) as totalSales
        FROM orders
        INNER JOIN users ON users.id = orders.userId
        LEFT JOIN employees ON employees.id = users.employeeId
        WHERE orders.on >= '${ytdStartStr}' AND orders.on <= '${ytdEndStr}'
          AND orders.statusId != 6
          AND users.employeeId IS NOT NULL
        GROUP BY users.employeeId, employees.name, employees.email
        ORDER BY totalSales DESC
        LIMIT 5`,
      {
        type: order.sequelize.QueryTypes.SELECT,
      },
    );
  }

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
      // When admin views a local partner's dashboard (salesRepId provided), franchisee data will be filtered to that local partner
      ...((isHqOperator(req.user.entity) ||
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
      // Month-to-Date Products (Top 5)
      mtdSalesByProduct: mtdSalesByProduct.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        totalQuantity: parseFloat(product.totalQuantity || 0),
        totalSales: parseFloat(product.totalSales || 0),
      })),
      // Year-to-Date Products (Top 5)
      ytdSalesByProduct: ytdSalesByProduct.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        totalQuantity: parseFloat(product.totalQuantity || 0),
        totalSales: parseFloat(product.totalSales || 0),
      })),
      // Only include employee sales data for admin users
      // Exclude when admin is viewing a local partner's dashboard (salesRepId provided)
      ...(isHqOperator(req.user.entity) &&
        !isAdminViewingLocalPartner && {
          mtdSalesByEmployee: mtdSalesByEmployee.map((employee) => ({
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            employeeEmail: employee.employeeEmail,
            totalOrders: parseInt(employee.totalOrders || 0),
            totalSales: parseFloat(employee.totalSales || 0),
          })),
          ytdSalesByEmployee: ytdSalesByEmployee.map((employee) => ({
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            employeeEmail: employee.employeeEmail,
            totalOrders: parseInt(employee.totalOrders || 0),
            totalSales: parseFloat(employee.totalSales || 0),
          })),
        }),
      fulfillment,
      invoiceExceptions,
    },
  });
});
