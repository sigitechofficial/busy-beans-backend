/**
 * Smoke tests for Email Configuration (local). Run from BusyBeans:
 *   node scripts/emailConfigurationSmokeTest.js
 *
 * Optional env for API tests:
 *   EMAIL_TEST_ADMIN_EMAIL, EMAIL_TEST_ADMIN_PASSWORD
 *   EMAIL_TEST_BASE_URL (default http://127.0.0.1:8013)
 */
require("dotenv").config();
const axios = require("axios");
const {
  canSendEmail,
  sendIfAllowed,
  invalidateEmailSettingsCache,
} = require("../utils/emailSendGate");
const { emailSetting } = require("../models");
const { TYPE_DEFAULT_RECIPIENT_ID } = require("../utils/emailCatalog");

const baseUrl =
  process.env.EMAIL_TEST_BASE_URL || "http://127.0.0.1:8013/api/v1/admin";

const results = [];

function pass(id, msg) {
  results.push({ id, ok: true, msg });
  console.log(`PASS ${id}: ${msg}`);
}

function fail(id, msg, err) {
  const detail = err?.message || err?.response?.data || err;
  results.push({ id, ok: false, msg, detail: String(detail).slice(0, 200) });
  console.error(`FAIL ${id}: ${msg}`, detail);
}

async function testGateLogic() {
  invalidateEmailSettingsCache();

  const typeOff = await canSendEmail({
    recipientType: "customer",
    recipientId: TYPE_DEFAULT_RECIPIENT_ID,
    emailType: "quotation",
  });
  if (typeOff === false) {
    pass("GATE-01", "Type default OFF for customer quotation (recipientId 0)");
  } else {
    fail("GATE-01", "Expected quotation type default OFF from DB", { typeOff });
  }

  const anyCustomer = await emailSetting.findOne({
    where: { recipientType: "customer", recipientId: { [require("sequelize").Op.gt]: 0 } },
    raw: true,
  });
  if (anyCustomer) {
    const typeDefaultOn = await canSendEmail({
      recipientType: "customer",
      recipientId: anyCustomer.recipientId,
      emailType: anyCustomer.emailType,
    });
    const typeRow = await emailSetting.findOne({
      where: {
        recipientType: "customer",
        recipientId: TYPE_DEFAULT_RECIPIENT_ID,
        emailType: anyCustomer.emailType,
      },
      raw: true,
    });
    const typeEnabled =
      !typeRow ||
      typeRow.enabled === true ||
      typeRow.enabled === 1 ||
      typeRow.enabled === "1";
    if (typeDefaultOn === typeEnabled) {
      pass("GATE-02", "Per-person DB rows ignored; type default applies");
    } else {
      fail("GATE-02", "Expected type default only", { typeDefaultOn, typeEnabled });
    }
  } else {
    pass("GATE-02", "Type-default-only gate (no per-person rows in DB)");
  }

  const otpAlways = await canSendEmail({
    recipientType: "customer",
    recipientId: 999999,
    emailType: "otp_verification",
  });
  if (otpAlways === true) {
    pass("GATE-03", "OTP verification always allowed (locked)");
  } else {
    fail("GATE-03", "OTP should always send", { otpAlways });
  }

  let sendCalled = false;
  const blocked = await sendIfAllowed({
    recipientType: "customer",
    recipientId: TYPE_DEFAULT_RECIPIENT_ID,
    emailType: "quotation",
    orderId: null,
    recipients: "test@example.com",
    send: async () => {
      sendCalled = true;
    },
  });
  if (blocked === false && sendCalled === false) {
    pass("GATE-04", "sendIfAllowed skips send when type default OFF");
  } else {
    fail("GATE-04", "Expected skip without calling send()", { blocked, sendCalled });
  }

  sendCalled = false;
  const allowed = await sendIfAllowed({
    recipientType: "customer",
    recipientId: TYPE_DEFAULT_RECIPIENT_ID,
    emailType: "order_dispatch",
    orderId: null,
    recipients: "test@example.com",
    send: async () => {
      sendCalled = true;
    },
  });
  if (allowed === true && sendCalled === true) {
    pass("GATE-05", "sendIfAllowed runs send when type default ON (order_dispatch)");
  } else {
    fail("GATE-05", "Expected send for order_dispatch", { allowed, sendCalled });
  }
}

async function testApi(token) {
  const headers = { Authorization: `Bearer ${token}` };

  const catalog = await axios.get(`${baseUrl}/email-settings/catalog`, { headers });
  if (catalog.status === 200 && catalog.data?.data?.tabs?.length >= 7) {
    pass("API-01", "GET catalog returns tabs");
  } else {
    fail("API-01", "Catalog response invalid", catalog.data);
  }

  const locked = catalog.data.data.tabs
    .flatMap((t) => t.emails)
    .find((e) => e.key === "otp_verification");
  if (locked?.locked === true) {
    pass("API-02", "Catalog marks OTP as locked");
  } else {
    fail("API-02", "OTP should be locked in catalog");
  }

  const settings = await axios.get(`${baseUrl}/email-settings?type=customer&page=1&limit=5`, {
    headers,
  });
  const td = settings.data?.data?.typeDefaults;
  if (settings.status === 200 && td && typeof td.quotation === "boolean") {
    pass("API-03", "GET settings returns typeDefaults.quotation");
  } else {
    fail("API-03", "Settings payload missing typeDefaults", settings.data);
  }

  if (!Array.isArray(settings.data?.data?.recipients)) {
    pass("API-04", "Settings response has no per-person recipients list");
  } else if (settings.data.data.recipients.length === 0) {
    pass("API-04", "Recipients list empty (type defaults only)");
  } else {
    fail("API-04", "Unexpected recipients array in settings response");
  }

  try {
    await axios.patch(
      `${baseUrl}/email-settings`,
      {
        recipientType: "customer",
        recipientId: 999,
        emailType: "order_confirmation",
        enabled: false,
      },
      { headers },
    );
    fail("API-04b", "Should reject per-person PATCH");
  } catch (e) {
    if (e.response?.status === 400) {
      pass("API-04b", "PATCH rejects per-person settings with 400");
    } else {
      fail("API-04b", "Unexpected error for per-person PATCH", e.response?.data);
    }
  }

  try {
    await axios.patch(
      `${baseUrl}/email-settings`,
      {
        recipientType: "customer",
        recipientId: 0,
        emailType: "otp_verification",
        enabled: false,
      },
      { headers },
    );
    fail("API-05", "Should reject disabling OTP");
  } catch (e) {
    if (e.response?.status === 400) {
      pass("API-05", "PATCH rejects OTP disable with 400");
    } else {
      fail("API-05", "Unexpected error disabling OTP", e.response?.data || e.message);
    }
  }

  const testKey = "order_shipped";
  const before = td[testKey] !== false;
  const flipTo = !before;
  await axios.patch(
    `${baseUrl}/email-settings`,
    {
      recipientType: "customer",
      recipientId: 0,
      emailType: testKey,
      enabled: flipTo,
    },
    { headers },
  );
  invalidateEmailSettingsCache();
  const afterGet = await axios.get(`${baseUrl}/email-settings?type=customer&page=1&limit=1`, {
    headers,
  });
  const afterVal = afterGet.data?.data?.typeDefaults?.[testKey] !== false;
  if (afterVal === flipTo) {
    pass("API-06", "PATCH type default persists and reads back");
  } else {
    fail("API-06", "Toggle persistence failed", { before, flipTo, afterVal });
  }
  await axios.patch(
    `${baseUrl}/email-settings`,
    {
      recipientType: "customer",
      recipientId: 0,
      emailType: testKey,
      enabled: before,
    },
    { headers },
  );
  invalidateEmailSettingsCache();

  try {
    await axios.get(`${baseUrl}/email-settings?type=not_a_type`, { headers });
    fail("API-07", "Should reject invalid type");
  } catch (e) {
    if (e.response?.status === 400) pass("API-07", "Invalid type returns 400");
    else fail("API-07", "Unexpected status for invalid type", e.response?.status);
  }
}

async function main() {
  console.log("\n=== Email Configuration smoke test ===\n");
  try {
    await testGateLogic();
  } catch (e) {
    fail("GATE-00", "Gate logic suite crashed", e);
  }

  const email = process.env.EMAIL_TEST_ADMIN_EMAIL;
  const password = process.env.EMAIL_TEST_ADMIN_PASSWORD;
  if (email && password) {
    try {
      const login = await axios.post(`${baseUrl}/login`, { email, password });
      const token = login.data?.token || login.data?.data?.token;
      if (!token) {
        fail("API-00", "Login did not return token", login.data);
      } else {
        pass("API-00", "Admin login OK");
        await testApi(token);
      }
    } catch (e) {
      fail("API-00", "Admin login failed", e.response?.data || e.message);
    }
  } else {
    console.log(
      "SKIP API tests: set EMAIL_TEST_ADMIN_EMAIL and EMAIL_TEST_ADMIN_PASSWORD in .env",
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Done: ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
