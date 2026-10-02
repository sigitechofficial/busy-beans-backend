/**
 * Audience › Devices and entered ad spend (spend, cost per lead, ROAS) — services, then HTTP when
 * the local API is up. Writes a small fixture (visitors / sessions / events / leads / spend in
 * May 2017, ids prefixed with the run id) and removes it.
 *   npm run marketing:devices-spend-test
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getMarketingJwtSecret } = require("../services/auth.service");
const { getSessionModel } = require("../models/session");
const { getVisitorModel } = require("../models/visitor");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const reports = require("../services/reports.service");
const outcomes = require("../services/outcomeReports.service");
const adSpend = require("../services/adSpend.service");
const { rangeFromQuery } = require("../utils/reportQuery");
const { toSqlUtc } = require("../utils/dateRange");

const BASE = (process.env.MARKETING_TEST_BASE_URL || "http://localhost:8013").replace(/\/api\/?$/, "").replace(/\/+$/, "");
const RUN = `dsp-${Date.now()}`;
const FROM = "2017-05-10";
const TO = "2017-05-14";
const D = (day, hour, min = 0) => new Date(Date.UTC(2017, 4, day, hour, min));
const db = () => getMarketingSequelize();
let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
}

const FB = { channel: "Paid Social", source: "facebook", medium: "paid_social", campaign: `${RUN}-fb` };
const GADS = { channel: "Paid Search", source: "google", medium: "cpc", campaign: `${RUN}-gads` };
const DEVICES = {
  iphone: { deviceType: "mobile", os: "iOS", browser: "Safari" },
  android: { deviceType: "mobile", os: "Android", browser: "Chrome" },
  laptop: { deviceType: "desktop", os: "Windows", browser: "Chrome" },
  mac: { deviceType: "desktop", os: "macOS", browser: "Safari" },
  ipad: { deviceType: "tablet", os: "iOS", browser: "Safari" },
};
const spendIds = [];

async function seed() {
  const Visitor = getVisitorModel();
  const Session = getSessionModel();
  const Lead = getLeadSubmissionModel();
  let ev = 0;
  /** One visit: session + its first page view carrying the device. */
  const visit = async (vid, sid, at, touch, device) => {
    if (!(await Visitor.findByPk(`${RUN}-${vid}`))) await Visitor.create({ visitorId: `${RUN}-${vid}`, firstSeenAt: at, lastSeenAt: at });
    await Session.create({
      sessionId: `${RUN}-${sid}`, visitorId: `${RUN}-${vid}`, startedAt: at, endedAt: new Date(at.getTime() + 600000), entryPathname: "/",
      channel: touch.channel, source: touch.source, medium: touch.medium, campaign: touch.campaign, touch,
    });
    await db().query(
      `INSERT INTO marketing_analytics_events (id, visitor_id, session_id, event_type, timestamp, pathname, page_type, metadata)
       VALUES (:id, :v, :s, 'page_view', :ts, '/', 'site', :meta)`,
      { replacements: { id: `${RUN}-e${(ev += 1)}`, v: `${RUN}-${vid}`, s: `${RUN}-${sid}`, ts: toSqlUtc(at), meta: JSON.stringify({ ...device, site: "customer-website" }) } },
    );
  };
  const lead = (vid, sid, at, touch, device, extra = {}) =>
    Lead.create({
      pageUrl: "https://www.example.test/contact", fields: { name: "D" }, submittedAt: at, testMode: false, conversionStatus: "new", submitStatus: "success",
      attribution: {}, device, visitorId: `${RUN}-${vid}`, sessionId: `${RUN}-${sid}`, pageType: "site", pageSlug: `${RUN}-page`,
      channel: touch.channel, source: touch.source, medium: touch.medium, campaign: touch.campaign,
      firstTouch: touch, lastTouch: touch, lastNonDirectTouch: touch, sessionTouch: touch, conversionTouch: touch,
      ...extra,
    });

  // Facebook: 3 phone visits (iPhone ×2 visitors, Android), 1 iPad. 1 lead from an iPhone (won $600).
  await visit("f1", "f1s1", D(10, 15), FB, DEVICES.iphone);
  await visit("f2", "f2s1", D(10, 16), FB, DEVICES.iphone);
  await visit("f3", "f3s1", D(11, 15), FB, DEVICES.android);
  await visit("f4", "f4s1", D(11, 16), FB, DEVICES.ipad);
  await lead("f1", "f1s1", D(10, 15, 5), FB, DEVICES.iphone, { conversionStatus: "won", revenue: 600 });
  // Google Ads: 2 laptop visits + 1 Mac; 2 leads from desktops (won $1,500 and lost).
  await visit("g1", "g1s1", D(12, 15), GADS, DEVICES.laptop);
  await visit("g2", "g2s1", D(12, 16), GADS, DEVICES.laptop);
  await visit("g3", "g3s1", D(13, 15), GADS, DEVICES.mac);
  await lead("g1", "g1s1", D(12, 15, 5), GADS, DEVICES.laptop, { conversionStatus: "won", revenue: 1500 });
  await lead("g3", "g3s1", D(13, 15, 5), GADS, DEVICES.mac, { conversionStatus: "lost" });

  // Spend: Facebook $300 over May 1–30 (only 5 of 30 days in the report → $50); Google $1,000
  // over exactly the report days; a campaign with spend and no visits ($200, May 10–14).
  for (const e of [
    { source: "facebook", campaign: FB.campaign, periodStart: "2017-05-01", periodEnd: "2017-05-30", amount: 300 },
    { source: "google", medium: "cpc", campaign: GADS.campaign, periodStart: FROM, periodEnd: TO, amount: 1000 },
    { source: "linkedin", campaign: `${RUN}-li`, periodStart: FROM, periodEnd: TO, amount: 200 },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    spendIds.push((await adSpend.createEntry(e, { userId: RUN })).id);
  }
}

async function serviceChecks() {
  const range = rangeFromQuery({ range: "custom", from: FROM, to: TO });
  const filters = {};

  // ── devices ──
  const dt = await outcomes.getDevices({ range, dimension: "deviceType", filters });
  const by = (rows, v) => rows.find((r) => r.value === v) || {};
  check(by(dt.rows, "Mobile").sessions === 3 && by(dt.rows, "Desktop / laptop").sessions === 3 && by(dt.rows, "Tablet").sessions === 1, "device type: 3 mobile, 3 desktop, 1 tablet visits", dt.rows.map((r) => [r.value, r.sessions]));
  check(by(dt.rows, "Mobile").leads === 1 && by(dt.rows, "Desktop / laptop").leads === 2, "leads by the device they were submitted from");
  check(by(dt.rows, "Mobile").sessionShare === 42.9 && dt.rows.reduce((s, r) => s + r.sessions, 0) === dt.totals.sessions, "share of sessions; rows add up to the total");
  check(by(dt.rows, "Desktop / laptop").leadRevenue === 1500 && by(dt.rows, "Mobile").wonLeads === 1, "won leads / lead revenue by device");
  const os = await outcomes.getDevices({ range, dimension: "os", filters });
  check(by(os.rows, "iOS").sessions === 3 && by(os.rows, "Android").sessions === 1 && by(os.rows, "Windows").sessions === 2 && by(os.rows, "macOS").sessions === 1, "operating systems (iPhone + iPad = iOS)", os.rows.map((r) => [r.value, r.sessions]));
  const br = await outcomes.getDevices({ range, dimension: "browser", filters: { channel: "Paid Social" } });
  check(by(br.rows, "Safari").sessions === 3 && by(br.rows, "Chrome").sessions === 1 && br.totals.sessions === 4, "browser, filtered to Paid Social", br.rows.map((r) => [r.value, r.sessions]));
  check(dt.spendAvailable === false, "devices have no spend");

  // ── spend ──
  const cd = await reports.getAcquisition({ range, dimension: "campaignDetail" });
  const fb = cd.rows.find((r) => r.campaign === FB.campaign) || {};
  const gads = cd.rows.find((r) => r.campaign === GADS.campaign) || {};
  const li = cd.rows.find((r) => r.campaign === `${RUN}-li`) || {};
  check(cd.spendAvailable === true, "campaign grouping has spend");
  check(fb.spend === 50 && fb.costPerLead === 50 && fb.costPerWonLead === 50 && fb.roas === 12, "Facebook: $300 over 30 days → $50 in 5 days; CPL $50; ROAS 600/50 = 12", fb);
  check(gads.spend === 1000 && gads.costPerLead === 500 && gads.costPerWonLead === 1000 && gads.roas === 1.5, "Google: $1,000; 2 leads → CPL $500; 1 won → $1,000; ROAS 1,500/1,000 = 1.5", gads);
  check(li.spend === 200 && li.sessions === 0 && li.channel === "Paid Social" && li.costPerLead === null && li.roas === 0, "spend with no visits gets its own row (LinkedIn, paid by default)", li);
  check(cd.totals.spend === 1250 && cd.totals.costPerLead === Math.round((1250 / 3) * 100) / 100 && cd.totals.roas === Math.round((2100 / 1250) * 100) / 100, "totals: spend $1,250, CPL, ROAS", cd.totals);
  const ch = await reports.getAcquisition({ range, dimension: "channel" });
  check(by(ch.rows, "Paid Social").spend === 250 && by(ch.rows, "Paid Search").spend === 1000, "spend by channel (classified from source / medium)", ch.rows.map((r) => [r.value, r.spend]));
  const ps = await reports.getAcquisition({ range, dimension: "campaignDetail", filters: { channel: "Paid Search" } });
  check(ps.totals.spend === 1000 && ps.rows.every((r) => r.channel === "Paid Search"), "spend follows the channel filter");
  const half = await reports.getAcquisition({ range: rangeFromQuery({ range: "custom", from: "2017-05-10", to: "2017-05-11" }), dimension: "campaignDetail" });
  check((half.rows.find((r) => r.campaign === FB.campaign) || {}).spend === 20 && (half.rows.find((r) => r.campaign === GADS.campaign) || {}).spend === 400, "two days: $20 of Facebook, $400 of Google");
  const lp = await reports.getAcquisition({ range, dimension: "campaignDetail", filters: { content: "x" } });
  check(lp.spendAvailable === false && lp.rows.every((r) => r.spend === undefined), "no spend when filtered by ad (content)");
  const rev = await outcomes.getRevenue({ range, dimension: "campaignDetail", filters });
  check((rev.rows.find((r) => r.campaign === GADS.campaign) || {}).roas === 1.5 && rev.totals.spend === 1250, "Revenue report carries spend / ROAS too");

  // ── validation ──
  for (const [body, label] of [
    [{ source: "", campaign: "x", periodStart: FROM, periodEnd: TO, amount: 1 }, "source required"],
    [{ source: "facebook", campaign: "x", periodStart: TO, periodEnd: FROM, amount: 1 }, "end before start"],
    [{ source: "facebook", campaign: "x", periodStart: FROM, periodEnd: TO, amount: -5 }, "negative amount"],
    [{ source: "facebook", campaign: "x", periodStart: "2017-13-01", periodEnd: TO, amount: 5 }, "bad date"],
  ]) {
    let code = null;
    try { adSpend.cleanEntry(body); } catch (e) { code = e.code; }
    check(code === "VALIDATION_ERROR", `validation: ${label}`);
  }
}

async function httpChecks() {
  try {
    await fetch(`${BASE}/api/health`);
  } catch {
    // eslint-disable-next-line no-console
    console.log(`skip HTTP checks (API not reachable at ${BASE})`);
    return;
  }
  const token = jwt.sign({ sub: `${RUN}-user`, scope: "marketing", role: "Super Admin" }, getMarketingJwtSecret(), { expiresIn: "10m" });
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const q = `range=custom&from=${FROM}&to=${TO}`;
  check((await fetch(`${BASE}/api/admin/analytics/ad-spend?${q}`)).status === 401, "ad spend requires a Campaign Builder login");
  const bad = await fetch(`${BASE}/api/admin/analytics/ad-spend`, { method: "POST", headers: auth, body: JSON.stringify({ source: "x", campaign: "y", periodStart: FROM, periodEnd: TO, amount: "abc" }) });
  check(bad.status === 400, "POST invalid amount → 400");
  const created = await (await fetch(`${BASE}/api/admin/analytics/ad-spend`, { method: "POST", headers: auth, body: JSON.stringify({ source: "TikTok", campaign: `${RUN}-tt`, periodStart: FROM, periodEnd: TO, amount: 75.5, notes: "test" }) })).json();
  const id = created.data?.id;
  check(id && created.data.source === "tiktok" && created.data.channel === "Paid Social" && created.data.amount === 75.5, "POST creates (source lower-cased, channel derived)", created.data);
  const list = await (await fetch(`${BASE}/api/admin/analytics/ad-spend?${q}`, { headers: auth })).json();
  check(list.data.entries.some((e) => e.id === id && e.inPeriod === 75.5) && list.data.entries.some((e) => e.campaign === FB.campaign && e.inPeriod === 50), "GET lists the period's entries with their share", list.data.total);
  const patched = await (await fetch(`${BASE}/api/admin/analytics/ad-spend/${id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ amount: 80 }) })).json();
  check(patched.data?.amount === 80, "PATCH updates the amount");
  const del = await fetch(`${BASE}/api/admin/analytics/ad-spend/${id}`, { method: "DELETE", headers: auth });
  check(del.status === 200 && (await fetch(`${BASE}/api/admin/analytics/ad-spend/${id}`, { method: "DELETE", headers: auth })).status === 404, "DELETE removes (then 404)");
  const dev = await (await fetch(`${BASE}/api/admin/analytics/reports/audience/devices?${q}&dimension=os`, { headers: auth })).json();
  check(dev.data?.rows.some((r) => r.value === "iOS" && r.sessions === 3), "GET /reports/audience/devices?dimension=os");
  check((await fetch(`${BASE}/api/admin/analytics/reports/audience/devices?${q}&dimension=password`, { headers: auth })).status === 400, "unknown device dimension → 400");
  const csv = await (await fetch(`${BASE}/api/admin/analytics/reports/acquisition?${q}&dimension=campaignDetail&format=csv`, { headers: auth })).text();
  check(/spend_usd/.test(csv.split("\n")[0]) && /roas_lead_revenue/.test(csv.split("\n")[0]), "campaign CSV has spend / ROAS columns");
}

async function cleanup() {
  for (const id of spendIds) {
    // eslint-disable-next-line no-await-in-loop
    await adSpend.deleteEntry(id);
  }
  await db().query("DELETE FROM marketing_ad_spend WHERE campaign LIKE :like", { replacements: { like: `${RUN}%` } });
  const like = `${RUN}%`;
  for (const sql of [
    "DELETE FROM marketing_analytics_events WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_sessions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_visitors WHERE visitor_id LIKE :like",
    "DELETE FROM lead_submissions WHERE visitor_id LIKE :like",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await db().query(sql, { replacements: { like } });
  }
}

(async () => {
  try {
    await seed();
    await serviceChecks();
    await httpChecks();
  } finally {
    await cleanup();
  }
  // eslint-disable-next-line no-console
  console.log(failures ? `[devices-spend-test] ${failures} failed` : "[devices-spend-test] passed");
  process.exit(failures ? 1 : 0);
})().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await cleanup().catch(() => {});
  process.exit(1);
});
