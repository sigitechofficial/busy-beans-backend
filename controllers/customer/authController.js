require('dotenv').config();

const crypto = require('crypto');
const { promisify } = require('util');
const REDIS = require('../../utils/redisHandling');
const jwt = require('jsonwebtoken');
// const { Op, literal, col, fn, where } = require('sequelize');
const {
  user,
  address,
  salesRep,
  stateInSystem,
  billingAddress,
  deviceToken,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const Email = require('../../utils/email');
const otpGenerator = require('otp-generator');
const EmailResetPasswordOtpToAll = require('../../helper/ResetPasswordOtpToAll');
const Event = require('../events/userAccountRelatedEvents');
const { response } = require('../../utils/response');
const bcrypt = require('bcryptjs');
const Stripe = require('../stripe');

const signToken = (data) =>
  jwt.sign(
    data,
    process.env.JWT_SECRET, // Hardcoded JWT Secret
    {
      expiresIn: '7d',
    },
  );

const createSendToken = (input, statusCode, req, res, tokenId = '') => {
  console.log('ðŸš€ ~ createSendToken ~ input:', input);
  const token = signToken({
    id: input.id,
    name: input.name,
    email: input.email,
    dvToken: tokenId,
    entity: 'user',
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
  REDIS.storeAccessToken(`user${input.id}`, token);
  res.status(statusCode).json({
    status: 'success',
    data: {
      token,
      user: input,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  console.log('ðŸš€ ~ exports.signup=catchAsync ~  req.body:', req.body);

  const OTP = otpGenerator.generate(4, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  if (!req.body?.info?.registerBy || req.body?.info?.registerBy != 'email') {
    req.body.info.verifiedAt = Date.now();
  }

  const sr = await salesRep.findAll({
    where: { state: req.body?.address?.state },
  });

  if (sr && sr.length === 1) {
    req.body.info.salesRepId = sr[0]?.id;
  }
  console.log('ðŸš€ ~ exports.signup=catchAsync ~ sr:', sr?.id);
  req.body.info.latestOtp = OTP;
  const newUser = await user.create(req.body?.info);

  req.body.address.userId = newUser?.id;
  req.body.billingAddress.userId = newUser?.id;
  const defaultAddress = await address.create(req.body?.address);
  billingAddress.create(req.body?.billingAddress);
  console.log(
    'ðŸš€ ~ exports.signup=catchsasdsadasdasdasdsdAsync ~ req.body?.address:',
    defaultAddress,
  );

  const stripeCustomerId = await Stripe.addCustomer({
    email: newUser?.email,
    name: newUser?.name,
  });
  newUser.stripeCustomerId = stripeCustomerId;
  await newUser.save();
  const input = JSON.parse(JSON.stringify(newUser));
  input.address = defaultAddress;
  if (!req.body?.info?.registerBy || req.body?.info?.registerBy == 'email') {
    Event.otpToUsersEvent({
      email: newUser?.email,
      name: newUser.name,
      otp: OTP,
    });
    return res.status(200).json(
      response({
        message: 'OTP sent to your email!',
        data: {
          message: 'OTP sent to your email!',
          data: {
            id: input?.id,
            email: input?.email,
            email: newUser?.password,
          },
        },
      }),
    );
  }

  Event.userAccountCreatedEvent({ email: newUser?.email, name: newUser?.name });
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
    where: { email, deleted: 0 },
  });
  //   console.log('Ã°Å¸Å¡â‚¬ ~ exports.login=catchAsync ~ customer:', customer);
  if (!customer) {
    return next(new AppError('User Not found!', 200));
  } else if (!customer.status) {
    return next(new AppError('User Blocked by Administrator!', 200));
  }
  console.log('Ã°Å¸Å¡â‚¬ ~ exports.login=catchAsync ~ password:', password);
  console.log(
    'Ã°Å¸Å¡â‚¬ ~ exports.login=catchAsync ~ customer?.password:',
    customer?.password,
  );
  //   const isMatch = password == customer?.password;
  const isMatch = await bcrypt.compare(password, customer?.password); // password == customer?.password;
  console.log(
    'Ã°Å¸Å¡â‚¬ ~ exports.login=catchAsync ~ isMatch?.isMatch:',
    isMatch,
  );
  if (!user || !isMatch) {
    return next(new AppError('Incorrect email or password', 401));
  }

  if (!customer.verifiedAt) {
    const OTP = otpGenerator.generate(4, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    customer.latestOtp = OTP;
    await customer.save();
    Event.otpToUsersEvent({
      email: customer?.email,
      name: customer.name,
      otp: OTP,
    });
    return res.status(200).json(
      response({
        status: 'verification-required',
        message: 'OTP sent to your email!',
        data: {
          id: customer?.id,
          email: customer?.email,
        },
      }),
    );
  }

  if (req.body?.tokenId)
    deviceToken.create({ tokenId: req.body?.tokenId, userId: customer.id });
  const customerAddress = await address.findOne({
    where: { userId: customer?.id },
    attributes: {
      exclude: [`deleted`, `updatedAt`, `deletedAt`],
    },
  });

  const input = JSON.parse(JSON.stringify(customer));
  input.address = customerAddress;
  // 3) If everything ok, send token to client

  createSendToken(input, 200, req, res, req.body?.tokenId);
});

exports.stripeAchPayment = catchAsync(async (req, res, next) => {
  const result = await user.findOne({
    where: { id: req.params?.id },
    attributes: ['stripeCustomerId'],
  });
  if (!result) return next(new AppError('User not Found', 200));
  const data = await Stripe.financialConnectionsSession({
    customerId: result?.stripeCustomerId,
  });
  return res.status(200).json(
    response({
      data: {
        message: 'Success',
        data: data,
      },
    }),
  );
});

exports.otpVerification = catchAsync(async (req, res, next) => {
  const { otp, id, on } = req.body;

  // 2) Check if user exists && password is correct
  const customer = await user.findOne({
    where: { id },
    include: {
      model: address,
      attributes: {
        exclude: [`deleted`, `updatedAt`, `deletedAt`],
      },
    },
    attributes: {
      exclude: [`deleted`, `updatedAt`, `deletedAt`],
    },
  });
  console.log('ðŸš€ ~ exports.login=catchAsync ~ customer:', customer);

  if (!customer) {
    return next(new AppError('User not found', 200));
  }

  if (customer.latestOtp == otp && on == 'signup') {
    const data = JSON.parse(JSON.stringify(customer));
    data.addresses = undefined;
    data.address = customer?.addresses[0];
    createSendToken(data, 200, req, res);
    customer.verifiedAt = Date.now();
    await customer.save();
    Event.userAccountApproveEvent({
      email: customer?.email,
      name: customer.name,
    });
  } else if (customer.latestOtp == otp) {
    customer.verifiedAt = Date.now(); //HAVE TO CHANGE
    await customer.save();
    return res.status(200).json(
      response({
        data: {
          message: 'Success',
          data: { userId: id },
        },
      }),
    );
  }

  return next(new AppError('Invalid OTP', 200));
});

// exports.logout = (req, res) => {
//   res.cookie('jwt', 'loggedout', {
//     expires: new Date(Date.now() + 10 * 1000),
//     httpOnly: true,
//   });
//   res.status(200).json({ status: 'success' });
// };

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
      exclude: ['updatedAt', 'deleted', 'deletedAt', 'password'],
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

  customer.latestOtp = OTP;
  await customer.save();

  Event.otpToUsersForgotPasswordEvent({
    email: customer?.email,
    otp: OTP,
    name: customer?.name,
  });

  res.status(200).json({
    status: 'success',
    data: customer,
    message: 'OTP sent to email!',
  });
});

exports.resendOtp = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const customer = await user.findOne({
    where: { email: req.body.email },
    attributes: {
      exclude: ['updatedAt', 'deleted', 'deletedAt', 'password', 'latestOtp'],
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

  await user.update({ latestOtp: OTP }, { where: { id: customer?.id } });

  if (req.params.type == 'signup') {
    Event.otpToUsersEvent({
      email: customer?.email,
      name: customer.name,
      otp: OTP,
    });
  } else {
    Event.otpToUsersForgotPasswordEvent({
      email: customer?.email,
      otp: OTP,
      name: customer?.name,
    });
  }
  res.status(200).json({
    status: 'success',
    data: { id: customer?.id, email: customer.email },
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
  const user = await user.findById(req.user.id).select('+password');

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

exports.logout = catchAsync(async (req, res, next) => {
  // 1) Get customer from collection
  await deviceToken.destroy({
    where: {
      tokenId: req.user?.dvToken || '',
      userId: req.user?.id,
    },
  });

  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  // 3) If so, update password
  REDIS.revokeSingleToken(`user${req.user?.id}`, req.user.accessToken);

  return res.status(200).json(
    response({
      data: {
        message: 'Logout',
        data: {},
      },
    }),
  );
});
