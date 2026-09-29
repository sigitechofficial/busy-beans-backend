/**
 * Product & store analytics (Phase 16). All reports take a business-time range (see
 * utils/businessTime.parseReportRange) and read marketing_analytics_events (product_id /
 * customer_user_id columns, migration 032) and marketing_order_attribution (paid orders + items).
 *
 *   getProductReport   one row per product: views, viewers, carts, checkouts, orders, revenue…
 *   getProductDetail   one product: daily series, hour × weekday heatmap, sources, also viewed,
 *                      recent views and signed-in customers who viewed it
 *   getStoreFunnel     product view → cart → cart page → checkout → order → paid, abandoned carts
 *   getTimePatterns    hour × weekday heatmaps for page views, leads and orders
 *   getBrokenLinks     website 404 views by path
 *   getVisitorJourney  every visit, page, product and action of one visitor / lead / order / customer
 *
 * Identified customers (name, email, company, phone) are only returned to users allowed by
 * piiAccess.service; every such response is written to the access log.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { appendTimestampFilter, toSqlUtc } = require("../utils/dateRange");
const { reportTimeZone, localDateOf } = require("../utils/businessTime");
const { presentCustomer, logPiiAccess, maskedCustomer } = require("./piiAccess.service");
const { getApiPublicUrl } = require("../utils/publicUrls");

const VIEW_TYPES = "('page_view','landing_page_view')";
const MAX_ENGAGED_MS_PER_EVENT = 30 * 60 * 1000;
const EVENT_ROW_CAP = 50000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── helpers ────────────────────────────────────────────────────────────────

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return Math.round(num(v) * 100) / 100;
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function json(v, fallback) {
  if (v && typeof v === "object") return v;
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function select(sql, replacements = {}) {
  return getMarketingSequelize().query(sql, { replacements, type: QueryTypes.SELECT });
}

function rangeFilter(range, column) {
  return appendTimestampFilter(range || {}, column, "AND");
}

/** Weekday (0 = Mon) and hour (0–23) of a date in the business time zone. */
function makeDayHour(tz) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23" });
  return (date) => {
    const parts = fmt.formatToParts(date);
    const weekday = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")?.value);
    const hour = Number(parts.find((p) => p.type === "hour")?.value) % 24;
    return { weekday, hour };
  };
}

function emptyHeatmap() {
  return WEEKDAYS.map(() => Array(24).fill(0));
}

function heatmapPayload(matrix, tz) {
  let max = 0;
  let total = 0;
  for (const row of matrix) for (const v of row) {
    max = Math.max(max, v);
    total += v;
  }
  return { timeZone: tz, weekdays: WEEKDAYS, cells: matrix, max, total };
}

// ─── directories (commerce catalog + customers), injectable for tests ────────

/** Product images are stored as paths under the API (public/products/…), like the website resolves them. */
function absoluteImage(path) {
  const value = String(path || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(getApiPublicUrl() || "").replace(/\/+$/, "");
  return base ? `${base}/${value.replace(/^\/+/, "")}` : null;
}

let catalogCache = { at: 0, map: new Map() };
const CATALOG_TTL_MS = 5 * 60 * 1000;

async function defaultLookupProducts(ids) {
  const wanted = [...new Set(ids.map(String))].filter((id) => /^\d{1,20}$/.test(id));
  if (Date.now() - catalogCache.at > CATALOG_TTL_MS) catalogCache = { at: Date.now(), map: new Map() };
  const missing = wanted.filter((id) => !catalogCache.map.has(id));
  if (missing.length) {
    // eslint-disable-next-line global-require
    const { product, category } = require("../../models");
    const rows = await product.findAll({
      where: { id: missing },
      attributes: ["id", "name", "image", "price", "categoryId"],
      raw: true,
      paranoid: false,
    });
    const catIds = [...new Set(rows.map((r) => r.categoryId).filter(Boolean))];
    const cats = new Map(
      catIds.length
        ? (await category.findAll({ where: { id: catIds }, attributes: ["id", "name"], raw: true })).map((c) => [Number(c.id), c.name])
        : [],
    );
    for (const r of rows) {
      catalogCache.map.set(String(r.id), {
        name: r.name,
        image: absoluteImage(r.image),
        price: r.price === null ? null : money(r.price),
        category: cats.get(Number(r.categoryId)) || null,
      });
    }
    for (const id of missing) if (!catalogCache.map.has(id)) catalogCache.map.set(id, null);
  }
  return new Map(wanted.map((id) => [id, catalogCache.map.get(id)]).filter(([, v]) => v));
}

async function defaultLookupCustomers(ids) {
  const wanted = [...new Set(ids.map(String))].filter((id) => /^\d{1,12}$/.test(id));
  if (!wanted.length) return new Map();
  // eslint-disable-next-line global-require
  const { user } = require("../../models");
  const rows = await user.findAll({
    where: { id: wanted },
    attributes: ["id", "name", "email", "companyName", "phoneNumber"],
    raw: true,
  });
  return new Map(rows.map((r) => [String(r.id), { name: r.name, email: r.email, company: r.companyName, phone: r.phoneNumber }]));
}

function lookups(options = {}) {
  return {
    lookupProducts: options.lookupProducts || defaultLookupProducts,
    lookupCustomers: options.lookupCustomers || defaultLookupCustomers,
  };
}

// ─── paid orders with items ─────────────────────────────────────────────────

async function paidOrdersWithItems(range, productId) {
  const f = rangeFilter(range, "m.paid_at");
  const rows = await select(
    `SELECT m.order_id AS orderId, m.customer_user_id AS customerUserId, m.visitor_id AS visitorId,
            m.session_id AS sessionId, m.paid_at AS paidAt, m.revenue, m.items
     FROM marketing_order_attribution m
     WHERE m.status = 'paid' AND m.items IS NOT NULL ${f.sql}
     ${productId ? "AND JSON_SEARCH(m.items, 'one', :productId, NULL, '$[*].productId') IS NOT NULL" : ""}`,
    { ...f.replacements, productId },
  );
  return rows.map((r) => ({ ...r, items: json(r.items, []) }));
}

// ─── product report ─────────────────────────────────────────────────────────

/**
 * @param {object} range  parseReportRange result
 * @param {{ productId?: string, lookupProducts?: Function }} [options]
 */
async function getProductReport(range, options = {}) {
  const { lookupProducts } = lookups(options);
  const pid = options.productId ? String(options.productId) : null;
  const f = rangeFilter(range, "e.timestamp");
  const productFilter = pid ? "AND e.product_id = :pid" : "AND e.product_id IS NOT NULL";
  const reps = { ...f.replacements, pid };

  const base = await select(
    `SELECT e.product_id AS pid,
       SUM(e.event_type IN ${VIEW_TYPES}) AS views,
       COUNT(DISTINCT CASE WHEN e.event_type IN ${VIEW_TYPES} THEN e.visitor_id END) AS viewers,
       COUNT(DISTINCT CASE WHEN e.event_type IN ${VIEW_TYPES} THEN e.session_id END) AS sessions,
       COUNT(DISTINCT CASE WHEN e.event_type IN ${VIEW_TYPES} THEN e.customer_user_id END) AS signedInViewers,
       SUM(CASE WHEN e.event_type = 'page_engagement' THEN LEAST(GREATEST(COALESCE(
             CAST(JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.activeMs')) AS DECIMAL(20,0)), 0), 0), ${MAX_ENGAGED_MS_PER_EVENT})
           ELSE 0 END) AS engagedMs,
       SUM(e.event_type = 'add_to_cart') AS addToCart,
       COUNT(DISTINCT CASE WHEN e.event_type = 'add_to_cart' THEN e.session_id END) AS cartSessions,
       SUM(e.event_type = 'remove_from_cart') AS removals,
       SUM(e.event_type = 'select_item') AS listClicks,
       SUM(e.event_type = 'quote_requested') AS quoteRequests,
       MIN(CASE WHEN e.event_type IN ${VIEW_TYPES} THEN e.timestamp END) AS firstViewedAt,
       MAX(CASE WHEN e.event_type IN ${VIEW_TYPES} THEN e.timestamp END) AS lastViewedAt
     FROM marketing_analytics_events e
     WHERE e.page_type IN ('site', 'landing_page') ${productFilter} ${f.sql}
     GROUP BY e.product_id`,
    reps,
  );

  const repeat = await select(
    `SELECT pid, COUNT(*) AS repeatViewers FROM (
       SELECT e.product_id AS pid, e.visitor_id, COUNT(DISTINCT e.session_id) AS s
       FROM marketing_analytics_events e
       WHERE e.event_type IN ${VIEW_TYPES} ${productFilter} ${f.sql}
       GROUP BY e.product_id, e.visitor_id HAVING s > 1) t
     GROUP BY pid`,
    reps,
  );

  const sources = await select(
    `SELECT e.product_id AS pid,
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.attribution, '$.source')), ''), 'direct') AS source,
            COUNT(DISTINCT e.session_id) AS n
     FROM marketing_analytics_events e
     WHERE e.event_type IN ${VIEW_TYPES} ${productFilter} ${f.sql}
     GROUP BY e.product_id, source`,
    reps,
  );

  // Cart page views and checkouts carry item lists (at most EVENT_ROW_CAP rows read).
  const baskets = await select(
    `SELECT e.event_type AS type, e.session_id AS sessionId, JSON_EXTRACT(e.metadata, '$.items') AS items
     FROM marketing_analytics_events e
     WHERE e.event_type IN ('view_cart', 'begin_checkout') ${f.sql}
     LIMIT ${EVENT_ROW_CAP}`,
    f.replacements,
  );

  const listViews = await select(
    `SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.category')), ''), 'all') AS category, COUNT(*) AS n
     FROM marketing_analytics_events e
     WHERE e.event_type = 'view_item_list' ${f.sql}
     GROUP BY category`,
    f.replacements,
  );

  const orders = await paidOrdersWithItems(range, pid);

  const rows = new Map();
  const rowFor = (id) => {
    const key = String(id);
    if (!rows.has(key)) {
      rows.set(key, {
        productId: key, name: null, image: null, category: null, price: null,
        views: 0, viewers: 0, sessions: 0, repeatViewers: 0, signedInViewers: 0, engagedMs: 0,
        addToCart: 0, cartSessions: 0, removals: 0, listClicks: 0, quoteRequests: 0, cartPageViews: 0, checkouts: 0,
        orders: 0, units: 0, revenue: 0, topSource: null, firstViewedAt: null, lastViewedAt: null,
        _checkoutSessions: new Set(), _cartSessions: new Set(), _orders: new Set(), _nameFromOrder: null,
      });
    }
    return rows.get(key);
  };

  for (const r of base) {
    const row = rowFor(r.pid);
    for (const k of ["views", "viewers", "sessions", "signedInViewers", "engagedMs", "addToCart", "cartSessions", "removals", "listClicks", "quoteRequests"]) {
      row[k] = num(r[k]);
    }
    row.firstViewedAt = r.firstViewedAt || null;
    row.lastViewedAt = r.lastViewedAt || null;
  }
  for (const r of repeat) rowFor(r.pid).repeatViewers = num(r.repeatViewers);
  const bestSource = new Map();
  for (const r of sources) {
    const cur = bestSource.get(String(r.pid));
    if (!cur || num(r.n) > cur.n) bestSource.set(String(r.pid), { source: r.source, n: num(r.n) });
  }
  for (const [id, s] of bestSource) if (rows.has(id)) rows.get(id).topSource = s.source;

  for (const b of baskets) {
    for (const item of json(b.items, []) || []) {
      const id = item?.productId ? String(item.productId) : null;
      if (!id || (pid && id !== pid)) continue;
      const row = rowFor(id);
      (b.type === "view_cart" ? row._cartSessions : row._checkoutSessions).add(b.sessionId);
    }
  }
  for (const o of orders) {
    for (const item of o.items || []) {
      const id = item?.productId ? String(item.productId) : null;
      if (!id || (pid && id !== pid)) continue;
      const row = rowFor(id);
      row._orders.add(String(o.orderId));
      row.units += num(item.qty) || 1;
      row.revenue = money(row.revenue + num(item.lineTotal));
      if (item.name && !row._nameFromOrder) row._nameFromOrder = item.name;
    }
  }

  const catalog = await lookupProducts([...rows.keys()]).catch(() => new Map());
  const listByCategory = new Map(listViews.map((l) => [String(l.category), num(l.n)]));
  const out = [...rows.values()].map((row) => {
    const c = catalog.get(row.productId);
    const impressions = (listByCategory.get("all") || 0) + (c?.category ? listByCategory.get(slugify(c.category)) || 0 : 0);
    const { _checkoutSessions, _cartSessions, _orders, _nameFromOrder, ...rest } = row;
    return {
      ...rest,
      name: c?.name || _nameFromOrder || `Product #${row.productId}`,
      image: c?.image || null,
      category: c?.category || null,
      price: c?.price ?? null,
      avgEngagedSec: row.views > 0 ? Math.round(row.engagedMs / row.views / 100) / 10 : 0,
      cartPageViews: _cartSessions.size,
      checkouts: _checkoutSessions.size,
      orders: _orders.size,
      listImpressions: impressions,
      listClickRate: pct(row.listClicks, impressions),
      cartRate: pct(row.cartSessions, row.sessions),
      orderRate: pct(_orders.size, row.viewers),
    };
  });
  out.sort((a, b) => b.views - a.views || b.revenue - a.revenue || a.name.localeCompare(b.name));

  const [totalsRow] = await select(
    `SELECT COUNT(DISTINCT CASE WHEN e.event_type IN ${VIEW_TYPES} THEN e.visitor_id END) AS viewers,
            COUNT(DISTINCT CASE WHEN e.event_type = 'begin_checkout' THEN e.session_id END) AS checkouts,
            SUM(e.event_type = 'view_item_list') AS listViews,
            SUM(e.event_type = 'select_item') AS listClicks
     FROM marketing_analytics_events e
     WHERE (e.product_id IS NOT NULL OR e.event_type IN ('begin_checkout', 'view_item_list', 'select_item')) ${f.sql}`,
    f.replacements,
  );
  const orderIds = new Set(orders.map((o) => String(o.orderId)));
  const totals = {
    products: out.length,
    views: out.reduce((s, r) => s + r.views, 0),
    viewers: num(totalsRow?.viewers),
    addToCart: out.reduce((s, r) => s + r.addToCart, 0),
    quoteRequests: out.reduce((s, r) => s + r.quoteRequests, 0),
    checkouts: num(totalsRow?.checkouts),
    orders: orderIds.size,
    units: out.reduce((s, r) => s + r.units, 0),
    revenue: money(out.reduce((s, r) => s + r.revenue, 0)),
    listViews: num(totalsRow?.listViews),
    listClicks: num(totalsRow?.listClicks),
  };
  return { rows: out, totals };
}

// ─── product detail ─────────────────────────────────────────────────────────

/**
 * @param {object} range
 * @param {string} productId
 * @param {object} access  piiAccess.resolveAccess(req)
 */
async function getProductDetail(range, productId, access, options = {}) {
  const pid = String(productId);
  const { lookupProducts, lookupCustomers } = lookups(options);
  const tz = reportTimeZone();
  const dayHour = makeDayHour(tz);
  const report = await getProductReport(range, { ...options, productId: pid });
  const product = report.rows[0] || null;

  const f = rangeFilter(range, "e.timestamp");
  const events = await select(
    `SELECT e.event_type AS type, e.visitor_id AS visitorId, e.session_id AS sessionId, e.timestamp AS ts,
            e.customer_user_id AS customerUserId,
            JSON_UNQUOTE(JSON_EXTRACT(e.attribution, '$.source')) AS source,
            JSON_UNQUOTE(JSON_EXTRACT(e.attribution, '$.medium')) AS medium,
            JSON_UNQUOTE(JSON_EXTRACT(e.attribution, '$.campaign')) AS campaign,
            JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.deviceType')) AS device,
            JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.qty')) AS qty
     FROM marketing_analytics_events e
     WHERE e.product_id = :pid AND e.event_type IN ('page_view', 'landing_page_view', 'add_to_cart') ${f.sql}
     ORDER BY e.timestamp DESC
     LIMIT ${EVENT_ROW_CAP}`,
    { ...f.replacements, pid },
  );
  const orders = await paidOrdersWithItems(range, pid);

  const heat = emptyHeatmap();
  const daily = new Map();
  const dayRow = (day) => {
    if (!daily.has(day)) daily.set(day, { day, views: 0, viewers: new Set(), addToCart: 0, orders: 0, units: 0, revenue: 0 });
    return daily.get(day);
  };
  const count = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  const sourceSessions = new Map();
  const campaignSessions = new Map();
  const deviceSessions = new Map();
  const seenSession = new Set();
  const customers = new Map();
  const viewSessions = new Set();
  const recent = [];

  for (const e of events) {
    const at = new Date(e.ts);
    const isView = e.type !== "add_to_cart";
    const d = dayRow(localDateOf(at, tz));
    const cid = e.customerUserId ? String(e.customerUserId) : null;
    if (isView) {
      d.views += 1;
      d.viewers.add(e.visitorId);
      const { weekday, hour } = dayHour(at);
      if (weekday >= 0) heat[weekday][hour] += 1;
      viewSessions.add(e.sessionId);
      if (!seenSession.has(e.sessionId)) {
        seenSession.add(e.sessionId);
        count(sourceSessions, `${e.source || "direct"}|${e.medium || "none"}`);
        if (e.campaign) count(campaignSessions, e.campaign);
        count(deviceSessions, e.device || "unknown");
      }
      if (recent.length < 50) {
        recent.push({ at: e.ts, visitorId: e.visitorId, source: e.source || "direct", medium: e.medium || null, device: e.device || null, customerUserId: cid });
      }
    } else {
      d.addToCart += 1;
    }
    if (cid) {
      if (!customers.has(cid)) customers.set(cid, { views: 0, sessions: new Set(), lastViewedAt: null, addedToCart: false, ordered: false });
      const c = customers.get(cid);
      if (isView) {
        c.views += 1;
        c.sessions.add(e.sessionId);
        if (!c.lastViewedAt || at > new Date(c.lastViewedAt)) c.lastViewedAt = e.ts;
      } else {
        c.addedToCart = true;
      }
    }
  }
  for (const o of orders) {
    const d = dayRow(localDateOf(new Date(o.paidAt), tz));
    d.orders += 1;
    for (const item of o.items) {
      if (String(item.productId) !== pid) continue;
      d.units += num(item.qty) || 1;
      d.revenue = money(d.revenue + num(item.lineTotal));
    }
    const cid = o.customerUserId ? String(o.customerUserId) : null;
    if (cid && customers.has(cid)) customers.get(cid).ordered = true;
  }

  // Other products viewed in the same visits.
  const sessionList = [...viewSessions].slice(0, 5000);
  const also = sessionList.length
    ? await select(
      `SELECT e.product_id AS pid, COUNT(DISTINCT e.session_id) AS sessions
       FROM marketing_analytics_events e
       WHERE e.session_id IN (:sessions) AND e.product_id IS NOT NULL AND e.product_id <> :pid
         AND e.event_type IN ${VIEW_TYPES}
       GROUP BY e.product_id ORDER BY sessions DESC LIMIT 10`,
      { sessions: sessionList, pid },
    )
    : [];
  const catalog = await lookupProducts(also.map((a) => a.pid)).catch(() => new Map());

  const customerIds = [...new Set([...customers.keys(), ...recent.map((r) => r.customerUserId).filter(Boolean)])];
  const directory = access?.canViewCustomerDetails ? await lookupCustomers(customerIds).catch(() => new Map()) : new Map();
  const customerRows = [...customers.entries()]
    .map(([cid, c]) => ({
      ...presentCustomer(access, cid, directory),
      views: c.views,
      visits: c.sessions.size,
      lastViewedAt: c.lastViewedAt,
      addedToCart: c.addedToCart,
      ordered: c.ordered,
    }))
    .sort((a, b) => b.views - a.views || String(b.lastViewedAt).localeCompare(String(a.lastViewedAt)))
    .slice(0, 200);
  const recentRows = recent.map((r) => ({ ...r, customer: presentCustomer(access, r.customerUserId, directory) }));
  await logPiiAccess(access, { action: "product_customers", subject: `product:${pid}`, customerIds }).catch(() => false);

  const top = (map, limit = 8) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, sessions]) => ({ name, sessions }));

  return {
    product,
    timeZone: tz,
    daily: [...daily.values()]
      .map((d) => ({ ...d, viewers: d.viewers.size }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    heatmap: heatmapPayload(heat, tz),
    breakdowns: {
      sources: top(sourceSessions).map((s) => {
        const [source, medium] = s.name.split("|");
        return { name: source, medium, sessions: s.sessions };
      }),
      campaigns: top(campaignSessions),
      devices: top(deviceSessions),
    },
    alsoViewed: also.map((a) => ({
      productId: String(a.pid),
      name: catalog.get(String(a.pid))?.name || `Product #${a.pid}`,
      image: catalog.get(String(a.pid))?.image || null,
      sessions: num(a.sessions),
    })),
    recentViews: recentRows,
    customers: customerRows,
    customerDetailsHidden: !access?.canViewCustomerDetails,
  };
}

// ─── store funnel + abandoned carts ─────────────────────────────────────────

const STORE_STEPS = [
  { step: "product_view", label: "Viewed a product" },
  { step: "add_to_cart", label: "Added to cart" },
  { step: "view_cart", label: "Viewed cart" },
  { step: "begin_checkout", label: "Started checkout" },
  { step: "order_created", label: "Placed an order" },
  { step: "paid", label: "Paid" },
];

async function getStoreFunnel(range, access, options = {}) {
  const { lookupCustomers } = lookups(options);
  const f = rangeFilter(range, "e.timestamp");
  const viewed = await select(
    `SELECT DISTINCT e.session_id AS sessionId FROM marketing_analytics_events e
     WHERE e.product_id IS NOT NULL AND e.event_type IN ${VIEW_TYPES} ${f.sql}
     LIMIT ${EVENT_ROW_CAP}`,
    f.replacements,
  );
  const sessionIds = viewed.map((v) => v.sessionId);
  const sessions = new Map(sessionIds.map((id) => [id, {}]));
  if (sessionIds.length) {
    const events = await select(
      `SELECT e.session_id AS sessionId, e.event_type AS type, e.timestamp AS ts, e.product_id AS pid
       FROM marketing_analytics_events e
       WHERE e.session_id IN (:ids)
         AND (e.event_type IN ('add_to_cart', 'view_cart', 'begin_checkout', 'order_created')
              OR (e.product_id IS NOT NULL AND e.event_type IN ${VIEW_TYPES}))`,
      { ids: sessionIds },
    );
    for (const e of events) {
      const s = sessions.get(e.sessionId);
      const step = e.type === "page_view" || e.type === "landing_page_view" ? "product_view" : e.type;
      (s[step] ||= []).push(new Date(e.ts).getTime());
    }
    const paid = await select(
      `SELECT session_id AS sessionId, paid_at AS ts FROM marketing_order_attribution
       WHERE status = 'paid' AND inherited_from_order_id IS NULL AND session_id IN (:ids)`,
      { ids: sessionIds },
    );
    for (const p of paid) (sessions.get(p.sessionId).paid ||= []).push(new Date(p.ts).getTime());
  }
  const sequential = STORE_STEPS.map(() => 0);
  const anyOrder = STORE_STEPS.map(() => 0);
  for (const s of sessions.values()) {
    let at = -Infinity;
    let reached = true;
    STORE_STEPS.forEach(({ step }, i) => {
      const times = s[step] || [];
      if (times.length) anyOrder[i] += 1;
      if (!reached) return;
      // The cart page is optional on the way to checkout.
      const next = times.filter((t) => t >= at).sort((a, b) => a - b)[0];
      if (next === undefined) {
        if (step !== "view_cart") reached = false;
        return;
      }
      sequential[i] += 1;
      at = next;
    });
  }
  const funnel = STORE_STEPS.map((s, i) => ({
    ...s,
    sessions: sequential[i],
    anyOrder: anyOrder[i],
    dropOffPct: i > 0 && sequential[i - 1] > 0 ? Math.round((1 - sequential[i] / sequential[i - 1]) * 1000) / 10 : null,
  }));

  // Abandoned carts: visits with an add to cart and no order by that visitor afterwards.
  const adds = await select(
    `SELECT e.session_id AS sessionId, e.visitor_id AS visitorId, e.customer_user_id AS customerUserId,
            e.timestamp AS ts, e.product_id AS pid,
            JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.name')) AS name,
            JSON_EXTRACT(e.metadata, '$.qty') AS qty, JSON_EXTRACT(e.metadata, '$.price') AS price,
            JSON_UNQUOTE(JSON_EXTRACT(e.attribution, '$.source')) AS source
     FROM marketing_analytics_events e
     WHERE e.event_type = 'add_to_cart' ${f.sql}
     ORDER BY e.timestamp DESC LIMIT ${EVENT_ROW_CAP}`,
    f.replacements,
  );
  const visitorIds = [...new Set(adds.map((a) => a.visitorId))];
  const ordersByVisitor = new Map();
  if (visitorIds.length) {
    const orderEvents = await select(
      `SELECT visitor_id AS visitorId, MAX(timestamp) AS lastOrderAt FROM marketing_analytics_events
       WHERE event_type = 'order_created' AND visitor_id IN (:ids) GROUP BY visitor_id`,
      { ids: visitorIds },
    );
    for (const o of orderEvents) ordersByVisitor.set(o.visitorId, new Date(o.lastOrderAt).getTime());
  }
  const carts = new Map();
  for (const a of adds) {
    if (!carts.has(a.sessionId)) {
      carts.set(a.sessionId, { sessionId: a.sessionId, visitorId: a.visitorId, customerUserId: a.customerUserId ? String(a.customerUserId) : null, lastAddAt: a.ts, source: a.source || "direct", items: new Map() });
    }
    const cart = carts.get(a.sessionId);
    if (new Date(a.ts) > new Date(cart.lastAddAt)) cart.lastAddAt = a.ts;
    const key = String(a.pid || a.name);
    const prev = cart.items.get(key) || { productId: a.pid ? String(a.pid) : null, name: a.name || null, qty: 0, price: num(a.price) || null };
    prev.qty += num(a.qty) || 1;
    cart.items.set(key, prev);
  }
  const abandoned = [...carts.values()].filter((c) => {
    const ordered = ordersByVisitor.get(c.visitorId);
    return !(ordered && ordered >= new Date(c.lastAddAt).getTime());
  });
  const value = (c) => money([...c.items.values()].reduce((s, i) => s + num(i.price) * i.qty, 0));
  const recentCarts = abandoned
    .sort((a, b) => String(b.lastAddAt).localeCompare(String(a.lastAddAt)))
    .slice(0, 50);
  const customerIds = recentCarts.map((c) => c.customerUserId).filter(Boolean);
  const directory = access?.canViewCustomerDetails ? await lookupCustomers(customerIds).catch(() => new Map()) : new Map();
  await logPiiAccess(access, { action: "abandoned_carts", subject: "store", customerIds }).catch(() => false);

  return {
    funnel,
    abandonedCarts: {
      count: abandoned.length,
      value: money(abandoned.reduce((s, c) => s + value(c), 0)),
      rate: pct(abandoned.length, carts.size),
      recent: recentCarts.map((c) => ({
        sessionId: c.sessionId,
        visitorId: c.visitorId,
        lastAddAt: c.lastAddAt,
        source: c.source,
        items: [...c.items.values()],
        value: value(c),
        customer: presentCustomer(access, c.customerUserId, directory),
      })),
    },
    customerDetailsHidden: !access?.canViewCustomerDetails,
  };
}

// ─── time patterns ──────────────────────────────────────────────────────────

/** Counts per UTC hour, converted to business-time weekday × hour (DST-correct per bucket). */
async function hourHeatmap(range, where, tz) {
  const f = rangeFilter(range, "e.timestamp");
  const buckets = await select(
    `SELECT DATE_FORMAT(e.timestamp, '%Y-%m-%d %H:00:00') AS utcHour, COUNT(*) AS n
     FROM marketing_analytics_events e
     WHERE ${where} ${f.sql}
     GROUP BY utcHour`,
    f.replacements,
  );
  const dayHour = makeDayHour(tz);
  const matrix = emptyHeatmap();
  for (const b of buckets) {
    const { weekday, hour } = dayHour(new Date(`${String(b.utcHour).replace(" ", "T")}Z`));
    if (weekday >= 0) matrix[weekday][hour] += num(b.n);
  }
  return heatmapPayload(matrix, tz);
}

async function getTimePatterns(range) {
  const tz = reportTimeZone();
  const [views, productViews, leads, orders] = await Promise.all([
    hourHeatmap(range, `e.event_type IN ${VIEW_TYPES} AND e.page_type IN ('site', 'landing_page')`, tz),
    hourHeatmap(range, `e.event_type IN ${VIEW_TYPES} AND e.product_id IS NOT NULL`, tz),
    hourHeatmap(range, "e.event_type = 'lead_created'", tz),
    hourHeatmap(range, "e.event_type = 'order_created'", tz),
  ]);
  return { timeZone: tz, views, productViews, leads, orders };
}

// ─── broken links ───────────────────────────────────────────────────────────

async function getBrokenLinks(range) {
  const f = rangeFilter(range, "e.timestamp");
  const rows = await select(
    `SELECT e.pathname, COUNT(*) AS hits, COUNT(DISTINCT e.visitor_id) AS visitors, MAX(e.timestamp) AS lastSeenAt,
            MAX(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.attribution, '$.referrer')), '')) AS referrer
     FROM marketing_analytics_events e
     WHERE e.page_type = 'not_found' AND e.event_type IN ${VIEW_TYPES} ${f.sql}
     GROUP BY e.pathname ORDER BY hits DESC LIMIT 200`,
    f.replacements,
  );
  return rows.map((r) => ({ pathname: r.pathname, hits: num(r.hits), visitors: num(r.visitors), lastSeenAt: r.lastSeenAt, referrer: r.referrer || null }));
}

// ─── visitor journey ────────────────────────────────────────────────────────

const JOURNEY_TYPES = [
  "page_view", "landing_page_view", "page_engagement", "cta_click", "form_start", "form_submit", "lead_created",
  "view_item_list", "select_item", "add_to_cart", "remove_from_cart", "update_cart_qty", "view_cart", "begin_checkout",
  "quote_requested", "login", "sign_up", "order_created", "order_completed",
];

function journeyError(message, code = "VALIDATION_ERROR", status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

/**
 * @param {{ visitorId?: string, leadId?: string|number, orderId?: string|number, customerUserId?: string|number }} ref
 * @param {object} access piiAccess.resolveAccess(req)
 */
async function getVisitorJourney(ref, access, options = {}) {
  const { lookupProducts, lookupCustomers } = lookups(options);
  let visitorIds = [];
  let subject = null;
  let customerId = null;

  if (ref.customerUserId !== undefined && ref.customerUserId !== null && ref.customerUserId !== "") {
    customerId = String(ref.customerUserId);
    if (!/^\d{1,12}$/.test(customerId)) throw journeyError("Invalid customer id.");
    if (!access?.canViewCustomerDetails) {
      throw journeyError("Your role cannot view customer journeys.", "PII_FORBIDDEN", 403);
    }
    subject = `customer:${customerId}`;
    const rows = await select(
      `SELECT DISTINCT visitor_id AS v FROM marketing_analytics_events WHERE customer_user_id = :cid
       UNION SELECT DISTINCT visitor_id AS v FROM marketing_order_attribution WHERE customer_user_id = :cid`,
      { cid: customerId },
    );
    visitorIds = rows.map((r) => r.v).filter(Boolean);
  } else if (ref.leadId !== undefined && ref.leadId !== null && ref.leadId !== "") {
    // Leads are shown as "sub_{id}" in the Campaign Builder.
    const id = Number(String(ref.leadId).replace(/^sub_/, ""));
    if (!Number.isInteger(id) || id <= 0) throw journeyError("Invalid lead id.");
    subject = `lead:${id}`;
    const [lead] = await select("SELECT visitor_id AS v FROM lead_submissions WHERE id = :id", { id });
    if (lead?.v) visitorIds = [lead.v];
  } else if (ref.orderId !== undefined && ref.orderId !== null && ref.orderId !== "") {
    const id = Number(ref.orderId);
    if (!Number.isInteger(id) || id <= 0) throw journeyError("Invalid order id.");
    subject = `order:${id}`;
    const [order] = await select("SELECT visitor_id AS v, customer_user_id AS c FROM marketing_order_attribution WHERE order_id = :id", { id });
    if (order?.v) visitorIds = [order.v];
  } else if (ref.visitorId) {
    const v = String(ref.visitorId);
    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(v)) throw journeyError("Invalid visitor id.");
    subject = `visitor:${v}`;
    visitorIds = [v];
  } else {
    throw journeyError("Provide visitorId, leadId, orderId or customerUserId.");
  }
  visitorIds = [...new Set(visitorIds)].slice(0, 20);
  if (!visitorIds.length) {
    return { found: false, subject, customer: customerId ? presentCustomer(access, customerId, new Map()) : null, summary: null, sessions: [], leads: [], orders: [] };
  }

  const events = (
    await select(
      `SELECT e.id, e.session_id AS sessionId, e.visitor_id AS visitorId, e.event_type AS type, e.timestamp AS ts,
              e.pathname, e.page_type AS pageType, e.product_id AS productId, e.customer_user_id AS customerUserId,
              e.attribution, e.metadata
       FROM marketing_analytics_events e
       WHERE e.visitor_id IN (:vids) AND e.event_type IN (:types)
       ORDER BY e.timestamp DESC LIMIT 1000`,
      { vids: visitorIds, types: JOURNEY_TYPES },
    )
  ).reverse();

  const leads = await select(
    `SELECT id, landing_page_slug AS landingPageSlug, page_url AS pageUrl, submitted_at AS submittedAt,
            conversion_status AS status, revenue
     FROM lead_submissions WHERE visitor_id IN (:vids) AND test_mode = 0 ORDER BY submitted_at`,
    { vids: visitorIds },
  );
  const orders = await select(
    `SELECT order_id AS orderId, created_at AS createdAt, status, paid_at AS paidAt, revenue, order_total AS orderTotal,
            items, is_repeat AS isRepeat, customer_user_id AS customerUserId
     FROM marketing_order_attribution WHERE visitor_id IN (:vids) ORDER BY created_at`,
    { vids: visitorIds },
  );

  const productIds = new Set(events.map((e) => e.productId).filter(Boolean).map(String));
  const catalog = await lookupProducts([...productIds]).catch(() => new Map());
  const productName = (id, fallback) => (id ? catalog.get(String(id))?.name || fallback || `Product #${id}` : fallback || null);

  const sessions = new Map();
  for (const e of events) {
    const meta = json(e.metadata, {});
    const attr = json(e.attribution, {});
    if (!sessions.has(e.sessionId)) {
      sessions.set(e.sessionId, {
        sessionId: e.sessionId,
        visitorId: e.visitorId,
        startedAt: e.ts,
        endedAt: e.ts,
        source: attr.source || "direct",
        medium: attr.medium || null,
        campaign: attr.campaign || null,
        device: meta.deviceType || null,
        entryPath: null,
        events: [],
      });
    }
    const s = sessions.get(e.sessionId);
    s.endedAt = e.ts;
    if (!s.device && meta.deviceType) s.device = meta.deviceType;
    const isView = e.type === "page_view" || e.type === "landing_page_view";
    if (isView && !s.entryPath) s.entryPath = e.pathname;
    if (e.type === "page_engagement") {
      // Active time belongs to the last view of the same page in this visit.
      const view = [...s.events].reverse().find((x) => x.kind === "view" && x.path === e.pathname);
      if (view) view.activeSec = Math.round((num(view.activeSec) * 1000 + Math.min(num(meta.activeMs), MAX_ENGAGED_MS_PER_EVENT)) / 1000);
      continue;
    }
    s.events.push({
      at: e.ts,
      kind: isView ? "view" : e.type,
      path: e.pathname || null,
      notFound: e.pageType === "not_found",
      productId: e.productId ? String(e.productId) : null,
      productName: productName(e.productId, meta.name),
      title: isView ? meta.pageTitle || null : null,
      label: e.type === "cta_click" ? meta.label || null : null,
      qty: meta.qty ?? null,
      from: meta.from ?? null,
      to: meta.to ?? null,
      value: meta.value ?? meta.revenue ?? meta.orderTotal ?? null,
      items: Array.isArray(meta.items)
        ? meta.items.slice(0, 20).map((i) => ({ productId: i.productId, name: productName(i.productId, i.name), qty: i.qty }))
        : null,
      orderId: meta.orderId ?? null,
      method: meta.method ?? null,
      activeSec: null,
    });
  }

  const customerIds = [
    ...new Set([
      ...(customerId ? [customerId] : []),
      ...events.map((e) => e.customerUserId).filter(Boolean).map(String),
      ...orders.map((o) => o.customerUserId).filter(Boolean).map(String),
    ]),
  ];
  const directory = access?.canViewCustomerDetails ? await lookupCustomers(customerIds).catch(() => new Map()) : new Map();
  const customers = customerIds.map((id) => presentCustomer(access, id, directory));
  await logPiiAccess(access, { action: "journey", subject, customerIds }).catch(() => false);

  const sessionList = [...sessions.values()];
  const views = events.filter((e) => e.type === "page_view" || e.type === "landing_page_view");
  return {
    found: true,
    subject,
    visitorIds,
    customer: customers[0] || null,
    customers,
    customerDetailsHidden: !access?.canViewCustomerDetails,
    summary: {
      firstSeenAt: events[0]?.ts || null,
      lastSeenAt: events[events.length - 1]?.ts || null,
      visits: sessionList.length,
      pageViews: views.length,
      productViews: views.filter((e) => e.productId).length,
      productsViewed: new Set(views.map((e) => e.productId).filter(Boolean)).size,
      firstSource: sessionList[0] ? { source: sessionList[0].source, medium: sessionList[0].medium, campaign: sessionList[0].campaign } : null,
      leads: leads.length,
      orders: orders.length,
      revenue: money(orders.filter((o) => o.status === "paid").reduce((s, o) => s + num(o.revenue), 0)),
      truncated: events.length >= 1000,
    },
    sessions: sessionList.reverse(),
    leads: leads.map((l) => ({ ...l, revenue: l.revenue === null ? null : money(l.revenue) })),
    orders: orders.map((o) => ({
      orderId: o.orderId,
      createdAt: o.createdAt,
      status: o.status,
      paidAt: o.paidAt,
      revenue: o.revenue === null ? null : money(o.revenue),
      orderTotal: o.orderTotal === null ? null : money(o.orderTotal),
      isRepeat: Boolean(num(o.isRepeat)),
      items: (json(o.items, []) || []).map((i) => ({ ...i, name: productName(i.productId, i.name) })),
    })),
  };
}

module.exports = {
  getProductReport,
  getProductDetail,
  getStoreFunnel,
  getTimePatterns,
  getBrokenLinks,
  getVisitorJourney,
  /** Catalog names / images / categories by product id (cached 5 min). */
  lookupProducts: (ids) => defaultLookupProducts(ids),
  // for tests
  _makeDayHour: makeDayHour,
  _maskedCustomer: maskedCustomer,
  _resetCatalogCache: () => {
    catalogCache = { at: 0, map: new Map() };
  },
  _toSqlUtc: toSqlUtc,
};
