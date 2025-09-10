const {
  countryInSystem,
  stateInSystem,
  territory,
  cityInSystem,
  address,
  billingAddress,
  account,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');

exports.getAdmin = async (req, res, next) => {
  const admin = await account.findOne({
    attributes: { exclude: ['password', 'status'] },
  });

  res.status(200).json({ status: 'success', message: 'success', data: admin });
};

exports.updateAdmin = factory.updateOne(account);
