/**
 * Reporting Phase C checks on a controlled fixture (local DB only; every row is removed):
 * lead quality (current-status counts, rates, reconciliation with Overview / campaign report),
 * attribution comparison (Google Ads → Direct → LinkedIn organic → Direct conversion credited under
 * all six models, for leads, won leads and revenue), Direct semantics (true last touch vs
 * operational vs conversion session), organic search / social / referral grouping, new vs
 * returning, lead vs order revenue kept separate, previous-period comparison, trends, multi-status
 * lead filter, timezone, CSV (filters, model, formula neutralisation, Unknown buckets) and
 * permissions. Window: 2018-03-05 … 2018-03-18 (New York business days).
 *   npm run marketing:outcome-test            (-- --keep leaves the fixture; -- --cleanup=<run id> removes it)
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getMarketingJwtSecret } = require("../services/auth.service");
const { getSessionModel } = require("../models/session");
const { getVisitorModel } = require("../models/visitor");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const reports = require("../services/reports.service");
const outcomes = require("../services/outcomeReports.service");
const conv = require("../services/conversionReports.service");
const { rangeFromQuery, compareRangeFromQuery } = require("../utils/reportQuery");
const { toSqlUtc } = require("../utils/dateRange");

const BASE = (process.env.MARKETING_TEST_BASE_URL || "http://localhost:8013").replace(/\/api\/?$/, "").replace(/\/+$/, "");
const CLEANUP = (process.argv.find((a) => a.startsWith("--cleanup=")) || "").slice("--cleanup=".length);
const RUN = CLEANUP || `rpc-${Date.now()}`;
const FROM = "2018-03-05";
const TO = "2018-03-18";
const T = (month, day, hour, min = 0) => new Date(Date.UTC(2018, month - 1, day, hour, min)); // UTC
const M = (day, hour, min = 0) => T(3, day, hour, min);
let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
}
const db = () => getMarketingSequelize();
let orderSeq = 0;

// Touches (channel / source / medium / campaign), as utils/attribution.js writes them.
const GADS = { channel: "Paid Search", source: "google", medium: "cpc", campaign: "spring_ads" };
const DIRECT = { channel: "Direct", source: "direct", medium: "none" };
const LI_ORG = { channel: "Organic Social", source: "linkedin", medium: "organic_social" };
const G_ORG = { channel: "Organic Search", source: "google", medium: "organic" };
const B_ORG = { channel: "Organic Search", source: "bing", medium: "organic" };
const DDG = { channel: "Organic Search", source: "duckduckgo", medium: "organic" };
const FB_PAID = { channel: "Paid Social", source: "facebook", medium: "paid_social", campaign: "fb_spring" };
const PARTNER = { channel: "Referral", source: "partner.example", medium: "referral", campaign: "=SUM(1,2)" };

async function seed() {
  const Visitor = getVisitorModel();
  const Session = getSessionModel();
  const Lead = getLeadSubmissionModel();
  const withTime = (touch, at) => ({ ...touch, receivedAt: at.toISOString() });
  const visitor = (id, firstTouch, at) => Visitor.create({ visitorId: `${RUN}-${id}`, firstSeenAt: at, lastSeenAt: at, firstTouch: withTime(firstTouch, at) });
  const session = (vid, sid, start, touch, referrer = null) =>
    Session.create({
      sessionId: `${RUN}-${sid}`, visitorId: `${RUN}-${vid}`, startedAt: start, endedAt: new Date(start.getTime() + 15 * 60000),
      entryPathname: "/", channel: touch.channel, source: touch.source, medium: touch.medium, campaign: touch.campaign || null,
      referrer, touch: touch,
    });
  /** Lead with every attribution model set explicitly: { op, first, last, lnd, session, conversion }. */
  const lead = (vid, sid, at, t, extra = {}) => {
    const flat = (prefix, touch) => (touch ? { [`${prefix}Source`]: touch.source, [`${prefix}Medium`]: touch.medium, [`${prefix}Channel`]: touch.channel } : {});
    return Lead.create({
      pageUrl: "https://www.example.test/contact", fields: { name: "C" }, submittedAt: at, testMode: false, conversionStatus: "new",
      submitStatus: "success", attribution: {}, device: {}, visitorId: vid ? `${RUN}-${vid}` : null, sessionId: sid ? `${RUN}-${sid}` : null,
      pageType: "site", pageSlug: `${RUN}-page`,
      channel: t.op?.channel ?? null, source: t.op?.source ?? null, medium: t.op?.medium ?? null, campaign: t.op?.campaign ?? null,
      firstTouch: t.first || null, ...flat("firstTouch", t.first),
      lastTouch: t.last || null, ...flat("lastTouch", t.last),
      lastNonDirectTouch: t.lnd || null, ...flat("lnd", t.lnd),
      sessionTouch: t.session || null, conversionTouch: t.conversion || null,
      ...extra,
    });
  };
  const one = (touch) => ({ op: touch, first: touch, last: touch, lnd: touch.channel === "Direct" ? null : touch, session: touch, conversion: touch });
  const order = (vid, paidAt, revenue, touch) =>
    db().query(
      `INSERT INTO marketing_order_attribution (order_id, visitor_id, session_id, first_touch, last_touch, status, paid_at, revenue)
       VALUES (:oid, :v, :s, :t, :t, 'paid', :paid, :rev)`,
      { replacements: { oid: 800000000 + (Date.now() % 90000000) + (orderSeq += 1), v: `${RUN}-${vid}`, s: `${RUN}-${vid}-o`, t: JSON.stringify(touch), paid: toSqlUtc(paidAt), rev: revenue } },
    );

  // A1 (item 36): Google Ads → Direct → LinkedIn organic → Direct conversion. Won, $1,000.
  await visitor("a1", GADS, M(5, 16));
  await session("a1", "a1s1", M(5, 16), GADS);
  await session("a1", "a1s2", M(6, 16), DIRECT);
  await session("a1", "a1s3", M(7, 16), LI_ORG, "https://www.linkedin.com/");
  await session("a1", "a1s4", M(8, 16), DIRECT);
  await lead("a1", "a1s4", M(8, 16, 5), { op: LI_ORG, first: GADS, last: DIRECT, lnd: LI_ORG, session: DIRECT, conversion: DIRECT }, { conversionStatus: "won", revenue: 1000 });

  // B1 (item 37, visitor A): Google Ads → Direct → lead. Qualified.
  await visitor("b1", GADS, M(9, 16));
  await session("b1", "b1s1", M(9, 16), GADS);
  await session("b1", "b1s2", M(10, 16), DIRECT);
  await lead("b1", "b1s2", M(10, 16, 5), { op: GADS, first: GADS, last: DIRECT, lnd: GADS, session: DIRECT, conversion: DIRECT }, { conversionStatus: "qualified" });
  // B2 (item 37, visitor B): Direct → lead. Won, $300. Also a $80 online order (Direct).
  await visitor("b2", DIRECT, M(11, 16));
  await session("b2", "b2s1", M(11, 16), DIRECT);
  await lead("b2", "b2s1", M(11, 16, 5), one(DIRECT), { conversionStatus: "won", revenue: 300 });
  await order("b2", M(15, 16), 80, DIRECT);

  // Organic / referral (item 38).
  await visitor("c1", G_ORG, M(12, 16));
  await session("c1", "c1s1", M(12, 16), G_ORG, "https://www.google.com/");
  // Revenue entered on a QUALIFIED lead is not lead revenue (only won leads count).
  await lead("c1", "c1s1", M(12, 16, 5), one(G_ORG), { conversionStatus: "qualified", revenue: 999 });
  await visitor("c2", B_ORG, M(12, 17));
  await session("c2", "c2s1", M(12, 17), B_ORG, "https://www.bing.com/");
  await lead("c2", "c2s1", M(12, 17, 5), one(B_ORG), { conversionStatus: "won", revenue: 500 });
  await order("c2", M(15, 17), 200, B_ORG);
  await visitor("c3", LI_ORG, M(13, 16));
  await session("c3", "c3s1", M(13, 16), LI_ORG, "https://www.linkedin.com/feed/");
  await lead("c3", "c3s1", M(13, 16, 5), one(LI_ORG), { conversionStatus: "contacted" });
  await visitor("c4", PARTNER, M(13, 17));
  await session("c4", "c4s1", M(13, 17), PARTNER, "https://partner.example/blog/post?utm=x&token=secret");
  await lead("c4", "c4s1", M(13, 17, 5), one(PARTNER), { conversionStatus: "lost" });
  await visitor("c5", DIRECT, M(14, 16));
  await session("c5", "c5s1", M(14, 16), DIRECT);
  await visitor("c6", DDG, M(14, 17));
  await session("c6", "c6s1", M(14, 17), DDG, "https://duckduckgo.com/");
  await visitor("c7", FB_PAID, M(14, 18));
  await session("c7", "c7s1", M(14, 18), FB_PAID);

  // D1: Google Ads, won WITHOUT an amount entered (average won value ignores it).
  await visitor("d1", GADS, M(15, 16));
  await session("d1", "d1s1", M(15, 16), GADS);
  await lead("d1", "d1s1", M(15, 16, 5), one(GADS), { conversionStatus: "won" });
  // E1: legacy lead without visitor / session / attribution; 2018-03-19 03:00 UTC = 03-18 23:00 New York (inside).
  await lead(null, null, T(3, 19, 3), {}, { conversionStatus: "new", pageSlug: `${RUN}-page` });

  // Excluded: a test lead and a lead at 2018-03-19 01:00 New York (outside the window).
  await lead("d1", "d1s1", M(15, 16, 30), one(GADS), { conversionStatus: "won", revenue: 5000, testMode: true });
  await lead("d1", "d1s1", T(3, 19, 5), one(GADS), { conversionStatus: "won", revenue: 777 });
  // Order without any recorded visit (visitor unknown to marketing sessions).
  await order("nov", M(16, 16), 50, GADS);

  // Previous period (2018-02-19 … 03-04): one won Google Ads lead ($400) and a $100 order.
  await visitor("p1", GADS, T(2, 20, 16));
  await session("p1", "p1s1", T(2, 20, 16), GADS);
  await lead("p1", "p1s1", T(2, 20, 16, 5), one(GADS), { conversionStatus: "won", revenue: 400 });
  await order("p1", T(2, 21, 16), 100, GADS);
}

const rowOf = (data, value) => data.rows.find((r) => r.value.toLowerCase() === String(value).toLowerCase());

async function checks() {
  const range = rangeFromQuery({ from: FROM, to: TO });
  const compareRange = compareRangeFromQuery({ compare: "previous" }, range);

  // ── lead quality ──
  const lq = await outcomes.getLeadQuality({ range, compareRange, model: "operational", dimension: "channel" });
  const t = lq.totals;
  check(t.leads === 9, "lead quality: 9 real leads (test + out-of-window excluded, timezone edge included)", t.leads);
  check(t.newLeads + t.contacted + t.qualified + t.wonLeads + t.lost === t.leads, "statuses are exclusive: New + Contacted + Qualified + Won + Lost = leads");
  check(t.newLeads === 1 && t.contacted === 1 && t.qualified === 2 && t.wonLeads === 4 && t.lost === 1, "current-status counts 1 / 1 / 2 / 4 / 1", t);
  check(t.reachedQualified === 6 && t.qualifiedRate === 66.7, "qualified-or-won 6, qualified rate 66.7%", [t.reachedQualified, t.qualifiedRate]);
  check(t.winRate === 44.4 && t.lossRate === 11.1, "win rate 44.4%, loss rate 11.1%", [t.winRate, t.lossRate]);
  check(t.leadRevenue === 1800, "lead revenue = won leads only ($999 on a qualified lead and the test lead ignored)", t.leadRevenue);
  check(t.averageWonValue === 600 && t.revenuePerLead === 200 && t.revenuePerQualifiedLead === 300, "average won value 600 (3 won with an amount), revenue per lead 200, per qualified 300", [t.averageWonValue, t.revenuePerLead, t.revenuePerQualifiedLead]);
  check(lq.funnel.map((s) => s.leads).join(",") === "9,7,6,4", "current-state funnel Lead 9 → Contacted+ 7 → Qualified+ 6 → Won 4", lq.funnel);
  const ps = rowOf(lq, "Paid Search");
  const os = rowOf(lq, "Organic Search");
  check(ps && ps.leads === 2 && ps.reachedQualified === 2 && ps.wonLeads === 1 && ps.leadRevenue === 0, "Paid Search (operational): 2 leads, 2 qualified, 1 won, $0", ps);
  check(os && os.leads === 2 && os.wonLeads === 1 && os.leadRevenue === 500, "Organic Search: 2 leads, 1 won, $500", os);
  check(rowOf(lq, "Unknown")?.leads === 1, "legacy lead without attribution → Unknown bucket");
  check(lq.rows.reduce((a, r) => a + r.leads, 0) === 9 && lq.rows.reduce((a, r) => a + r.wonLeads, 0) === 4, "rows add up to the totals");
  const cmp = lq.comparison;
  check(cmp.leads.previous === 1 && cmp.wonLeads.delta === 3 && cmp.leadRevenue.deltaPct === 350, "compare: previous period 1 lead, won +3, lead revenue +350%", cmp.leadRevenue);
  check(cmp.lost.previous === 0 && cmp.lost.deltaPct === null, "compare: previous 0 → no percentage (safe)", cmp.lost);

  // ── reconciliation: Lead quality = Overview = campaign report (same model / filters) ──
  const ov = await reports.getOverview({ range, model: "operational" });
  const camp = await reports.getAcquisition({ range, model: "operational", dimension: "campaign" });
  check(ov.metrics.wonLeads.value === 4 && camp.totals.wonLeads === 4 && camp.rows.reduce((a, r) => a + r.wonLeads, 0) === 4, "won leads: lead quality = overview = campaign report = 4");
  check(ov.metrics.leadRevenue.value === 1800 && camp.totals.leadRevenue === 1800, "lead revenue reconciles across reports (1800)");
  check(ov.metrics.qualifiedLeads.value === 6 && ov.metrics.qualificationRate.value === 66.7 && ov.metrics.winRate.value === 44.4, "overview: qualified 6, qualification 66.7%, win rate 44.4%", ov.metrics.qualifiedLeads);
  const lqFirst = await outcomes.getLeadQuality({ range, model: "first", dimension: "channel" });
  check(rowOf(lqFirst, "Paid Search")?.leads === 3, "lead quality follows the model (first touch: Paid Search 3)");
  const lqCampaign = await outcomes.getLeadQuality({ range, model: "operational", dimension: "campaign", filters: { channel: "Paid Search" } });
  check(lqCampaign.totals.leads === 2 && rowOf(lqCampaign, "spring_ads")?.leads === 2, "drill filter: Paid Search → campaign spring_ads 2 leads");

  // ── attribution comparison (item 36: A1's single lead under each model) ──
  const ac = await outcomes.getAttributionComparison({ range, dimension: "channel" });
  const credit = (value, model) => rowOf(ac, value)?.models[model] || { leads: 0, wonLeads: 0, leadRevenue: 0 };
  const models = ["operational", "first", "last", "last_non_direct", "session", "conversion"];
  check(models.every((m) => ac.totals[m].leads === 9 && ac.totals[m].wonLeads === 4 && ac.totals[m].leadRevenue === 1800), "every model credits all 9 leads / 4 won / $1,800 exactly once");
  check(credit("Organic Social", "operational").leads === 2 && credit("Organic Social", "last_non_direct").leads === 2, "A1 → Organic Social under Operational and Last non-direct");
  check(credit("Paid Search", "first").leads === 3 && credit("Paid Search", "first").wonLeads === 2 && credit("Paid Search", "first").leadRevenue === 1000, "A1 → Paid Search under First touch (3 leads, 2 won, $1,000)", credit("Paid Search", "first"));
  check(credit("Direct", "last").leads === 3 && credit("Direct", "session").leads === 3 && credit("Direct", "conversion").leads === 3, "A1 → Direct under Last touch, Session and Conversion");
  check(credit("Direct", "last").leadRevenue === 1300 && credit("Direct", "operational").leadRevenue === 300, "revenue moves with credit: Direct $1,300 last touch vs $300 operational");
  check(credit("Unknown", "last_non_direct").leads === 2, "Last non-direct: no non-direct touch → Unknown (never Direct)");
  const acCampaign = await outcomes.getAttributionComparison({ range, dimension: "campaign" });
  check(rowOf(acCampaign, "spring_ads")?.models.first.leads === 3 && rowOf(acCampaign, "spring_ads")?.models.operational.leads === 2, "campaign credit: spring_ads 3 (first) vs 2 (operational)");

  // ── Direct (item 37) ──
  const d = await outcomes.getDirect({ range, compareRange });
  const s = d.summary;
  check(s.sessions === 5 && s.visitors === 4, "Direct visits: 5 sessions, 4 visitors", [s.sessions, s.visitors]);
  check(s.sessionDirect === 3 && s.lastTouchDirect === 3, "true last touch / conversion session = Direct for A1, B1, B2 (3)");
  check(s.operationalDirect === 1 && s.trulyDirect === 1 && s.creditedEarlier === 2, "operational: only B2 is Direct; 2 credited to earlier sources", s);
  check(s.earlierWon === 1 && s.earlierRevenue === 1000 && s.trulyRevenue === 300 && s.sessionRevenue === 1300, "Direct-visit outcomes split: truly $300, credited earlier $1,000");
  const b1 = d.creditedTo.find((x) => x.campaign === "spring_ads");
  check(b1 && b1.channel === "Paid Search" && b1.source === "google" && d.creditedTo.some((x) => x.channel === "Organic Social" && x.source === "linkedin"), "credited to: Paid Search / google / spring_ads and Organic Social / linkedin", d.creditedTo);
  check(s.directOrders === 1 && s.directOrderRevenue === 80, "Direct order revenue (no non-direct touch at checkout) $80");

  // ── organic search / social / referral (item 38) ──
  const osv = await reports.getAcquisition({ range, model: "operational", dimension: "searchEngine", filters: { channel: "Organic Search" } });
  const g = rowOf(osv, "Google");
  const bing = rowOf(osv, "Bing");
  check(g && g.sessions === 1 && g.leads === 1 && g.visitorToLeadRate === 100 && g.reachedQualified === 1 && g.wonLeads === 0, "Organic Search · Google: 1 visit, 1 lead, qualified", g);
  check(bing && bing.wonLeads === 1 && bing.leadRevenue === 500 && bing.orderRevenue === 200, "Organic Search · Bing: won $500 lead revenue, $200 order revenue (separate)", bing);
  check(rowOf(osv, "DuckDuckGo")?.sessions === 1 && rowOf(osv, "DuckDuckGo")?.leads === 0, "Organic Search · DuckDuckGo: visit without lead");
  const soc = await reports.getAcquisition({ range, model: "operational", dimension: "socialNetwork", filters: { channel: "Organic Social" } });
  const li = rowOf(soc, "LinkedIn");
  check(li && li.sessions === 2 && li.leads === 2 && li.wonLeads === 1 && li.leadRevenue === 1000, "Organic Social · LinkedIn: 2 visits, 2 leads, 1 won $1,000", li);
  check(!rowOf(soc, "Facebook"), "Paid Social (facebook ads) is not organic social");
  const paidSoc = await reports.getAcquisition({ range, model: "operational", dimension: "socialNetwork", filters: { channel: "Paid Social" } });
  check(rowOf(paidSoc, "Facebook")?.sessions === 1, "Paid Social · Facebook shown separately");
  const ref = await reports.getAcquisition({ range, model: "operational", dimension: "source", filters: { channel: "Referral" } });
  const partner = rowOf(ref, "partner.example");
  check(partner && partner.sessions === 1 && partner.leads === 1 && partner.lost === 1 && partner.reachedQualified === 0, "Referral · partner.example: 1 visit, 1 lead (lost)", partner);
  const urls = await outcomes.getReferrerUrls({ range, source: "partner.example" });
  check(urls.urls.length === 1 && urls.urls[0].url === "https://partner.example/blog/post" && urls.urls[0].leadSessions === 1, "referrer URL drill: query string dropped, 1 lead session", urls.urls);

  // ── new vs returning ──
  const nr = await outcomes.getNewReturning({ range, compareRange });
  const ret = nr.rows.find((r) => r.key === "returning");
  const nw = nr.rows.find((r) => r.key === "new");
  const unk = nr.rows.find((r) => r.key === "unknown");
  check(ret.visitors === 2 && ret.sessions === 6 && ret.leads === 2 && ret.visitorToLeadRate === 100 && ret.averageVisitsPerVisitor === 3, "returning: 2 visitors, 6 visits, 2 leads, 100%, 3 visits each", ret);
  check(nw.visitors === 9 && nw.leads === 6 && nw.visitorToLeadRate === 66.7, "new: 9 visitors, 6 leads, 66.7%", nw);
  check(unk && unk.leads === 1 && unk.orders === 1 && unk.orderRevenue === 50, "lead / order without a recorded visit → own row (totals reconcile)", unk);
  check(ret.leads + nw.leads + unk.leads === 9 && nw.orderRevenue === 280, "groups add up to all leads; new visitors' orders $280");
  const bret = nr.behaviour.find((b) => b.key === "returning");
  check(bret.medianSeconds === 173100 && bret.medianSessions === 3 && bret.sameSessionRate === 0, "returning conversion behaviour: median 2 days 5 min (173,100 s), 3 visits, 0% same visit", bret);
  check(nr.behaviour.find((b) => b.key === "new").sameSessionRate === 100, "new visitors: 100% same visit (by definition)");

  // ── revenue kept separate (item 39) ──
  const rev = await outcomes.getRevenue({ range, compareRange, model: "operational", dimension: "channel" });
  check(rev.totals.leadRevenue === 1800 && rev.totals.orderRevenue === 330 && rev.totals.orders === 3, "revenue totals: lead $1,800 and order $330 (3 orders), never summed", rev.totals);
  check(!("totalRevenue" in rev.totals) && rev.totals.averageOrderValue === 110, "no combined total; AOV 110");
  check(rev.comparison.orderRevenue.previous === 100, "revenue compare: previous order revenue 100");

  // ── trends / lead filter ──
  const tr = await conv.getTrends({ range, model: "operational" });
  const sum = (k) => tr.points.reduce((a, p) => a + p[k], 0);
  check(tr.points.length === 14 && sum("qualifiedLeads") === 6 && sum("wonLeads") === 4 && sum("leadRevenue") === 1800 && sum("orderRevenue") === 330, "trends: qualified 6, won 4, lead $1,800, order $330 over 14 days");
  const list = await reports.listLeads({ range, query: { status: "won,lost" } });
  check(list.total === 5, "lead list multi-status filter won + lost = 5", list.total);
}

async function httpChecks() {
  let up = true;
  try {
    await fetch(`${BASE}/api/public/tracking/health`).catch(() => fetch(BASE));
  } catch {
    up = false;
  }
  if (!up) {
    // eslint-disable-next-line no-console
    console.log(`skip HTTP checks (API not reachable at ${BASE})`);
    return;
  }
  const token = jwt.sign({ sub: "0", scope: "marketing", role: "Viewer" }, getMarketingJwtSecret(), { expiresIn: "5m" });
  const auth = { Authorization: `Bearer ${token}` };
  const q = `from=${FROM}&to=${TO}`;
  for (const path of ["lead-quality", "revenue", "attribution-comparison", "audience/new-returning", "audience/direct", "audience/referrer-urls?source=x&"]) {
    // eslint-disable-next-line no-await-in-loop
    const r = await fetch(`${BASE}/api/admin/analytics/reports/${path}${path.includes("?") ? "" : "?"}${q}`);
    check(r.status === 401, `${path.split("?")[0]}: requires a Campaign Builder login`);
  }
  const csv = async (path, extra = "") => {
    const r = await fetch(`${BASE}/api/admin/analytics/reports/${path}?${q}&format=csv${extra}`, { headers: auth });
    return { status: r.status, type: r.headers.get("content-type"), text: await r.text() };
  };
  const lq = await csv("lead-quality", "&dimension=channel");
  check(lq.status === 200 && /text\/csv/.test(lq.type) && lq.text.includes("qualified_rate,win_rate") && lq.text.includes("Unknown"), "lead-quality CSV (columns + Unknown bucket)");
  const lqFirst = await csv("lead-quality", "&dimension=channel&attribution=first");
  check(/\r\nPaid Search,first,3,/.test(lqFirst.text), "lead-quality CSV follows the attribution model (first: Paid Search 3)", lqFirst.text.split("\r\n").slice(0, 3));
  const lqCamp = await csv("lead-quality", "&dimension=campaign");
  check(lqCamp.text.includes("'=SUM(1,2)") && !/\r\n=SUM/.test(lqCamp.text), "CSV neutralises spreadsheet formulas");
  const lqFiltered = await csv("lead-quality", "&dimension=campaign&channel=Paid%20Search");
  check(lqFiltered.text.includes("spring_ads,operational,2,") && !lqFiltered.text.includes("SUM"), "CSV respects drill filters");
  const ac = await csv("attribution-comparison", "&dimension=channel");
  check(ac.text.replace(/^﻿/, "").startsWith("dimension,operational_leads,first_touch_leads,last_touch_leads,last_non_direct_leads,session_leads,conversion_leads,operational_won") && ac.text.includes("conversion_lead_revenue"), "attribution comparison CSV: six models × leads / won / revenue");
  const rv = await csv("revenue", "&dimension=channel");
  check(rv.text.includes("lead_revenue") && rv.text.includes("order_revenue") && !/total_revenue|combined/i.test(rv.text) && !/name|email|phone/i.test(rv.text.split("\r\n")[0]), "revenue CSV: separate lead / order revenue, no PII");
  const nr = await csv("audience/new-returning");
  check(nr.status === 200 && nr.text.includes("Returning visitors"), "new vs returning CSV");
  const bad = await fetch(`${BASE}/api/admin/analytics/reports/lead-quality?${q}&dimension=bogus`, { headers: auth });
  check(bad.status === 400, "unknown dimension → 400");
  const tz = await fetch(`${BASE}/api/admin/analytics/reports/lead-quality?${q}`, { headers: auth }).then((r) => r.json());
  check(tz.data.period.timeZone && tz.data.totals.leads === 9, "HTTP: timezone echoed, 9 leads");
}

async function cleanup() {
  const like = `${RUN}%`;
  for (const sql of [
    "DELETE FROM marketing_order_attribution WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_sessions WHERE visitor_id LIKE :like",
    "DELETE FROM marketing_visitors WHERE visitor_id LIKE :like",
    "DELETE FROM lead_submissions WHERE visitor_id LIKE :like OR page_slug = :page",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await db().query(sql, { replacements: { like, page: `${RUN}-page` } });
  }
}

async function run() {
  if (CLEANUP) {
    await cleanup();
    // eslint-disable-next-line no-console
    console.log(`[outcome-test] fixture ${RUN} removed`);
    return;
  }
  const [{ n }] = await db().query(
    "SELECT COUNT(*) AS n FROM lead_submissions WHERE submitted_at >= '2018-02-01' AND submitted_at < '2018-04-01'",
    { type: QueryTypes.SELECT },
  );
  if (Number(n) > 0) throw new Error("The 2018-02 / 03 test window already has leads (a kept fixture?) — remove them first.");
  const keep = process.argv.includes("--keep");
  try {
    await seed();
    await checks();
    await httpChecks();
  } finally {
    if (keep) {
      // eslint-disable-next-line no-console
      console.log(`[outcome-test] fixture kept (${FROM} … ${TO}); remove with --cleanup=${RUN}`);
    } else await cleanup();
  }
  // eslint-disable-next-line no-console
  console.log(failures ? `[outcome-test] ${failures} failed` : "[outcome-test] passed");
  if (failures) throw new Error(`${failures} outcome checks failed`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[outcome-test] failed:", error.message);
      process.exit(1);
    });
}

module.exports = { run };
