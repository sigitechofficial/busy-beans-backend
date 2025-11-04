require('dotenv').config(); // This will load variables from .env file into process.env

const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/user');
const Address = require('../models/address');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { response } = require('../../utils/response');
const account = require('../models/account');

const signToken = (userId) =>
  jwt.sign({ id: userId || 1 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '365d',
  });

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user.id);

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN || 1 * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // Validation check for password confirmation
  if (req.body?.password !== req.body?.passwordConfirm) {
    return next(new AppError('Passwords do not match!', 400));
  }

  // Create a new user
  const newUser = await User.create(req.body);

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  const user = await account.findOne({ where: { email } });

  const isMatch = password == user.password;
  if (!user || !isMatch) {
    return next(new AppError('Incorrect email or password', 401));
  }

  createSendToken(user, 200, req, res);
});

exports.protect = catchAsync(async (req, res, next) => {
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

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findByPk(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }

  if (
    currentUser.changedPasswordAt &&
    currentUser.changedPasswordAt > decoded.iat * 1000
  ) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// exports.forgotPassword = catchAsync(async (req, res, next) => {
//   // const user = await User.findOne({ where: { email: req.body.email } });
//   if (!user) {
//     return next(new AppError('There is no user with that email address.', 404));
//   }

//   const resetToken = user.createPasswordResetToken();
//   await user.save({ validateBeforeSave: false });

//   const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
//   try {
//     await new Email(user, resetURL).sendPasswordReset();
//     res.status(200).json({
//       status: 'success',
//       message: 'Token sent to email!',
//     });
//   } catch (err) {
//     user.passwordResetToken = undefined;
//     user.passwordResetExpires = undefined;
//     await user.save({ validateBeforeSave: false });
//     return next(
//       new AppError(
//         'There was an error sending the email. Try again later!',
//         500,
//       ),
//     );
//   }
// });

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { [Op.gt]: Date.now() },
    },
  });

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.user.id);

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  createSendToken(user, 200, req, res);
});
