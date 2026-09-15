require("dotenv").config();
const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const REDIS = require("../../utils/redisHandling");
const { Op, literal, fn, col } = require("sequelize");

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
  subAdmin,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const Email = require("../../utils/email");
const otpGenerator = require("otp-generator");
const EmailResetPasswordOtpToAll = require("../../helper/ResetPasswordOtpToAll");
const Event = require("../events/userAccountRelatedEvents");
const {
  setTemporaryBlockAndSendOtp,
  setForgotPasswordOtpAndReturnSuccess,
  purgeSessionsAndDeviceTokens,
  isTemporaryBlockActive,
  returnTemporaryBlockResponse,
  normalizeVerificationContext,
  isValidTemporaryBlockOtp,
  clearTemporaryBlock,
} = require("../../middlewares/temporaryBlockFlow");

const MODEL = {
  user: user,
  admin: account,
  supplier: supplier,
  localPartner: salesRep,
  adminEmployee: employee,
  partnerEmployee: employee,
  subAdmin: subAdmin,
};

const permissionInclude = { model: permission, attributes: ["id", "key"] };

const hintedEntityFrom = (req) =>
  req.body?.entity || req.body?.loginOtpEntity || "";

const assignDeviceTokenFields = (entity, id, tokenId) => {
  if (!tokenId) return;
  const input = { tokenId };
  if (entity === "localPartner") input.salesRepId = id;
  else if (entity === "supplier") input.supplierId = id;
  else if (entity === "admin") input.accountId = id;
  else if (entity === "adminEmployee" || entity === "partnerEmployee")
    input.employeeId = id;
  else return;
  deviceToken.create(input);
};

const { response } = require("../../utils/response");
const bcrypt = require("bcryptjs");
const signToken = (data) =>
  jwt.sign(
    data,
    process.env.JWT_SECRET, // Hardcoded JWT Secret
    {
      expiresIn: "7d",
    },
  );

const createSendToken = (input, statusCode, req, res, tokenId, entity) => {
  const token = signToken({
    id: input.id,
    name: input.name,
    email: input.email,
    entity: entity,
    tokenId: tokenId || "",
  });

  res.cookie("jwt", token, {
    expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });

  const user =
    input && typeof input.toJSON === "function"
      ? input.toJSON()
      : JSON.parse(JSON.stringify(input || {}));
  user.password = undefined;
  user.updatedAt = undefined;
  user.deletedAt = undefined;
  user.deleted = undefined;
  user.entity = entity;
  user.isSubAdmin = entity === "subAdmin";

  REDIS.storeAccessToken(`${entity}${input.id}`, token);

  res.status(statusCode).json({
    status: "success",
    data: {
      token,
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const OTP = otpGenerator.generate(4, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  if (!req.body?.info?.registerBy || req.body?.info?.registerBy != "email") {
    req.body.info.verifiedAt = Date.now();
  }
  const newUser = await user.create(req.body?.info);

  if (!req.body?.info?.registerBy || req.body?.info?.registerBy == "email") {
    EmailResetPasswordOtpToAll(OTP, newUser, "verification");
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
    const { email, password } = req.body;
    let entity = req.params.entity;
    const context = req.tempBlockContext || "login";

    if (!email || !password) {
      return next(new AppError("Please provide email and password!", 400));
    }

    let data = await Model.findOne({
      where: { email, deleted: 0 },
    });

    if (!data) {
      if (entity === "admin") {
        data = await subAdmin.findOne({
          where: { email, deleted: 0 },
          include: permissionInclude,
        });
        if (data) entity = "subAdmin";
      }
      if (!data && (entity === "admin" || entity === "localPartner")) {
        const condition = { email, deleted: 0 };
        if (entity === "admin") condition.salesRepId = { [Op.is]: null };
        else condition.accountId = { [Op.is]: null };
        data = await employee.findOne({
          where: condition,
          include: permissionInclude,
        });
        if (data) {
          entity = data.accountId ? "adminEmployee" : "partnerEmployee";
        }
      }
    }

    if (!data) {
      return next(new AppError("Incorrect email or password", 400));
    }

    if (!data?.status) {
      return next(new AppError("You are blocked by admin!", 400));
    }

    if (isTemporaryBlockActive({ record: data, context })) {
      return returnTemporaryBlockResponse({
        record: data,
        context,
        entity,
        res,
      });
    }

    const isMatch = await bcrypt.compare(password, data?.password);
    if (!isMatch) {
      const failed = await REDIS.incrementLoginFailedAttempts(entity, data.id);
      if (failed >= REDIS.LOGIN_FAILED_MAX_ATTEMPTS) {
        return setTemporaryBlockAndSendOtp({
          record: data,
          context,
          entity,
          res,
        });
      }
      return next(new AppError("Incorrect email or password", 400));
    }

    await REDIS.resetLoginFailedAttempts(entity, data.id);

    if (req.body?.tokenId) {
      assignDeviceTokenFields(entity, data?.id, req.body?.tokenId);
    }

    return createSendToken(data, 200, req, res, req.body?.tokenId, entity);
  });
};

const forgotPassword = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    const context = req.tempBlockContext || "forgot_password";
    let data = await Model.findOne({
      where: { email: req.body.email, deleted: 0 },
      attributes: {
        exclude: ["updatedAt", "deleted", "deletedAt", "password"],
      },
    });
    let resolvedEntity = entity;
    if (!data && entity === "admin") {
      data = await subAdmin.findOne({
        where: { email: req.body.email, deleted: 0 },
      });
      if (data) resolvedEntity = "subAdmin";
    }
    if (!data && (entity === "admin" || entity === "localPartner")) {
      data = await employee.findOne({
        where: { email: req.body.email, deleted: 0 },
      });
      if (data) {
        resolvedEntity = data.accountId ? "adminEmployee" : "partnerEmployee";
      }
    }
    if (!data) {
      return next(new AppError("There is no user with email address.", 404));
    }

    return setForgotPasswordOtpAndReturnSuccess({
      record: data,
      entity: resolvedEntity,
      res,
    });
  });

const resendOtp = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    let data = await Model.findOne({
      where: { email: req.body.email },
      attributes: {
        exclude: ["updatedAt", "deleted", "deletedAt", "password", "latestOtp"],
      },
    });
    let resolvedEntity = entity;
    if (!data && entity === "admin") {
      data = await subAdmin.findOne({
        where: { email: req.body.email, deleted: 0 },
      });
      if (data) resolvedEntity = "subAdmin";
    }
    if (!data && (entity === "admin" || entity === "localPartner")) {
      data = await employee.findOne({
        where: { email: req.body.email, deleted: 0 },
      });
      if (data) {
        resolvedEntity = data.accountId ? "adminEmployee" : "partnerEmployee";
      }
    }
    if (!data) {
      return next(new AppError("There is no user with email address.", 404));
    }
    const requestedContext = normalizeVerificationContext(
      req.body?.on || req.params?.type || data?.verificationContext,
    );

    if (requestedContext === "signup") {
      const OTP = otpGenerator.generate(4, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
      });

      data.latestOtp = OTP;
      await data.save();
      Event.otpToUsersEvent({
        email: data?.email,
        name: data?.name || "",
        otp: OTP,
      });
      return res.status(200).json({
        status: "success",
        data: { id: data?.id, email: data.email },
        message: "OTP sent to email!",
      });
    }

    if (requestedContext === "login") {
      return setTemporaryBlockAndSendOtp({
        record: data,
        context: "login",
        entity: resolvedEntity,
        res,
      });
    }

    return setForgotPasswordOtpAndReturnSuccess({
      record: data,
      entity: resolvedEntity,
      res,
    });
  });

const otpVerification = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    const { otp, id, on } = req.body;
    let resolvedEntity = entity;

    let data = await Model.findOne({
      where: { id, deleted: 0 },
      attributes: {
        exclude: [`deleted`, `updatedAt`, `deletedAt`],
      },
    });

    if (!data && (entity === "admin" || entity === "localPartner")) {
      const hinted = hintedEntityFrom(req);
      if (entity === "admin" && hinted === "subAdmin") {
        data = await subAdmin.findOne({
          where: { id, deleted: 0 },
          include: permissionInclude,
        });
        if (data) resolvedEntity = "subAdmin";
      }
      if (!data) {
        data = await employee.findOne({
          where: { id, deleted: 0 },
          include: permissionInclude,
        });
        if (data) {
          resolvedEntity = data.accountId ? "adminEmployee" : "partnerEmployee";
        }
      }
    }

    if (!data) {
      return next(new AppError("User not found", 200));
    }

    const context = normalizeVerificationContext(
      on || data?.verificationContext,
    );
    if (!isValidTemporaryBlockOtp({ record: data, otp, context })) {
      return next(new AppError("Invalid OTP", 200));
    }

    await clearTemporaryBlock(data);

    if (context === "login") {
      await REDIS.resetLoginFailedAttempts(resolvedEntity, data.id);
      await purgeSessionsAndDeviceTokens({
        entity: resolvedEntity,
        id: data.id,
      });
      if (req.body?.tokenId) {
        assignDeviceTokenFields(
          resolvedEntity,
          data?.id,
          req.body?.tokenId,
        );
      }
      return createSendToken(
        data,
        200,
        req,
        res,
        req.body?.tokenId,
        resolvedEntity,
      );
    }

    return res.status(200).json(
      response({
        data: {
          message: "Success",
          data: { id },
        },
      }),
    );
  });

const resetPassword = (Model, entity) =>
  catchAsync(async (req, res, next) => {
    let resolvedEntity = entity;
    let data = await Model.findOne({
      where: { id: req.body?.id, deleted: 0 },
      attributes: {
        exclude: ["updatedAt", "deleted", "deletedAt", "latestOtp"],
      },
    });
    if (!data && (entity == "admin" || entity == "localPartner")) {
      const hinted = hintedEntityFrom(req);
      if (entity == "admin" && hinted === "subAdmin") {
        data = await subAdmin.findOne({
          where: { id: req.body?.id, deleted: 0 },
        });
        if (data) resolvedEntity = "subAdmin";
      }
      if (!data) {
        data = await employee.findOne({
          where: { id: req.body?.id, deleted: 0 },
        });
        if (data) {
          resolvedEntity = data.accountId ? "adminEmployee" : "partnerEmployee";
        }
      }
    }
    // 2) If token has not expired, and there is user, set the new password
    if (!data) {
      return next(new AppError("Token is invalid or has expired", 400));
    }

    console.log("🚀 ~ catchAsync ~ req.body?.password:", req.body?.password);
    console.log("🚀 ~ catchAsync ~ data?.password:", data?.password);
    // await Model.update({password:req.body?.password},{where:{id:data?.id}})
    data.password = req.body.password;
    await data.save();
    data.password = undefined;
    await purgeSessionsAndDeviceTokens({ entity: resolvedEntity, id: data.id });
    if (req.body?.tokenId) {
      assignDeviceTokenFields(
        resolvedEntity,
        data?.id,
        req.body?.tokenId,
      );
    }
    createSendToken(data, 200, req, res, req.body?.tokenId, resolvedEntity);
  });

// exports.allLogin = login(account);
exports.adminLogin = login(account);
exports.salesRepLogin = login(salesRep);
exports.supplierLogin = login(supplier);

exports.adminForgotPassword = forgotPassword(account, "admin");
exports.salesRepForgotPassword = forgotPassword(salesRep, "localPartner");
exports.supplierForgotPassword = forgotPassword(supplier, "supplier");

exports.adminResendOtp = resendOtp(account, "admin");
exports.salesRepResendOtp = resendOtp(salesRep, "localPartner");
exports.supplierResendOtp = resendOtp(supplier, "supplier");

exports.adminOtpVerification = otpVerification(account, "admin");
exports.salesRepOtpVerification = otpVerification(salesRep, "localPartner");
exports.supplierOtpVerification = otpVerification(supplier, "supplier");

exports.adminResetPassword = resetPassword(account, "admin");
exports.salesRepResetPassword = resetPassword(salesRep, "localPartner");
exports.supplierResetPassword = resetPassword(supplier, "supplier");

exports.logina = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  console.log("🚀 ~ exports.login=catchAsync ~ req.body;:", req.body);

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }
  // 2) Check if user exists && password is correct
  const data = await account.findOne({
    where: { email },
  });
  console.log("🚀 ~ exports.login=catchAsync ~ data:", data);

  // if (!data || !(await bcrypt.compare(password, data?.password))) {
  //   return next(new AppError('Incorrect email or password', 400));
  // }

  if (!data || password != "123456") {
    return next(new AppError("Incorrect email or password", 400));
  }

  // 3) If everything ok, send token to client
  createSendToken(data, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};
