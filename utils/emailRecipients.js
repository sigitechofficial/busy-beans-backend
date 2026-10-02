/**
 * Who receives lead / enquiry emails — set in the admin panel (Email Configuration → Recipients),
 * stored in email_recipient_settings (migration 20261002). Missing keys use the defaults below, which
 * match what the email helpers did before (developer copy on every lead / quotation / enquiry email).
 *
 *   developerCopyEmail / developerCopyEnabled  copied on lead, quotation, enquiry and Meta lead emails
 *   leadAlertTo        Busy Beans staff who get "new lead" / "new enquiry" alerts (list); empty =
 *                      ADMIN_NOTIFY_EMAIL from the environment
 *   customerTestRecipient  when set (e.g. on staging), every customer-facing lead email (request
 *                      received, quotation) goes ONLY to this address, never to the customer and
 *                      without the developer copy
 */
const { emailRecipientSetting } = require("../models");

const DEFAULTS = {
  developerCopyEmail: "sigidevelopers@gmail.com",
  developerCopyEnabled: "true",
  leadAlertTo: "",
  customerTestRecipient: "",
};
const KEYS = Object.keys(DEFAULTS);
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const CACHE_TTL_MS = 15000;
let cache = { loadedAt: 0, values: null };

const list = (value) =>
  String(value || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
const unique = (items) => [...new Set(items.filter(Boolean).map((s) => String(s).trim()).filter(Boolean))];

async function loadValues(force = false) {
  if (!force && cache.values && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.values;
  let rows = [];
  try {
    rows = await emailRecipientSetting.findAll({ raw: true });
  } catch (error) {
    // Table not migrated yet: behave exactly as before (defaults).
    console.error("email recipients: using defaults —", error.message);
  }
  const values = { ...DEFAULTS };
  for (const row of rows) if (KEYS.includes(row.settingKey) && row.value !== null) values[row.settingKey] = row.value;
  cache = { loadedAt: Date.now(), values };
  return values;
}

function invalidateRecipientCache() {
  cache = { loadedAt: 0, values: null };
}

/** The settings as the admin panel shows them. */
async function getRecipientSettings() {
  const v = await loadValues(true);
  return {
    developerCopyEmail: v.developerCopyEmail,
    developerCopyEnabled: v.developerCopyEnabled === "true",
    leadAlertTo: list(v.leadAlertTo),
    customerTestRecipient: v.customerTestRecipient || "",
    adminNotifyEmailFallback: Boolean(process.env.ADMIN_NOTIFY_EMAIL),
  };
}

function validationError(message) {
  return Object.assign(new Error(message), { statusCode: 400, code: "VALIDATION_ERROR" });
}

/** Validated update from the admin panel (any subset of the keys). */
async function updateRecipientSettings(body = {}) {
  const updates = {};
  if (body.developerCopyEmail !== undefined) {
    const e = String(body.developerCopyEmail || "").trim().toLowerCase();
    if (e && !EMAIL.test(e)) throw validationError("Developer copy: enter a valid email address.");
    updates.developerCopyEmail = e;
  }
  if (body.developerCopyEnabled !== undefined) updates.developerCopyEnabled = body.developerCopyEnabled ? "true" : "false";
  if (body.leadAlertTo !== undefined) {
    const emails = Array.isArray(body.leadAlertTo) ? body.leadAlertTo.map((s) => String(s).trim().toLowerCase()).filter(Boolean) : list(body.leadAlertTo);
    const bad = emails.find((e) => !EMAIL.test(e));
    if (bad) throw validationError(`Lead alert recipients: "${bad}" is not a valid email address.`);
    if (emails.length > 20) throw validationError("Lead alert recipients: at most 20 addresses.");
    updates.leadAlertTo = unique(emails).join(",");
  }
  if (body.customerTestRecipient !== undefined) {
    const e = String(body.customerTestRecipient || "").trim().toLowerCase();
    if (e && !EMAIL.test(e)) throw validationError("Test recipient: enter a valid email address.");
    updates.customerTestRecipient = e;
  }
  for (const [settingKey, value] of Object.entries(updates)) {
    // eslint-disable-next-line no-await-in-loop
    await emailRecipientSetting.upsert({ settingKey, value });
  }
  invalidateRecipientCache();
  return getRecipientSettings();
}

/** Developer copy address, or null when switched off. */
async function developerCopy() {
  const v = await loadValues();
  return v.developerCopyEnabled === "true" && EMAIL.test(v.developerCopyEmail) ? v.developerCopyEmail : null;
}

/**
 * Recipients of a customer-facing lead email (request received, quotation): the customer plus the
 * developer copy — or only the test recipient when one is set.
 */
async function customerEmailRecipients(customerEmail) {
  const v = await loadValues();
  if (v.customerTestRecipient && EMAIL.test(v.customerTestRecipient)) return [v.customerTestRecipient];
  const copy = await developerCopy();
  return unique([customerEmail, copy]);
}

/** Staff alert recipients ("new lead", "new enquiry"): lead alert list (or ADMIN_NOTIFY_EMAIL) + developer copy. */
async function leadAlertRecipients() {
  const v = await loadValues();
  const staff = list(v.leadAlertTo);
  const base = staff.length ? staff : list(process.env.ADMIN_NOTIFY_EMAIL);
  return unique([...base, await developerCopy()]);
}

module.exports = {
  DEFAULTS,
  getRecipientSettings,
  updateRecipientSettings,
  invalidateRecipientCache,
  developerCopy,
  customerEmailRecipients,
  leadAlertRecipients,
};
