const { supplier } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');

exports.getAllSuppliers = factory.getAll(supplier);
exports.getSupplier = factory.getOne(supplier);
exports.createSupplier = factory.createOne(supplier);
exports.updateSupplier = factory.updateOne(supplier);
exports.deleteSupplier = factory.deleteOne(supplier);
