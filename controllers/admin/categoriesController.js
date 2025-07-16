const { category } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');

exports.getAllCatagories = factory.getAll(category);
exports.getCatagory = factory.getOne(category);
exports.createCatagory = factory.createOne(category, ['name']);
exports.updateCatagory = factory.updateOne(category);
exports.deleteCatagory = factory.softdelete(category);
