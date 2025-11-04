const { category, product } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const APIFeatures = require('../../utils/apiFeatures');
const { Op, literal, where, fn, col } = require('sequelize');

exports.getAllCatagories = catchAsync(async (req, res, next) => {
  // Build manual conditions based on query/params
  let condition = {};
  if (req.params.id) condition.id = req.params.id;
  // Build API features (filter, sort, fields, pagination)
  const features = new APIFeatures(category, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order, etc.)
  const queryOptions = features.getQuery();

  // Merge manual filter conditions
  queryOptions.where = { ...(queryOptions.where || {}), ...condition };

  // Add your custom includes

  // Custom attributes with literal fields

  queryOptions.attributes = [
    'id',
    [
      literal(
        `(SELECT COUNT(*) FROM products WHERE products.categoryId = category.id AND products.deleted = 0)`,
      ),
      'numberOfProducts',
    ],
    `name`,
    `status`,
    `createdAt`,
  ];

  // Execute the query
  const doc = await category.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: 'success',
    results: doc.length,
    data: {
      data: doc,
    },
  });
});
exports.getCatagory = factory.getOne(category);
exports.createCatagory = factory.createOne(category, ['name']);
exports.updateCatagory = factory.updateOne(category);
exports.deleteCatagory = catchAsync(async (req, res, next) => {
  const data = await category.findOne({
    where: { id: req.params?.id },
    attributes: ['id', 'deleted'],
  });
  data.deleted = true;
  await data.save();
  await product.update({ deleted: 1 }, { where: { categoryId: data?.id } });

  res.status(200).json({
    status: 'success',
    data: {},
  });
});
