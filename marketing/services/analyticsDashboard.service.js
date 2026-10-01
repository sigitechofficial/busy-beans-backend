const { Op, literal } = require("sequelize");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getTouchpointModel } = require("../models/touchpoint");
const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { appendTimestampFilter } = require("../utils/dateRange");
const { leadAttrExpr } = require("../utils/leadAttributionSql");
const { rangeFromQuery } = require("../utils/reportQuery");
const { getPageStats } = require("./pageStats.service");
const customerReports = require("./customerReports.service");
const { formatTouchpointRow } = require("./touchpoints.service");
const { formatEventRow } = require("./analyticsEvents.service");
const { countNonTestLeads, countLeadVisitors } = require("./leadSubmissionsAdmin.service");
const { realEvents, realSessions, realTouchpoints } = require("../utils/reportFilters");

const FUNNEL_STEPS = [
  { step: "landing_page_view", label: "Landing page views" },
  { step: "cta_click", label: "CTA clicks" },
  { step: "form_start", label: "Form starts" },
  { step: "form_submit", label: "Form submits" },
  { step: "lead_created", label: "Leads created" },
  { step: "order_completed", label: "Orders completed" },
];

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function buildFunnel(countsByStep) {
  const funnel = [];
  let prevCount = null;

  for (const { step, label } of FUNNEL_STEPS) {
    const count = countsByStep[step] || 0;
    let dropOffPct = null;
    if (prevCount !== null && prevCount > 0) {
      dropOffPct = Math.round(((prevCount - count) / prevCount) * 100);
    }
    funnel.push({ step, label, count, dropOffPct });
    prevCount = count;
  }

  return funnel;
}

/**
 * Visitors in the range, split into new and returning (partition: new + returning = visitors).
 *   visitor    distinct visitor with a real (non-preview) session started in the range
 *              (same definition as the reports API, services/reports.service.js)
 *   returning  that visitor has 2+ distinct sessions up to the range end
 *   new        exactly one session up to the range end
 * Several page views in one session never make a visitor "returning". Server-only events
 * (e.g. a payment days later) are not visits.
 */
async function getVisitorStats(range) {
  const sequelize = getMarketingSequelize();
  const replacements = {};
  const active = [realSessions("s")];
  const upToEnd = [realSessions("s2")];
  if (range.end) {
    active.push("s.started_at <= :end");
    upToEnd.push("s2.started_at <= :end");
    replacements.end = range.end;
  }
  if (range.start) {
    active.push("s.started_at >= :start");
    replacements.start = range.start;
  }
  const [row] = await sequelize.query(
    `SELECT COUNT(*) AS visitors, COALESCE(SUM(v.sessions >= 2), 0) AS returning
     FROM (
       SELECT a.visitor_id, COUNT(DISTINCT s2.session_id) AS sessions
       FROM (SELECT DISTINCT s.visitor_id FROM marketing_sessions s WHERE ${active.join(" AND ")}) a
       JOIN marketing_sessions s2 ON s2.visitor_id = a.visitor_id AND ${upToEnd.join(" AND ")}
       GROUP BY a.visitor_id
     ) v`,
    { replacements, type: QueryTypes.SELECT },
  );
  const visitors = Number(row?.visitors || 0);
  const returningVisitors = Number(row?.returning || 0);
  return { visitors, newVisitors: visitors - returningVisitors, returningVisitors };
}

async function sumRevenueFromEvents(range) {
  const sequelize = getMarketingSequelize();
  const filter = appendTimestampFilter(range, "timestamp", "AND");
  const rows = await sequelize.query(
    `SELECT SUM(
       CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.revenue')) AS DECIMAL(20,2))
     ) AS total
     FROM marketing_analytics_events
     WHERE event_type IN ('payment_completed', 'order_completed')
     ${filter.sql}`,
    {
      replacements: { ...filter.replacements },
      type: QueryTypes.SELECT,
    },
  );
  return Number(rows[0]?.total || 0);
}

/**
 * Revenue of paid attributed orders (marketing_order_attribution) grouped by a UTM field of the
 * chosen touch ("last" = last_touch, "first" = first_touch). Keyed like the touchpoint rows.
 */
async function getOrderRevenueBy(range, touch, field, fallback) {
  const sequelize = getMarketingSequelize();
  const column = touch === "first" ? "first_touch" : "last_touch";
  const expr = `COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${column}, '$.${field}')), ''), '${fallback}')`;
  const filter = appendTimestampFilter(range, "paid_at", "AND");
  const rows = await sequelize.query(
    `SELECT ${expr} AS grp, SUM(revenue) AS revenue
     FROM marketing_order_attribution
     WHERE status = 'paid' ${filter.sql}
     GROUP BY ${expr}`,
    { replacements: { ...filter.replacements }, type: QueryTypes.SELECT },
  );
  const byGroup = {};
  for (const row of rows) byGroup[row.grp] = Number(row.revenue || 0);
  return byGroup;
}

async function getFunnelCounts(range) {
  const sequelize = getMarketingSequelize();
  const filter = appendTimestampFilter(range, "timestamp", "AND");
  const rows = await sequelize.query(
    `SELECT event_type, COUNT(*) AS cnt
     FROM marketing_analytics_events
     WHERE ${realEvents()} ${filter.sql}
     GROUP BY event_type`,
    {
      replacements: { ...filter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const counts = {};
  for (const row of rows) {
    counts[row.event_type] = Number(row.cnt || 0);
  }
  return counts;
}

async function getLeadCountsBySlug(range) {
  const sequelize = getMarketingSequelize();
  const leadFilter = appendTimestampFilter(range, "l.submitted_at", "AND");
  const rows = await sequelize.query(
    `SELECT
       l.landing_page_slug AS slug,
       MAX(l.landing_page_id) AS landingPageId,
       COUNT(*) AS leads
     FROM lead_submissions l
     WHERE l.test_mode = 0
       AND l.landing_page_slug IS NOT NULL
       AND l.landing_page_slug != ''
       ${leadFilter.sql}
     GROUP BY l.landing_page_slug`,
    {
      replacements: { ...leadFilter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const bySlug = {};
  for (const row of rows) {
    bySlug[row.slug] = {
      leads: Number(row.leads || 0),
      landingPageId: row.landingPageId || null,
    };
  }
  return bySlug;
}

/**
 * One row per source (or campaign). Visitors, leads, won leads and order revenue are each
 * grouped from their OWN table and merged on the group key (case-insensitive): a source or
 * campaign with leads but few / no tracked visitors still appears, and the lead column always
 * sums to the non-test leads in the range. Visitors come from touchpoints (a visitor is counted
 * under every source they arrived from in the range); leads use the lead attribution model
 * chosen by `touch` (utils/leadAttributionSql.js).
 */
async function getGroupedTraffic(range, touch, { field, fallback }) {
  const tpFilter = appendTimestampFilter(range, "tp.timestamp", "AND");
  const leadFilter = appendTimestampFilter(range, "l.submitted_at", "AND");
  const sequelize = getMarketingSequelize();
  const tpExpr = `COALESCE(NULLIF(tp.${field}, ''), '${fallback}')`;
  const leadExpr = leadAttrExpr(field, { touch });

  const visitorRows = await sequelize.query(
    `SELECT ${tpExpr} AS grp, COUNT(DISTINCT tp.visitor_id) AS visitors
     FROM marketing_touchpoints tp
     WHERE ${realTouchpoints("tp")} ${tpFilter.sql}
     GROUP BY ${tpExpr}`,
    { replacements: { ...tpFilter.replacements }, type: QueryTypes.SELECT },
  );
  const leadRows = await sequelize.query(
    `SELECT ${leadExpr} AS grp, COUNT(*) AS leads
     FROM lead_submissions l
     WHERE l.test_mode = 0 ${leadFilter.sql}
     GROUP BY ${leadExpr}`,
    { replacements: { ...leadFilter.replacements }, type: QueryTypes.SELECT },
  );
  const revenueByGroup = await getOrderRevenueBy(range, touch, field, fallback);
  const wonByGroup = await customerReports.getWonLeadsBy(range, leadExpr);

  const rows = new Map();
  const rowFor = (label) => {
    const name = String(label ?? "").trim() || fallback;
    const key = name.toLowerCase();
    if (!rows.has(key)) rows.set(key, { [field]: name, visitors: 0, leads: 0, revenue: 0, wonLeads: 0, wonRevenue: 0 });
    return rows.get(key);
  };
  for (const r of visitorRows) rowFor(r.grp).visitors += Number(r.visitors || 0);
  for (const r of leadRows) rowFor(r.grp).leads += Number(r.leads || 0);
  for (const [grp, revenue] of Object.entries(revenueByGroup)) rowFor(grp).revenue += Number(revenue || 0);
  for (const [key, won] of wonByGroup) {
    const row = rowFor(key);
    row.wonLeads += won.wonLeads;
    row.wonRevenue += won.wonRevenue;
  }
  return [...rows.values()].sort(
    (a, b) => b.visitors - a.visitors || b.leads - a.leads || String(a[field]).localeCompare(String(b[field])),
  );
}

async function getTrafficSources(range, touch) {
  return getGroupedTraffic(range, touch, { field: "source", fallback: "direct" });
}

async function getUtmCampaigns(range, touch) {
  return getGroupedTraffic(range, touch, { field: "campaign", fallback: "(not set)" });
}

/** Per landing page: id and view breakdowns by device / source / campaign (grouped, not per slug). */
async function getLandingPageBreakdowns(range) {
  const sequelize = getMarketingSequelize();
  const filter = appendTimestampFilter(range, "timestamp", "AND");
  const bySlug = new Map();
  const entry = (slug) => {
    if (!bySlug.has(slug)) {
      bySlug.set(slug, { landingPageId: null, deviceBreakdown: {}, sourceBreakdown: {}, campaignBreakdown: {} });
    }
    return bySlug.get(slug);
  };
  const ids = await sequelize.query(
    `SELECT landing_page_slug AS slug, MAX(landing_page_id) AS landingPageId
     FROM marketing_analytics_events
     WHERE page_type = 'landing_page' AND landing_page_slug IS NOT NULL ${filter.sql}
     GROUP BY landing_page_slug`,
    { replacements: { ...filter.replacements }, type: QueryTypes.SELECT },
  );
  for (const row of ids) entry(row.slug).landingPageId = row.landingPageId || null;
  const breakdowns = [
    ["deviceBreakdown", "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.deviceType')), ''), 'unknown')"],
    ["sourceBreakdown", "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.source')), ''), 'direct')"],
    ["campaignBreakdown", "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.campaign')), ''), '(not set)')"],
  ];
  for (const [key, expr] of breakdowns) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await sequelize.query(
      `SELECT landing_page_slug AS slug, ${expr} AS name, COUNT(*) AS cnt
       FROM marketing_analytics_events
       WHERE event_type = 'landing_page_view' AND page_type = 'landing_page' ${filter.sql}
       GROUP BY landing_page_slug, ${expr}`,
      { replacements: { ...filter.replacements }, type: QueryTypes.SELECT },
    );
    for (const row of rows) entry(row.slug)[key][row.name] = Number(row.cnt || 0);
  }
  return bySlug;
}

/**
 * Landing page table (from the daily rollups — see pageStats.service for definitions).
 * Field names kept for existing clients; conversionRate is now leads per session.
 */
async function getLandingPageMetrics(reportRange, legacyRange, touch) {
  const { rows } = await getPageStats({ range: reportRange, pageType: "landing_page", touch });
  const breakdowns = await getLandingPageBreakdowns(legacyRange);
  return rows
    .map((r) => {
      const extra = breakdowns.get(r.pageSlug) || {};
      return {
        landingPageSlug: r.pageSlug,
        landingPageId: extra.landingPageId || null,
        visitors: r.visitors,
        uniqueVisitors: r.visitors,
        sessions: r.sessions,
        views: r.views,
        entrances: r.entrances,
        bounceRate: r.bounceRate,
        exits: r.exits,
        avgTimeOnPageSec: Math.round(r.avgEngagedSec),
        avgEngagedSec: r.avgEngagedSec,
        avgScrollDepth: r.avgScrollDepth,
        ctaClicks: r.ctaClicks,
        formStarts: r.formStarts,
        formSubmissions: r.formSubmissions,
        leads: r.leads,
        orders: r.orders,
        revenue: r.revenue,
        repeatOrders: r.repeatOrders,
        repeatRevenue: r.repeatRevenue,
        wonLeads: r.wonLeads,
        wonRevenue: r.wonRevenue,
        leadWinRate: r.leadWinRate,
        customerRevenue: r.customerRevenue,
        conversionRate: r.leadConversionRate,
        orderConversionRate: r.orderConversionRate,
        deviceBreakdown: extra.deviceBreakdown || {},
        sourceBreakdown: extra.sourceBreakdown || {},
        campaignBreakdown: extra.campaignBreakdown || {},
      };
    })
    .sort((a, b) => b.visitors - a.visitors);
}

async function getRecentTouchpoints(range, limit = 20) {
  const Touchpoint = getTouchpointModel();
  const where = {};
  if (range.start || range.end) {
    where.timestamp = {};
    if (range.start) where.timestamp[Op.gte] = range.start;
    if (range.end) where.timestamp[Op.lte] = range.end;
  }

  const rows = await Touchpoint.findAll({
    where: { ...where, [Op.and]: [literal(realTouchpoints())] },
    order: [["timestamp", "DESC"]],
    limit,
  });

  return rows.map(formatTouchpointRow);
}

async function getRecentEvents(range, limit = 30) {
  const AnalyticsEvent = getAnalyticsEventModel();
  const where = {};
  if (range.start || range.end) {
    where.timestamp = {};
    if (range.start) where.timestamp[Op.gte] = range.start;
    if (range.end) where.timestamp[Op.lte] = range.end;
  }

  const rows = await AnalyticsEvent.findAll({
    where: { ...where, [Op.and]: [literal(realEvents())] },
    order: [["timestamp", "DESC"]],
    limit,
  });

  return rows.map(formatEventRow);
}

async function getDashboard(query = {}) {
  // Dates are business-timezone days (MARKETING_REPORT_TIMEZONE), "to" inclusive.
  const reportRange = rangeFromQuery(query, { defaultPreset: null });
  const range = {
    start: reportRange.start,
    end: reportRange.end ? new Date(reportRange.end.getTime() - 1000) : undefined,
  };
  const touch = query.touch === "first" ? "first" : "last";

  // Visitors = distinct visitors with a real session in the range (split new / returning).
  const { visitors: totalVisitors, newVisitors, returningVisitors } = await getVisitorStats(range);
  const funnelCounts = await getFunnelCounts(range);
  const totalLeads = await countNonTestLeads(range);
  funnelCounts.lead_created = totalLeads;
  const totalOrders = funnelCounts.order_completed || 0;
  const revenue = await sumRevenueFromEvents(range);
  // Visitors who submitted at least one lead / visitors (never above 100%).
  const leadVisitors = await countLeadVisitors(range);
  const conversionRate =
    totalVisitors > 0 ? roundOneDecimal((Math.min(leadVisitors, totalVisitors) / totalVisitors) * 100) : 0;
  const averageOrderValue =
    totalOrders > 0 ? roundOneDecimal(revenue / totalOrders) : 0;

  const trafficSources = await getTrafficSources(range, touch);
  const trafficSourceMediums = await customerReports.getTrafficSourceMediums(range, touch);
  const utmCampaigns = await getUtmCampaigns(range, touch);
  const customerSummary = await customerReports.getCustomerSummary(range);
  const customersBySource = await customerReports.getCustomersBySource(range, touch);
  const landingPages = await getLandingPageMetrics(reportRange, range, touch);
  const recentTouchpoints = await getRecentTouchpoints(range, 20);
  const recentEvents = await getRecentEvents(range, 30);
  const funnel = buildFunnel(funnelCounts);

  return {
    executive: {
      totalVisitors,
      totalLeads,
      totalOrders,
      revenue,
      conversionRate,
      averageOrderValue,
      newVisitors,
      returningVisitors,
      newCustomers: customerSummary.newCustomers,
      repeatCustomers: customerSummary.repeatCustomers,
      repeatRevenue: customerSummary.repeatRevenue,
      wonLeads: customerSummary.wonLeads,
      wonRevenue: customerSummary.wonRevenue,
      totalCustomerRevenue: customerSummary.totalCustomerRevenue,
      // Store activity (Phase 16): website sign-ins / sign-ups, add-to-carts, checkouts started.
      signIns: funnelCounts.login || 0,
      signUps: funnelCounts.sign_up || 0,
      addToCarts: funnelCounts.add_to_cart || 0,
      checkoutsStarted: funnelCounts.begin_checkout || 0,
    },
    marketing: {
      trafficSources,
      trafficSourceMediums,
      utmCampaigns,
      landingPages,
    },
    customers: {
      summary: customerSummary,
      bySource: customersBySource,
    },
    funnel,
    landingPages,
    recentTouchpoints,
    recentEvents,
    meta: {
      timeZone: reportRange.tz,
      from: reportRange.fromDay || null,
      to: reportRange.toDay || null,
      touch,
    },
  };
}

module.exports = {
  getDashboard,
};
