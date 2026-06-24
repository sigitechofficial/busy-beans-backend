const { Op } = require("sequelize");
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getTouchpointModel } = require("../models/touchpoint");
const { getAnalyticsEventModel } = require("../models/analyticsEvent");
const { parseDateRange, appendTimestampFilter } = require("../utils/dateRange");
const { formatTouchpointRow } = require("./touchpoints.service");
const { formatEventRow } = require("./analyticsEvents.service");

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

async function getTrafficSources(range) {
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
     WHERE l.test_mode = 0 ${leadFilter.sql}`,
    {
      replacements: { ...leadFilter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const leadsBySource = {};
  for (const row of leadRows) {
    leadsBySource[row.source] = Number(row.leads || 0);
  }

  return rows.map((row) => ({
    source: row.source,
    visitors: Number(row.visitors || 0),
    leads: leadsBySource[row.source] || 0,
    revenue: 0,
  }));
}

async function getUtmCampaigns(range) {
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
     WHERE l.test_mode = 0 ${leadFilter.sql}`,
    {
      replacements: { ...leadFilter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const leadsByCampaign = {};
  for (const row of leadRows) {
    leadsByCampaign[row.campaign] = Number(row.leads || 0);
  }

  return rows.map((row) => ({
    campaign: row.campaign,
    visitors: Number(row.visitors || 0),
    leads: leadsByCampaign[row.campaign] || 0,
    revenue: 0,
  }));
}

async function getLandingPageMetrics(range) {
  const sequelize = getMarketingSequelize();
  const filter = appendTimestampFilter(range, "timestamp", "AND");

  const slugRows = await sequelize.query(
    `SELECT DISTINCT landing_page_slug AS slug, landing_page_id AS landingPageId
     FROM marketing_analytics_events
     WHERE landing_page_slug IS NOT NULL AND landing_page_slug != ''
     ${filter.sql}`,
    {
      replacements: { ...filter.replacements },
      type: QueryTypes.SELECT,
    },
  );

  const landingPages = [];

  for (const slugRow of slugRows) {
    const slug = slugRow.slug;
    const slugFilter = appendTimestampFilter(range, "timestamp", "AND");
    const replacements = {
      slug,
      ...slugFilter.replacements,
    };

    const viewRows = await sequelize.query(
      `SELECT COUNT(*) AS views,
              COUNT(DISTINCT visitor_id) AS uniqueVisitors,
              COUNT(DISTINCT session_id) AS sessions
       FROM marketing_analytics_events
       WHERE event_type = 'landing_page_view'
         AND landing_page_slug = :slug ${slugFilter.sql}`,
      { replacements, type: QueryTypes.SELECT },
    );

    const views = Number(viewRows[0]?.views || 0);
    const uniqueVisitors = Number(viewRows[0]?.uniqueVisitors || 0);
    const sessions = Number(viewRows[0]?.sessions || 0);

    const eventCounts = await sequelize.query(
      `SELECT event_type, COUNT(*) AS cnt
       FROM marketing_analytics_events
       WHERE landing_page_slug = :slug ${slugFilter.sql}
       GROUP BY event_type`,
      { replacements, type: QueryTypes.SELECT },
    );

    const counts = {};
    for (const row of eventCounts) {
      counts[row.event_type] = Number(row.cnt || 0);
    }

    const bounceRows = await sequelize.query(
      `SELECT
         SUM(CASE WHEN event_count = 1 THEN 1 ELSE 0 END) AS bounced,
         COUNT(*) AS total_sessions
       FROM (
         SELECT session_id, COUNT(*) AS event_count
         FROM marketing_analytics_events
         WHERE landing_page_slug = :slug ${slugFilter.sql}
         GROUP BY session_id
       ) s`,
      { replacements, type: QueryTypes.SELECT },
    );

    const bounced = Number(bounceRows[0]?.bounced || 0);
    const totalSessions = Number(bounceRows[0]?.total_sessions || 0);
    const bounceRate =
      totalSessions > 0 ? Math.round((bounced / totalSessions) * 100) : 0;

    const scrollRows = await sequelize.query(
      `SELECT AVG(
         CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.depthPct')) AS DECIMAL(10,2))
       ) AS avgDepth
       FROM marketing_analytics_events
       WHERE event_type = 'scroll_depth'
         AND landing_page_slug = :slug ${slugFilter.sql}`,
      { replacements, type: QueryTypes.SELECT },
    );

    const avgScrollDepth = Math.round(Number(scrollRows[0]?.avgDepth || 0));

    const deviceRows = await sequelize.query(
      `SELECT
         COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.deviceType')), 'unknown') AS deviceType,
         COUNT(*) AS cnt
       FROM marketing_analytics_events
       WHERE landing_page_slug = :slug ${slugFilter.sql}
       GROUP BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.deviceType')), 'unknown')`,
      { replacements, type: QueryTypes.SELECT },
    );

    const deviceBreakdown = {};
    for (const row of deviceRows) {
      deviceBreakdown[row.deviceType] = Number(row.cnt || 0);
    }

    const sourceRows = await sequelize.query(
      `SELECT
         COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.source')), ''), 'direct') AS source,
         COUNT(*) AS cnt
       FROM marketing_analytics_events
       WHERE landing_page_slug = :slug ${slugFilter.sql}
       GROUP BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.source')), ''), 'direct')`,
      { replacements, type: QueryTypes.SELECT },
    );

    const sourceBreakdown = {};
    for (const row of sourceRows) {
      sourceBreakdown[row.source] = Number(row.cnt || 0);
    }

    const campaignRows = await sequelize.query(
      `SELECT
         COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.campaign')), ''), '(not set)') AS campaign,
         COUNT(*) AS cnt
       FROM marketing_analytics_events
       WHERE landing_page_slug = :slug ${slugFilter.sql}
       GROUP BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.campaign')), ''), '(not set)')`,
      { replacements, type: QueryTypes.SELECT },
    );

    const campaignBreakdown = {};
    for (const row of campaignRows) {
      campaignBreakdown[row.campaign] = Number(row.cnt || 0);
    }

    const leads = counts.lead_created || 0;
    const conversionRate =
      views > 0 ? roundOneDecimal((leads / views) * 100) : 0;

    landingPages.push({
      landingPageSlug: slug,
      landingPageId: slugRow.landingPageId || null,
      visitors: uniqueVisitors,
      uniqueVisitors,
      sessions,
      bounceRate,
      avgTimeOnPageSec: 0,
      avgScrollDepth,
      ctaClicks: counts.cta_click || 0,
      formStarts: counts.form_start || 0,
      formSubmissions: counts.form_submit || 0,
      leads,
      orders: counts.order_completed || 0,
      revenue: 0,
      conversionRate,
      deviceBreakdown,
      sourceBreakdown,
      campaignBreakdown,
    });
  }

  return landingPages.sort((a, b) => b.visitors - a.visitors);
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
  const range = parseDateRange(query.from, query.to);

  const totalVisitors = await countUniqueVisitorsFromEvents(range);
  const funnelCounts = await getFunnelCounts(range);
  const totalLeads = funnelCounts.lead_created || 0;
  const totalOrders = funnelCounts.order_completed || 0;
  const revenue = await sumRevenueFromEvents(range);
  const conversionRate =
    totalVisitors > 0 ? roundOneDecimal((totalLeads / totalVisitors) * 100) : 0;
  const averageOrderValue =
    totalOrders > 0 ? roundOneDecimal(revenue / totalOrders) : 0;
  const returningVisitors = await countReturningVisitors(range);

  const trafficSources = await getTrafficSources(range);
  const utmCampaigns = await getUtmCampaigns(range);
  const landingPages = await getLandingPageMetrics(range);
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
    },
    marketing: {
      trafficSources,
      utmCampaigns,
      landingPages: [],
    },
    funnel,
    landingPages,
    recentTouchpoints,
    recentEvents,
  };
}

module.exports = {
  getDashboard,
};
