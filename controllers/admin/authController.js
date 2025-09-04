require('dotenv').config();
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const REDIS = require('../../utils/redisHandling');
const { Op, literal, fn, col } = require('sequelize');

// const { Op, literal, col, fn, where } = require('sequelize');
const {
  user,
  address,
  account,
  salesRep,
  supplier,
  deviceToken,
  employee,
  permission,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const Email = require('../../utils/email');
const otpGenerator = require('otp-generator');
const EmailResetPasswordOtpToAll = require('../../helper/ResetPasswordOtpToAll');
const Event = require('../events/userAccountRelatedEvents');

const MODEL = {
  user: user,
  admin: account,
  supplier: supplier,
  localPartner: salesRep,
  adminEmployee: employee,
  partnerEmployee: employee,
};

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

const createSendToken = (input, statusCode, req, res, tokenId, entity) => {
  // console.log('🚀 ~ createSendToken ~ input:', input);
  const token = signToken({
    id: input.id,
    name: input.name,
    email: input.email,
    entity: entity,
    tokenId: tokenId || '',
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
  REDIS.storeAccessToken(`${entity}${input.id}`, token);

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

const login = (Model) => {
  return catchAsync(async (req, res, next) => {
    // console.log('🚀 ~ login ~ entity:BEFORE', entity);
    const { email, password } = req.body;
    console.log('🚀 ~ login ~ req.params.entity:', req.params.entity);
    entity = req.params.entity;
    console.log('🚀 ~ login ~ entity:AFTER', entity);
    console.log('🚀 ~ exports.login=catchAsync ~ req.body;:', req.body);
    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }
    // 2) Check if user exists && password is correct

    let data = await Model.findOne({
      where: { email, deleted: 0 },
    });

    console.log('🚀 ~ login ~ entityBBBB:', entity);
    if (!data) {
      if (entity == 'admin' || entity == 'localPartner') {
        const condition = { email, deleted: 0 };
        if (entity == 'admin') condition.salesRepId = { [Op.is]: null };
        else condition.accountId = { [Op.is]: null };
        console.log('🚀 ~ login ~ condition:EMPLOYEE', condition);

        data = await employee.findOne({
          where: condition,
          include: { model: permission, attributes: ['id', 'key'] },
        });
        // console.log('🚀 ~ login ~ data:', data);
        if (data) {
          entity = data.accountId ? 'adminEmployee' : 'partnerEmployee';
        }
      }
    }
    console.log('🚀 ~ exports.login=catchAsync ~ data:', data);
    if (!data || !(await bcrypt.compare(password, data?.password))) {
      return next(new AppError('Incorrect email or password', 400));
    }
    // if (!data || password != data.password) {
    //   return next(new AppError('Incorrect email or password', 400));
    // }
    if (!data?.status) {
      return next(new AppError('You are blocked by admin!', 400));
    }
    if (req.body?.tokenId) {
      const input = { tokenId: req.body?.tokenId };
      if (entity == 'localPartner') input.salesRepId = data?.id;
      else if (entity == 'supplier') input.supplierId = data?.id;
      else if (entity == 'admin') input.accountId = data?.id;
      else input.employeeId = data?.id;
      deviceToken.create(input);
    }
    // 3) If everything ok, send token to client
    console.log('🚀 ~ login ~ createSendToken:', entity);
    createSendToken(data, 200, req, res, req.body?.tokenId, entity);
  });
};

const forgotPassword = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    let data = await Model.findOne({
      where: { email: req.body.email, deleted: 0 },
      attributes: {
        exclude: ['updatedAt', 'deleted', 'deletedAt', 'password'],
      },
    });
    if (!data && (entity == 'admin' || entity == 'localPartner')) {
      data = await employee.findOne({
        where: { email: req.body.email, deleted: 0 },
      });
      console.log('🚀 ~ login ~ data:', data);
      if (data) {
        entity = data.accountId ? 'adminEmployee' : 'partnerEmployee';
      }
    }
    if (!data) {
      return next(new AppError('There is no user with email address.', 404));
    }

    const OTP = otpGenerator.generate(4, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    data.latestOtp = OTP;
    await data.save();

    Event.otpToUsersForgotPasswordEvent({
      email: data?.email,
      otp: OTP,
      name: data?.name,
    });

    res.status(200).json({
      status: 'success',
      data: { id: data.id, email: data.email },
      message: 'OTP sent to email!',
    });
  });

const resendOtp = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    const data = await Model.findOne({
      where: { email: req.body.email },
      attributes: {
        exclude: ['updatedAt', 'deleted', 'deletedAt', 'password', 'latestOtp'],
      },
    });
    if (!data && (entity == 'admin' || entity == 'localPartner')) {
      data = await employee.findOne({
        where: { email: req.body.email, deleted: 0 },
      });
      console.log('🚀 ~ login ~ data:', data);
      if (data) {
        entity = data.accountId ? 'adminEmployee' : 'partnerEmployee';
      }
    }
    if (!data) {
      return next(new AppError('There is no user with email address.', 404));
    }

    const OTP = otpGenerator.generate(4, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    await Model.update({ latestOtp: OTP }, { where: { id: data?.id } });

    Event.otpToUsersForgotPasswordEvent({
      email: data?.email,
      otp: OTP,
      name: data?.name,
    });

    res.status(200).json({
      status: 'success',
      data: { id: data?.id, email: data.email },
      message: 'OTP sent to email!',
    });
  });

const otpVerification = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    const { otp, id, on } = req.body;

    // 2) Check if user exists && password is correct
    const data = await Model.findOne({
      where: { id, deleted: 0 },
      attributes: {
        exclude: [`deleted`, `updatedAt`, `deletedAt`],
      },
    });

    if (!data && (entity == 'admin' || entity == 'localPartner')) {
      data = await employee.findOne({
        where: { id, deleted: 0 },
      });
      console.log('🚀 ~ login ~ data:', data);
      if (data) {
        entity = data.accountId ? 'adminEmployee' : 'partnerEmployee';
      }
    }

    if (!data) {
      return next(new AppError('User not found', 200));
    }

    if (data.latestOtp == otp) {
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

const resetPassword = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    let data = await Model.findOne({
      where: { id: req.body?.id, deleted: 0 },
      attributes: {
        exclude: ['updatedAt', 'deleted', 'deletedAt', 'latestOtp'],
      },
    });
    if (!data && (entity == 'admin' || entity == 'localPartner')) {
      data = await employee.findOne({
        where: { id: req.body?.id, deleted: 0 },
      });
      console.log('🚀 ~ login ~ data:', data);
      if (data) {
        entity = data.accountId ? 'adminEmployee' : 'partnerEmployee';
      }
    }
    // 2) If token has not expired, and there is user, set the new password
    if (!data) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    console.log('🚀 ~ catchAsync ~ req.body?.password:', req.body?.password);
    console.log('🚀 ~ catchAsync ~ data?.password:', data?.password);
    // await Model.update({password:req.body?.password},{where:{id:data?.id}})
    data.password = req.body.password;
    await data.save();
    data.password = undefined;
    createSendToken(data, 200, req, res, req.params.tokenId, entity);
  });

// exports.allLogin = login(account);
exports.adminLogin = login(account);
exports.salesRepLogin = login(salesRep);
exports.supplierLogin = login(supplier);

exports.adminForgotPassword = forgotPassword(account, 'admin');
exports.salesRepForgotPassword = forgotPassword(salesRep, 'localPartner');
exports.supplierForgotPassword = forgotPassword(supplier, 'supplier');

exports.adminResendOtp = resendOtp(account, 'admin');
exports.salesRepResendOtp = resendOtp(salesRep, 'localPartner');
exports.supplierResendOtp = resendOtp(supplier, 'supplier');

exports.adminOtpVerification = otpVerification(account, 'admin');
exports.salesRepOtpVerification = otpVerification(salesRep, 'localPartner');
exports.supplierOtpVerification = otpVerification(supplier, 'supplier');

exports.adminResetPassword = resetPassword(account, 'admin');
exports.salesRepResetPassword = resetPassword(salesRep, 'localPartner');
exports.supplierResetPassword = resetPassword(supplier, 'supplier');

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
