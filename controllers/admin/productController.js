const { product,user,supplier,orderHistory, } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');

exports.addProduct = catchAsync(async (req, res, next) => {
  const input = req.body;
  if (req.file) {
    // throw new  'Image not uploaded', 'Please upload image';
    const tmpPath = req.file.path;
    const imagePath = tmpPath.replace(/\\/g, '/');
    input.image = imagePath;
  } else {
    throw new AppError('Product Image is required. Please upload Image', 200);
  }
  await product.create(input);

  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.view = catchAsync(async (req, res, next) => {
  const input = req.body;
  if (req.file) {
    // throw new  'Image not uploaded', 'Please upload image';
    const tmpPath = req.file.path;
    const imagePath = tmpPath.replace(/\\/g, '/');
    input.image = imagePath;
  } else {
    throw new AppError('Product Image is required. Please upload Image', 200);
  }
  await product.create(input);

  res.status(200).json({
    status: 'success',
    data: {},
  });
});
exports.getAllProducts = factory.getAll(product);
exports.getProduct = factory.getOne(product);
exports.updateProduct = factory.updateOne(product);
exports.deleteProduct = factory.deleteOne(product);
