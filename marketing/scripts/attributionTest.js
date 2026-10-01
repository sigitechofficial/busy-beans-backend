/**
 * Attribution / lead-ingest checks (tracking spec Phases 1–3). Unit checks plus DB-backed
 * scenarios against the local marketing database; every row it writes is removed at the end.
 * Optional HTTP checks run against the local API (MARKETING_TEST_BASE_URL, default
 * http://localhost:8013) when it is up.
 *   npm run marketing:attribution-test
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getMarketingJwtSecret } = require("../services/auth.service");
const attribution = require("../utils/attribution");
const { serverTimestamp, safeDecode, cleanIdentity } = require("../utils/analyticsPayload");
const { leadAttrExpr } = require("../utils/leadAttributionSql");
const { trustProxySetting } = require("../../utils/trustProxy");
const touchpoints = require("../services/touchpoints.service");
const events = require("../services/analyticsEvents.service");
const leads = require("../services/leadSubmissions.service");

const BASE = (process.env.MARKETING_TEST_BASE_URL || "http://localhost:8013").replace(/\/api\/?$/, "").replace(/\/+$/, "");
const SITE = "https://www.example-site.test";
const RUN = `attr-test-${Date.now()}`;
let failures = 0;
function check(condition, label) {
  if (!condition) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
}

const touch = (url, referrer) => attribution.normalizeTouch({ landingUrl: url, referrer });

function unitChecks() {
  // Classification (server re-derives everything from the raw landing URL).
  const gads = touch(`${SITE}/?gclid=abc123&utm_campaign=brand`);
  check(gads.channel === "Paid Search" && gads.source === "google" && gads.clickIds.gclid === "abc123", "Google Ads click → Paid Search / google, gclid kept");
  const cpc = touch(`${SITE}/?utm_source=google&utm_medium=cpc&utm_campaign=x`);
  check(cpc.channel === "Paid Search" && cpc.medium === "cpc", "utm google/cpc → Paid Search");
  const meta = touch(`${SITE}/?utm_source=facebook&utm_medium=paid_social&fbclid=f1&ad_id=77&adset_name=Office`);
  check(meta.channel === "Paid Social" && meta.meta.adId === "77" && meta.meta.adsetName === "Office", "Meta ad → Paid Social with ad metadata");
  check(touch(`${SITE}/?fbclid=f1`).channel === "Organic Social", "fbclid alone → Organic Social (not paid)");
  check(touch(`${SITE}/`, "https://www.google.com/").channel === "Organic Search", "Google referrer → Organic Search");
  const ref = touch(`${SITE}/`, "https://blog.partner.test/post");
  check(ref.channel === "Referral" && ref.referrerDomain === "blog.partner.test", "external site → Referral");
  check(touch(`${SITE}/`).channel === "Direct", "no source → Direct");
  check(touch(`${SITE}/`, `${SITE}/pricing`).channel === "Direct", "own-site referrer is not a touch");
  check(touch(`${SITE}/`, "https://checkout.stripe.com/pay").channel === "Direct", "payment-provider return is not a referral");
  const alias = touch(`${SITE}/?utm_source=facebook&utm_medium=Paid-Social`);
  check(alias.channel === "Paid Social" && alias.medium === "paid-social", "medium alias → Paid Social, raw medium kept");
  const li = touch(`${SITE}/?utm_source=linkedin&utm_medium=cpc`);
  check(li.channel === "Paid Social", "linkedin/cpc → Paid Social");
  const extra = touch(`${SITE}/?utm_source=x&utm_medium=email&utm_audience=vip&utm_id=42`);
  check(extra.channel === "Email" && extra.extraUtm.utm_audience === "vip" && extra.utmId === "42", "unknown utm_* preserved, utm_id parsed");
  const conflict = touch(`${SITE}/?utm_source=facebook&utm_medium=paid_social&gclid=g1`);
  check(conflict.conflict === true && conflict.channel === "Paid Social", "UTM vs click-ID disagreement flagged (diagnostic only)");
  const allIds = touch(`${SITE}/?gbraid=a&wbraid=b&dclid=c&msclkid=d&ttclid=e&li_fat_id=f&twclid=g`);
  check(["gbraid", "wbraid", "dclid", "msclkid", "ttclid", "liFatId", "twclid"].every((k) => allIds.clickIds[k]), "all click IDs preserved");

  // Client claims are not trusted.
  const claimed = attribution.normalizeTouch({ channel: "Paid Search", source: "google", medium: "cpc", landingUrl: `${SITE}/` });
  check(claimed.channel === "Direct", "client-claimed channel ignored when the landing URL has no campaign");

  // Validation / privacy.
  const pii = touch(`${SITE}/?utm_source=a@b.com&email=a@b.com&utm_medium=email`);
  check(pii.source === "[redacted]" && !pii.landingUrl.includes("a%40b.com") && !pii.landingUrl.includes("a@b.com"), "email-like values redacted");
  const long = touch(`${SITE}/?utm_source=${"s".repeat(300)}&utm_term=${"t".repeat(900)}&gclid=${"g".repeat(900)}`);
  check(long.source.length === 100 && long.term.length === 500 && long.clickIds.gclid.length === 512, "source/term/click-ID length caps");
  check(attribution.cleanUrl(`${SITE}/?q=${"x".repeat(5000)}`).length === 2048, "URL cap 2048");
  check(attribution.cleanUrl("javascript:alert(1)") === undefined, "non-http URL rejected");
  let threw = false;
  try {
    attribution.normalizeTouch({ landingUrl: "http://%%%", referrer: "::::" });
    attribution.parseCampaign("not a url");
  } catch {
    threw = true;
  }
  check(!threw, "malformed URLs never throw");
  check(safeDecode("%E0%A4%A") === "%E0%A4%A", "malformed %-sequence decodes safely");
  check(cleanIdentity("abc-123") === "abc-123" && cleanIdentity("a b") === "" && cleanIdentity("x".repeat(65)) === "", "identity validation");

  // Server time.
  const now = new Date();
  check(serverTimestamp("2020-01-01T00:00:00Z", now) === now, "ancient client timestamp → server time");
  check(serverTimestamp(new Date(now.getTime() + 3600e3).toISOString(), now) === now, "future client timestamp → server time");
  check(serverTimestamp("garbage", now) === now, "invalid client timestamp → server time");
  check(attribution.cleanTimestamp("2019-01-01T00:00:00Z") === undefined, "touch timestamp outside window dropped");

  // Report definitions + proxy setting.
  check(leadAttrExpr("source").includes("l.source") && leadAttrExpr("source", { touch: "first" }).includes("first_touch_source"), "report lead expressions per touch model");
  check(trustProxySetting(undefined) === 1 && trustProxySetting("2") === 2 && trustProxySetting("true") === 1 && trustProxySetting("loopback") === "loopback", "TRUST_PROXY_HOPS parsing");
}

const db = () => getMarketingSequelize();
const one = async (sql, replacements) => (await db().query(sql, { replacements, type: QueryTypes.SELECT }))[0];
let seq = 0;
const id = (p) => `${RUN}-${p}-${(seq += 1)}`;
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

async function visit(visitorId, sessionId, url, referrer) {
  const t = { landingUrl: url, referrer, timestamp: iso(), channel: "Paid Search", source: "spoofed" };
  const path = new URL(url).pathname;
  await touchpoints.ingestTouchpoint({ id: id("tp"), visitorId, sessionId, timestamp: iso(), pageUrl: url, pathname: path, touch: t });
  await events.ingestEvent({ id: id("ev"), visitorId, sessionId, eventType: "page_view", timestamp: iso(), pathname: path, pageUrl: url });
}

function leadPayload(visitorId, sessionId, extra = {}) {
  return {
    fields: { name: "Attr Test", email: "attr@example.com" },
    pageUrl: `${SITE}/contact`,
    eventId: `${RUN}-${(seq += 1)}-evt`.replace(/[^A-Za-z0-9-]/g, ""),
    visitorId,
    sessionId,
    // What a tampered/stale browser might claim.
    touches: { lastNonDirect: { channel: "Direct", source: "direct", landingUrl: `${SITE}/` } },
    ...extra,
  };
}

async function leadRow(result) {
  return one("SELECT * FROM lead_submissions WHERE id = ?", [Number(String(result.id).replace("sub_", ""))]);
}

async function scenarioChecks() {
  // Paid → internal navigation → lead: server records win over a tampered browser claim.
  {
    const v = id("v");
    const s = id("s");
    await visit(v, s, `${SITE}/?gclid=G-1&utm_source=google&utm_medium=cpc&utm_campaign=brand`);
    // Internal navigation: page views only, no touchpoint.
    await events.ingestEvent({ id: id("ev"), visitorId: v, sessionId: s, eventType: "page_view", timestamp: iso(), pathname: "/pricing" });
    const res = await leads.submitLead(leadPayload(v, s));
    const row = await leadRow(res);
    check(row.channel === "Paid Search" && row.source === "google" && row.campaign === "brand", "paid → internal nav → lead credited to Google Ads");
    check(row.gclid === "G-1" && row.attribution_basis === "server", "gclid on the lead; attribution from server records");
    check(Boolean(row.attribution_conflict), "tampered browser claim flagged as conflict");
    check(res.testMode === false && row.test_mode === 0, "no auth → real lead");
    const created = await one("SELECT page_type, event_type FROM marketing_analytics_events WHERE id = ?", [`lead-${row.event_id}`]);
    check(created && created.event_type === "lead_created", "server recorded lead_created with the lead's event id");
  }

  // Paid → direct return: first = Google Ads, session = Direct, last = Direct, lnd = Google Ads.
  {
    const v = id("v");
    const s1 = id("s");
    const s2 = id("s");
    await visit(v, s1, `${SITE}/?gclid=G-2`);
    await visit(v, s2, `${SITE}/`);
    const visitor = await one("SELECT first_touch, last_touch, last_non_direct_touch, click_ids FROM marketing_visitors WHERE visitor_id = ?", [v]);
    const j = (x) => (typeof x === "string" ? JSON.parse(x) : x);
    check(j(visitor.first_touch).channel === "Paid Search" && j(visitor.last_touch).channel === "Direct" && j(visitor.last_non_direct_touch).channel === "Paid Search", "direct revisit keeps last non-direct = Google Ads");
    check(j(visitor.click_ids).gclid.value === "G-2" && Boolean(j(visitor.click_ids).gclid.at), "click ID stored with its click time");
    const row = await leadRow(await leads.submitLead(leadPayload(v, s2, { touches: {} })));
    check(row.channel === "Paid Search" && row.lnd_channel === "Paid Search" && row.last_touch_channel === "Direct" && row.first_touch_channel === "Paid Search", "lead: source = Google Ads, last touch = Direct");
    check(j(row.session_touch).channel === "Direct" && j(row.conversion_touch).conversionPath === "/contact", "session touch Direct; conversion touch has the page");
    const lastExpr = leadAttrExpr("channel");
    const anyExpr = leadAttrExpr("channel", { touch: "lastAny" });
    const sessionExpr = leadAttrExpr("channel", { touch: "session" });
    const firstExpr = leadAttrExpr("channel", { touch: "first" });
    const lndExpr = leadAttrExpr("channel", { touch: "lnd" });
    const convExpr = leadAttrExpr("channel", { touch: "conversion" });
    const rep = await one(
      `SELECT ${lastExpr} AS leadSource, ${anyExpr} AS lastAny, ${sessionExpr} AS sess, ${firstExpr} AS first, ${lndExpr} AS lnd, ${convExpr} AS conv FROM lead_submissions l WHERE l.id = ?`,
      [row.id],
    );
    check(
      rep.leadSource === "Paid Search" && rep.lnd === "Paid Search" && rep.first === "Paid Search" && rep.lastAny === "Direct" && rep.sess === "Direct" && rep.conv === "Direct",
      "reports reach every model: lead source / first / last / last non-direct / session / conversion",
    );
    // The operational source never overwrites the models: each is stored on its own.
    check(
      j(row.first_touch).channel === "Paid Search" && j(row.last_touch).channel === "Direct" && j(row.last_non_direct_touch).channel === "Paid Search" && j(row.session_touch).channel === "Direct" && j(row.conversion_touch).channel === "Direct",
      "first / last / last non-direct / session / conversion touches all kept independently",
    );
  }

  // Google organic → LinkedIn ad → conversion.
  {
    const v = id("v");
    const s1 = id("s");
    const s2 = id("s");
    await visit(v, s1, `${SITE}/`, "https://www.google.com/");
    await visit(v, s2, `${SITE}/?utm_source=linkedin&utm_medium=paid_social&li_fat_id=L-1`);
    const row = await leadRow(await leads.submitLead(leadPayload(v, s2, { touches: {} })));
    check(row.first_touch_channel === "Organic Search" && row.channel === "Paid Social" && row.source === "linkedin" && row.li_fat_id === "L-1", "Google → LinkedIn → lead: first Organic Search, source LinkedIn");
  }

  // Paid Social → Campaign Builder-hosted /lp → internal navigation → form submit. The payloads
  // are what the OLD Campaign Builder bundle sent (a touchpoint on every page view, flat fields,
  // document.referrer re-read): the server must not turn the internal pages into touches.
  {
    const v = id("v");
    const s = id("s");
    const CB = "https://campaign.example-site.test";
    const fb = "https://l.facebook.com/";
    const cbTouch = (url, referrer, extra = {}) =>
      touchpoints.ingestTouchpoint({
        id: id("tp"), visitorId: v, sessionId: s, timestamp: iso(), pageUrl: url, pathname: new URL(url).pathname,
        referrer, source: "facebook", medium: "paid_social", campaign: "office_q4", category: "paid_social",
        landingPage: "office-coffee", isLandingPage: true, ...extra,
      }, { fromBrowser: true });
    const entry = await cbTouch(`${CB}/lp/office-coffee?utm_source=facebook&utm_medium=paid_social&utm_campaign=office_q4&fbclid=FB9`, fb);
    const internal = [
      await cbTouch(`${CB}/lp/office-coffee/pricing`, fb), // SPA: entry referrer still set
      await cbTouch(`${CB}/lp/machines`, `${CB}/lp/office-coffee/pricing`), // own-site referrer
      await cbTouch(`${CB}/lp/office-coffee`, undefined), // no referrer at all
    ];
    check(entry.stored && internal.every((r) => r.internal && !r.stored), "CB /lp internal navigation creates no touchpoint");
    const tpCount = await one("SELECT COUNT(*) AS n FROM marketing_touchpoints WHERE session_id = ?", [s]);
    check(Number(tpCount.n) === 1, "only the Paid Social entry touch is stored");
    const res = await leads.submitLead({
      fields: { name: "CB lead" },
      pageUrl: `${CB}/lp/office-coffee`,
      eventId: `${RUN}cb${(seq += 1)}`.replace(/[^A-Za-z0-9-]/g, ""),
      visitorId: v,
      sessionId: s,
      // Legacy CB lead payload (flat fields only; the old bundle sent only formSectionId).
      attribution: { source: "facebook", utmSource: "facebook", utmMedium: "paid_social", utmCampaign: "office_q4" },
      trafficCategory: "paid_social",
      formSectionId: "sec-hero-form",
    });
    const row = await leadRow(res);
    const j = (x) => (typeof x === "string" ? JSON.parse(x) : x);
    check(
      row.first_touch_channel === "Paid Social" && j(row.session_touch).channel === "Paid Social" && row.lnd_channel === "Paid Social" && row.last_touch_channel === "Paid Social",
      "CB /lp lead: first = session = last non-direct = last = Paid Social",
    );
    check(row.channel === "Paid Social" && row.source === "facebook" && row.campaign === "office_q4" && row.fbclid === "FB9", "CB /lp lead source = facebook / office_q4, fbclid kept");
    check(row.form_id === "sec-hero-form" && row.section_id === "sec-hero-form", "CB /lp lead (old bundle, formSectionId only): form_id + section_id populated");
    const current = await leadRow(await leads.submitLead({
      fields: { name: "CB lead 2" }, pageUrl: `${CB}/lp/office-coffee`, visitorId: v, sessionId: s,
      formId: "quote-form", sectionId: "sec-footer", formSectionId: "sec-footer",
    }));
    check(current.form_id === "quote-form" && current.section_id === "sec-footer", "CB /lp lead (current bundle): form_id + section_id populated");
    const site = await leadRow(await leads.submitLead({
      fields: { name: "Site lead" }, pageUrl: `${SITE}/contact`, visitorId: v, sessionId: s, formId: "contact", sectionId: "contact-main",
    }));
    check(site.form_id === "contact" && site.section_id === "contact-main", "website lead: formId / sectionId unchanged");
  }

  // Session touch is write-once (a second touchpoint in the same session doesn't replace it).
  {
    const v = id("v");
    const s = id("s");
    await visit(v, s, `${SITE}/?utm_source=newsletter&utm_medium=email`);
    await visit(v, s, `${SITE}/?utm_source=facebook&utm_medium=paid_social`);
    const session = await one("SELECT channel, source FROM marketing_sessions WHERE session_id = ?", [s]);
    check(session.channel === "Email" && session.source === "newsletter", "session acquisition touch is write-once");
  }

  // Storage blocked / no server records: validated client touches are used.
  {
    const res = await leads.submitLead({
      fields: { name: "No storage" },
      pageUrl: `${SITE}/contact`,
      touches: { session: { landingUrl: `${SITE}/?utm_source=bing&utm_medium=cpc&msclkid=M1`, channel: "Direct" } },
    });
    const row = await leadRow(res);
    check(row.channel === "Paid Search" && row.source === "bing" && row.msclkid === "M1" && row.attribution_basis === "client", "no visitor id: client touch re-classified by the server");
    await db().query("DELETE FROM lead_submissions WHERE id = ?", { replacements: [row.id] });
  }

  // Test mode is server-decided.
  {
    const v = id("v");
    const s = id("s");
    const spoof = await leads.submitLead(leadPayload(v, s, { testMode: true }));
    check(spoof.testMode === false, "body testMode:true ignored (spoofed test mode)");
    const token = jwt.sign({ id: 1, scope: "marketing" }, getMarketingJwtSecret(), { expiresIn: "5m" });
    const admin = await leads.submitLead(leadPayload(v, s), { authorization: `Bearer ${token}` });
    check(admin.testMode === true, "Campaign Builder session → test lead");
    const created = await one("SELECT id FROM marketing_analytics_events WHERE id = ?", [`lead-${(await leadRow(admin)).event_id}`]);
    check(!created, "test lead records no lead_created event");
    const noScope = jwt.sign({ id: 1 }, getMarketingJwtSecret(), { expiresIn: "5m" });
    check((await leads.submitLead(leadPayload(v, s), { authorization: `Bearer ${noScope}` })).testMode === false, "token without marketing scope → real lead");
    check((await leads.submitLead(leadPayload(v, s), { authorization: "Bearer not-a-jwt" })).testMode === false, "invalid token → real lead");
    const page = await one("SELECT id, preview_token FROM landing_pages WHERE preview_token IS NOT NULL LIMIT 1");
    if (page) {
      const good = await leads.submitLead(leadPayload(v, s, { previewToken: page.preview_token, landingPageId: page.id }));
      const bad = await leads.submitLead(leadPayload(v, s, { previewToken: "wrong-token", landingPageId: page.id }));
      check(good.testMode === true && bad.testMode === false, "valid preview token → test; wrong token → real");
    } else {
      // eslint-disable-next-line no-console
      console.log("skip preview-token check (no landing page has a preview token)");
    }
  }

  // Server-authoritative time.
  {
    const v = id("v");
    const s = id("s");
    const before = Date.now();
    const old = await leadRow(await leads.submitLead(leadPayload(v, s, { submittedAt: "2020-01-01T00:00:00Z" })));
    check(new Date(old.submitted_at).getTime() >= before - 2000 && old.client_submitted_at === null, "spoofed submittedAt ignored (server time; out-of-range client time dropped)");
    const clientAt = iso(-60000);
    const fresh = await leadRow(await leads.submitLead(leadPayload(v, s, { clientSubmittedAt: clientAt })));
    check(Math.abs(new Date(fresh.client_submitted_at).getTime() - Date.parse(clientAt)) < 1500, "plausible client time kept separately");
  }

  // Validation, spam, idempotency.
  {
    const v = id("v");
    const s = id("s");
    const reject = async (payload) => leads.submitLead(payload).then(() => false, (e) => e.code === "VALIDATION_ERROR");
    check(await reject(leadPayload(v, s, { fields: { note: "x".repeat(6000) } })), "oversized field value rejected");
    check(await reject(leadPayload(v, s, { fields: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`f${i}`, "x"])) })), "too many fields rejected");
    check(await reject(leadPayload(v, s, { fields: { nested: { a: 1 } } })), "non-text field value rejected");
    check(await reject(leadPayload(v, s, { pageUrl: "not a url" })), "malformed pageUrl → 400, not 500");
    const long = await leadRow(await leads.submitLead(leadPayload(v, s, { touches: { session: { landingUrl: `${SITE}/?utm_source=${"s".repeat(400)}&utm_medium=email` } }, visitorId: undefined, sessionId: undefined })));
    check(long.source.length === 100, "oversized utm_source capped at 100");
    await db().query("DELETE FROM lead_submissions WHERE id = ?", { replacements: [long.id] });

    const count = async () => Number((await one("SELECT COUNT(*) AS n FROM lead_submissions WHERE visitor_id = ?", [v])).n);
    const before = await count();
    const bot = await leads.submitLead(leadPayload(v, s, { fields: { name: "bot", bb_hp: "http://spam" } }));
    const bot2 = await leads.submitLead(leadPayload(v, s, { honeypot: "filled" }));
    check(bot.stored && bot.testMode && bot.id === null && bot2.id === null && (await count()) === before, "honeypot: normal-looking response, nothing stored");

    const same = leadPayload(v, s);
    const [a, b] = await Promise.all([leads.submitLead(same), leads.submitLead(same)]);
    const c = await leads.submitLead(same);
    check(a.id === b.id && b.id === c.id && (await count()) === before + 1, "same event id → one lead (race-safe, idempotent)");
    const withHp = await leadRow(await leads.submitLead(leadPayload(v, s, { fields: { name: "ok", bb_hp: "" } })));
    const f = typeof withHp.fields === "string" ? JSON.parse(withHp.fields) : withHp.fields;
    check(!("bb_hp" in f), "empty honeypot field never stored");
  }

  // Duplicate events / touchpoints, malformed paths, editor traffic.
  {
    const v = id("v");
    const s = id("s");
    const ev = { id: id("ev"), visitorId: v, sessionId: s, eventType: "cta_click", timestamp: iso(), pathname: "/" };
    const results = await Promise.all([events.ingestEvent(ev), events.ingestEvent(ev), events.ingestEvent(ev)]);
    check(results.filter((r) => r.stored).length === 1 && results.filter((r) => r.duplicate).length === 2, "concurrent duplicate events: one stored, rest duplicate (no error)");
    const tp = { id: id("tp"), visitorId: v, sessionId: s, timestamp: iso(), pageUrl: `${SITE}/`, pathname: "/" };
    const tps = await Promise.all([touchpoints.ingestTouchpoint(tp), touchpoints.ingestTouchpoint(tp)]);
    check(tps.filter((r) => r.stored).length === 1, "concurrent duplicate touchpoints: one stored");
    const bad = await events.ingestEvent({ id: id("ev"), visitorId: v, sessionId: s, eventType: "page_view", timestamp: iso(), pathname: "/lp/%E0%A4%A" });
    check(bad.stored, "malformed /lp/% path stored, no error");
    const rejectEvent = (p) => events.ingestEvent(p).then(() => false, (e) => e.code === "VALIDATION_ERROR");
    check(await rejectEvent({ ...ev, id: "bad id with spaces" }), "invalid event id rejected");
    check(await rejectEvent({ ...ev, id: id("ev"), eventType: "<script>" }), "invalid event type rejected");
    const skew = await events.ingestEvent({ ...ev, id: id("ev"), timestamp: "2031-01-01T00:00:00Z" }, { fromBrowser: true });
    const skewRow = await one("SELECT timestamp, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.clientTimestamp')) AS ct FROM marketing_analytics_events WHERE session_id = ? AND JSON_EXTRACT(metadata, '$.clientTimestamp') IS NOT NULL", [s]);
    check(skew.stored && skewRow && new Date(skewRow.timestamp).getFullYear() < 2031 && skewRow.ct.startsWith("2031"), "future event time replaced by server time, client time kept in metadata");

    const pv = id("s");
    const prev = await events.ingestEvent({ id: id("ev"), visitorId: v, sessionId: pv, eventType: "page_view", timestamp: iso(), pathname: "/preview/landing-page/abc" });
    const prevRow = await one("SELECT page_type, site FROM marketing_analytics_events WHERE session_id = ?", [pv]);
    check(prev.preview && prevRow.page_type === "preview" && prevRow.site === "campaign-preview", "preview traffic marked (page_type preview)");
    const prevSession = await one("SELECT session_id FROM marketing_sessions WHERE session_id = ?", [pv]);
    check(!prevSession, "preview traffic creates no session");
    const staffTp = await touchpoints.ingestTouchpoint({ id: id("tp"), visitorId: v, sessionId: pv, timestamp: iso(), pageUrl: `${SITE}/lp/x?utm_source=test`, pathname: "/lp/x" }, { staff: true });
    check(staffTp.preview && !staffTp.stored, "Campaign Builder staff touchpoint not stored");
  }
}

async function httpChecks() {
  let up = false;
  try {
    up = (await fetch(`${BASE}/api/public/tracking/settings`)).status < 500;
  } catch {
    up = false;
  }
  if (!up) {
    // eslint-disable-next-line no-console
    console.log(`skip HTTP checks (API not reachable at ${BASE})`);
    return;
  }
  const headers = { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0" };
  const big = await fetch(`${BASE}/api/public/lead-submissions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields: { note: "x".repeat(70 * 1024) }, pageUrl: `${SITE}/` }),
  });
  check(big.status === 413, `public endpoint body limit 64kb (got ${big.status})`);
  const v = id("v");
  const leadEvt = await fetch(`${BASE}/api/public/tracking/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: id("ev"), visitorId: v, sessionId: id("s"), eventType: "lead_created", timestamp: iso(), pathname: "/" }),
  });
  const stored = await one("SELECT COUNT(*) AS n FROM marketing_analytics_events WHERE visitor_id = ?", [v]);
  check(leadEvt.status === 204 && Number(stored.n) === 0, "browser lead_created accepted but not stored (server records it)");
  const malformed = await fetch(`${BASE}/api/public/tracking/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: id("ev"), visitorId: v, sessionId: id("s"), eventType: "page_view", timestamp: iso(), pathname: "/lp/%E0%A4%A", pageUrl: "http://%%%" }),
  });
  check(malformed.status === 204, `malformed URL/path → 204, not 500 (got ${malformed.status})`);
}

async function cleanup() {
  const like = `${RUN}%`;
  const q = (sql) => db().query(sql, { replacements: { like } });
  await q("DELETE FROM marketing_analytics_events WHERE visitor_id LIKE :like OR id LIKE :like");
  await q("DELETE FROM marketing_touchpoints WHERE visitor_id LIKE :like");
  await q("DELETE FROM marketing_sessions WHERE visitor_id LIKE :like");
  await q("DELETE FROM marketing_visitors WHERE visitor_id LIKE :like");
  const ids = await db().query("SELECT event_id FROM lead_submissions WHERE visitor_id LIKE :like AND event_id IS NOT NULL", { replacements: { like }, type: QueryTypes.SELECT });
  for (const { event_id: e } of ids) {
    // eslint-disable-next-line no-await-in-loop
    await db().query("DELETE FROM marketing_analytics_events WHERE id = ?", { replacements: [`lead-${e}`] });
  }
  await q("DELETE FROM lead_submissions WHERE visitor_id LIKE :like");
}

async function run() {
  unitChecks();
  try {
    await scenarioChecks();
    await httpChecks();
  } finally {
    await cleanup();
  }
  // eslint-disable-next-line no-console
  console.log(failures ? `[attribution-test] ${failures} failed` : "[attribution-test] passed");
  if (failures) throw new Error(`${failures} attribution checks failed`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[attribution-test] failed:", error.message);
      process.exit(1);
    });
}

module.exports = { run };
