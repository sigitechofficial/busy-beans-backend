/**
 * Page reporting (Phase 9): per-page metrics for site pages and landing pages.
 *
 * Closed business days are rolled up into marketing_daily_page_stats (computeDay/rollupDay,
 * run by the marketing scheduler; missing days are filled on first read). Today is always
 * computed live. Distinct visitors over a range are counted live (not additive).
 *
 * Definitions
 *   views        page_view / landing_page_view events
 *   sessions     distinct sessions with a view of the page that day
 *   entrances    sessions (marketing_sessions) that started on the page
 *   bounces      entrances with ≤1 page view, <10 s engaged time and no CTA/form/lead event
 *   exits        sessions whose last page view that day was the page
 *   engaged time page_engagement.activeMs (visible + focused + active); avg is per view
 *   leads        landing pages: non-test lead_submissions; site pages: lead_created events
 *   orders       paid attributed orders (marketing_order_attribution) by paid day;
 *                last touch = landing_page_slug, first touch = first_landing_page_slug;
 *                repeat_* = the customer's 2nd+ paid order (incl. untracked repeat orders
 *                credited to the customer's original source)
 *   won leads    non-test leads marked "won" by sales, by the day they were marked (converted_at),
 *                on the page the lead came from; won_revenue = the revenue entered on the lead
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { toSqlUtc } = require("../utils/dateRange");
const { resolvePageContext } = require("../utils/analyticsPayload");
const {
  reportTimeZone,
  localDateOf,
  dayStartUtc,
  addDays,
  daysBetween,
} = require("../utils/businessTime");

const VIEW_TYPES = "('page_view','landing_page_view')";
const PAGE_TYPES = new Set(["site", "landing_page"]);
const BOUNCE_ENGAGED_MS = 10_000;
const MAX_ENGAGED_MS_PER_EVENT = 30 * 60 * 1000;
/** A closed day is rolled up again this often while it is recent (late events, e.g. keepalive). */
const ROLLUP_INTERVAL_MS = 15 * 60 * 1000;
const ROLLUP_RECENT_DAYS = 2;
const MAX_SELF_HEAL_DAYS = 400;

const COUNTERS = [
  "views",
  "visitors",
  "sessions",
  "entrances",
  "bounces",
  "exits",
  "engaged_ms",
  "engagement_reports",
  "scroll_pct_sum",
  "cta_clicks",
  "form_starts",
  "form_submits",
  "leads",
  "won_leads",
  "won_revenue",
  "orders_last",
  "revenue_last",
  "repeat_orders_last",
  "repeat_revenue_last",
  "orders_first",
  "revenue_first",
  "repeat_orders_first",
  "repeat_revenue_first",
];

const MONEY = new Set(["won_revenue", "revenue_last", "revenue_first", "repeat_revenue_last", "repeat_revenue_first"]);

function emptyRow(pageType, pageSlug) {
  const row = { page_type: pageType, page_slug: pageSlug };
  for (const key of COUNTERS) row[key] = 0;
  return row;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function money(value) {
  return Math.round(num(value) * 100) / 100;
}

function dayWindow(day, tz) {
  return { start: toSqlUtc(dayStartUtc(day, tz)), end: toSqlUtc(dayStartUtc(addDays(day, 1), tz)) };
}

/** All metrics for one business day, keyed by `${page_type}|${page_slug}`. */
async function computeDay(day, tz = reportTimeZone()) {
  const db = getMarketingSequelize();
  const { start, end } = dayWindow(day, tz);
  const rows = new Map();
  const rowFor = (type, slug) => {
    const key = `${type}|${slug}`;
    if (!rows.has(key)) rows.set(key, emptyRow(type, slug));
    return rows.get(key);
  };
  const q = (sql, replacements = {}) =>
    db.query(sql, { replacements: { start, end, ...replacements }, type: QueryTypes.SELECT });

  const pageRows = await q(
    `SELECT page_type, page_slug,
       SUM(event_type IN ${VIEW_TYPES}) AS views,
       COUNT(DISTINCT CASE WHEN event_type IN ${VIEW_TYPES} THEN session_id END) AS sessions,
       COUNT(DISTINCT CASE WHEN event_type IN ${VIEW_TYPES} THEN visitor_id END) AS visitors,
       SUM(CASE WHEN event_type = 'page_engagement' THEN LEAST(GREATEST(COALESCE(
             CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.activeMs')) AS DECIMAL(20,0)), 0), 0), ${MAX_ENGAGED_MS_PER_EVENT})
           ELSE 0 END) AS engaged_ms,
       SUM(event_type = 'page_engagement') AS engagement_reports,
       SUM(CASE WHEN event_type = 'page_engagement' THEN LEAST(GREATEST(COALESCE(
             CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.maxScrollPct')) AS DECIMAL(10,0)), 0), 0), 100)
           ELSE 0 END) AS scroll_pct_sum,
       SUM(event_type = 'cta_click') AS cta_clicks,
       SUM(event_type = 'form_start') AS form_starts,
       SUM(event_type = 'form_submit') AS form_submits,
       SUM(event_type = 'lead_created') AS lead_events
     FROM marketing_analytics_events
     WHERE timestamp >= :start AND timestamp < :end
       AND page_slug IS NOT NULL AND page_type IN ('site', 'landing_page')
     GROUP BY page_type, page_slug`,
  );
  for (const r of pageRows) {
    const row = rowFor(r.page_type, r.page_slug);
    for (const key of ["views", "sessions", "visitors", "engaged_ms", "engagement_reports", "scroll_pct_sum", "cta_clicks", "form_starts", "form_submits"]) {
      row[key] = num(r[key]);
    }
    if (r.page_type === "site") row.leads = num(r.lead_events);
  }

  const leadRows = await q(
    `SELECT landing_page_slug AS slug, COUNT(*) AS leads
     FROM lead_submissions
     WHERE test_mode = 0 AND landing_page_slug IS NOT NULL AND landing_page_slug != ''
       AND submitted_at >= :start AND submitted_at < :end
     GROUP BY landing_page_slug`,
  );
  for (const r of leadRows) rowFor("landing_page", r.slug).leads = num(r.leads);

  const wonRows = await q(
    `SELECT landing_page_slug AS slug, page_url AS pageUrl, revenue
     FROM lead_submissions
     WHERE test_mode = 0 AND conversion_status = 'won' AND converted_at >= :start AND converted_at < :end`,
  );
  for (const r of wonRows) {
    let type = "landing_page";
    let slug = r.slug;
    if (!slug) {
      let pathname = "";
      try {
        pathname = new URL(String(r.pageUrl || "")).pathname;
      } catch {
        pathname = "";
      }
      const ctx = resolvePageContext({ pathname: pathname || "/" });
      type = ctx.pageType;
      slug = ctx.pageSlug;
    }
    if (!slug || !PAGE_TYPES.has(type)) continue;
    const row = rowFor(type, slug);
    row.won_leads += 1;
    row.won_revenue = money(row.won_revenue + num(r.revenue));
  }

  const orderRows = await q(
    `SELECT m.landing_page_slug AS lastSlug, m.first_landing_page_slug AS firstSlug, m.revenue, m.is_repeat AS isRepeat,
            s.entry_pathname AS entryPath,
            (SELECT s2.entry_pathname FROM marketing_sessions s2
              WHERE s2.visitor_id = m.visitor_id AND s2.entry_pathname IS NOT NULL
              ORDER BY s2.started_at ASC LIMIT 1) AS firstEntryPath
     FROM marketing_order_attribution m
     LEFT JOIN marketing_sessions s ON s.session_id = m.session_id
     WHERE m.status = 'paid' AND m.paid_at >= :start AND m.paid_at < :end`,
  );
  // Paths the website served as "not found" (404): never a site page (entrances, order credit).
  const notFoundPaths = new Set(
    (
      await q(
        `SELECT DISTINCT pathname FROM marketing_analytics_events
         WHERE page_type = 'not_found' AND pathname IS NOT NULL`,
      )
    ).map((r) => r.pathname),
  );

  // Site pages: the order is credited to the page its visit started on (last touch) and the page
  // the visitor's first visit started on (first touch). Landing pages keep their own credit above.
  const creditSite = (path, kind, r, repeat) => {
    if (!path || notFoundPaths.has(path)) return;
    const ctx = resolvePageContext({ pathname: path });
    if (ctx.pageType !== "site" || !ctx.pageSlug) return;
    const row = rowFor("site", ctx.pageSlug);
    row[`orders_${kind}`] += 1;
    row[`revenue_${kind}`] = money(row[`revenue_${kind}`] + num(r.revenue));
    if (repeat) {
      row[`repeat_orders_${kind}`] += 1;
      row[`repeat_revenue_${kind}`] = money(row[`repeat_revenue_${kind}`] + num(r.revenue));
    }
  };
  for (const r of orderRows) {
    const repeat = num(r.isRepeat) === 1;
    creditSite(r.entryPath, "last", r, repeat);
    creditSite(r.firstEntryPath, "first", r, repeat);
    if (r.lastSlug) {
      const row = rowFor("landing_page", r.lastSlug);
      row.orders_last += 1;
      row.revenue_last = money(row.revenue_last + num(r.revenue));
      if (repeat) {
        row.repeat_orders_last += 1;
        row.repeat_revenue_last = money(row.repeat_revenue_last + num(r.revenue));
      }
    }
    if (r.firstSlug) {
      const row = rowFor("landing_page", r.firstSlug);
      row.orders_first += 1;
      row.revenue_first = money(row.revenue_first + num(r.revenue));
      if (repeat) {
        row.repeat_orders_first += 1;
        row.repeat_revenue_first = money(row.repeat_revenue_first + num(r.revenue));
      }
    }
  }

  const sessionRows = await q(
    `SELECT s.entry_pathname AS entryPathname, s.page_count AS pageCount, s.engaged_ms AS engagedMs,
       EXISTS (SELECT 1 FROM marketing_analytics_events e
               WHERE e.session_id = s.session_id
                 AND e.event_type IN ('cta_click', 'form_start', 'form_submit', 'lead_created')) AS acted
     FROM marketing_sessions s
     WHERE s.started_at >= :start AND s.started_at < :end AND s.entry_pathname IS NOT NULL`,
  );
  for (const r of sessionRows) {
    if (notFoundPaths.has(r.entryPathname)) continue;
    const ctx = resolvePageContext({ pathname: r.entryPathname });
    if (!ctx.pageSlug || !PAGE_TYPES.has(ctx.pageType)) continue;
    const row = rowFor(ctx.pageType, ctx.pageSlug);
    row.entrances += 1;
    if (num(r.pageCount) <= 1 && num(r.engagedMs) < BOUNCE_ENGAGED_MS && !num(r.acted)) row.bounces += 1;
  }

  const exitRows = await q(
    `SELECT page_type, page_slug, COUNT(*) AS exits FROM (
       SELECT page_type, page_slug,
              ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp DESC, id DESC) AS rn
       FROM marketing_analytics_events
       WHERE event_type IN ${VIEW_TYPES} AND timestamp >= :start AND timestamp < :end
         AND page_slug IS NOT NULL AND page_type IN ('site', 'landing_page')
     ) t WHERE rn = 1
     GROUP BY page_type, page_slug`,
  );
  for (const r of exitRows) rowFor(r.page_type, r.page_slug).exits = num(r.exits);

  return rows;
}

/** Recompute one closed day and store it (replaces that day's rows). */
async function rollupDay(day, tz = reportTimeZone()) {
  const rows = [...(await computeDay(day, tz)).values()];
  const db = getMarketingSequelize();
  await db.transaction(async (transaction) => {
    await db.query("DELETE FROM marketing_daily_page_stats WHERE stat_date = :day", {
      replacements: { day },
      transaction,
    });
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const cols = ["stat_date", "page_type", "page_slug", ...COUNTERS];
      const values = [];
      const placeholders = chunk.map((row) => {
        values.push(day, row.page_type, row.page_slug, ...COUNTERS.map((k) => row[k]));
        return `(${cols.map(() => "?").join(",")})`;
      });
      // eslint-disable-next-line no-await-in-loop
      await db.query(
        `INSERT INTO marketing_daily_page_stats (${cols.join(",")}) VALUES ${placeholders.join(",")}`,
        { replacements: values, transaction },
      );
    }
    await db.query(
      `INSERT INTO marketing_daily_rollup_runs (stat_date, time_zone, computed_at)
       VALUES (:day, :tz, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE time_zone = VALUES(time_zone), computed_at = VALUES(computed_at)`,
      { replacements: { day, tz }, transaction },
    );
  });
  return rows.length;
}

async function firstEventDay(tz) {
  const db = getMarketingSequelize();
  const [row] = await db.query("SELECT MIN(timestamp) AS ts FROM marketing_analytics_events", {
    type: QueryTypes.SELECT,
  });
  return row?.ts ? localDateOf(new Date(row.ts), tz) : null;
}

/** Closed days in [fromDay, toDay] that were never rolled up (or rolled up in another timezone). */
async function missingDays(fromDay, toDay, tz) {
  if (!fromDay || fromDay > toDay) return [];
  const db = getMarketingSequelize();
  const done = await db.query(
    `SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS day FROM marketing_daily_rollup_runs
     WHERE stat_date BETWEEN :fromDay AND :toDay AND time_zone = :tz`,
    { replacements: { fromDay, toDay, tz }, type: QueryTypes.SELECT },
  );
  const doneSet = new Set(done.map((r) => r.day));
  return daysBetween(fromDay, toDay).filter((day) => !doneSet.has(day));
}

/** Resolve a report range into business days; clamps to first event … today. */
async function resolveDays(range) {
  const tz = range?.tz || reportTimeZone();
  const today = localDateOf(new Date(), tz);
  const firstDay = await firstEventDay(tz);
  let fromDay = range?.fromDay || firstDay || today;
  if (firstDay && fromDay < firstDay) fromDay = firstDay;
  let toDay = range?.toDay || today;
  if (toDay > today) toDay = today;
  return { tz, today, fromDay, toDay };
}

/** Summed metrics per page over [fromDay, toDay] — stored closed days + live today. */
async function sumRows({ fromDay, toDay, today, tz }, { pageType, pageSlug } = {}) {
  const totals = new Map();
  const add = (row) => {
    const key = `${row.page_type}|${row.page_slug}`;
    if (!totals.has(key)) totals.set(key, emptyRow(row.page_type, row.page_slug));
    const t = totals.get(key);
    for (const k of COUNTERS) t[k] = MONEY.has(k) ? money(t[k] + num(row[k])) : t[k] + num(row[k]);
  };
  const matches = (row) =>
    (!pageType || row.page_type === pageType) && (!pageSlug || row.page_slug === pageSlug);
  if (fromDay > toDay) return totals;

  const lastClosed = toDay < today ? toDay : addDays(today, -1);
  if (fromDay <= lastClosed) {
    const missing = await missingDays(fromDay, lastClosed, tz);
    for (const day of missing.slice(0, MAX_SELF_HEAL_DAYS)) {
      // eslint-disable-next-line no-await-in-loop
      await rollupDay(day, tz);
    }
    const db = getMarketingSequelize();
    const stored = await db.query(
      `SELECT page_type, page_slug, ${COUNTERS.map((k) => `SUM(${k}) AS ${k}`).join(", ")}
       FROM marketing_daily_page_stats
       WHERE stat_date BETWEEN :fromDay AND :lastClosed
         ${pageType ? "AND page_type = :pageType" : ""} ${pageSlug ? "AND page_slug = :pageSlug" : ""}
       GROUP BY page_type, page_slug`,
      { replacements: { fromDay, lastClosed, pageType, pageSlug }, type: QueryTypes.SELECT },
    );
    stored.forEach(add);
  }
  if (toDay >= today) {
    for (const row of (await computeDay(today, tz)).values()) if (matches(row)) add(row);
  }
  return totals;
}

/** Distinct visitors per page over the whole range (not additive across days). */
async function rangeVisitors({ fromDay, toDay, tz }, { pageType, pageSlug } = {}) {
  const db = getMarketingSequelize();
  const rows = await db.query(
    `SELECT page_type, page_slug, COUNT(DISTINCT visitor_id) AS visitors
     FROM marketing_analytics_events
     WHERE event_type IN ${VIEW_TYPES} AND timestamp >= :start AND timestamp < :end
       AND page_slug IS NOT NULL AND page_type IN ('site', 'landing_page')
       ${pageType ? "AND page_type = :pageType" : ""} ${pageSlug ? "AND page_slug = :pageSlug" : ""}
     GROUP BY page_type, page_slug`,
    {
      replacements: {
        start: toSqlUtc(dayStartUtc(fromDay, tz)),
        end: toSqlUtc(dayStartUtc(addDays(toDay, 1), tz)),
        pageType,
        pageSlug,
      },
      type: QueryTypes.SELECT,
    },
  );
  const map = new Map();
  for (const r of rows) map.set(`${r.page_type}|${r.page_slug}`, num(r.visitors));
  return map;
}

/** Report row (API shape) from summed counters. */
function toMetrics(t, visitors, touch) {
  const orders = touch === "first" ? t.orders_first : t.orders_last;
  const revenue = touch === "first" ? t.revenue_first : t.revenue_last;
  const repeatOrders = touch === "first" ? t.repeat_orders_first : t.repeat_orders_last;
  const repeatRevenue = touch === "first" ? t.repeat_revenue_first : t.repeat_revenue_last;
  return {
    pageType: t.page_type,
    pageSlug: t.page_slug,
    views: t.views,
    visitors,
    sessions: t.sessions,
    entrances: t.entrances,
    bounces: t.bounces,
    bounceRate: t.entrances > 0 ? Math.round((t.bounces / t.entrances) * 100) : 0,
    exits: t.exits,
    exitRate: t.views > 0 ? Math.round((t.exits / t.views) * 100) : 0,
    avgEngagedSec: t.views > 0 ? round1(t.engaged_ms / t.views / 1000) : 0,
    avgScrollDepth: t.engagement_reports > 0 ? Math.round(t.scroll_pct_sum / t.engagement_reports) : 0,
    ctaClicks: t.cta_clicks,
    formStarts: t.form_starts,
    formSubmissions: t.form_submits,
    leads: t.leads,
    leadConversionRate: t.sessions > 0 ? round1((t.leads / t.sessions) * 100) : 0,
    wonLeads: t.won_leads,
    wonRevenue: t.won_revenue,
    leadWinRate: t.leads > 0 ? round1((t.won_leads / t.leads) * 100) : 0,
    orders,
    revenue,
    repeatOrders,
    repeatRevenue,
    /** Paid orders + won-lead revenue: everything this page earned. */
    customerRevenue: money(revenue + t.won_revenue),
    orderConversionRate: t.sessions > 0 ? round1((orders / t.sessions) * 100) : 0,
  };
}

/**
 * Per-page report. `touch` = "last" | "first" picks which attribution the orders/revenue use.
 * @param {{ range?: object, pageType?: string, pageSlug?: string, touch?: string }} options
 */
async function getPageStats({ range, pageType, pageSlug, touch = "last" } = {}) {
  const days = await resolveDays(range);
  const filter = { pageType: PAGE_TYPES.has(pageType) ? pageType : undefined, pageSlug };
  const totals = await sumRows(days, filter);
  const visitors = await rangeVisitors(days, filter);
  const labels = await pageLabels(days, filter);
  const rows = [...totals.values()]
    .map((t) => ({
      ...toMetrics(t, visitors.get(`${t.page_type}|${t.page_slug}`) || 0, touch === "first" ? "first" : "last"),
      ...(labels.get(`${t.page_type}|${t.page_slug}`) || { title: null, pathname: null, productId: null }),
    }))
    .sort((a, b) => b.sessions - a.sessions || b.revenue - a.revenue || a.pageSlug.localeCompare(b.pageSlug));
  return { rows, fromDay: days.fromDay, toDay: days.toDay, timeZone: days.tz };
}

/**
 * Human labels per page: the latest page title and path seen in the range; product pages get
 * the product id and the catalog product name as title.
 */
async function pageLabels({ fromDay, toDay, tz }, { pageType, pageSlug } = {}) {
  const rows = await getMarketingSequelize().query(
    `SELECT e.page_type AS pageType, e.page_slug AS pageSlug, e.pathname, e.product_id AS productId,
            JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.pageTitle')) AS title
     FROM marketing_analytics_events e
     JOIN (SELECT page_type, page_slug, MAX(timestamp) AS ts FROM marketing_analytics_events
           WHERE event_type IN ${VIEW_TYPES} AND timestamp >= :start AND timestamp < :end
             AND page_slug IS NOT NULL AND page_type IN ('site', 'landing_page')
             ${pageType ? "AND page_type = :pageType" : ""} ${pageSlug ? "AND page_slug = :pageSlug" : ""}
           GROUP BY page_type, page_slug) l
       ON l.page_type = e.page_type AND l.page_slug = e.page_slug AND l.ts = e.timestamp
     WHERE e.event_type IN ${VIEW_TYPES}`,
    {
      replacements: {
        start: toSqlUtc(dayStartUtc(fromDay, tz)),
        end: toSqlUtc(dayStartUtc(addDays(toDay, 1), tz)),
        pageType,
        pageSlug,
      },
      type: QueryTypes.SELECT,
    },
  );
  const map = new Map();
  for (const r of rows) {
    map.set(`${r.pageType}|${r.pageSlug}`, {
      title: r.title || null,
      pathname: r.pathname || null,
      productId: r.productId ? String(r.productId) : null,
    });
  }
  const productIds = [...map.values()].map((l) => l.productId).filter(Boolean);
  if (productIds.length) {
    // eslint-disable-next-line global-require
    const { lookupProducts } = require("./productAnalytics.service");
    const catalog = await lookupProducts(productIds).catch(() => new Map());
    for (const label of map.values()) {
      const name = label.productId ? catalog.get(label.productId)?.name : null;
      if (name) label.title = name;
    }
  }
  return map;
}

const FUNNEL_STEPS = [
  { step: "view", label: "Viewed page" },
  { step: "cta_click", label: "Clicked a CTA" },
  { step: "form_start", label: "Started a form" },
  { step: "form_submit", label: "Submitted a form" },
  { step: "lead", label: "Became a lead" },
  { step: "order", label: "Became a customer (paid order or won lead)" },
];

/**
 * Session funnel for one page: a session counts at a step only if it reached every earlier
 * step first (in time). `anyOrder` is the plain count of sessions with that step.
 */
async function getPageFunnel({ fromDay, toDay, tz }, { pageType, pageSlug, touch }) {
  const db = getMarketingSequelize();
  const start = toSqlUtc(dayStartUtc(fromDay, tz));
  const end = toSqlUtc(dayStartUtc(addDays(toDay, 1), tz));
  const events = await db.query(
    `SELECT e.session_id AS sessionId, e.visitor_id AS visitorId, e.event_type AS eventType, e.timestamp AS ts
     FROM marketing_analytics_events e
     JOIN (SELECT DISTINCT session_id FROM marketing_analytics_events
           WHERE event_type IN ${VIEW_TYPES} AND page_type = :pageType AND page_slug = :pageSlug
             AND timestamp >= :start AND timestamp < :end) s ON s.session_id = e.session_id
     WHERE e.page_type = :pageType AND e.page_slug = :pageSlug
       AND e.event_type IN ('page_view', 'landing_page_view', 'cta_click', 'form_start', 'form_submit', 'lead_created')
     ORDER BY e.session_id, e.timestamp`,
    { replacements: { pageType, pageSlug, start, end }, type: QueryTypes.SELECT },
  );

  const sessions = new Map();
  for (const ev of events) {
    if (!sessions.has(ev.sessionId)) sessions.set(ev.sessionId, { visitorId: ev.visitorId, times: {} });
    const s = sessions.get(ev.sessionId);
    const step = ev.eventType === "page_view" || ev.eventType === "landing_page_view" ? "view" : ev.eventType;
    (s.times[step] ||= []).push(new Date(ev.ts).getTime());
  }
  const sessionIds = [...sessions.keys()];

  if (sessionIds.length && pageType === "landing_page") {
    const leads = await db.query(
      `SELECT session_id AS sessionId, submitted_at AS ts, conversion_status AS status, converted_at AS wonAt
       FROM lead_submissions
       WHERE test_mode = 0 AND landing_page_slug = :pageSlug AND session_id IN (:sessionIds)`,
      { replacements: { pageSlug, sessionIds }, type: QueryTypes.SELECT },
    );
    for (const l of leads) {
      const times = sessions.get(l.sessionId).times;
      (times.lead ||= []).push(new Date(l.ts).getTime());
      if (l.status === "won") (times.order ||= []).push(new Date(l.wonAt || l.ts).getTime());
    }
  } else {
    for (const s of sessions.values()) if (s.times.lead_created) s.times.lead = s.times.lead_created;
  }

  if (sessionIds.length && pageType === "site") {
    // Orders credited to this site page: the ordering visit (or, first touch, the visitor's first
    // visit) started on it — same rule as the rollup.
    const visitorIds = [...new Set([...sessions.values()].map((s) => s.visitorId))];
    const orders = await db.query(
      `SELECT m.visitor_id AS visitorId, m.paid_at AS ts, s.entry_pathname AS entryPath,
              (SELECT s2.entry_pathname FROM marketing_sessions s2
                WHERE s2.visitor_id = m.visitor_id AND s2.entry_pathname IS NOT NULL
                ORDER BY s2.started_at ASC LIMIT 1) AS firstEntryPath
       FROM marketing_order_attribution m
       LEFT JOIN marketing_sessions s ON s.session_id = m.session_id
       WHERE m.status = 'paid' AND m.visitor_id IN (:visitorIds)`,
      { replacements: { visitorIds }, type: QueryTypes.SELECT },
    );
    const byVisitor = new Map();
    for (const o of orders) {
      const path = touch === "first" ? o.firstEntryPath : o.entryPath;
      const ctx = path ? resolvePageContext({ pathname: path }) : null;
      if (!ctx || ctx.pageType !== "site" || ctx.pageSlug !== pageSlug) continue;
      if (!byVisitor.has(o.visitorId)) byVisitor.set(o.visitorId, []);
      byVisitor.get(o.visitorId).push(new Date(o.ts).getTime());
    }
    for (const s of sessions.values()) {
      if (byVisitor.has(s.visitorId)) s.times.order = [...(s.times.order || []), ...byVisitor.get(s.visitorId)];
    }
  }

  if (sessionIds.length && pageType === "landing_page") {
    const visitorIds = [...new Set([...sessions.values()].map((s) => s.visitorId))];
    const slugCol = touch === "first" ? "first_landing_page_slug" : "landing_page_slug";
    const orders = await db.query(
      `SELECT visitor_id AS visitorId, paid_at AS ts FROM marketing_order_attribution
       WHERE status = 'paid' AND ${slugCol} = :pageSlug AND visitor_id IN (:visitorIds)`,
      { replacements: { pageSlug, visitorIds }, type: QueryTypes.SELECT },
    );
    const byVisitor = new Map();
    for (const o of orders) {
      if (!byVisitor.has(o.visitorId)) byVisitor.set(o.visitorId, []);
      byVisitor.get(o.visitorId).push(new Date(o.ts).getTime());
    }
    for (const s of sessions.values()) {
      if (byVisitor.has(s.visitorId)) s.times.order = [...(s.times.order || []), ...byVisitor.get(s.visitorId)];
    }
  }

  const sequential = FUNNEL_STEPS.map(() => 0);
  const anyOrder = FUNNEL_STEPS.map(() => 0);
  for (const s of sessions.values()) {
    let at = -Infinity;
    let reached = true;
    FUNNEL_STEPS.forEach(({ step }, i) => {
      const times = s.times[step] || [];
      if (times.length) anyOrder[i] += 1;
      if (!reached) return;
      const next = times.filter((t) => t >= at).sort((a, b) => a - b)[0];
      if (next === undefined) {
        reached = false;
        return;
      }
      at = next;
      sequential[i] += 1;
    });
  }

  return FUNNEL_STEPS.map(({ step, label }, i) => ({
    step,
    label,
    sessions: sequential[i],
    anyOrder: anyOrder[i],
    dropOffPct: i > 0 && sequential[i - 1] > 0 ? Math.round(((sequential[i - 1] - sequential[i]) / sequential[i - 1]) * 100) : null,
  }));
}

async function getPageBreakdowns({ fromDay, toDay, tz }, { pageType, pageSlug }) {
  const db = getMarketingSequelize();
  const replacements = {
    pageType,
    pageSlug,
    start: toSqlUtc(dayStartUtc(fromDay, tz)),
    end: toSqlUtc(dayStartUtc(addDays(toDay, 1), tz)),
  };
  const group = async (expr) => {
    const rows = await db.query(
      `SELECT ${expr} AS name, COUNT(DISTINCT session_id) AS sessions
       FROM marketing_analytics_events
       WHERE event_type IN ${VIEW_TYPES} AND page_type = :pageType AND page_slug = :pageSlug
         AND timestamp >= :start AND timestamp < :end
       GROUP BY ${expr} ORDER BY sessions DESC LIMIT 20`,
      { replacements, type: QueryTypes.SELECT },
    );
    return rows.map((r) => ({ name: r.name, sessions: num(r.sessions) }));
  };
  return {
    sources: await group("COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.source')), ''), 'direct')"),
    campaigns: await group("COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(attribution, '$.campaign')), ''), '(not set)')"),
    devices: await group("COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.deviceType')), ''), 'unknown')"),
  };
}

/** One page: KPIs, daily series, funnel, source/campaign/device breakdowns. */
async function getPageDetail({ range, pageType = "landing_page", pageSlug, touch = "last" }) {
  const type = PAGE_TYPES.has(pageType) ? pageType : "landing_page";
  const touchKey = touch === "first" ? "first" : "last";
  const days = await resolveDays(range);
  const filter = { pageType: type, pageSlug };
  const { rows } = await getPageStats({ range, pageType: type, pageSlug, touch: touchKey });
  const summary = rows[0] || toMetrics(emptyRow(type, pageSlug), 0, touchKey);

  const daily = [];
  if (days.fromDay <= days.toDay) {
    const db = getMarketingSequelize();
    const lastClosed = days.toDay < days.today ? days.toDay : addDays(days.today, -1);
    const stored = days.fromDay <= lastClosed
      ? await db.query(
        `SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS day, ${COUNTERS.join(", ")}, page_type, page_slug
         FROM marketing_daily_page_stats
         WHERE page_type = :pageType AND page_slug = :pageSlug AND stat_date BETWEEN :fromDay AND :lastClosed`,
        { replacements: { pageType: type, pageSlug, fromDay: days.fromDay, lastClosed }, type: QueryTypes.SELECT },
      )
      : [];
    const byDay = new Map(stored.map((r) => [r.day, r]));
    if (days.toDay >= days.today) {
      const live = (await computeDay(days.today, days.tz)).get(`${type}|${pageSlug}`);
      if (live) byDay.set(days.today, live);
    }
    for (const day of daysBetween(days.fromDay, days.toDay)) {
      const r = byDay.get(day) || emptyRow(type, pageSlug);
      const m = toMetrics(
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, COUNTERS.includes(k) ? num(v) : v])),
        num(r.visitors),
        touchKey,
      );
      daily.push({
        day,
        views: m.views,
        sessions: m.sessions,
        visitors: m.visitors,
        leads: m.leads,
        wonLeads: m.wonLeads,
        orders: m.orders,
        revenue: m.revenue,
        customerRevenue: m.customerRevenue,
        avgEngagedSec: m.avgEngagedSec,
      });
    }
  }

  return {
    page: summary,
    daily,
    funnel: await getPageFunnel(days, { ...filter, touch: touchKey }),
    breakdowns: await getPageBreakdowns(days, filter),
    fromDay: days.fromDay,
    toDay: days.toDay,
    timeZone: days.tz,
    touch: touchKey,
  };
}

let lastRollupAt = 0;

/** Scheduler hook: every 15 min re-roll the most recent closed days (late events). */
async function runRollupCycle(now = new Date()) {
  if (now.getTime() - lastRollupAt < ROLLUP_INTERVAL_MS) return null;
  lastRollupAt = now.getTime();
  const tz = reportTimeZone();
  const today = localDateOf(now, tz);
  const days = [];
  for (let i = ROLLUP_RECENT_DAYS; i >= 1; i -= 1) days.push(addDays(today, -i));
  for (const day of days) {
    // eslint-disable-next-line no-await-in-loop
    await rollupDay(day, tz);
  }
  return { days };
}

module.exports = {
  computeDay,
  rollupDay,
  getPageStats,
  getPageDetail,
  runRollupCycle,
  resolveDays,
  FUNNEL_STEPS,
};
