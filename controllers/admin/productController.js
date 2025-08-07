const { product, user, supplier, orderHistory , skuSupplier } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');

// exports.addProduct = factory.createOne(product, ['name']);

exports.addProduct = catchAsync(async (req, res, next) => {
  const input = req.body;
  const exist = await product.findOne({
        where: {name :req.body?.name },
        attributes: ['id'],
      });
  if (exist) {
    return next(new AppError('Already Exist', 400));
  }

  await product.create(input);
  if(input.supplierAndSkus && input?.supplierAndSkus?.length > 0){
    await skuSupplier.bulkCreate(input.supplierAndSkus)
  } 
  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.getAllProducts = factory.getAll(product);
exports.getProduct = factory.getOne(product);
exports.updateProduct = factory.updateOne(product);
exports.deleteProduct = factory.softdelete(product);
