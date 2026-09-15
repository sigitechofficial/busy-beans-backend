const {
  subAdmin,
  account,
  salesRep,
  supplier,
  employee,
  permission,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const {
  hasPermissionKey,
  SCOPED_FEATURES,
  FEATURE_ACTIONS,
} = require("../../utils/hqOperator");
const REDIS = require("../../utils/redisHandling");

const revokeSubAdminSessions = (id) =>
  REDIS.revokeAllTokensForUser(`subAdmin${id}`);

const failPermission = (next) =>
  next(
    new AppError(
      "You do not have permission to perform this action",
      403,
      "permission-fail",
    ),
  );

const assertSubAdminMutator = (req, next, action) => {
  if (req.user?.entity === "admin") return true;
  if (req.user?.entity === "subAdmin") {
    if (!hasPermissionKey(req, `sub-admins_${action}`)) {
      failPermission(next);
      return false;
    }
    return true;
  }
  failPermission(next);
  return false;
};

const emailTaken = async (email, excludeId) => {
  if (!email) return false;
  const whereEmail = { email };
  const [inAccounts, inReps, inSuppliers, inEmployees, inSubAdmins] =
    await Promise.all([
      account.findOne({ where: whereEmail }),
      salesRep.findOne({ where: whereEmail }),
      supplier.findOne({ where: whereEmail }),
      employee.findOne({ where: { email, deleted: 0 } }),
      subAdmin.findOne({
        where: excludeId
          ? { email, deleted: 0, id: { [Op.ne]: excludeId } }
          : { email, deleted: 0 },
      }),
    ]);
  return Boolean(
    inAccounts || inReps || inSuppliers || inEmployees || inSubAdmins,
  );
};

const featuresToRows = (features, subAdminId) => {
  if (!features || features.length === 0) return [];
  return features.flatMap((f) => {
    const entries = { ...f };
    const feature = entries.feature;
    if (SCOPED_FEATURES.includes(feature)) {
      const hasAction = FEATURE_ACTIONS.some((action) => entries[action] === true);
      const hasScope =
        entries.scope_customer === true || entries.scope_partner === true;
      if (hasAction && !hasScope) {
        entries.scope_customer = true;
        entries.scope_partner = true;
      }
    }
    return Object.entries(entries)
      .filter(([key, value]) => key !== "feature" && value === true)
      .map(([key]) => ({
        key: `${feature}_${key}`,
        subAdminId,
      }));
  });
};

exports.createSubAdmin = catchAsync(async (req, res, next) => {
  if (!assertSubAdminMutator(req, next, "create")) return;

  if (await emailTaken(req.body?.email)) {
    return next(new AppError("User with this email already exists.", 400));
  }

  const created = await subAdmin.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    phoneNumber: req.body.phoneNumber,
    countryCode: req.body.countryCode,
    status: req.body.status !== undefined ? req.body.status : true,
  });

  const rows = featuresToRows(req.body.features, created.id);
  if (rows.length > 0) await permission.bulkCreate(rows);

  res.status(201).json({ status: "success", data: created });
});

exports.getAllSubAdmins = catchAsync(async (req, res, next) => {
  if (!assertSubAdminMutator(req, next, "view")) return;

  const rows = await subAdmin.findAll({
    where: { deleted: 0 },
    attributes: { exclude: ["password"] },
    order: [["id", "DESC"]],
  });
  res.status(200).json({ status: "success", data: { data: rows } });
});

exports.getSubAdmin = catchAsync(async (req, res, next) => {
  if (!assertSubAdminMutator(req, next, "view")) return;

  const row = await subAdmin.findByPk(req.params.id, {
    attributes: { exclude: ["password"] },
    include: { model: permission, attributes: ["id", "key"] },
  });
  if (!row) {
    return res.status(404).json({ status: "fail", message: "Sub-admin not found" });
  }
  res.status(200).json({ status: "success", data: row });
});

exports.updateSubAdmin = catchAsync(async (req, res, next) => {
  if (!assertSubAdminMutator(req, next, "update")) return;

  const { id } = req.params;
  const existing = await subAdmin.findByPk(id);
  if (!existing) {
    return next(new AppError("Sub-admin not found", 404));
  }

  if (req.body?.email && (await emailTaken(req.body.email, Number(id)))) {
    return next(new AppError("User with this email already exists.", 400));
  }

  const updateData = { ...req.body };
  delete updateData.features;
  delete updateData.id;
  if (updateData.password) {
    updateData.password = bcrypt.hashSync(updateData.password, 12);
  }

  await subAdmin.update(updateData, { where: { id } });

  if (req.body.features) {
    await permission.destroy({ where: { subAdminId: id } });
    const rows = featuresToRows(req.body.features, id);
    if (rows.length > 0) await permission.bulkCreate(rows);
  }

  await revokeSubAdminSessions(id);

  res.status(200).json({ status: "success", data: {} });
});

const SELF_PROFILE_EXCLUDE = [
  "password",
  "verificationOtp",
  "verificationOtpExpiresAt",
];

exports.getMyProfile = catchAsync(async (req, res, next) => {
  if (req.user?.entity !== "subAdmin") {
    return next(new AppError("Only sub-admins can access this profile.", 403));
  }

  const row = await subAdmin.findByPk(req.user.id, {
    attributes: { exclude: SELF_PROFILE_EXCLUDE },
  });
  if (!row) {
    return next(new AppError("Sub-admin not found", 404));
  }

  res.status(200).json({ status: "success", data: row });
});

const SELF_PROFILE_PASSWORD_FIELDS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "passwordConfirm",
]);

const SELF_PROFILE_IDENTITY_FIELDS = [
  "name",
  "email",
  "phoneNumber",
  "phone",
  "countryCode",
  "status",
  "deleted",
  "features",
  "id",
  "verificationRequired",
  "verificationContext",
  "verificationOtp",
  "verificationOtpExpiresAt",
  "loginVerificationDone",
];

exports.updateMyProfile = catchAsync(async (req, res, next) => {
  if (req.user?.entity !== "subAdmin") {
    return next(new AppError("Only sub-admins can update this profile.", 403));
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const identitySent = SELF_PROFILE_IDENTITY_FIELDS.filter(
    (key) => body[key] !== undefined,
  );
  if (identitySent.length > 0) {
    return next(
      new AppError(
        `Identity fields cannot be changed on self-profile. Remove: ${identitySent.join(", ")}. Only password can be updated.`,
        400,
      ),
    );
  }

  const unexpected = Object.keys(body).filter(
    (key) => !SELF_PROFILE_PASSWORD_FIELDS.has(key),
  );
  if (unexpected.length > 0) {
    return next(
      new AppError(
        `Only password can be updated. Unexpected fields: ${unexpected.join(", ")}.`,
        400,
      ),
    );
  }

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.password || body.newPassword || "");
  const passwordConfirm =
    body.passwordConfirm !== undefined ? String(body.passwordConfirm) : null;

  if (!currentPassword) {
    return next(new AppError("Current password is required", 400));
  }
  if (!newPassword) {
    return next(new AppError("New password is required", 400));
  }
  if (newPassword.length < 6) {
    return next(new AppError("Password must be at least 6 characters", 400));
  }
  if (passwordConfirm !== null && passwordConfirm !== newPassword) {
    return next(new AppError("Password and confirm password do not match", 400));
  }
  if (currentPassword === newPassword) {
    return next(
      new AppError("New password must differ from current password", 400),
    );
  }

  const existing = await subAdmin.findByPk(req.user.id);
  if (!existing) {
    return next(new AppError("Sub-admin not found", 404));
  }

  const matches = await bcrypt.compare(currentPassword, existing.password);
  if (!matches) {
    return next(new AppError("Current password is incorrect", 401));
  }

  existing.password = newPassword;
  await existing.save();

  const row = existing.toJSON();
  delete row.password;
  delete row.verificationOtp;
  delete row.verificationOtpExpiresAt;

  res.status(200).json({ status: "success", data: row });
});

exports.deleteSubAdmin = catchAsync(async (req, res, next) => {
  if (!assertSubAdminMutator(req, next, "delete")) return;

  const { id } = req.params;
  if (String(req.user.id) === String(id) && req.user.entity === "subAdmin") {
    return next(
      new AppError("You cannot delete your own sub-admin account.", 400),
    );
  }

  const row = await subAdmin.findByPk(id);
  if (!row) {
    return next(new AppError("Sub-admin not found", 404));
  }

  await permission.destroy({ where: { subAdminId: id } });
  await row.update({ deleted: true, status: false });
  await row.destroy();
  await revokeSubAdminSessions(id);

  res.status(200).json({ status: "success", data: {} });
});
