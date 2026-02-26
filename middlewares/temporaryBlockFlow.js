const otpGenerator = require("otp-generator");
const Event = require("../controllers/events/userAccountRelatedEvents");
const REDIS = require("../utils/redisHandling");
const { deviceToken } = require("../models");

const TEMP_BLOCK_STATUS = "temporary-block";
const OTP_EXPIRES_IN_MS = 15 * 60 * 1000;

const setTemporaryBlockContext = (context) => (req, res, next) => {
  req.tempBlockContext = context;
  next();
};

function getDeviceTokenWhereByEntity(entity, id) {
  if (entity === "user") return { userId: id };
  if (entity === "admin") return { accountId: id };
  if (entity === "localPartner") return { salesRepId: id };
  if (entity === "supplier") return { supplierId: id };
  if (entity === "adminEmployee" || entity === "partnerEmployee")
    return { employeeId: id };
  return null;
}

async function purgeSessionsAndDeviceTokens({ entity, id }) {
  if (!entity || id === undefined || id === null) return;

  await REDIS.revokeAllTokensForUser(`${entity}${id}`);
  const tokenWhere = getDeviceTokenWhereByEntity(entity, id);
  if (tokenWhere) {
    await deviceToken.destroy({ where: tokenWhere });
  }
}

async function setTemporaryBlockAndSendOtp({ record, context, entity, res }) {
  const otp = otpGenerator.generate(4, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  record.verificationRequired = true;
  record.verificationContext = context;
  record.verificationOtp = Number(otp);
  record.verificationOtpExpiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MS);
  await record.save();

  if (context === "login") {
    // Security hardening: when account is temp-blocked, end all sessions/devices.
    await purgeSessionsAndDeviceTokens({ entity, id: record?.id });
  }

  if (context === "forgot_password") {
    Event.otpToUsersForgotPasswordEvent({
      email: record?.email,
      otp,
      name: record?.name || record?.srName || record?.supplierName || "",
    });
  } else {
    Event.otpToUsersEvent({
      email: record?.email,
      otp,
      name: record?.name || record?.srName || record?.supplierName || "",
    });
  }

  return res.status(200).json({
    status: TEMP_BLOCK_STATUS,
    message: "OTP sent to your email. Please verify to continue.",
    data: {
      id: record?.id,
      email: record?.email,
      entity,
      context,
    },
  });
}

async function setForgotPasswordOtpAndReturnSuccess({ record, entity, res }) {
  const context = "forgot_password";
  const otp = otpGenerator.generate(4, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  record.verificationRequired = true;
  record.verificationContext = context;
  record.verificationOtp = Number(otp);
  record.verificationOtpExpiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MS);
  await record.save();

  Event.otpToUsersForgotPasswordEvent({
    email: record?.email,
    otp,
    name: record?.name || record?.srName || record?.supplierName || "",
  });

  return res.status(200).json({
    status: "success",
    data: {
      id: record?.id,
      email: record?.email,
      entity,
      context,
    },
    message: "OTP sent to email!",
  });
}

function isTemporaryBlockActive({ record, context }) {
  if (!record?.verificationRequired) return false;
  if (record?.verificationContext !== context) return false;
  if (!record?.verificationOtpExpiresAt) return false;
  return new Date(record.verificationOtpExpiresAt).getTime() >= Date.now();
}

function returnTemporaryBlockResponse({ record, context, entity, res }) {
  return res.status(200).json({
    status: TEMP_BLOCK_STATUS,
    message: "OTP sent to your email. Please verify to continue.",
    data: {
      id: record?.id,
      email: record?.email,
      entity,
      context,
    },
  });
}

function normalizeVerificationContext(value) {
  if (!value) return value;
  const v = String(value).trim();
  if (v === "forgotPassword") return "forgot_password";
  return v;
}

function isValidTemporaryBlockOtp({ record, otp, context }) {
  if (!record?.verificationRequired) return false;
  if (record?.verificationContext !== context) return false;
  if (!record?.verificationOtpExpiresAt) return false;
  if (new Date(record.verificationOtpExpiresAt).getTime() < Date.now())
    return false;
  return String(record?.verificationOtp) === String(otp);
}

async function clearTemporaryBlock(record) {
  record.verificationRequired = false;
  record.verificationContext = null;
  record.verificationOtp = null;
  record.verificationOtpExpiresAt = null;
  await record.save();
}

module.exports = {
  TEMP_BLOCK_STATUS,
  setTemporaryBlockContext,
  setTemporaryBlockAndSendOtp,
  setForgotPasswordOtpAndReturnSuccess,
  purgeSessionsAndDeviceTokens,
  isTemporaryBlockActive,
  returnTemporaryBlockResponse,
  normalizeVerificationContext,
  isValidTemporaryBlockOtp,
  clearTemporaryBlock,
};
