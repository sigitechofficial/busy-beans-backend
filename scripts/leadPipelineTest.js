/**
 * Unified lead pipeline (local API only): every website enquiry is one lead on the admin Leads
 * Dashboard (Kanban), linked to its Campaign Builder lead by event id, and Kanban stage / won amount
 * flow back to the Campaign Builder lead (Analytics status + revenue).
 *
 *   node scripts/leadPipelineTest.js            (API on API_TEST_URL, default http://localhost:8013)
 *
 * Start the API with mail disabled for this run (EMAIL_PASSWORD="" ZEPTO_API_TOKEN="" in its env)
 * so no enquiry email is sent. Mints a short-lived local admin token into Redis the way login does
 * and removes every lead / get-in-touch / Campaign Builder row it created at the end.
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { account, Lead, GetInTouch, sequelize } = require("../models");
const { getMarketingSequelize } = require("../marketing/db/sequelize.marketing");
const { issueCode } = require("../marketing/services/sso.service");

const redisClient = redis.createClient({
  socket: {
    host: String(process.env.REDIS_HOST || "localhost").replace(/['";]/g, ""),
    port: Number(String(process.env.REDIS_PORT || "6379").replace(/['";]/g, "")) || 6379,
  },
});

const API = (process.env.API_TEST_URL || "http://localhost:8013").replace(/\/+$/, "");
const SITE = "http://localhost:3001";
const RUN = `lpt${Date.now().toString(36)}`;
// SSO codes are issued for a placeholder admin id so cleanup removes only this run's rows.
const SSO_ADMIN_ID = 900000 + Math.floor(Math.random() * 99999);
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

async function request(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* not JSON */
  }
  return { status: res.status, json };
}

async function mintToken(entity, record) {
  const token = jwt.sign({ id: record.id, email: record.email, entity }, process.env.JWT_SECRET, { expiresIn: "10m" });
  await redisClient.set(token, `${entity}${record.id}`, { EX: 600 });
  await redisClient.sAdd(`${entity}${record.id}`, token);
  return token;
}

const eventId = (n) => `${RUN}-${n}`;
const email = (n) => `${RUN}-${n}@example.test`;

function marketingLead(n, { formId, path, fields = {} }) {
  return request("/api/public/lead-submissions", {
    method: "POST",
    body: {
      eventId: eventId(n),
      formId,
      pageUrl: `${SITE}${path}`,
      visitorId: `${RUN}-visitor-${n}`,
      // Attribution claim (no visitor history on the server for these ids).
      utmSource: RUN,
      utmMedium: "cpc",
      utmCampaign: `${RUN}-campaign`,
      fields: { name: `Pipeline ${n}`, email: email(n), company: `${RUN} Co ${n}`, ...fields },
    },
  });
}

function getInTouch(n, formId) {
  return request("/api/v1/users/get-in-touch", {
    method: "POST",
    body: { name: `Pipeline ${n}`, email: email(n), company: `${RUN} Co ${n}`, notes: "test", formId, marketingEventId: eventId(n) },
  });
}

const leadsFor = (n) => Lead.findAll({ where: { marketingEventId: eventId(n) } });
async function submission(n) {
  const [row] = await getMarketingSequelize().query(
    "SELECT conversion_status AS status, revenue, converted_at AS convertedAt, test_mode AS testMode FROM lead_submissions WHERE event_id = :e",
    { replacements: { e: eventId(n) }, type: sequelize.QueryTypes.SELECT },
  );
  return row;
}

async function run() {
  await redisClient.connect();
  const admin = await account.findOne({ where: { deleted: 0, status: 1 }, order: [["id", "ASC"]] });
  if (!admin) throw new Error("No active admin account in the local DB");
  const token = await mintToken("admin", admin);
  try {
    // 1) Tasting form: get-in-touch first (as the website does), then the Campaign Builder copy → one lead.
    const g1 = await getInTouch(1, "hero_tasting_request");
    check(g1.status < 300, `get-in-touch must succeed (got ${g1.status})`);
    const m1 = await marketingLead(1, { formId: "hero_tasting_request", path: "/" });
    check(m1.status < 300 && m1.json?.data?.testMode === false, `lead submission must be stored as real (got ${m1.status} ${JSON.stringify(m1.json?.data)})`);
    let l1 = await leadsFor(1);
    check(l1.length === 1, `tasting enquiry must be exactly one lead (got ${l1.length})`);
    check(l1[0]?.enquiryType === "tasting" && l1[0]?.getInTouchId, "tasting lead: enquiryType tasting + getInTouchId");

    // 2) Campaign Builder copy first, then get-in-touch → still one lead, completed with getInTouchId.
    await marketingLead(2, { formId: "contact_page", path: "/contact" });
    await getInTouch(2, "contact_page");
    const l2 = await leadsFor(2);
    check(l2.length === 1, `reverse order must still be one lead (got ${l2.length})`);
    check(l2[0]?.getInTouchId && l2[0]?.enquiryType === "contact", "reverse order: lead gets getInTouchId and enquiryType contact");

    // 3) Product quote (Campaign Builder only) → lead created.
    await marketingLead(3, { formId: "product_quote", path: "/products/x-1", fields: { productName: "Espresso Beans", quantity: "10" } });
    const l3 = await leadsFor(3);
    check(l3.length === 1 && l3[0].enquiryType === "product_quote", `product quote must create a product_quote lead (got ${l3.length} ${l3[0]?.enquiryType})`);
    check(/Espresso Beans/.test(l3[0]?.notes || ""), "product quote lead notes include the product");

    // 4) Public machine form: allow-list (no mass assignment), honeypot, event id link.
    const p4 = await request("/api/v1/users/create-lead", {
      method: "POST",
      body: {
        contactName: "Pipeline 4", company: `${RUN} Co 4`, contactEmail: email(4), marketingEventId: eventId(4),
        status: "WON", salesRepId: 1, employeeId: 1, wonAmount: 99999, preferredContact: "Any",
      },
    });
    check(p4.status === 201, `public create-lead must succeed (got ${p4.status} ${p4.json?.message})`);
    const l4 = await leadsFor(4);
    check(l4.length === 1, `public lead must exist once (got ${l4.length})`);
    check(l4[0]?.status === "New Enquiry" && !l4[0]?.salesRepId && !l4[0]?.employeeId && l4[0]?.wonAmount === null, "public lead ignores status / assignment / wonAmount");
    check(l4[0]?.enquiryType === "machine", "public lead enquiryType machine");
    await marketingLead(4, { formId: "machine_contact", path: "/machine/contact" });
    check((await leadsFor(4)).length === 1, "machine form + Campaign Builder copy stay one lead");
    const spam = await request("/api/v1/users/create-lead", {
      method: "POST",
      body: { contactName: "Bot", company: `${RUN} spam`, website: "http://spam.example", marketingEventId: eventId(5) },
    });
    check(spam.status === 201 && (await leadsFor(5)).length === 0, "honeypot submission looks accepted but stores nothing");
    const missing = await request("/api/v1/users/create-lead", { method: "POST", body: { contactName: "No company" } });
    check(missing.status === 400, `public lead without company must be 400 (got ${missing.status})`);

    // 5) Kanban stage → Campaign Builder status; won amount → revenue; lost.
    const id1 = l1[0].id;
    let r = await request(`/api/v1/leads/${id1}`, { token, method: "PATCH", body: { status: "Contacted" } });
    check(r.status === 200, `PATCH status must succeed (got ${r.status})`);
    check((await submission(1))?.status === "contacted", "Contacted → Campaign Builder contacted");
    r = await request(`/api/v1/leads/${id1}`, { token, method: "PATCH", body: { status: "Quoted" } });
    check((await submission(1))?.status === "qualified", "Quoted → Campaign Builder qualified");
    r = await request(`/api/v1/leads/${id1}/won`, { token, method: "PATCH", body: { amount: -5 } });
    check(r.status === 400, `negative won amount must be 400 (got ${r.status})`);
    r = await request(`/api/v1/leads/${id1}/won`, { token, method: "PATCH", body: { amount: 1234.5 } });
    check(r.status === 200, `mark won must succeed (got ${r.status})`);
    let s1 = await submission(1);
    check(s1?.status === "won" && Number(s1?.revenue) === 1234.5 && s1?.convertedAt, `Won → won + revenue 1234.5 (got ${JSON.stringify(s1)})`);
    l1 = await leadsFor(1);
    check(Number(l1[0].wonAmount) === 1234.5 && l1[0].wonAt, "lead keeps wonAmount + wonAt");
    r = await request(`/api/v1/leads/${l2[0].id}/lost`, { token, method: "PATCH", body: { reason: "not-a-reason", feedback: "x" } });
    check(r.status === 200, `mark lost with an unknown reason must still succeed as Other (got ${r.status})`);
    check((await submission(2))?.status === "lost", "Lost → Campaign Builder lost");
    check((await Lead.findByPk(l2[0].id)).lostReason === "Other", "unknown lost reason stored as Other");

    // 6) Notes, Kanban source, detail source.
    r = await request(`/api/v1/leads/${id1}/comments`, { token, method: "POST", body: { message: "Called, left a voicemail" } });
    check(r.status === 201, `add note must be 201 (got ${r.status})`);
    r = await request(`/api/v1/leads/${id1}/comments`, { token, method: "POST", body: { message: "   " } });
    check(r.status === 400, `empty note must be 400 (got ${r.status})`);
    r = await request(`/api/v1/leads/${id1}/comments`, { method: "POST", body: { message: "guest" } });
    check(r.status === 401, `note without token must be 401 (got ${r.status})`);
    const kanban = await request("/api/v1/leads/kanban", { token });
    const onBoard = Object.values(kanban.json?.data || {}).flat().find((l) => l.id === id1);
    check(onBoard?.status === "WON" && onBoard?.marketingSource?.campaign === `${RUN}-campaign`, `Kanban card carries the campaign (got ${JSON.stringify(onBoard?.marketingSource)})`);
    const detail = await request(`/api/v1/leads/${id1}`, { token });
    check(detail.json?.data?.marketingSource?.source === RUN, "lead detail carries the source");
    check((detail.json?.data?.LeadLogs || []).some((log) => log.type === "comment" && /voicemail/.test(log.message)), "note shows in the activity log");

    // 7) Guests cannot read enquiries.
    const guestKanban = await request("/api/v1/leads/kanban");
    check(guestKanban.status === 401, `Kanban without token must be 401 (got ${guestKanban.status})`);

    // 8) Status set in the Campaign Builder → Kanban stage (only when it maps to a different status).
    const [mUser] = await getMarketingSequelize().query("SELECT email FROM marketing_users WHERE email IS NOT NULL ORDER BY id LIMIT 1", {
      type: sequelize.QueryTypes.SELECT,
    });
    const { code } = await issueCode({ adminEntity: "admin", adminId: SSO_ADMIN_ID, email: mUser.email, ip: "127.0.0.1" });
    const cbToken = (await request("/api/auth/sso/exchange", { method: "POST", body: { code } })).json?.data?.token;
    check(Boolean(cbToken), "Campaign Builder session for the status checks");
    const [sub3] = await getMarketingSequelize().query("SELECT id FROM lead_submissions WHERE event_id = :e", {
      replacements: { e: eventId(3) },
      type: sequelize.QueryTypes.SELECT,
    });
    const cbPatch = (body) => request(`/api/admin/lead-submissions/sub_${sub3.id}`, { token: cbToken, method: "PATCH", body });
    const id3 = l3[0].id;
    r = await cbPatch({ conversionStatus: "qualified" });
    check(r.status === 200, `Campaign Builder status change must succeed (got ${r.status})`);
    check((await Lead.findByPk(id3)).status === "Quoted", "Campaign Builder qualified → Kanban Quoted");
    await request(`/api/v1/leads/${id3}`, { token, method: "PATCH", body: { status: "Negotiation" } });
    await cbPatch({ conversionStatus: "qualified" });
    check((await Lead.findByPk(id3)).status === "Negotiation", "qualified keeps a lead that is already in Negotiation");
    await cbPatch({ conversionStatus: "won", revenue: 500 });
    const won3 = await Lead.findByPk(id3);
    check(won3.status === "WON" && Number(won3.wonAmount) === 500 && won3.wonAt, `Campaign Builder won + 500 → Kanban WON 500 (got ${won3.status} ${won3.wonAmount})`);
    check(Number((await submission(3))?.revenue) === 500, "Campaign Builder revenue kept (no sync loop overwrite)");
  } finally {
    await redisClient.del(token).catch(() => {});
    await redisClient.sRem(`admin${admin.id}`, token).catch(() => {});
    await cleanup();
  }
}

async function cleanup() {
  const ids = (await Lead.findAll({ where: { company: { [require("sequelize").Op.like]: `${RUN}%` } }, attributes: ["id"] })).map((l) => l.id);
  if (ids.length) {
    await sequelize.query("DELETE FROM leadLogs WHERE LeadId IN (:ids)", { replacements: { ids } });
    await Lead.destroy({ where: { id: ids } });
  }
  await GetInTouch.destroy({ where: { company: { [require("sequelize").Op.like]: `${RUN}%` } } });
  const like = `${RUN}%`;
  const m = getMarketingSequelize();
  for (const sql of [
    "DELETE FROM marketing_analytics_events WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_sessions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_visitors WHERE visitor_id LIKE :like",
    "DELETE FROM lead_submissions WHERE event_id LIKE :like",
    "DELETE FROM marketing_sso_codes WHERE admin_id = :ssoAdmin",
  ]) {
    await m.query(sql, { replacements: { like, ssoAdmin: SSO_ADMIN_ID } }).catch((e) => console.warn("cleanup:", e.message));
  }
}

run()
  .then(() => {
    if (failures.length) {
      console.error(`lead pipeline: ${failures.length} failure(s)`);
      failures.forEach((f) => console.error(`  ✗ ${f}`));
      process.exitCode = 1;
    } else {
      console.log("lead pipeline: all checks passed");
    }
  })
  .catch((error) => {
    console.error("lead pipeline test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await redisClient.quit().catch(() => {});
    await sequelize.close().catch(() => {});
    await getMarketingSequelize().close().catch(() => {});
  });
