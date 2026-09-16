/**
 * Full local QA for type-default-only Email Configuration.
 */
require("dotenv").config();
const axios = require("axios");
const {
  canSendEmail,
  invalidateEmailSettingsCache,
} = require("../utils/emailSendGate");
const { emailLog } = require("../models");
const { TYPE_DEFAULT_RECIPIENT_ID } = require("../utils/emailCatalog");
const { orderEvents } = require("../controllers/events/orderEvents");

const baseUrl =
  process.env.EMAIL_TEST_BASE_URL || "http://127.0.0.1:8013/api/v1/admin";
const CUSTOMER_ID = Number(process.env.QA_CUSTOMER_ID) || 328;

const results = [];
const patchLog = [];

function pass(id, msg) {
  results.push({ id, ok: true, msg });
  console.log(`PASS ${id}: ${msg}`);
}
function fail(id, msg, err) {
  const detail = err?.message || err?.response?.data?.message || String(err).slice(0, 180);
  results.push({ id, ok: false, msg, detail });
  console.error(`FAIL ${id}: ${msg}`, detail);
}

async function patchSetting(headers, body) {
  await axios.patch(`${baseUrl}/email-settings`, body, { headers });
  patchLog.push(body);
  invalidateEmailSettingsCache();
}

async function runFullQa(token) {
  const headers = { Authorization: `Bearer ${token}` };

  const settings = await axios.get(`${baseUrl}/email-settings?type=customer`, {
    headers,
  });
  if (settings.data?.data?.typeDefaults && !settings.data?.data?.recipients) {
    pass("API-R01", "Customer settings are type-default only");
  } else {
    fail("API-R01", "Unexpected settings shape", settings.data?.data);
  }

  try {
    await patchSetting(headers, {
      recipientType: "customer",
      recipientId: CUSTOMER_ID,
      emailType: "order_confirmation",
      enabled: false,
    });
    fail("API-U01", "Per-person PATCH should be rejected");
  } catch (e) {
    if (e.response?.status === 400) {
      pass("API-U01", "Per-person PATCH rejected");
    } else {
      fail("API-U01", "Unexpected error", e.response?.data);
    }
  }

  await patchSetting(headers, {
    recipientType: "customer",
    recipientId: 0,
    emailType: "order_confirmation",
    enabled: false,
  });
  const blocked = await canSendEmail({
    recipientType: "customer",
    recipientId: CUSTOMER_ID,
    emailType: "order_confirmation",
  });
  if (blocked === false) {
    pass("FLOW-01", "Type OFF blocks all customers (incl. id " + CUSTOMER_ID + ")");
  } else {
    fail("FLOW-01", "Type default OFF should block everyone", { blocked });
  }

  const orderRow = await require("../models").order.findOne({
    where: { userId: CUSTOMER_ID },
    order: [["id", "DESC"]],
    attributes: ["id"],
    raw: true,
  });
  const orderId = orderRow?.id;
  if (orderId) {
    await orderEvents({ orderId, orderType: "customer" });
    const log = await emailLog.findOne({
      where: { emailType: "order_confirmation", orderId },
      order: [["id", "DESC"]],
      raw: true,
    });
    if (log?.emailSent === "Skipped") {
      pass("FLOW-02", `Order #${orderId} confirmation Skipped when type OFF`);
    } else {
      fail("FLOW-02", "Expected Skipped log", log);
    }
  } else {
    pass("FLOW-02", "Skipped order event (no order for test customer)");
  }

  const sup = await axios.get(`${baseUrl}/email-settings?type=supplier`, { headers });
  if (
    sup.data?.data?.suppliersForDefault?.length &&
    sup.data?.data?.defaultSupplierId != null
  ) {
    pass("SUP-01", "Supplier tab returns default supplier + list");
  } else if (sup.data?.data?.suppliersForDefault?.length) {
    pass("SUP-01", "Supplier list returned (no default set yet)");
  } else {
    fail("SUP-01", "Missing suppliersForDefault", sup.data?.data);
  }
}

async function restoreDefaults(headers) {
  for (const p of [...patchLog].reverse()) {
    if (Number(p.recipientId) !== TYPE_DEFAULT_RECIPIENT_ID) continue;
    try {
      await axios.patch(
        `${baseUrl}/email-settings`,
        { ...p, recipientId: 0, enabled: true },
        { headers },
      );
    } catch (_) {
      /* ignore */
    }
  }
  invalidateEmailSettingsCache();
}

async function main() {
  console.log("\n=== Email Config QA (type defaults only) ===\n");
  const email = process.env.EMAIL_TEST_ADMIN_EMAIL || "admin@gmail.com";
  const password = process.env.EMAIL_TEST_ADMIN_PASSWORD || "123456";
  let token;
  try {
    const login = await axios.post(`${baseUrl}/login`, { email, password });
    token = login.data?.data?.token;
    if (!token) throw new Error("no token");
    pass("API-00", "Admin login OK");
  } catch (e) {
    fail("API-00", "Login failed", e);
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${token}` };
  try {
    await runFullQa(token);
  } catch (e) {
    fail("QA-00", "Suite error", e);
  }
  await restoreDefaults(headers);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length) process.exitCode = 1;
}

main();
