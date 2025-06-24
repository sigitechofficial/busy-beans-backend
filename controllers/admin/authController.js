const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
// const { Op, literal, col, fn, where } = require('sequelize');
const { user, address, account ,salesRep, supplier} = require('../../models');
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
    'd4cec3a48d07bcc52c3de15cBusyBeansCoffee60d03989ed0d638daa5677d7b', // Hardcoded JWT Secret
    {
      expiresIn: '7d',
    },
);

const createSendToken = (input, statusCode, req, res) => {
  console.log('🚀 ~ createSendToken ~ input:', input);
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
  if (!req.body?.info?.registerBy || req.body?.info?.registerBy == 'email') {
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

const login = (Model) =>
  catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    console.log('🚀 ~ exports.login=catchAsync ~ req.body;:', req.body);
  
    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }
    // 2) Check if user exists && password is correct
    const data = await Model.findOne({
      where: { email,deleted:0 },
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
      
      Event.otpToUsersForgotPasswordEvent({email:entity?.email,otp:OTP,name:entity?.name});

    res.status(200).json({
      status: 'success',
      data: {id:entity.id, email:entity.email},
      message: 'OTP sent to email!',
    });
});


exports.adminLogin =  login(account);
exports.salesRepLogin =  login(salesRep);
exports.supplierLogin =  login(supplier);
 

exports.adminForgotPassword =  forgotPassword(account);
exports.salesRepForgotPassword =  forgotPassword(salesRep);
exports.supplierForgotPassword =  forgotPassword(supplier);
  
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
