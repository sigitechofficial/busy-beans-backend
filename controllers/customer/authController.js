const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
// const { Op, literal, col, fn, where } = require('sequelize');
const { user, address } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const Email = require('../../utils/email');
const otpGenerator = require('otp-generator');
const EmailResetPasswordOtpToAll = require('../../helper/ResetPasswordOtpToAll');
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

  req.body.info.latestOtp = OTP;
  const newUser = await user.create(req.body?.info);

  req.body.address.userId = newUser?.id;
  const defaultAddress = await address.create(req.body?.address);

  const input = JSON.parse(JSON.stringify(newUser));
  input.address = defaultAddress;
  if (!req.body?.info?.registerBy || req.body?.info?.registerBy == 'email') {
    EmailResetPasswordOtpToAll(OTP, newUser, 'verification');
    return res.status(200).json(
      response({
        data: {
          message: 'OTP sent to your email!',
          data: input,
        },
      }),
    );
  }

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 200));
  }
  // 2) Check if user exists && password is correct
  const customer = await user.findOne({
    where: { email },
    include: {
      model: address,
      attributes: {
        exclude: [`deleted`, `updatedAt`, `deletedAt`],
      },
    },
  });
  console.log('🚀 ~ exports.login=catchAsync ~ customer:', customer);

  if (!customer || !(await bcrypt.compare(password, customer?.password))) {
    return next(new AppError('Incorrect email or password', 200));
  }

  // 3) If everything ok, send token to client
  createSendToken(customer, 200, req, res);
});

exports.otpVerification = catchAsync(async (req, res, next) => {
  const { otp, id } = req.body;

  // 2) Check if user exists && password is correct
  const customer = await user.findOne({
    where: { latestOtp: otp, id },
    include: {
      model: address,
      attributes: {
        exclude: [`deleted`, `updatedAt`, `deletedAt`],
      },
    },
  });
  console.log('🚀 ~ exports.login=catchAsync ~ customer:', customer);

  if (!customer) {
    customer.verifiedAt = Date.now();
    await customer.save();
    return next(new AppError('User not found', 200));
  }

  if (customer.latestOtp == otp) {
    createSendToken(customer, 200, req, res);
  }

  return next(new AppError('Invalid OTP', 200));
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401),
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }

    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const customer = await user.findOne({
    where: { email: req.body.email },
    attributes: {
      exclude: ['userId', 'updatedAt', 'deleted', 'deletedAt', 'password'],
    },
  });
  if (!customer) {
    return next(new AppError('There is no user with email address.', 404));
  }

  const OTP = otpGenerator.generate(4, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  EmailResetPasswordOtpToAll(OTP, customer, 'forgot-password');

  customer.latestOtp = OTP;
  await customer.save();

  res.status(200).json({
    status: 'success',
    data: customer,
    message: 'OTP sent to email!',
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token

  const customer = await user.findOne({
    where: { id: req.body?.userId },
    include: {
      model: address,
      attributes: { exclude: ['userId', 'updatedAt', 'deleted', 'deletedAt'] },
    },
    attributes: { exclude: ['updatedAt', 'deleted', 'deletedAt', ''] },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!customer) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  customer.password = req.body.password;
  await customer.save();

  customer.password = undefined;
  createSendToken(customer, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get customer from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});
