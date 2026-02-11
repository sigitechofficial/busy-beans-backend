const { salesRepProductPrice, product, salesRep } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const APIFeatures = require("../../utils/apiFeatures");
const { Op, literal } = require("sequelize");

/**
 * Get All Sales Rep Product Prices (localPartner / partnerEmployee / admin / adminEmployee)
 * GET /api/v1/admin/sales-rep-product-price
 * Query params: productId, status, page, limit, sort, fields, salesRepId (required for admin/adminEmployee).
 * - Local partners/employees: salesRepId is forced to req.user.localPartnerId
 * - Admin/admin employees: salesRepId comes from req.query.salesRepId
 */
exports.getAllSalesRepProductPrices = catchAsync(async (req, res, next) => {
  const isLocalPartnerOrEmployee =
    req.user?.entity === "localPartner" ||
    req.user?.entity === "partnerEmployee";
  const isAdminOrEmployee =
    req.user?.entity === "admin" || req.user?.entity === "adminEmployee";

  // Determine salesRepId based on user type
  let salesRepId;

  if (isLocalPartnerOrEmployee) {
    // Local partner or partner employee: use their own localPartnerId
    if (!req.user?.localPartnerId) {
      return next(
        new AppError("Local partner ID not found in user data.", 403),
      );
    }
    salesRepId = req.user.localPartnerId;
  } else if (isAdminOrEmployee) {
    // Admin or admin employee: use salesRepId from query
    if (!req.query.salesRepId) {
      return next(
        new AppError(
          "salesRepId query parameter is required for admin users.",
          400,
        ),
      );
    }
    salesRepId = req.query.salesRepId;
  } else {
    // Not authorized
    return next(
      new AppError("This route is only accessible to authorized users.", 403),
    );
  }
  const searchableFields = ["id", "name", "sku", "productCode", "desc"];

  // Don't pass salesRepId to filter – product table has no salesRepId column
  const { salesRepId: _drop, ...queryForProduct } = req.query;

  // Build API features on product (filter, search, sort, fields, pagination)
  const features = new APIFeatures(product, queryForProduct)
    .filter()
    .search(searchableFields)
    .sort()
    .limitFields()
    .paginate();

  const queryOptions = features.getQuery();

  // Only products that ARE in salesRepProductPrices for this sales rep (products they added with custom price)
  queryOptions.where = {
    ...(queryOptions.where || {}),
    deleted: false,
    id: {
      [Op.in]: literal(
        `(SELECT productId FROM salesRepProductPrices WHERE salesRepId = ${salesRepId} AND deleted = 0)`,
      ),
    },
  };

  // Return product fields + custom price from salesRepProductPrices via literals
  queryOptions.attributes = [
    "id",
    "name",
    "sku",
    "productCode",
    "desc",
    "image",
    "weight",
    "grind",
    "quantity",
    "unit",
    "categoryId",
    "createdAt",
    "updatedAt",
    [
      literal(
        `(SELECT srpp.price FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
      ),
      "price",
    ],
    //wholsesalePrice
    [
      literal(
        `(SELECT srpp.wholesalePrice FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
      ),
      "wholesalePrice",
    ],
    [
      literal(
        `(SELECT srpp.id FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
      ),
      "pid",
    ],
    [
      literal(
        `(SELECT srpp.status FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`,
      ),
      "status",
    ],
  ];

  const countWhere = {
    deleted: false,
    id: {
      [Op.in]: literal(
        `(SELECT productId FROM salesRepProductPrices WHERE salesRepId = ${salesRepId} AND deleted = 0)`,
      ),
    },
  };
  const pagination = await features.getPaginationMetadata(product, {
    where: countWhere,
  });

  const doc = await product.findAll(queryOptions);

  res.status(200).json({
    status: "success",
    results: doc.length,
    pagination: pagination,
    data: {
      data: doc,
    },
  });
});

/**
 * Get all products that are NOT yet added (no custom price) by the given sales rep.
 * Local partner / partner employee: uses req.user.localPartnerId.
 * Admin / admin employee: requires salesRepId query parameter.
 */
exports.productsFromAdminForSalesRep = catchAsync(async (req, res, next) => {
  const isLocalPartnerOrEmployee =
    req.user?.entity === "localPartner" ||
    req.user?.entity === "partnerEmployee";
  const isAdminOrEmployee =
    req.user?.entity === "admin" || req.user?.entity === "adminEmployee";

  // Determine salesRepId based on user type
  let salesRepId;

  if (isLocalPartnerOrEmployee) {
    // Local partner or partner employee: use their own localPartnerId
    if (!req.user?.localPartnerId) {
      return next(
        new AppError("Local partner ID not found in user data.", 403),
      );
    }
    salesRepId = req.user.localPartnerId;
  } else if (isAdminOrEmployee) {
    // Admin or admin employee: use salesRepId from query
    if (!req.params.srId) {
      return next(
        new AppError(
          "salesRepId query parameter is required for admin users.",
          400,
        ),
      );
    }
    salesRepId = req.params.srId;
  } else {
    // Not authorized
    return next(
      new AppError("This route is only accessible to authorized users.", 403),
    );
  }
  const searchableFields = ["id", "name", "sku", "productCode", "desc"];

  // Don't pass salesRepId to filter – product table has no salesRepId column
  const { salesRepId: _drop, ...queryForProduct } = req.query;

  // Build API features on product (filter, search, sort, fields, pagination)
  const features = new APIFeatures(product, queryForProduct)
    .filter()
    .search(searchableFields)
    .sort()
    .limitFields()
    .paginate();

  const queryOptions = features.getQuery();

  // Only products that are NOT in salesRepProductPrices for this sales rep (not yet added by them)
  queryOptions.where = {
    ...(queryOptions.where || {}),
    deleted: false,
    id: {
      [Op.notIn]: literal(
        `(SELECT productId FROM salesRepProductPrices WHERE salesRepId = ${salesRepId} AND deleted = 0)`,
      ),
    },
  };

  // Return a fixed set of product fields for "add product" picker
  queryOptions.attributes = [
    "id",
    "name",
    "sku",
    "productCode",
    "desc",
    "price",
    "image",
    "weight",
    "wholesalePrice",
    "unit",
    "categoryId",
    "createdAt",
    "updatedAt",
    "grind",
  ];

  const countWhere = {
    deleted: false,
    id: {
      [Op.notIn]: literal(
        `(SELECT productId FROM salesRepProductPrices WHERE salesRepId = ${salesRepId} AND deleted = 0)`,
      ),
    },
  };
  const pagination = await features.getPaginationMetadata(product, {
    where: countWhere,
  });

  const doc = await product.findAll(queryOptions);

  res.status(200).json({
    status: "success",
    results: doc.length,
    pagination: pagination,
    data: {
      data: doc,
    },
  });
});
/**
 * Get Single Sales Rep Product Price by ID
 * GET /api/v1/admin/sales-rep-product-price/:id
 */
exports.getSalesRepProductPrice = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const price = await salesRepProductPrice.findOne({
    where: {
      id: id,
      deleted: false,
    },
    include: [
      {
        model: product,
        as: "product",
        attributes: ["id", "name", "sku", "productCode", "price"],
      },
      {
        model: salesRep,
        as: "salesRep",
        attributes: ["id", "srName", "email", "territoryName"],
      },
    ],
  });

  if (!price) {
    return next(new AppError(`No pricing entry found with ID ${id}`, 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      data: price,
    },
  });
});

/**
 * Create Sales Rep Product Prices (Bulk Create)
 * POST /api/v1/admin/sales-rep-product-price
 * Body: [{ productId, salesRepId, price, status }]
 */
exports.createSalesRepProductPrices = catchAsync(async (req, res, next) => {
  let pricesData = req.body;

  // Validate that body is an array
  if (!Array.isArray(pricesData)) {
    return next(
      new AppError("Request body must be an array of pricing entries", 400),
    );
  }

  if (pricesData.length === 0) {
    return next(new AppError("Pricing array cannot be empty", 400));
  }

  // Remove duplicate combinations (productId + salesRepId) - keep first occurrence
  const seenCombinations = new Set();
  pricesData = pricesData.filter((priceEntry) => {
    const combinationKey = `${priceEntry.productId}_${priceEntry.salesRepId}`;
    if (seenCombinations.has(combinationKey)) {
      return false; // Skip duplicate
    }
    seenCombinations.add(combinationKey);
    return true; // Keep first occurrence
  });

  // If all entries were duplicates, return error
  if (pricesData.length === 0) {
    return next(
      new AppError(
        "All entries were duplicates. No unique entries to process.",
        400,
      ),
    );
  }

  // Validate required fields for each entry
  for (const priceEntry of pricesData) {
    if (
      !priceEntry.productId ||
      !priceEntry.salesRepId ||
      priceEntry.price === undefined
    ) {
      return next(
        new AppError(
          "Each pricing entry must have 'productId', 'salesRepId', and 'price' fields",
          400,
        ),
      );
    }

    // Validate price is positive
    if (Number(priceEntry.price) < 0) {
      return next(
        new AppError(
          `Price must be a positive number for productId: ${priceEntry.productId}, salesRepId: ${priceEntry.salesRepId}`,
          400,
        ),
      );
    }

    // Validate wholesalePrice if provided
    if (
      priceEntry.wholesalePrice !== undefined &&
      Number(priceEntry.wholesalePrice) < 0
    ) {
      return next(
        new AppError(
          `Wholesale price must be a positive number for productId: ${priceEntry.productId}, salesRepId: ${priceEntry.salesRepId}`,
          400,
        ),
      );
    }
  }

  // Check for existing pricing entries in database (productId + salesRepId combinations)
  const existingPrices = await salesRepProductPrice.findAll({
    where: {
      [Op.or]: pricesData.map((p) => ({
        productId: p.productId,
        salesRepId: p.salesRepId,
        deleted: false,
      })),
    },
    attributes: ["productId", "salesRepId"],
  });

  if (existingPrices.length > 0) {
    const existingCombinations = existingPrices.map(
      (p) => `productId: ${p.productId}, salesRepId: ${p.salesRepId}`,
    );
    return next(
      new AppError(
        `Pricing entry already exists for: ${existingCombinations.join("; ")}. Use update endpoint instead.`,
        409,
      ),
    );
  }

  // Prepare pricing entries for bulk create
  const pricesToCreate = pricesData.map((priceEntry) => ({
    productId: priceEntry.productId,
    salesRepId: priceEntry.salesRepId,
    price: priceEntry.price,
    wholesalePrice: priceEntry.wholesalePrice,
    status: priceEntry.status !== undefined ? priceEntry.status : true,
    deleted: false,
  }));

  // Bulk create pricing entries
  const createdPrices = await salesRepProductPrice.bulkCreate(pricesToCreate, {
    returning: true,
  });

  // Fetch created entries with associations for response
  //   const createdIds = createdPrices.map((p) => p.id);
  //   const createdWithAssociations = await salesRepProductPrice.findAll({
  //     where: {
  //       id: {
  //         [Op.in]: createdIds,
  //       },
  //     },
  //     include: [
  //       {
  //         model: product,
  //         as: "product",
  //         attributes: ["id", "name", "sku", "productCode", "price"],
  //       },
  //       {
  //         model: salesRep,
  //         as: "salesRep",
  //         attributes: ["id", "srName", "email", "territoryName"],
  //       },
  //     ],
  //   });

  res.status(201).json({
    status: "success",
    data: {},
  });
});

/**
 * Update Sales Rep Product Prices (Bulk Update)
 * PATCH /api/v1/admin/sales-rep-product-price
 * Body: [{ productId, salesRepId, price, status }]
 */
exports.updateSalesRepProductPrices = catchAsync(async (req, res, next) => {
  let pricesData = req.body;

  // Validate that body is an array
  if (!Array.isArray(pricesData)) {
    return next(
      new AppError("Request body must be an array of pricing entries", 400),
    );
  }

  if (pricesData.length === 0) {
    return next(new AppError("Pricing array cannot be empty", 400));
  }

  // Remove duplicate combinations (productId + salesRepId) - keep first occurrence
  const seenCombinations = new Set();
  pricesData = pricesData.filter((priceEntry) => {
    const combinationKey = `${priceEntry.productId}_${priceEntry.salesRepId}`;
    if (seenCombinations.has(combinationKey)) {
      return false; // Skip duplicate
    }
    seenCombinations.add(combinationKey);
    return true; // Keep first occurrence
  });

  // If all entries were duplicates, return error
  if (pricesData.length === 0) {
    return next(
      new AppError(
        "All entries were duplicates. No unique entries to process.",
        400,
      ),
    );
  }

  // Validate required fields for each entry
  for (const priceEntry of pricesData) {
    if (!priceEntry.productId || !priceEntry.salesRepId) {
      return next(
        new AppError(
          "Each pricing entry must have 'productId' and 'salesRepId' fields",
          400,
        ),
      );
    }

    // Validate price is positive if provided
    if (priceEntry.price !== undefined && Number(priceEntry.price) < 0) {
      return next(
        new AppError(
          `Price must be a positive number for productId: ${priceEntry.productId}, salesRepId: ${priceEntry.salesRepId}`,
          400,
        ),
      );
    }

    // Validate wholesalePrice is positive if provided
    if (
      priceEntry.wholesalePrice !== undefined &&
      Number(priceEntry.wholesalePrice) < 0
    ) {
      return next(
        new AppError(
          `Wholesale price must be a positive number for productId: ${priceEntry.productId}, salesRepId: ${priceEntry.salesRepId}`,
          400,
        ),
      );
    }
  }

  // Find existing pricing entries in database
  const existingPrices = await salesRepProductPrice.findAll({
    where: {
      [Op.or]: pricesData.map((p) => ({
        productId: p.productId,
        salesRepId: p.salesRepId,
        deleted: false,
      })),
    },
  });

  if (existingPrices.length === 0) {
    return next(
      new AppError(
        "No existing pricing entries found to update. Use create endpoint instead.",
        404,
      ),
    );
  }

  // Create a map of existing prices for quick lookup
  const existingPricesMap = new Map();
  existingPrices.forEach((price) => {
    const key = `${price.productId}_${price.salesRepId}`;
    existingPricesMap.set(key, price);
  });

  // Separate entries into those that exist and those that don't
  const entriesToUpdate = [];
  const missingEntries = [];

  pricesData.forEach((priceEntry) => {
    const key = `${priceEntry.productId}_${priceEntry.salesRepId}`;
    if (existingPricesMap.has(key)) {
      entriesToUpdate.push({
        existingPrice: existingPricesMap.get(key),
        updateData: priceEntry,
      });
    } else {
      missingEntries.push({
        productId: priceEntry.productId,
        salesRepId: priceEntry.salesRepId,
      });
    }
  });

  // If some entries don't exist, inform user but continue with updates
  if (missingEntries.length > 0 && entriesToUpdate.length === 0) {
    const missingCombinations = missingEntries.map(
      (e) => `productId: ${e.productId}, salesRepId: ${e.salesRepId}`,
    );
    return next(
      new AppError(
        `No existing pricing entries found for: ${missingCombinations.join("; ")}. Use create endpoint instead.`,
        404,
      ),
    );
  }

  // Update existing entries
  const updatePromises = entriesToUpdate.map(
    async ({ existingPrice, updateData }) => {
      const updateFields = {};

      if (updateData.price !== undefined) {
        updateFields.price = updateData.price;
      }

      if (updateData.wholesalePrice !== undefined) {
        updateFields.wholesalePrice = updateData.wholesalePrice;
      }

      if (updateData.status !== undefined) {
        updateFields.status = updateData.status;
      }

      // Only update if there are fields to update
      if (Object.keys(updateFields).length > 0) {
        await existingPrice.update(updateFields);
      }

      return existingPrice;
    },
  );

  const updatedPrices = await Promise.all(updatePromises);

  // Fetch updated entries with associations for response
  const updatedIds = updatedPrices.map((p) => p.id);
  const updatedWithAssociations = await salesRepProductPrice.findAll({
    where: {
      id: {
        [Op.in]: updatedIds,
      },
    },
  });

  const response = {
    status: "success",
    results: updatedWithAssociations.length,
    data: {
      data: updatedWithAssociations,
    },
  };

  // Add warning if some entries were not found
  if (missingEntries.length > 0) {
    response.warning = `${missingEntries.length} entry/entries not found and were skipped. Use create endpoint to add them.`;
    response.missingEntries = missingEntries;
  }

  res.status(200).json(response);
});

/**
 * Delete Sales Rep Product Price by ID (Hard Delete - permanently removes from database)
 * DELETE /api/v1/admin/sales-rep-product-price/:id
 */
exports.deleteSalesRepProductPrice = factory.deleteOne(salesRepProductPrice);

/**
 * Delete Sales Rep Product Prices (Bulk Hard Delete - permanently removes from database)
 * DELETE /api/v1/admin/sales-rep-product-price
 * Body: [{ id }] or [{ productId, salesRepId }]
 */
exports.deleteSalesRepProductPrices = catchAsync(async (req, res, next) => {
  let deleteData = req.body;

  // Validate that body is an array
  if (!Array.isArray(deleteData)) {
    return next(
      new AppError("Request body must be an array of entries to delete", 400),
    );
  }

  if (deleteData.length === 0) {
    return next(new AppError("Delete array cannot be empty", 400));
  }

  // Remove duplicate entries - keep first occurrence
  const seenEntries = new Set();
  deleteData = deleteData.filter((entry) => {
    // Support both id-based and productId+salesRepId-based deletion
    const key = entry.id
      ? `id_${entry.id}`
      : `product_${entry.productId}_salesrep_${entry.salesRepId}`;

    if (seenEntries.has(key)) {
      return false; // Skip duplicate
    }
    seenEntries.add(key);
    return true; // Keep first occurrence
  });

  // If all entries were duplicates, return error
  if (deleteData.length === 0) {
    return next(
      new AppError(
        "All entries were duplicates. No unique entries to process.",
        400,
      ),
    );
  }

  // Validate required fields for each entry
  for (const entry of deleteData) {
    if (!entry.id && (!entry.productId || !entry.salesRepId)) {
      return next(
        new AppError(
          "Each entry must have either 'id' or both 'productId' and 'salesRepId' fields",
          400,
        ),
      );
    }
  }

  // Build where condition for finding entries to delete (no deleted check needed for hard delete)
  const whereConditions = deleteData.map((entry) => {
    if (entry.id) {
      return { id: entry.id };
    } else {
      return {
        productId: entry.productId,
        salesRepId: entry.salesRepId,
      };
    }
  });

  // Find existing pricing entries in database
  const existingPrices = await salesRepProductPrice.findAll({
    where: {
      [Op.or]: whereConditions,
    },
  });

  if (existingPrices.length === 0) {
    return next(
      new AppError("No existing pricing entries found to delete.", 404),
    );
  }

  // Get IDs of entries to delete
  const idsToDelete = existingPrices.map((p) => p.id);

  // Hard delete entries (permanently remove from database)
  await salesRepProductPrice.destroy({
    where: {
      id: {
        [Op.in]: idsToDelete,
      },
    },
  });

  // Check if some entries were not found
  const foundIds = new Set(existingPrices.map((p) => p.id));
  const foundProductSalesRep = new Set(
    existingPrices.map((p) => `${p.productId}_${p.salesRepId}`),
  );

  const missingEntries = deleteData.filter((entry) => {
    if (entry.id) {
      return !foundIds.has(entry.id);
    } else {
      return !foundProductSalesRep.has(
        `${entry.productId}_${entry.salesRepId}`,
      );
    }
  });

  const response = {
    status: "success",
    results: existingPrices.length,
    message: `Successfully deleted ${existingPrices.length} pricing entry/entries`,
    data: {
      deletedIds: idsToDelete,
    },
  };

  // Add warning if some entries were not found
  if (missingEntries.length > 0) {
    response.warning = `${missingEntries.length} entry/entries not found and were skipped.`;
    response.missingEntries = missingEntries;
  }

  res.status(200).json(response);
});

/**
 * Get products with custom wholesale prices for partner order creation
 * POST /api/v1/admin/sales-rep-product-price/products-for-order/:salesRepId
 * Body: { productIds: [1, 2, 3] }
 *
 * Returns products with their wholesalePrice (custom if set in salesRepProductPrices, default if not)
 */
exports.getProductsForPartnerOrder = catchAsync(async (req, res, next) => {
  const { salesRepId } = req.params;
  const { productIds } = req.body;

  // Validate salesRepId
  if (!salesRepId) {
    return next(new AppError("salesRepId is required", 400));
  }

  // Validate productIds

  // Build product attributes with conditional wholesalePrice
  const productAttributes = [
    "id",
    "name",
    "sku",
    "productCode",
    "desc",
    "image",
    "weight",
    "quantity",
    "unit",
    "categoryId",
    "grind",
  ];

  // Add custom wholesalePrice/price: use salesRepProductPrices when present, else product column
  // Subquery returns NULL when no srpp row exists, so outer COALESCE falls back to product.*
  productAttributes.push(
    [
      literal(
        `(SELECT COALESCE(
          (SELECT srpp.wholesalePrice FROM salesRepProductPrices srpp 
           WHERE srpp.productId = product.id 
             AND srpp.salesRepId = ${salesRepId} 
             AND srpp.deleted = 0 
           LIMIT 1),
          product.wholesalePrice
        ))`,
      ),
      "wholesalePrice",
    ],
    [
      literal(
        `(SELECT COALESCE(
          (SELECT srpp.price FROM salesRepProductPrices srpp 
           WHERE srpp.productId = product.id 
             AND srpp.salesRepId = ${salesRepId} 
             AND srpp.deleted = 0 
           LIMIT 1),
          product.price
        ))`,
      ),
      "price",
    ],
  );

  const whereCondition = {
    deleted: false,
  };

  if (productIds && Array.isArray(productIds) && productIds?.length > 0) {
    whereCondition.id = {
      [Op.in]: productIds,
    };
  }
  // Query products
  const products = await product.findAll({
    where: whereCondition,
    attributes: productAttributes,
    raw: true,
  });

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products: products,
    },
  });
});
