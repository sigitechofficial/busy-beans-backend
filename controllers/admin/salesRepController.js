const { salesRep } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');

exports.getAllSalesRep = factory.getAll(salesRep);
exports.getSalesRep = factory.getOne(salesRep);
exports.createSalesRep = factory.createOne(salesRep);
exports.updateSalesRep = factory.updateOne(salesRep);
exports.deleteSalesRep = factory.deleteOne(salesRep);
