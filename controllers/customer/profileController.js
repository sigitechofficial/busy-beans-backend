const { user, address } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');

exports.updateProfile = catchAsync(async (req, res, next) => {
  if (req.body?.userId && req.body?.userData) {
    req.body.userData.email = undefined;
    req.body.userData.password = undefined;
    req.body.userData.id = undefined;
    await user.update(req.body?.userData, { where: { id: req.body?.userId } });
  }

  if (req.body?.addressId) {
    req.body.addressData.userId = undefined;
    req.body.addressData.id = undefined;
    await address.update(req.body?.addressData, {
      where: { id: req.body?.addressId },
    });
  }

  return res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.addAddress = catchAsync(async (req, res, next) => {
  req.body.address.userId = req.params.id;
  const data = await address.create(req.body?.address);

  return res.status(200).json({
    status: 'success',
    data: { data },
  });
});

exports.getAllAddress = factory.getAll(address);
