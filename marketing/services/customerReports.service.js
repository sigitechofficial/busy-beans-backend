/**
 * Customer reporting (Phase 13): who became a customer, from which source, and whether they came
 * back.
 *
 *   Customers   paid attributed orders (marketing_order_attribution): new = the customer's first
 *               paid order (customer_order_seq = 1) in the range; repeat = 2nd+ paid orders,
 *               including untracked repeat orders credited to the customer's original source.
 *   Won leads   non-test leads marked "won" by sales (converted_at in range) with the revenue
 *               entered on the lead — B2B customers who never check out online.
 *   Sources     touch = "last" | "first": which stored touch the order is credited to. Leads use
 *               the attribution captured with the lead.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { appendTimestampFilter } = require("../utils/dateRange");

const LEAD_SOURCE =
  "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.source')), ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.utmSource')), ''), 'direct')";
const LEAD_MEDIUM =
  "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.medium')), ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.utmMedium')), ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.lastTouchMedium')), ''), 'none')";
const LEAD_CAMPAIGN =
  "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.campaign')), ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.utmCampaign')), ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(l.attribution, '$.lastTouchCampaign')), ''), '(not set)')";

function orderExpr(touch, key, fallback) {
  const column = touch === "first" ? "m.first_touch" : "m.last_touch";
  return `COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${column}, '$.${key}')), ''), '${fallback}')`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return Math.round(num(v) * 100) / 100;
}

/** "(none)", "", "(not set)" and "none" are the same medium. */
function normMedium(medium) {
  const m = String(medium ?? "").trim().toLowerCase();
  return !m || m === "(none)" || m === "(not set)" ? "none" : m;
}

function keyOf(...parts) {
  return parts.map((p) => String(p ?? "").trim().toLowerCase()).join("|");
}

async function select(sql, replacements) {
  return getMarketingSequelize().query(sql, { replacements, type: QueryTypes.SELECT });
}

/** Totals for the executive cards. */
async function getCustomerSummary(range) {
  const paid = appendTimestampFilter(range, "m.paid_at", "AND");
  const won = appendTimestampFilter(range, "l.converted_at", "AND");
  const [orders] = await select(
    `SELECT
       SUM(m.customer_order_seq = 1) AS newCustomers,
       COUNT(DISTINCT CASE WHEN m.is_repeat = 1 THEN m.customer_user_id END) AS repeatCustomers,
       COUNT(DISTINCT m.customer_user_id) AS customers,
       SUM(m.is_repeat = 1) AS repeatOrders,
       SUM(CASE WHEN m.is_repeat = 1 THEN m.revenue ELSE 0 END) AS repeatRevenue,
       SUM(CASE WHEN m.is_repeat = 0 THEN m.revenue ELSE 0 END) AS firstOrderRevenue,
       SUM(m.revenue) AS orderRevenue,
       COUNT(*) AS orders
     FROM marketing_order_attribution m
     WHERE m.status = 'paid' ${paid.sql}`,
    paid.replacements,
  );
  const [wonRow] = await select(
    `SELECT COUNT(*) AS wonLeads, SUM(COALESCE(l.revenue, 0)) AS wonRevenue
     FROM lead_submissions l
     WHERE l.test_mode = 0 AND l.conversion_status = 'won' ${won.sql}`,
    won.replacements,
  );
  const customers = num(orders?.customers);
  const repeatCustomers = num(orders?.repeatCustomers);
  const orderRevenue = money(orders?.orderRevenue);
  const wonRevenue = money(wonRow?.wonRevenue);
  return {
    newCustomers: num(orders?.newCustomers),
    repeatCustomers,
    customers,
    repeatCustomerRate: customers > 0 ? Math.round((repeatCustomers / customers) * 1000) / 10 : 0,
    orders: num(orders?.orders),
    repeatOrders: num(orders?.repeatOrders),
    orderRevenue,
    firstOrderRevenue: money(orders?.firstOrderRevenue),
    repeatRevenue: money(orders?.repeatRevenue),
    wonLeads: num(wonRow?.wonLeads),
    wonRevenue,
    totalCustomerRevenue: money(orderRevenue + wonRevenue),
  };
}

/** Won leads + revenue grouped by a lead-attribution expression. */
async function getWonLeadsBy(range, expr) {
  const won = appendTimestampFilter(range, "l.converted_at", "AND");
  const rows = await select(
    `SELECT ${expr} AS grp, COUNT(*) AS wonLeads, SUM(COALESCE(l.revenue, 0)) AS wonRevenue
     FROM lead_submissions l
     WHERE l.test_mode = 0 AND l.conversion_status = 'won' ${won.sql}
     GROUP BY ${expr}`,
    won.replacements,
  );
  const map = new Map();
  for (const r of rows) map.set(keyOf(r.grp), { wonLeads: num(r.wonLeads), wonRevenue: money(r.wonRevenue) });
  return map;
}

/**
 * Customers per source (+ medium) for the chosen touch: acquisition and lifetime value.
 * @returns {Array<{source, medium, customers, newCustomers, repeatCustomers, orders, revenue,
 *   repeatRevenue, revenuePerCustomer, wonLeads, wonRevenue, totalRevenue}>}
 */
async function getCustomersBySource(range, touch = "last") {
  const paid = appendTimestampFilter(range, "m.paid_at", "AND");
  const source = orderExpr(touch, "source", "direct");
  const medium = orderExpr(touch, "medium", "none");
  const rows = await select(
    `SELECT ${source} AS source, ${medium} AS medium,
       COUNT(DISTINCT m.customer_user_id) AS customers,
       SUM(m.customer_order_seq = 1) AS newCustomers,
       COUNT(DISTINCT CASE WHEN m.is_repeat = 1 THEN m.customer_user_id END) AS repeatCustomers,
       COUNT(*) AS orders,
       SUM(m.revenue) AS revenue,
       SUM(CASE WHEN m.is_repeat = 1 THEN m.revenue ELSE 0 END) AS repeatRevenue
     FROM marketing_order_attribution m
     WHERE m.status = 'paid' ${paid.sql}
     GROUP BY ${source}, ${medium}`,
    paid.replacements,
  );
  const won = await getWonLeadsBy(range, `CONCAT(${LEAD_SOURCE}, '|', ${LEAD_MEDIUM})`);
  const out = new Map();
  for (const r of rows) {
    const k = keyOf(r.source, normMedium(r.medium));
    const prev = out.get(k);
    out.set(k, {
      source: r.source,
      medium: normMedium(r.medium),
      customers: num(r.customers) + (prev?.customers || 0),
      newCustomers: num(r.newCustomers) + (prev?.newCustomers || 0),
      repeatCustomers: num(r.repeatCustomers) + (prev?.repeatCustomers || 0),
      orders: num(r.orders) + (prev?.orders || 0),
      revenue: money(num(r.revenue) + (prev?.revenue || 0)),
      repeatRevenue: money(num(r.repeatRevenue) + (prev?.repeatRevenue || 0)),
      wonLeads: 0,
      wonRevenue: 0,
    });
  }
  for (const [rawKey, w] of won) {
    const [src, rawMed] = rawKey.split("|");
    const med = normMedium(rawMed);
    const k = keyOf(src, med);
    const row = out.get(k) || {
      source: src,
      medium: med,
      customers: 0,
      newCustomers: 0,
      repeatCustomers: 0,
      orders: 0,
      revenue: 0,
      repeatRevenue: 0,
    };
    out.set(k, { ...row, wonLeads: (row.wonLeads || 0) + w.wonLeads, wonRevenue: money((row.wonRevenue || 0) + w.wonRevenue) });
  }
  return [...out.values()]
    .map((r) => ({
      ...r,
      wonLeads: r.wonLeads || 0,
      wonRevenue: r.wonRevenue || 0,
      totalRevenue: money(r.revenue + (r.wonRevenue || 0)),
      revenuePerCustomer: r.customers > 0 ? money(r.revenue / r.customers) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue || b.customers - a.customers);
}

/**
 * Full-range source + medium report (visitors from touchpoints, leads, won leads, orders and
 * revenue). Replaces the browser-side approximation built from the latest 20 touchpoints.
 */
async function getTrafficSourceMediums(range, touch = "last") {
  const tp = appendTimestampFilter(range, "tp.timestamp", "AND");
  const leadF = appendTimestampFilter(range, "l.submitted_at", "AND");
  const paid = appendTimestampFilter(range, "m.paid_at", "AND");
  const tpSource = "COALESCE(NULLIF(tp.source, ''), 'direct')";
  const tpMedium = "COALESCE(NULLIF(tp.medium, ''), 'none')";
  const visitors = await select(
    `SELECT ${tpSource} AS source, ${tpMedium} AS medium, MAX(tp.category) AS category,
            COUNT(DISTINCT tp.visitor_id) AS visitors
     FROM marketing_touchpoints tp
     WHERE 1 = 1 ${tp.sql}
     GROUP BY ${tpSource}, ${tpMedium}`,
    tp.replacements,
  );
  const leads = await select(
    `SELECT ${LEAD_SOURCE} AS source, ${LEAD_MEDIUM} AS medium, COUNT(*) AS leads
     FROM lead_submissions l
     WHERE l.test_mode = 0 ${leadF.sql}
     GROUP BY ${LEAD_SOURCE}, ${LEAD_MEDIUM}`,
    leadF.replacements,
  );
  const oSource = orderExpr(touch, "source", "direct");
  const oMedium = orderExpr(touch, "medium", "none");
  const orders = await select(
    `SELECT ${oSource} AS source, ${oMedium} AS medium, COUNT(*) AS orders, SUM(m.revenue) AS revenue,
            COUNT(DISTINCT m.customer_user_id) AS customers
     FROM marketing_order_attribution m
     WHERE m.status = 'paid' ${paid.sql}
     GROUP BY ${oSource}, ${oMedium}`,
    paid.replacements,
  );
  const won = await getWonLeadsBy(range, `CONCAT(${LEAD_SOURCE}, '|', ${LEAD_MEDIUM})`);

  const rows = new Map();
  const rowFor = (source, rawMedium) => {
    const medium = normMedium(rawMedium);
    const k = keyOf(source, medium);
    if (!rows.has(k)) {
      rows.set(k, { source, medium, category: undefined, visitors: 0, leads: 0, wonLeads: 0, wonRevenue: 0, orders: 0, revenue: 0, customers: 0 });
    }
    return rows.get(k);
  };
  for (const r of visitors) {
    const row = rowFor(r.source, r.medium);
    row.visitors += num(r.visitors);
    row.category = row.category || r.category || undefined;
  }
  for (const r of leads) rowFor(r.source, r.medium).leads += num(r.leads);
  for (const r of orders) {
    const row = rowFor(r.source, r.medium);
    row.orders += num(r.orders);
    row.revenue = money(row.revenue + num(r.revenue));
    row.customers += num(r.customers);
  }
  for (const [k, w] of won) {
    const [src, med] = k.split("|");
    const row = rowFor(src, med);
    row.wonLeads += w.wonLeads;
    row.wonRevenue = money(row.wonRevenue + w.wonRevenue);
  }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      conversionRate: r.visitors > 0 ? Math.round((r.orders / r.visitors) * 1000) / 10 : 0,
      leadRate: r.visitors > 0 ? Math.round((r.leads / r.visitors) * 1000) / 10 : 0,
      totalRevenue: money(r.revenue + r.wonRevenue),
    }))
    .sort((a, b) => b.visitors - a.visitors || b.totalRevenue - a.totalRevenue);
}

module.exports = {
  getCustomerSummary,
  getCustomersBySource,
  getTrafficSourceMediums,
  getWonLeadsBy,
  LEAD_SOURCE,
  LEAD_CAMPAIGN,
};
