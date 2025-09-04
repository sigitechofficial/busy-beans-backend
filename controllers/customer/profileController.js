const { user, address, billingAddress } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');
const bcrypt = require('bcryptjs');

exports.updateProfile = catchAsync(async (req, res, next) => {
  console.log('🚀 ~ req.body:', req.body);
  console.log('🚀 ~ req.user.Id:', req.user.id);

  console.log('🚀 ~ req.body?.userData:', req.body?.userData);
  if (req.user.id && req.body?.userData) {
    req.body.userData.email = undefined;
    // req.body.userData.password = undefined;
    const customer = await user.findOne({
      where: { id: req.user.id, deleted: 0 },
    });
    if (req.body?.userData?.newPassword) {
      const isMatch = await bcrypt.compare(
        req.body.userData.oldPassword,
        customer?.password,
      ); // password == customer?.password;
      console.log(
        'Ã°Å¸Å¡â‚¬ ~ exports.login=catchAsync ~ isMatch?.isMatch:',
        isMatch,
      );
      console.log('🚀 ~ req.body?.userData:', req.body?.userData);
      if (!isMatch) {
        return next(new AppError('Incorrect current password', 401));
      }
      req.body.userData.password = req.body?.userData?.newPassword;
    }
    console.log('🚀 ~ req.body.userData:', req.body.userData);
    req.body.userData.id = undefined;
    await user.update(req.body?.userData, {
      where: { id: req.user.id },
      individualHooks: true,
    });
  }

  if (req.body?.addressId) {
    req.body.addressData.userId = undefined;
    req.body.addressData.id = undefined;
    await address.update(req.body?.addressData, {
      where: { id: req.body?.addressId },
    });
  }

  if (req.body?.billingAddressId) {
    req.body.billingAddressData.userId = undefined;
    req.body.billingAddressData.id = undefined;
    await billingAddress.update(req.body?.billingAddressData, {
      where: { id: req.body?.billingAddressId },
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
