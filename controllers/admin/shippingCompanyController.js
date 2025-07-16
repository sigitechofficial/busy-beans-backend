const { shippingCompanies } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { Op, literal, where } = require('sequelize');

exports.getAllShippingCompany = factory.getAll(shippingCompanies);
exports.getShippingCompany = factory.getOne(shippingCompanies);

exports.updateShippingCompany = catchAsync(async (req, res, next) => {
  await shippingCompanies.destroy({ where: { deleted: 0 } });
  await shippingCompanies.bulkCreate(req.body?.ranges);

  res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.createShippingCompany = catchAsync(async (req, res, next) => {
  await shippingCompanies.bulkCreate(req.body.ranges);

  res.status(200).json({
    status: 'success',
    data: {},
  });
});
