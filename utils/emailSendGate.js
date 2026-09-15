const { emailSetting, user } = require("../models");
const { logEmailOutcome } = require("./emailLogOnSuccess");
const {
  TYPE_DEFAULT_RECIPIENT_ID,
  isLockedEmailType,
  isKnownEmailType,
} = require("./emailCatalog");

const CACHE_TTL_MS = 15000;
let cache = { loadedAt: 0, rows: [] };

function settingKey(recipientType, recipientId, emailType) {
  return `${recipientType}:${Number(recipientId) || 0}:${emailType}`;
}

async function loadSettings(force = false) {
  const now = Date.now();
  if (!force && cache.rows && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  const rows = await emailSetting.findAll({ raw: true });
  cache = { loadedAt: now, rows };
  return rows;
}

function invalidateEmailSettingsCache() {
  cache = { loadedAt: 0, rows: [] };
}

async function canSendEmail({ recipientType, recipientId, emailType }) {
  try {
    if (!emailType) return true;
    if (isLockedEmailType(emailType)) return true;
    if (!recipientType || !isKnownEmailType(recipientType, emailType)) {
      return true;
    }

    const numericId = Number(recipientId);
    const personId =
      Number.isFinite(numericId) && numericId > 0
        ? numericId
        : TYPE_DEFAULT_RECIPIENT_ID;

    const rows = await loadSettings();
    const map = new Map(
      rows.map((row) => [
        settingKey(row.recipientType, row.recipientId, row.emailType),
        row.enabled === true || row.enabled === 1 || row.enabled === "1",
      ]),
    );

    if (personId !== TYPE_DEFAULT_RECIPIENT_ID) {
      const personKey = settingKey(recipientType, personId, emailType);
      if (map.has(personKey)) return map.get(personKey);
    }

    const typeKey = settingKey(
      recipientType,
      TYPE_DEFAULT_RECIPIENT_ID,
      emailType,
    );
    if (map.has(typeKey)) return map.get(typeKey);
    return true;
  } catch (err) {
    console.error("[emailSendGate] fail-open:", err.message);
    return true;
  }
}

async function logEmailSkipped({
  emailType,
  orderId,
  orderType = "customer",
  recipients,
  reason = "disabled_by_settings",
}) {
  await logEmailOutcome({
    emailType,
    orderId,
    orderType,
    recipients,
    emailSent: "Skipped",
    errorMessage: reason,
  });
}

function orderPerson(details, orderType) {
  if (orderType === "local-partner") {
    return {
      recipientType: "partner",
      recipientId: details?.salesRepId,
    };
  }
  return {
    recipientType: "customer",
    recipientId: details?.userId,
  };
}

function supplierPerson(details) {
  return {
    recipientType: "supplier",
    recipientId: details?.supplierId,
  };
}

function partnerOrHq(details) {
  if (details?.salesRepId) {
    return {
      recipientType: "partner",
      recipientId: details.salesRepId,
    };
  }
  return {
    recipientType: "hq",
    recipientId: TYPE_DEFAULT_RECIPIENT_ID,
  };
}

function hqPerson() {
  return {
    recipientType: "hq",
    recipientId: TYPE_DEFAULT_RECIPIENT_ID,
  };
}

function leadPerson() {
  return {
    recipientType: "lead",
    recipientId: TYPE_DEFAULT_RECIPIENT_ID,
  };
}

async function sendIfAllowed({
  recipientType,
  recipientId,
  emailType,
  orderId,
  orderType = "customer",
  recipients,
  send,
}) {
  const allowed = await canSendEmail({
    recipientType,
    recipientId,
    emailType,
  });
  if (!allowed) {
    await logEmailSkipped({
      emailType,
      orderId,
      orderType,
      recipients,
    });
    return false;
  }
  await send();
  return true;
}

async function lookupUserIdByEmail(email) {
  if (!email) return null;
  const row = await user.findOne({
    where: { email, deleted: 0 },
    attributes: ["id"],
  });
  return row?.id || null;
}

module.exports = {
  canSendEmail,
  logEmailSkipped,
  invalidateEmailSettingsCache,
  orderPerson,
  supplierPerson,
  partnerOrHq,
  hqPerson,
  leadPerson,
  sendIfAllowed,
  lookupUserIdByEmail,
};
