const { Op } = require("sequelize");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getTouchpointModel } = require("../models/touchpoint");
const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { appendTimestampFilter } = require("../utils/dateRange");
const { parseReportRange } = require("../utils/businessTime");
const { getPageStats } = require("./pageStats.service");
const customerReports = require("./customerReports.service");
const { formatTouchpointRow } = require("./touchpoints.service");
const { formatEventRow } = require("./analyticsEvents.service");
const { countNonTestLeads, countLeadVisitors } = require("./leadSubmissionsAdmin.service");

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

async function countUniqueVisitorsFromEvents(range) {
  const sequelize = getMarketingSequelize();
  const filter = appendTimestampFilter(range, "timestamp", "AND");
  const rows = await sequelize.query(
    `SELECT COUNT(DISTINCT visitor_id) AS cnt FROM marketing_analytics_events
     WHERE 1=1 ${filter.sql}`,
    {
      replacements: { ...filter.replacements },
      type: QueryTypes.SELECT,
    },
  );
  return Number(rows[0]?.cnt || 0);
}

async function countReturningVisitors(range) {
  const sequelize = getMarketingSequelize();
  const filter = appendTimestampFilter(range, "last_seen_at", "AND");
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM marketing_visitors
     WHERE first_seen_at < last_seen_at ${filter.sql}`,
    {
      replacements: { ...filter.replacements },
      type: QueryTypes.SELECT,
    },
  );
  return Number(rows[0]?.cnt || 0);
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
     WHERE 1=1 ${filter.sql}
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

async function getTrafficSources(range, touch) {
  const tpFilter = appendTimestampFilter(range, "tp.timestamp", "AND");
  const leadFilter = appendTimestampFilter(range, "l.submitted_at", "AND");

  const sequelize = getMarketingSequelize();
  const rows = await sequelize.query(
    `SELECT
       COALESCE(NULLIF(tp.source, ''), 'direct') AS source,
       COUNT(DISTINCT tp.visitor_id) AS visitors
     FROM marketing_touchpoints tp
     WHERE 1=1 ${tpFilter.sql}
     GROUP BY COALESCE(NULLIF(tp.source, ''), 'direct')
     ORDER BY visitors DESC
     LIMIT 50`,
    {
      replacements: { ...tpFilter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const leadRows = await sequelize.query(
    `SELECT
       COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.source')), ''), 'direct') AS source,
       COUNT(*) AS leads
     FROM lead_submissions l
     WHERE l.test_mode = 0 ${leadFilter.sql}
     GROUP BY source`,
    {
      replacements: { ...leadFilter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const leadsBySource = {};
  for (const row of leadRows) {
    leadsBySource[row.source] = Number(row.leads || 0);
  }
  const revenueBySource = await getOrderRevenueBy(range, touch, "source", "direct");
  const wonBySource = await customerReports.getWonLeadsBy(range, customerReports.LEAD_SOURCE);

  return rows.map((row) => {
    const won = wonBySource.get(String(row.source).toLowerCase()) || { wonLeads: 0, wonRevenue: 0 };
    return {
      source: row.source,
      visitors: Number(row.visitors || 0),
      leads: leadsBySource[row.source] || 0,
      revenue: revenueBySource[row.source] || 0,
      wonLeads: won.wonLeads,
      wonRevenue: won.wonRevenue,
    };
  });
}

async function getUtmCampaigns(range, touch) {
  const tpFilter = appendTimestampFilter(range, "tp.timestamp", "AND");
  const leadFilter = appendTimestampFilter(range, "l.submitted_at", "AND");
  const sequelize = getMarketingSequelize();

  const rows = await sequelize.query(
    `SELECT
       COALESCE(NULLIF(tp.campaign, ''), '(not set)') AS campaign,
       COUNT(DISTINCT tp.visitor_id) AS visitors
     FROM marketing_touchpoints tp
     WHERE 1=1 ${tpFilter.sql}
     GROUP BY COALESCE(NULLIF(tp.campaign, ''), '(not set)')
     ORDER BY visitors DESC
     LIMIT 50`,
    {
      replacements: { ...tpFilter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const leadRows = await sequelize.query(
    `SELECT
       COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.utmCampaign')), ''), '(not set)') AS campaign,
       COUNT(*) AS leads
     FROM lead_submissions l
     WHERE l.test_mode = 0 ${leadFilter.sql}
     GROUP BY campaign`,
    {
      replacements: { ...leadFilter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const leadsByCampaign = {};
  for (const row of leadRows) {
    leadsByCampaign[row.campaign] = Number(row.leads || 0);
  }
  const revenueByCampaign = await getOrderRevenueBy(range, touch, "campaign", "(not set)");
  const wonByCampaign = await customerReports.getWonLeadsBy(range, customerReports.LEAD_CAMPAIGN);

  return rows.map((row) => {
    const won = wonByCampaign.get(String(row.campaign).toLowerCase()) || { wonLeads: 0, wonRevenue: 0 };
    return {
      campaign: row.campaign,
      visitors: Number(row.visitors || 0),
      leads: leadsByCampaign[row.campaign] || 0,
      revenue: revenueByCampaign[row.campaign] || 0,
      wonLeads: won.wonLeads,
      wonRevenue: won.wonRevenue,
    };
  });
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
    where,
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
    where,
    order: [["timestamp", "DESC"]],
    limit,
  });

  return rows.map(formatEventRow);
}

async function getDashboard(query = {}) {
  // Dates are business-timezone days (MARKETING_REPORT_TIMEZONE), "to" inclusive.
  const reportRange = parseReportRange(query.from, query.to);
  const range = {
    start: reportRange.start,
    end: reportRange.end ? new Date(reportRange.end.getTime() - 1000) : undefined,
  };
  const touch = query.touch === "first" ? "first" : "last";

  const totalVisitors = await countUniqueVisitorsFromEvents(range);
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
  const returningVisitors = await countReturningVisitors(range);

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
