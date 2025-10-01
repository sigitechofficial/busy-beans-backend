require('dotenv').config();
const { user, account, supplier, salesRep, employee } = require('../models');
const AppError = require('../utils/appError');
const Redis = require('../utils/redisHandling');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const catchAsync = require('./../utils/catchAsync');

const MODEL = {
  user: user,
  admin: account,
  supplier: supplier,
  localPartner: salesRep,
  adminEmployee: employee,
  partnerEmployee: employee,
};

exports.protect = catchAsync(async (req, res, next) => {
  let token;
 

  // 1) Get token from Authorization header or cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    console.log('🚀 ~ PROTECT MIDDLEWARE authorization Bearer Token:');

    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    console.log('🚀 ~ PROTECT MIDDLEWARE cookies:');
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError(
        'You are not logged in! Please log in to get access.',
        401,
        'authentication-fail',
      ),
    );
  }
  // 2) Verify JWT
   console.log('🚀 ~ protect >>>>>>:',token);
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    console.log('🚀 ~promisify(jwt.verify) decoded:', decoded);
  } catch (err) {
    return next(
      new AppError('Invalid or expired token.', 401, 'authentication-fail'),
    );
  }
  // console.log('🚀 ~ PROTECT MIDDLEWARE decoded:', decoded);
  // 3) Check if token is still valid in Redis
  let redisUserId = await Redis.getUserIdFromToken(token);
  // console.log('🚀 ~ PROTECT MIDDLEWARE FROM REDIS USER ID :', redisUserId);
  // console.log('🚀 ~ decoded.entity:', decoded);
  if (`${decoded?.entity}${decoded?.id}` == redisUserId)
    redisUserId = decoded.id;
  // console.log('🚀 ~ redisUserId: FINAL ', redisUserId);
  // console.log('🚀 ~ decoded?.id: FINAL ', decoded?.id);
  const allowedEntities = Object.keys(MODEL);

  if (
    !redisUserId ||
    redisUserId !== decoded.id ||
    !decoded?.entity ||
    !allowedEntities.includes(decoded?.entity)
  ) {
    return next(
      new AppError(
        'Session expired or token revoked.',
        401,
        'authentication-fail',
      ),
    );
  }
  // console.log('🚀 ~ AUTH PASS NOW GET USER FROM DB ', decoded?.id);

  // 4) Check if user still exists
  let currentUser = await MODEL[`${decoded.entity}`].findOne({
    where: { id: decoded?.id, email: decoded.email, deleted: 0 },
  });

  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token no longer exists.',
        401,
        'authentication-fail',
      ),
    );
  } else if (!currentUser.status) {
    return next(
      new AppError(
        'User blocked by administrator.',
        401,
        'authentication-fail',
      ),
    );
  }

  currentUser = JSON.parse(JSON.stringify(currentUser));

  // 5) Grant access and attach token + user to request
  req.user = currentUser;
  req.user.accessToken = token; // used in logout
  // req.user.accessToken = token;
  req.user.dvToken = decoded?.dvToken;
  req.user.entity = decoded?.entity;
  res.locals.user = currentUser;
  next();
});

exports.restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.entity)) {
      return res.status(200).json({
        status: 'fail',
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};
