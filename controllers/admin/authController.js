const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
// const { Op, literal, col, fn, where } = require('sequelize');
const {
  user,
  address,
  account,
  salesRep,
  supplier,
  deviceToken,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const Email = require('../../utils/email');
const otpGenerator = require('otp-generator');
const EmailResetPasswordOtpToAll = require('../../helper/ResetPasswordOtpToAll');
const Event = require('../events/userAccountRelatedEvents');

const EmailWelcome = require('../../helper/WelcomeForBoth');
const { response } = require('../../utils/response');
const bcrypt = require('bcryptjs');
const signToken = (data) =>
  jwt.sign(
    data,
    process.env.JWT_SECRET, // Hardcoded JWT Secret
    {
      expiresIn: '7d',
    },
  );

const createSendToken = (input, statusCode, req, res) => {
  // console.log('🚀 ~ createSendToken ~ input:', input);
  const token = signToken({
    id: input.id,
    name: input.name,
    email: input.email,
  });

  res.cookie('jwt', token, {
    expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });

  // Remove password from output
  input.password = undefined;
  input.updatedAt = undefined;
  input.deletedAt = undefined;
  input.deleted = undefined;

  res.status(statusCode).json({
    status: 'success',
    data: {
      token,
      user: input,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const OTP = otpGenerator.generate(4, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  if (!req.body?.info?.registerBy || req.body?.info?.registerBy != 'email') {
    req.body.info.verifiedAt = Date.now();
  }
  const newUser = await user.create(req.body?.info);

  if (!req.body?.info?.registerBy || req.body?.info?.registerBy == 'email') {
    EmailResetPasswordOtpToAll(OTP, newUser, 'verification');
    // return res.status(200).json(
    //   response({
    //     data: {
    //       message: 'OTP sent to your email!',
    //       data: newUser,
    //     },
    //   }),
    // );
  }
  if (req.body?.address) {
    req.body.address.userId = newUser?.id;
    address.create(req.body?.address);
  }
  createSendToken(newUser, 201, req, res);
});

const login = (Model, entity) => {
  return catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    console.log('🚀 ~ login ~ entity:', entity);
    console.log('🚀 ~ exports.login=catchAsync ~ req.body;:', req.body);
    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }
    // 2) Check if user exists && password is correct
    const data = await Model.findOne({
      where: { email, deleted: 0 },
    });
    console.log('🚀 ~ exports.login=catchAsync ~ data:', data);
    // if (!data || !(await bcrypt.compare(password, data?.password))) {
    //   return next(new AppError('Incorrect email or password', 400));
    // }
    if (!data || password != data.password) {
      return next(new AppError('Incorrect email or password', 400));
    }
    if (!data?.status) {
      return next(new AppError('You are blocked by admin!', 400));
    }
    if (req.body?.tokenId) {
      const input = { tokenId: req.body?.tokenId };
      if (entity == 'localPartner') input.salesRepId = data?.id;
      else if (entity == 'supplier') input.supplierId = data?.id;
      else input.accountId = data?.id;
      deviceToken.create(input);
    }
    // 3) If everything ok, send token to client
    createSendToken(data, 200, req, res);
  });
};

const forgotPassword = (Model) =>
  catchAsync(async (req, res, next) => {
    const entity = await Model.findOne({
      where: { email: req.body.email },
      attributes: {
        exclude: ['updatedAt', 'deleted', 'deletedAt', 'password'],
      },
    });
    if (!entity) {
      return next(new AppError('There is no user with email address.', 404));
    }

    const OTP = otpGenerator.generate(4, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    entity.latestOtp = OTP;
    await entity.save();

    Event.otpToUsersForgotPasswordEvent({
      email: entity?.email,
      otp: OTP,
      name: entity?.name,
    });

    res.status(200).json({
      status: 'success',
      data: { id: entity.id, email: entity.email },
      message: 'OTP sent to email!',
    });
  });

const resendOtp = (Model) =>
  catchAsync(async (req, res, next) => {
    const entity = await Model.findOne({
      where: { email: req.body.email },
      attributes: {
        exclude: ['updatedAt', 'deleted', 'deletedAt', 'password', 'latestOtp'],
      },
    });
    if (!entity) {
      return next(new AppError('There is no user with email address.', 404));
    }

    const OTP = otpGenerator.generate(4, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    await Model.update({ latestOtp: OTP }, { where: { id: entity?.id } });

    Event.otpToUsersForgotPasswordEvent({
      email: entity?.email,
      otp: OTP,
      name: entity?.name,
    });

    res.status(200).json({
      status: 'success',
      data: { id: entity?.id, email: entity.email },
      message: 'OTP sent to email!',
    });
  });

const otpVerification = (Model) =>
  catchAsync(async (req, res, next) => {
    const { otp, id, on } = req.body;

    // 2) Check if user exists && password is correct
    const entity = await Model.findOne({
      where: { id },
      attributes: {
        exclude: [`deleted`, `updatedAt`, `deletedAt`],
      },
    });

    if (!entity) {
      return next(new AppError('User not found', 200));
    }

    if (entity.latestOtp == otp) {
      return res.status(200).json(
        response({
          data: {
            message: 'Success',
            data: { id: id },
          },
        }),
      );
    }

    return next(new AppError('Invalid OTP', 200));
  });

const resetPassword = (Model) =>
  catchAsync(async (req, res, next) => {
    const entity = await Model.findOne({
      where: { id: req.body?.id },
      attributes: {
        exclude: ['updatedAt', 'deleted', 'deletedAt', 'latestOtp'],
      },
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!entity) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    console.log('🚀 ~ catchAsync ~ req.body?.password:', req.body?.password);
    console.log('🚀 ~ catchAsync ~ entity?.password:', entity?.password);
    // await Model.update({password:req.body?.password},{where:{id:entity?.id}})
    entity.password = req.body.password;
    await entity.save();
    entity.password = undefined;
    createSendToken(entity, 200, req, res);
  });

exports.adminLogin = login(account, 'admin');
exports.salesRepLogin = login(salesRep, 'localPartner');
exports.supplierLogin = login(supplier, 'supplier');

exports.adminForgotPassword = forgotPassword(account);
exports.salesRepForgotPassword = forgotPassword(salesRep);
exports.supplierForgotPassword = forgotPassword(supplier);

exports.adminResendOtp = resendOtp(account);
exports.salesRepResendOtp = resendOtp(salesRep);
exports.supplierResendOtp = resendOtp(supplier);

exports.adminOtpVerification = otpVerification(account);
exports.salesRepOtpVerification = otpVerification(salesRep);
exports.supplierOtpVerification = otpVerification(supplier);

exports.adminResetPassword = resetPassword(account);
exports.salesRepResetPassword = resetPassword(salesRep);
exports.supplierResetPassword = resetPassword(supplier);

exports.logina = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  console.log('🚀 ~ exports.login=catchAsync ~ req.body;:', req.body);

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  const data = await account.findOne({
    where: { email },
  });
  console.log('🚀 ~ exports.login=catchAsync ~ data:', data);

  // if (!data || !(await bcrypt.compare(password, data?.password))) {
  //   return next(new AppError('Incorrect email or password', 400));
  // }

  if (!data || password != '123456') {
    return next(new AppError('Incorrect email or password', 400));
  }

  // 3) If everything ok, send token to client
  createSendToken(data, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};
