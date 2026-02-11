const {
  product,
  user,
  supplier,
  orderHistory,
  skuSupplier,
  userDiscount,
  category,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { response } = require("../../utils/response");
const APIFeatures = require("../../utils/apiFeatures");
const { literal, Op } = require("sequelize");

exports.addProduct = catchAsync(async (req, res, next) => {
  const input = req.body;

  if (req.file) {
    // throw new  'Image not uploaded', 'Please upload image';
    const tmpPath = req.file.path;
    const imagePath = tmpPath.replace(/\\/g, "/");
    input.image = imagePath;
    console.log("ðŸš€ ~ catchAsync ~ nput.image:", input.image);
  } else {
    input.image = undefined;
    console.log("ðŸš€ ~ c ~ input.image:", input.image);
  }

  const data = await product.create(input);

  const supplierAndSkus = JSON.parse(input?.supplierAndSkus);

  if (supplierAndSkus && supplierAndSkus?.length > 0) {
    // Add productId to each object
    const enrichedSkus = supplierAndSkus.map((element) => ({
      ...element,
      productId: data.id,
    }));

    await skuSupplier.bulkCreate(enrichedSkus);
  }

  res.status(200).json({
    status: "success",
    data: { product: data },
  });
});

exports.getAllProducts = catchAsync(async (req, res, next) => {
  // Define searchable columns for products
  const searchableFields = ["id", "name", "sku", "productCode", "desc"];

  // Build API features (filter, search, sort, fields, pagination)
  const features = new APIFeatures(product, req.query)
    .filter()
    .search(searchableFields) // Add search functionality
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options
  const queryOptions = features.getQuery();

  // Get pagination metadata
  const pagination = await features.getPaginationMetadata(product);

  // Execute the query
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

exports.getAllProductsUser = catchAsync(async (req, res, next) => {
  // 🔐 SAFETY GUARD (PREVENTS 500 ERROR)
  if (!req.user || !req.user.id) {
    return next(new AppError("User not authenticated", 401));
  }

  const searchableFields = ["id", "name", "sku", "productCode", "desc"];

  const features = new APIFeatures(product, req.query)
    .filter()
    .search(searchableFields)
    .sort()
    .limitFields()
    .paginate();

  const queryOptions = features.getQuery();

  queryOptions.where = {
    ...queryOptions.where,
    status: 1,
  };

  // Sales rep's customer (user.salesRepId) → only products added by that sales rep, with their price/wholesale
  // Admin's customer (no salesRepId) → admin inventory (all products, regular price)
  const salesRepId = req.user?.salesRepId || null;

  if (salesRepId) {
    queryOptions.where = {
      ...queryOptions.where,
      id: {
        [Op.in]: literal(
          `(SELECT productId FROM salesRepProductPrices WHERE salesRepId = ${salesRepId} AND deleted = 0)`
        ),
      },
    };
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
      "status",
    ];
    productAttributes.push(
      [
        literal(
          `(SELECT COALESCE(srpp.price, product.price) FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`
        ),
        "price",
      ],
      [
        literal(
          `(SELECT COALESCE(srpp.wholesalePrice, product.wholesalePrice) FROM salesRepProductPrices srpp WHERE srpp.productId = product.id AND srpp.salesRepId = ${salesRepId} AND srpp.deleted = 0 LIMIT 1)`
        ),
        "wholesalePrice",
      ]
    );
    queryOptions.attributes = productAttributes;
  } else {
    const baseExcludes = ["deleted", "deletedAt", "wholesalePrice"];
    queryOptions.attributes = {
      exclude: baseExcludes,
    };
  }

  queryOptions.raw = true;

  const pagination = await features.getPaginationMetadata(product);
  const products = await product.findAll(queryOptions);

  // ✅ USER ID FROM TOKEN (NOT URL)
  const activeCategories = await userDiscount.findAll({
    where: { userId: req.user.id },
    attributes: ["percentage", "categoryId"],
    raw: true,
  });

  const discountMap = activeCategories.reduce((map, item) => {
    map[item.categoryId] = Number(item.percentage);
    return map;
  }, {});

  const productsWithDiscount = products.map((prod) => {
    const discount = discountMap[prod.categoryId] || 0;
    const originalPrice = Number(prod.price);
    const finalPrice = discount
      ? (originalPrice - (originalPrice * discount) / 100).toFixed(2)
      : originalPrice.toFixed(2);

    return {
      ...prod,
      price: finalPrice,
      appliedDiscount: discount,
    };
  });

  res.status(200).json({
    status: "success",
    results: productsWithDiscount.length,
    pagination,
    data: { data: productsWithDiscount },
  });
});

exports.getProduct = catchAsync(async (req, res, next) => {
  const data = await product.findOne({
    where: { id: req.params?.id },
    attributes: { exclude: ["deleted", "deletedAt", "updatedAt"] },
    include: {
      model: skuSupplier,
      attributes: { exclude: ["deleted", "updatedAt", "status"] },
    },
  });

  if (!data) {
    return next(new AppError("Product Not Found", 400));
  }
  res.status(200).json({
    status: "success",
    data: { product: data },
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const input = req.body;
  const exist = await product.findOne({
    where: { id: req.params.id },
    attributes: ["id"],
  });
  if (!exist) {
    return next(new AppError("Product Not Found", 400));
  }

  if (req.file) {
    // throw new  'Image not uploaded', 'Please upload image';
    const tmpPath = req.file.path;
    const imagePath = tmpPath.replace(/\\/g, "/");
    input.image = imagePath;
    console.log("ðŸš€ ~ catchAsync ~ nput.image:", input.image);
  } else {
    input.image = undefined;
    console.log("ðŸš€ ~ c ~ input.image:", input.image);
  }
  await product.update(input, { where: { id: req.params?.id } });

  if (input?.supplierAndSkus) {
    await skuSupplier.destroy({
      where: {
        productId: req.params?.id,
      },
    });
    const supplierAndSkus = JSON.parse(input?.supplierAndSkus);
    if (supplierAndSkus && supplierAndSkus?.length > 0) {
      // Add productId to each object
      const enrichedSkus = supplierAndSkus.map((element) => ({
        ...element,
        productId: req.params?.id,
      }));

      await skuSupplier.bulkCreate(enrichedSkus);
    }
  }
  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.deleteProduct = factory.softdelete(product);
