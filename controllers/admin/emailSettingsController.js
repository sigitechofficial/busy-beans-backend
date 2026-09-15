const { Op } = require("sequelize");
const {
  emailSetting,
  user,
  salesRep,
  supplier,
  employee,
  subAdmin,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const {
  TYPE_DEFAULT_RECIPIENT_ID,
  RECIPIENT_TYPES,
  getCatalog,
  getEmailsForType,
  isLockedEmailType,
  isKnownEmailType,
} = require("../../utils/emailCatalog");
const { invalidateEmailSettingsCache } = require("../../utils/emailSendGate");

const PEOPLE_MODELS = {
  customer: {
    model: user,
    nameField: "name",
    extraAttributes: ["companyName"],
  },
  partner: {
    model: salesRep,
    nameField: "srName",
    extraAttributes: [],
  },
  supplier: {
    model: supplier,
    nameField: "supplierName",
    extraAttributes: ["isDefaultSupplier"],
  },
  employee: {
    model: employee,
    nameField: "name",
    extraAttributes: ["employeeOf"],
  },
  subAdmin: {
    model: subAdmin,
    nameField: "name",
    extraAttributes: [],
  },
};

function parseEnabled(value) {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  return undefined;
}

function effectiveEnabled(typeDefault, personOverride) {
  if (personOverride === true || personOverride === false) return personOverride;
  if (typeDefault === true || typeDefault === false) return typeDefault;
  return true;
}

exports.getCatalog = catchAsync(async (req, res) => {
  res.status(200).json({
    status: "success",
    data: getCatalog(),
  });
});

exports.getSettings = catchAsync(async (req, res, next) => {
  const recipientType = req.query.type || "customer";
  if (!RECIPIENT_TYPES.includes(recipientType)) {
    return next(new AppError("Invalid recipient type.", 400));
  }

  const emails = getEmailsForType(recipientType);
  const emailKeys = emails.map((item) => item.key);
  const search = (req.query.search || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const settingRows = await emailSetting.findAll({
    where: { recipientType, emailType: { [Op.in]: emailKeys } },
    raw: true,
  });

  const typeDefaults = {};
  emails.forEach((item) => {
    typeDefaults[item.key] = true;
  });
  settingRows
    .filter((row) => Number(row.recipientId) === TYPE_DEFAULT_RECIPIENT_ID)
    .forEach((row) => {
      typeDefaults[row.emailType] =
        row.enabled === true || row.enabled === 1 || row.enabled === "1";
    });

  const peopleConfig = PEOPLE_MODELS[recipientType];
  let recipients = [];
  let total = 0;
  let defaultSupplierId = null;

  if (peopleConfig) {
    const where = { deleted: { [Op.ne]: true } };
    if (search) {
      where[Op.or] = [
        { [peopleConfig.nameField]: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    const attributes = [
      "id",
      peopleConfig.nameField,
      "email",
      ...peopleConfig.extraAttributes,
    ];
    const { rows, count } = await peopleConfig.model.findAndCountAll({
      where,
      attributes,
      order: [[peopleConfig.nameField, "ASC"]],
      limit,
      offset,
    });
    total = count;
    const overridesByPerson = new Map();
    settingRows
      .filter((row) => Number(row.recipientId) > 0)
      .forEach((row) => {
        const id = Number(row.recipientId);
        if (!overridesByPerson.has(id)) overridesByPerson.set(id, {});
        overridesByPerson.get(id)[row.emailType] =
          row.enabled === true || row.enabled === 1 || row.enabled === "1";
      });

    recipients = rows.map((row) => {
      const json = row.toJSON ? row.toJSON() : row;
      const overrides = overridesByPerson.get(json.id) || {};
      const settings = {};
      emails.forEach((item) => {
        settings[item.key] = effectiveEnabled(
          typeDefaults[item.key],
          overrides[item.key],
        );
      });
      return {
        id: json.id,
        name: json[peopleConfig.nameField],
        email: json.email,
        companyName: json.companyName || null,
        employeeOf: json.employeeOf || null,
        isDefaultSupplier: Boolean(json.isDefaultSupplier),
        settings,
      };
    });

    if (recipientType === "supplier") {
      const def = await supplier.findOne({
        where: { isDefaultSupplier: true, deleted: { [Op.ne]: true } },
        attributes: ["id"],
      });
      defaultSupplierId = def?.id || null;
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      recipientType,
      emails,
      typeDefaults,
      recipients,
      defaultSupplierId,
      pagination: {
        page,
        limit,
        total,
      },
    },
  });
});

exports.updateSetting = catchAsync(async (req, res, next) => {
  const recipientType = req.body?.recipientType;
  const emailType = req.body?.emailType;
  const enabled = parseEnabled(req.body?.enabled);
  const rawId = req.body?.recipientId;
  const recipientId =
    rawId === null || rawId === undefined || rawId === ""
      ? TYPE_DEFAULT_RECIPIENT_ID
      : Number(rawId);

  if (!RECIPIENT_TYPES.includes(recipientType)) {
    return next(new AppError("Invalid recipient type.", 400));
  }
  if (!isKnownEmailType(recipientType, emailType)) {
    return next(new AppError("Invalid email type for this recipient.", 400));
  }
  if (enabled === undefined) {
    return next(new AppError("enabled must be true or false.", 400));
  }
  if (!Number.isFinite(recipientId) || recipientId < 0) {
    return next(new AppError("Invalid recipient id.", 400));
  }
  if (isLockedEmailType(emailType) && enabled === false) {
    return next(new AppError("Auth emails cannot be turned off.", 400));
  }

  const existing = await emailSetting.findOne({
    where: { recipientType, recipientId, emailType },
  });
  if (existing) {
    existing.enabled = enabled;
    await existing.save();
  } else {
    await emailSetting.create({
      recipientType,
      recipientId,
      emailType,
      enabled,
    });
  }
  invalidateEmailSettingsCache();

  res.status(200).json({
    status: "success",
    data: { recipientType, recipientId, emailType, enabled },
  });
});

exports.setDefaultSupplier = catchAsync(async (req, res, next) => {
  const supplierId = Number(req.body?.supplierId);
  if (!supplierId) {
    return next(new AppError("supplierId is required.", 400));
  }
  const row = await supplier.findOne({
    where: { id: supplierId, deleted: { [Op.ne]: true } },
  });
  if (!row) {
    return next(new AppError("Supplier not found.", 404));
  }

  await supplier.update({ isDefaultSupplier: false }, { where: {} });
  await supplier.update(
    { isDefaultSupplier: true },
    { where: { id: supplierId } },
  );

  res.status(200).json({
    status: "success",
    data: { defaultSupplierId: supplierId },
  });
});
