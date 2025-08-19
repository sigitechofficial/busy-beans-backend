const {
  product,
  user,
  supplier,
  orderHistory,
  skuSupplier,
} = require('../../models');
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
    console.log('ðŸš€ ~ catchAsync ~ nput.image:', input.image);
  } else {
    input.image = undefined;
    console.log('ðŸš€ ~ c ~ input.image:', input.image);
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
    status: 'success',
    data: { product: data },
  });
});

exports.getAllProducts = factory.getAll(product);

exports.getProduct = catchAsync(async (req, res, next) => {
  const data = await product.findOne({
    where: { id: req.params?.id },
    attributes: { exclude: ['deleted', 'deletedAt', 'updatedAt'] },
    include: {
      model: skuSupplier,
      attributes: { exclude: ['deleted', 'updatedAt', 'status'] },
    },
  });

  if (!data) {
    return next(new AppError('Product Not Found', 400));
  }
  res.status(200).json({
    status: 'success',
    data: { product: data },
  });
});
exports.updateProduct = catchAsync(async (req, res, next) => {
  const input = req.body;
  const exist = await product.findOne({
    where: { id: req.params.id },
    attributes: ['id'],
  });
  if (!exist) {
    return next(new AppError('Product Not Found', 400));
  }

  if (req.file) {
    // throw new  'Image not uploaded', 'Please upload image';
    const tmpPath = req.file.path;
    const imagePath = tmpPath.replace(/\\/g, '/');
    input.image = imagePath;
    console.log('ðŸš€ ~ catchAsync ~ nput.image:', input.image);
  } else {
    input.image = undefined;
    console.log('ðŸš€ ~ c ~ input.image:', input.image);
  }
  await product.update(input, { where: { id: req.params?.id } });

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
  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.deleteProduct = factory.softdelete(product);
