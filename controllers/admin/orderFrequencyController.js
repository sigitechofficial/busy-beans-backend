const { orderFrequency } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');

exports.getAllSuppliers = factory.getAll(supplier);
 
