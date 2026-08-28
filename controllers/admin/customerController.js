const {
  user,
  address,
  order,
  billingAddress,
  item,
  userDiscount,
  category,
  qboCustomerMap,
  salesRep,
  account,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { response } = require("../../utils/response");
const REDIS = require("../../utils/redisHandling");
const { Op, literal, fn, col, where } = require("sequelize");
const Stripe = require("../stripe");
const APIFeatures = require("../../utils/apiFeatures");
const Event = require("../events/userAccountRelatedEvents");

exports.customersList = catchAsync(async (req, res, next) => {
  // sr can come from :sr or :srId (e.g. .../sale-rep-id/not-assigned)
  const sr = (req.params?.sr ?? req.params?.srId ?? "").toLowerCase();

  // Build manual filter conditions (accept both "not-assign" and "not-assigned", etc.)
  const filters = { deleted: 0 };
  if (sr === "not-assign" || sr === "not-assigned")
    filters.salesRepId = { [Op.is]: null };
  else if (sr === "assign" || sr === "assigned")
    filters.salesRepId = { [Op.ne]: null };
  else if (sr === "assigned-employee") filters.employeeId = { [Op.ne]: null };
  else if (sr === "not-assigned-employee")
    filters.employeeId = { [Op.eq]: null };

  if (req.params?.empId) filters.employeeId = req.params?.empId;
  //   if (req.params?.condition) {
  //     if (req.user.localPartnerId) filters.salesRepId = req.user.localPartnerId;
  //     if (req.user.employeeId) filters.employeeId = req.user.employeeId;
  //     if (req.params?.condition == "qbo-registered") {
  //       filters.qboCustomerId = { [Op.ne]: null };
  //     } else if (req.params?.condition == "qbo-not-registered") {
  //       filters.qboCustomerId = null;
  //     }
  //   }

  if (req.user?.employeeOf == "Local Partner") {
    filters.salesRepId = req.user?.salesRepId;
  }

  // Define searchable columns for customers
  const searchableFields = [
    "id",
    "name",
    "email",
    "companyName",
    "phoneNumber",
    "saleTaxNumber",
    "emailToSendInvoices",
  ];

  // Only override salesRepId with srId when it's a numeric ID (not "not-assign" / "not-assigned" / "assign" / "assigned")
  const srIdRaw = req.params?.srId;
  const isSrFilterLiteral =
    srIdRaw === "not-assign" ||
    srIdRaw === "not-assigned" ||
    srIdRaw === "assign" ||
    srIdRaw === "assigned";
  if (srIdRaw != null && !isSrFilterLiteral) filters.salesRepId = srIdRaw;
  // If entity is admin employee or local partner employee, only customers assigned to this employee
  if (
    req.user?.entity === "adminEmployee" ||
    req.user?.entity === "partnerEmployee"
  ) {
    if (req.user?.entity === "partnerEmployee") {
      filters.salesRepId = req.user.localPartnerId;
    }
    filters.employeeId = req.user.id;

    if (req.query.cus == "all") {
      delete filters.employeeId;
      if (req.user?.entity === "partnerEmployee") {
      } else if (req.user?.entity === "adminEmployee") {
        filters.salesRepId = null;
      }
    }

    delete req.query.cus;
    // if (req.query.cus == "all") {

    // }
    console, console.log("🚀 ~ filters:", filters);
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[customersList] sr=%s filters=%j", sr || "(none)", filters);
  }

  const features = new APIFeatures(user, req.query)
    .filter()
    .search(searchableFields) // Add search functionality
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options
  const queryOptions = features.getQuery();

  // Merge manual filter conditions with existing where conditions
  // Handle both simple object merge and Op.and structure
  if (Object.keys(filters).length > 0) {
    if (queryOptions.where && queryOptions.where[Op.and]) {
      // If where already has Op.and structure, add filters to it
      queryOptions.where[Op.and].push(filters);
    } else if (queryOptions.where) {
      // If where exists but no Op.and, create Op.and structure
      queryOptions.where = {
        [Op.and]: [queryOptions.where, filters],
      };
    } else {
      // If no existing where, just use filters
      queryOptions.where = filters;
    }
  }

  // Add custom includes
  queryOptions.include = [{ model: address }];

  // Custom attributes with literal fields
  queryOptions.attributes = [
    [
      literal("(SELECT COUNT(id) FROM orders WHERE orders.userId = user.id)"),
      "totalOrderPlaced",
    ],
    [
      literal(
        "(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)",
      ),
      "totalOrderAmount",
    ],
    [
      literal(
        `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
      ),
      "salesRepName",
    ],
    [
      literal(
        `(SELECT salesReps.state FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
      ),
      "salesRepState",
    ],
    [
      literal(
        `(SELECT paymentMethod FROM orders WHERE user.id = orders.userId LIMIT 1)`,
      ),
      "preferredPaymentMethod",
    ],
    [
      literal(
        `(SELECT employees.name FROM employees WHERE user.employeeId = employees.id LIMIT 1)`,
      ),
      "employee",
    ],
    `id`,
    `name`,
    `email`,
    `status`,
    `image`,
    `phoneNumber`,
    `countryCode`,
    `saleTaxNumber`,
    `emailToSendInvoices`,
    `companyName`,
    `verifiedAt`,
  ];

  // Get pagination metadata using APIFeatures
  const pagination = await features.getPaginationMetadata(user, {
    include: queryOptions.include,
    where: filters, // Pass additional where conditions (will be merged with filter and search conditions)
  });

  // Execute the query
  console, console.log("🚀 ~ queryOptions.where:", queryOptions.where);
  console, console.log("🚀 ~ queryOptions.where:", queryOptions.where);
  console, console.log("🚀 ~ queryOptions.where:", queryOptions.where);
  console, console.log("🚀 ~ queryOptions.where:", queryOptions.where);

  const data = await user.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: "success",
    results: data.length,
    pagination: pagination,
    data: { data },
  });
});

exports.customersListByQboStatus = catchAsync(async (req, res, next) => {
  const filters = { deleted: 0 };
  const condition = req.params?.condition;
  // Delete any records in qboCustomerMap where qboCustomerId is null (cleanup)
  await qboCustomerMap.destroy({
    where: {
      qboCustomerId: null,
    },
  });

  // Validate condition
  if (condition !== "qbo-registered" && condition !== "qbo-not-registered") {
    return next(
      new AppError(
        "Invalid condition. Use 'qbo-registered' or 'qbo-not-registered'.",
        400,
      ),
    );
  }

  let realmId;
  let accountId = null;
  let salesRepId = null;

  // Determine if user is admin or local partner
  const isAdmin =
    req.user.entity === "admin" ||
    req.user.entity === "adminEmployee" ||
    req.user.entity === "subAdmin";
  const isLocalPartner =
    req.user.entity === "localPartner" || req.user.entity === "partnerEmployee";

  if (isLocalPartner && req.user.localPartnerId) {
    // Local Partner: Use salesRep's currentRealmId and filter by salesRepId
    salesRepId = req.user.localPartnerId;
    filters.salesRepId = salesRepId;

    const salesRepData = await salesRep.findOne({
      where: { id: salesRepId },
      attributes: ["currentRealmId"],
    });

    if (!salesRepData || !salesRepData.currentRealmId) {
      return res.status(200).json({
        status: "success",
        data: { data: [] },
      });
    }

    realmId = salesRepData.currentRealmId;
  } else if (isAdmin && req.user.adminId) {
    // Admin: Use account's currentRealmId (no salesRepId filter - show all customers)
    accountId = req.user.adminId;

    const accountData = await account.findOne({
      where: { id: accountId },
      attributes: ["currentRealmId"],
    });

    if (!accountData || !accountData.currentRealmId) {
      return res.status(200).json({
        status: "success",
        data: { data: [] },
      });
    }

    realmId = accountData.currentRealmId;
    // Admin can see all customers, so no salesRepId filter
  } else {
    return next(
      new AppError(
        "Access denied. Admin ID or Local Partner ID required.",
        403,
      ),
    );
  }

  // Get sequelize instance from user model for escaping
  const sequelize = user.sequelize;

  // Build subquery condition based on admin or local partner
  let qboMapCondition = "";
  if (isAdmin && accountId) {
    // Admin: check by accountId and realmId
    qboMapCondition = `qboCustomerMaps.accountId = ${accountId} AND qboCustomerMaps.realmId = ${sequelize.escape(realmId)}`;
  } else if (isLocalPartner && salesRepId) {
    // Local Partner: check by salesRepId and realmId
    qboMapCondition = `qboCustomerMaps.salesRepId = ${salesRepId} AND qboCustomerMaps.realmId = ${sequelize.escape(realmId)}`;
  }

  if (!qboMapCondition) {
    return next(
      new AppError(
        "Unable to build QBO map condition. Missing accountId or salesRepId.",
        400,
      ),
    );
  }

  // Build subquery using Sequelize's literal with proper escaping
  // Note: In Sequelize WHERE clauses, the main table is referenced as the model name
  const qboMapExistsSubquery = literal(
    `EXISTS (
      SELECT 1
      FROM qboCustomerMaps
      WHERE qboCustomerMaps.userId = user.id AND qboCustomerMaps.qboCustomerId IS NOT NULL
        AND ${qboMapCondition} 
    )`,
  );

  // Add condition based on qbo-registered or qbo-not-registered
  console.log("🔵 STEP 1: Setting QBO condition. condition param:", condition);
  if (condition === "qbo-registered") {
    filters[Op.and] = [qboMapExistsSubquery];
    console.log("🔵 STEP 1: Set filters[Op.and] = EXISTS subquery");
  } else {
    // qbo-not-registered: NOT EXISTS
    filters[Op.and] = [
      literal(
        `NOT EXISTS (
          SELECT 1
          FROM qboCustomerMaps
          WHERE qboCustomerMaps.userId = user.id
            AND ${qboMapCondition}
           
        )`,
      ),
    ];
    console.log("🔵 STEP 1: Set filters[Op.and] = NOT EXISTS subquery");
  }
  console.log("🔵 STEP 1: filters[Op.and] exists:", !!filters[Op.and]);
  console.log("🔵 STEP 1: filters[Op.and] length:", filters[Op.and]?.length);

  // If entity is adminEmployee or partnerEmployee, filter for only those created by this employee
  if (
    req.user?.entity === "adminEmployee" ||
    req.user?.entity === "partnerEmployee"
  ) {
    filters.employeeId = req.user.id;
    console.log("🔵 STEP 1: Added employeeId filter:", req.user.id);
  }

  // Define searchable columns for customers
  const searchableFields = [
    "id",
    "name",
    "email",
    "companyName",
    "phoneNumber",
    "saleTaxNumber",
    "emailToSendInvoices",
  ];

  // Build API features (filter, search, sort, fields, pagination)
  const features = new APIFeatures(user, req.query)
    .filter()
    .search(searchableFields) // Add search functionality
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options
  const queryOptions = features.getQuery();

  // Merge manual filter conditions with existing where conditions
  // Handle complex Op.and structure with literal subqueries
  // Extract non-Op.and properties from filters
  const filterProps = {};
  const filterOpAndArray = [];

  console.log("🔵 STEP 2: Before extracting filters. condition:", condition);
  console.log("🔵 STEP 2: filters object keys:", Object.keys(filters));
  console.log("🔵 STEP 2: filters[Op.and] exists:", !!filters[Op.and]);
  console.log("🔵 STEP 2: filters[Op.and] length:", filters[Op.and]?.length);

  // CRITICAL: Object.keys() doesn't return Symbol keys, so we need to check Op.and separately
  // First, extract Op.and if it exists (it's a Symbol key)
  if (filters[Op.and]) {
    filterOpAndArray.push(...filters[Op.and]);
    console.log(
      "🔵 STEP 2: Extracted Op.and array, filterOpAndArray length:",
      filterOpAndArray.length,
    );
  }

  // Then extract string keys (regular properties)
  Object.keys(filters).forEach((key) => {
    filterProps[key] = filters[key];
  });

  console.log(
    "🔵 STEP 2: filterOpAndArray length after extraction:",
    filterOpAndArray.length,
  );
  console.log("🔵 STEP 2: filterProps:", filterProps);
  console.log(
    "🔵 STEP 2: queryOptions.where before merge:",
    queryOptions.where ? "exists" : "null",
  );

  // Build final where clause
  if (queryOptions.where && queryOptions.where[Op.and]) {
    // queryOptions.where has Op.and structure (from search)
    console.log("🔵 STEP 2: Merging into existing Op.and structure");
    queryOptions.where[Op.and] = [
      ...queryOptions.where[Op.and],
      ...filterOpAndArray, // This includes the QBO subquery
      filterProps,
    ];
  } else if (queryOptions.where) {
    // queryOptions.where exists but no Op.and
    console.log("🔵 STEP 2: Creating new Op.and structure");
    const allConditions = [
      queryOptions.where,
      ...filterOpAndArray, // This includes the QBO subquery
      filterProps,
    ];
    queryOptions.where = {
      [Op.and]: allConditions,
    };
  } else {
    // No existing where, build from filters
    console.log("🔵 STEP 2: Building where from filters only");
    if (filterOpAndArray.length > 0) {
      queryOptions.where = {
        ...filterProps,
        [Op.and]: filterOpAndArray, // This includes the QBO subquery
      };
    } else {
      queryOptions.where = filterProps;
    }
  }

  console.log(
    "🔵 STEP 2: Final queryOptions.where structure:",
    queryOptions.where ? "exists" : "null",
  );
  console.log(
    "🔵 STEP 2: queryOptions.where[Op.and] length:",
    queryOptions.where?.[Op.and]?.length,
  );
  console.log("🔵 STEP 2: condition param:", condition);

  // CRITICAL: Get total count RIGHT HERE after QBO condition is merged, BEFORE pagination limit/offset
  // Use the final merged where clause that includes QBO condition + search + filters
  const countOptions = {
    where: queryOptions.where, // Includes QBO condition + search + all filters
    include: [{ model: address }],
    distinct: true,
  };

  console.log("🔵 STEP 3: About to count. condition:", condition);
  console.log(
    "🔵 STEP 3: countOptions.where[Op.and] length:",
    countOptions.where?.[Op.and]?.length,
  );

  const totalItems = await user.count(countOptions);

  console.log("🔵 STEP 3: COUNT RESULT - totalItems:", totalItems);
  console.log("🔵 STEP 3: COUNT RESULT - condition was:", condition);

  // Add custom includes
  queryOptions.include = [{ model: address }];

  // Custom attributes with literal fields
  queryOptions.attributes = [
    [
      literal("(SELECT COUNT(id) FROM orders WHERE orders.userId = user.id)"),
      "totalOrderPlaced",
    ],
    [
      literal(
        "(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)",
      ),
      "totalOrderAmount",
    ],
    [
      literal(
        `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
      ),
      "salesRepName",
    ],
    [
      literal(
        `(SELECT salesReps.state FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
      ),
      "salesRepState",
    ],
    [
      literal(
        `(SELECT paymentMethod FROM orders WHERE user.id = orders.userId LIMIT 1)`,
      ),
      "preferredPaymentMethod",
    ],
    [
      literal(
        `(SELECT employees.name FROM employees WHERE user.employeeId = employees.id LIMIT 1)`,
      ),
      "employee",
    ],
    `id`,
    `name`,
    `email`,
    `status`,
    `image`,
    `phoneNumber`,
    `countryCode`,
    `saleTaxNumber`,
    `emailToSendInvoices`,
    `companyName`,
  ];

  // Calculate pagination metadata using the totalItems already calculated (with QBO condition)
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalItems / limit);

  const pagination = {
    page,
    limit,
    totalItems, // Use the totalItems calculated right after QBO condition
    totalPages,
  };

  // Execute the query
  const data = await user.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: "success",
    results: data.length,
    pagination: pagination,
    data: { data },
  });
});

exports.InvoiceCustomers = catchAsync(async (req, res, next) => {
  const filters = { deleted: 0 };

  if (req.params?.srId) filters.salesRepId = req.params?.srId;

  if (
    req.user.entity == "adminEmployee" ||
    req.user.entity == "partnerEmployee"
  ) {
    filters.employeeId = req.user?.id;
    // if (filters.salesRepId) delete filters.salesRepId;
  }

  console.log("🚀 ~ filters:", filters);
  console.log("🚀 ~ filters:", filters);
  console.log("🚀 ~ filters:", filters);
  console.log("🚀 ~ filters:", filters);
  const data = await user.findAll({
    where: filters,
    attributes: [
      [
        literal(`
          (
            SELECT SUM(totalBill)
            FROM orders
            WHERE orders.userId = user.id
              AND orders.paymentStatus = 'pending'
              AND orders.statusId != 6
          )
        `),
        "totalBalance",
      ],
      [
        literal(`
          (
            SELECT COUNT(id)
            FROM orders
            WHERE orders.userId = user.id
              AND orders.paymentStatus = 'pending'
              AND orders.statusId != 6
          )
        `),
        "numberOfOrders",
      ],
      [
        literal(`
        (
          SELECT COUNT(id)
          FROM orders
          WHERE orders.userId = user.id
            AND orders.paymentStatus = 'pending'
            AND orders.statusId != 6
            AND orders.on <= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        )
      `),
        "overDueOrders",
      ],
      `id`,
      `name`,
      `email`,
      `image`,
      `phoneNumber`,
      `saleTaxNumber`,
      `emailToSendInvoices`,
      "companyName",
      "defaultDiscount",
    ],
  });

  res.status(200).json({
    status: "success",
    data: { data },
  });
});

exports.assignSalesRep = catchAsync(async (req, res, next) => {
  const id = req.params?.id == "remove" ? null : req.params?.id;

  await user.update({ salesRepId: id }, { where: { id: req.body?.id } });
  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.viewCustomersManagement = catchAsync(async (req, res, next) => {
  const today = new Date();

  // Subtract 30 days from the current date
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 30);

  const totalCustomer = await user.count({ where: { deleted: 0 } });
  const activeCustomer = await user.count({
    where: { deleted: 0, status: true },
  });
  const inactiveCustomer = await user.count({
    where: { deleted: 0, status: false },
  });
  const newCustomer = await user.count({
    where: {
      deleted: 0,
      verifiedAt: {
        [Op.gte]: last30Days, // Assuming `last30Days` is a valid Date object
      },
    },
  });

  res.status(200).json({
    status: "success",
    data: {
      data: {
        totalCustomer,
        activeCustomer,
        inactiveCustomer,
        newCustomer,
      },
    },
  });
});

exports.customerDetail = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;

  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition);

  const doc = await user.findOne({
    where: condition,
    attributes: [
      [
        literal("(SELECT COUNT(id) FROM orders WHERE orders.userId = user.id)"),
        "totalOrderPlaced",
      ],
      [
        literal(
          "(SELECT SUM(totalBill) FROM orders WHERE orders.userId = user.id)",
        ),
        "totalOrderAmount",
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
        ),
        "salesRepName",
      ],
      [
        literal(
          `(SELECT employees.name FROM employees WHERE user.employeeId = employees.id LIMIT 1)`,
        ),
        "employee",
      ],
      [
        literal(
          `(SELECT employeeOf FROM employees WHERE user.employeeId = employees.id LIMIT 1)`,
        ),
        "employeeOf",
      ],
      [
        literal(
          `(SELECT salesReps.state FROM salesReps WHERE user.salesRepId = salesReps.id LIMIT 1)`,
        ),
        "salesRepState",
      ],
      [
        literal(
          `(SELECT paymentMethod FROM orders WHERE user.id = orders.userId LIMIT 1)`,
        ),
        "preferredPaymentMethod",
      ],
      `id`,
      `name`,
      `email`,
      `status`,
      `image`,
      `phoneNumber`,
      `countryCode`,
      `saleTaxNumber`,
      `emailToSendInvoices`,
      `companyName`,
      "dispatchEmail",
      "salesRepId",
      "defaultDiscount",
      "employeeId",
    ],
    include: [
      {
        model: address,
        attributes: {
          exclude: ["createdAt", "updatedAt", "userId", "deleted", "deletedAt"],
        },
      },
      {
        model: billingAddress,
        attributes: {
          exclude: ["createdAt", "updatedAt", "userId", "deleted", "deletedAt"],
        },
      },
      {
        model: userDiscount,
        attributes: [
          "categoryId",
          "percentage",
          [
            literal(
              `(SELECT categories.name FROM categories WHERE userDiscounts.categoryId= categories.id LIMIT 1)`,
            ),
            "categoryName",
          ],
        ],
      },
    ],
  });

  if (!doc) {
    return next(new AppError("Data not found!", 400));
  }
  res.status(200).json({
    status: "success",
    data: {
      customer: doc,
    },
  });
});

// exports.getAllProducts = factory.getAll(product);
// exports.getProduct = factory.getOne(product);
exports.updateCutomer = catchAsync(async (req, res, next) => {
  console.log("🚀 ~ req.body:", req.body);
  if (req.body?.info) {
    if (req.body.info?.status == false)
      REDIS.revokeAllTokensForUser(req.params.id);
    await user.update(req.body.info, {
      where: { id: req.params.id },
      individualHooks: true,
    });
  }

  if (req.body?.newAddressess) {
    await address.bulkCreate(req.body?.newAddressess);
  }

  if (req.body?.addresses) {
    await address.update(req.body.addresses, {
      where: { id: req.body?.addresses?.id },
    });
  }
  if (req.body?.billingAddress) {
    await billingAddress.update(req.body.billingAddress, {
      where: { userId: req.params.id },
    });
  }

  if (req.body?.userDiscount && req.body?.userDiscount.length > 0) {
    req.body?.userDiscount.forEach((obj) => {
      obj.userId = req.params.id;
    });
    await userDiscount.destroy({
      where: { deleted: 0, userId: req.params.id },
    });
    await userDiscount.bulkCreate(req.body?.userDiscount);
  }

  res.status(200).json({
    status: "success",
    data: {},
  });
});
// exports.deleteProduct = factory.deleteOne(product);

exports.deleteCustomer = catchAsync(async (req, res, next) => {
  const doc = await user.update(
    { deleted: 1 },
    {
      where: { id: req.params.id },
    },
  );

  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.fetchSavedCards = catchAsync(async (req, res, next) => {
  const userId = req.params.id;
  const customer = await user.findByPk(userId, {
    attributes: [
      "email",
      "stripeCustomerId",
      "stripeCustomerIdForPartner",
      "salesRepId",
    ],
    include: [
      {
        model: salesRep,
        as: "salesRep",
        required: false,
        attributes: ["partnerType", "connectAccountId"],
      },
    ],
  });

  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  const isDirectPartner =
    customer.salesRepId &&
    customer.salesRep?.partnerType === "direct-partner" &&
    customer.salesRep?.connectAccountId;

  // Direct partner: use customer on connected account
  if (isDirectPartner) {
    const partnerCustomerId = customer.stripeCustomerIdForPartner;
    if (
      partnerCustomerId === null ||
      partnerCustomerId === "" ||
      !partnerCustomerId
    ) {
      const output = response({ message: "All cards", data: { cards: [] } });
      return res.status(200).json(output);
    }

    const connectAccountId = customer.salesRep.connectAccountId;

    try {
      const allCards = await Stripe.cardsOnConnectedAccount(
        partnerCustomerId,
        connectAccountId,
      );
      const stripeCards = allCards.data.map((obj) => ({
        id: obj.id,
        name: obj.billing_details.name,
        brand: obj.card.brand,
        expMonth: obj.card.exp_month,
        expYear: obj.card.exp_year,
        last4: obj.card.last4,
        funding: obj.card.funding,
        stripeCustomerId: customer.stripeCustomerIdForPartner,
      }));
      const output = response({ data: { cards: stripeCards } });
      return res.status(200).json(output);
    } catch (error) {
      if (error.message && error.message.includes("No such customer")) {
        await user.update(
          { stripeCustomerIdForPartner: null },
          { where: { id: userId } },
        );
        const output = response({
          message: "All cards",
          data: { cards: [] },
        });
        return res.status(200).json(output);
      }
      throw error;
    }
  }

  // Platform (no direct partner): use main Stripe customer
  if (customer.stripeCustomerId === null || customer.stripeCustomerId === "") {
    const output = response({ message: "All cards", data: { cards: [] } });
    return res.status(200).json(output);
  }

  const customerId = customer.stripeCustomerId;

  try {
    const allCards = await Stripe.cards(customerId);
    const stripeCards = allCards.data.map((obj) => ({
      id: obj.id,
      name: obj.billing_details.name,
      brand: obj.card.brand,
      expMonth: obj.card.exp_month,
      expYear: obj.card.exp_year,
      last4: obj.card.last4,
      funding: obj.card.funding,
      stripeCustomerId: customer.stripeCustomerId,
    }));
    const output = response({ data: { cards: stripeCards } });
    return res.status(200).json(output);
  } catch (error) {
    if (error.message && error.message.includes("No such customer")) {
      await user.update({ stripeCustomerId: null }, { where: { id: userId } });
      const output = response({ message: "All cards", data: { cards: [] } });
      return res.status(200).json(output);
    }
    throw error;
  }
});

exports.dicounts = catchAsync(async (req, res, next) => {
  const data = await userDiscount.findAll({
    where: { userId: req.params?.id },
    attributes: [
      "id",
      "categoryId",
      "percentage",
      [
        literal(
          `(SELECT categories.name FROM categories WHERE userDiscount.categoryId= categories.id LIMIT 1)`,
        ),
        "categoryName",
      ],
    ],
  });

  return res.status(200).json({
    status: "success",
    data: data,
  });
});

exports.approveCustomer = catchAsync(async (req, res, next) => {
  const customer = await user.findOne({
    where: { id: req.params.id, deleted: 0 },
  });

  if (!customer) {
    return next(new AppError("Customer not found!", 404));
  }

  //   if (!customer.verifiedAt) {
  //     return next(
  //       new AppError("Customer must verify their email before approval.", 400),
  //     );
  //   }

  if (customer.approvedByAdmin) {
    return res.status(200).json(
      response({
        message: "Customer is already approved.",
        data: {
          id: customer.id,
          email: customer.email,
          approvedByAdmin: customer.approvedByAdmin,
        },
      }),
    );
  }
  const input = {};
  input.approvedByAdmin = new Date();
  input.verifiedAt = customer.verifiedAt || new Date();
  await customer.update(input);

  Event.userAccountApproveEvent({
    email: customer.email,
    name: customer.name,
  });

  return res.status(200).json(
    response({
      message: "Customer approved successfully. Approval email sent.",
      data: {
        id: customer.id,
        email: customer.email,
        approvedByAdmin: input.approvedByAdmin,
        verifiedAt: input.verifiedAt,
      },
    }),
  );
});
