/**
 * Revenue attribution for storefront orders (Phase 8).
 *
 *  recordOrderCreated — called from bookOrder with the website's analytics context. Stores a
 *    marketing_order_attribution row and an `order_created` event. Landing pages come from the
 *    visitor's own sessions (server data), not from the client.
 *  syncPaidOrders — run by the marketing scheduler. Emits `order_completed` (with revenue) for
 *    attributed orders whose payment is done, whichever path marked them paid (Stripe
 *    webhooks, multi-invoice checkout, admin). Event ids are deterministic, so repeats dedupe.
 *
 * Nothing here may break checkout or payments: every entry point catches its own errors.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { ingestEvent } = require("./analyticsEvents.service");
const { toSqlUtc } = require("../utils/dateRange");
const { cleanOrderItems } = require("../utils/productEvents");

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const TOUCH_KEYS = ["source", "medium", "campaign", "content", "term", "referrer", "landingPage", "category"];
/** Last-touch landing page must have been seen within this many days before the order. */
const LANDING_PAGE_LOOKBACK_DAYS = 30;
/** Orders still unpaid after this many days are no longer checked (net-terms invoices included). */
const PAYMENT_WATCH_DAYS = 180;
const SYNC_BATCH = 200;

function cleanString(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTouch(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of TOUCH_KEYS) {
    const value = cleanString(raw[key]);
    if (value) out[key] = value;
  }
  return out;
}

function cleanClickIds(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw).slice(0, 10)) {
    const v = cleanString(value, 200);
    if (v && /^[a-z_]{1,20}$/i.test(key)) out[key] = v;
  }
  return out;
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parseJson(value) {
  if (value && typeof value === "object") return value;
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

/** Landing pages this visitor came through: most recent within the lookback, and the first ever. */
async function landingPagesForVisitor(db, visitorId, at) {
  const [last] = await db.query(
    `SELECT COALESCE(last_landing_page_slug, entry_landing_page_slug) AS slug
     FROM marketing_sessions
     WHERE visitor_id = :visitorId
       AND (last_landing_page_slug IS NOT NULL OR entry_landing_page_slug IS NOT NULL)
       AND ended_at >= :since AND started_at <= :at
     ORDER BY ended_at DESC LIMIT 1`,
    {
      replacements: {
        visitorId,
        at: toSqlUtc(at),
        since: toSqlUtc(new Date(at.getTime() - LANDING_PAGE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)),
      },
      type: QueryTypes.SELECT,
    },
  );
  const [first] = await db.query(
    `SELECT COALESCE(entry_landing_page_slug, last_landing_page_slug) AS slug
     FROM marketing_sessions
     WHERE visitor_id = :visitorId
       AND (entry_landing_page_slug IS NOT NULL OR last_landing_page_slug IS NOT NULL)
       AND started_at <= :at
     ORDER BY started_at ASC LIMIT 1`,
    { replacements: { visitorId, at: toSqlUtc(at) }, type: QueryTypes.SELECT },
  );
  return { landingPageSlug: last?.slug || null, firstLandingPageSlug: first?.slug || null };
}

/**
 * @param {{ orderId: number, customerUserId?: number, orderTotal?: number, currency?: string,
 *   items?: Array<{ productId, name?, qty?, lineTotal?, categoryId? }>,
 *   analytics?: { visitorId?: string, sessionId?: string, firstTouch?: object, lastTouch?: object, clickIds?: object } }} input
 */
async function recordOrderCreated(input) {
  const orderId = Number(input?.orderId);
  const analytics = input?.analytics && typeof input.analytics === "object" ? input.analytics : null;
  const visitorId = cleanString(analytics?.visitorId, 64);
  const sessionId = cleanString(analytics?.sessionId, 64);
  if (!Number.isInteger(orderId) || orderId <= 0) return { recorded: false, reason: "no-order-id" };
  if (!ID_PATTERN.test(visitorId) || !ID_PATTERN.test(sessionId)) {
    return { recorded: false, reason: "no-analytics-context" };
  }

  const db = getMarketingSequelize();
  const at = new Date();
  const { landingPageSlug, firstLandingPageSlug } = await landingPagesForVisitor(db, visitorId, at);
  const firstTouch = cleanTouch(analytics.firstTouch);
  const lastTouch = cleanTouch(analytics.lastTouch);
  const clickIds = cleanClickIds(analytics.clickIds);
  const orderTotal = toAmount(input.orderTotal);
  const currency = cleanString(input.currency, 8).toLowerCase() || "usd";
  const customerUserId = Number(input.customerUserId);
  const items = cleanOrderItems(input.items);

  const [, inserted] = await db.query(
    `INSERT IGNORE INTO marketing_order_attribution
       (order_id, customer_user_id, visitor_id, session_id, landing_page_slug, first_landing_page_slug,
        first_touch, last_touch, order_total, currency, items)
     VALUES (:orderId, :customerUserId, :visitorId, :sessionId, :landingPageSlug, :firstLandingPageSlug,
        :firstTouch, :lastTouch, :orderTotal, :currency, :items)`,
    {
      replacements: {
        orderId,
        customerUserId: Number.isInteger(customerUserId) && customerUserId > 0 ? customerUserId : null,
        visitorId,
        sessionId,
        landingPageSlug,
        firstLandingPageSlug,
        firstTouch: JSON.stringify({ ...firstTouch, clickIds }),
        lastTouch: JSON.stringify({ ...lastTouch, clickIds }),
        orderTotal,
        currency,
        items: items ? JSON.stringify(items) : null,
      },
      type: QueryTypes.INSERT,
    },
  );

  await ingestEvent({
    id: `order_created-${orderId}`,
    visitorId,
    sessionId,
    eventType: "order_created",
    timestamp: at.toISOString(),
    landingPageSlug,
    attribution: lastTouch,
    clickIds,
    metadata: { site: "server", orderId, orderTotal, currency, firstLandingPageSlug, items: items || [] },
  });

  return { recorded: Boolean(inserted), landingPageSlug, firstLandingPageSlug };
}

/** Fire-and-forget wrapper for checkout code paths: never throws, never delays the response. */
function recordOrderCreatedSafe(input) {
  Promise.resolve()
    .then(() => recordOrderCreated(input))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[marketing:order-attribution] order_created failed:", error.message);
    });
}

/** invoicePaidDate is a DATE (no time): today → now, an earlier day → noon UTC that day. */
function paidAtFrom(invoicePaidDate, now) {
  if (!invoicePaidDate) return now;
  const day = String(invoicePaidDate).slice(0, 10);
  if (day >= now.toISOString().slice(0, 10)) return now;
  const noon = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(noon.getTime()) ? now : noon;
}

async function defaultLookupOrders(ids) {
  // Commerce models are loaded lazily so the marketing module still loads on its own.
  // eslint-disable-next-line global-require
  const { order } = require("../../models");
  return order.findAll({
    where: { id: ids },
    attributes: ["id", "userId", "paymentStatus", "totalBill", "invoicePaidDate", "deleted"],
    raw: true,
  });
}

/** Position of this order among the customer's paid orders (1 = first purchase). */
async function defaultCustomerOrderSeq(userId, orderId) {
  if (!userId) return null;
  // eslint-disable-next-line global-require
  const { order } = require("../../models");
  // eslint-disable-next-line global-require
  const { Op } = require("sequelize");
  const earlier = await order.count({
    where: { userId, paymentStatus: "done", deleted: { [Op.not]: true }, id: { [Op.lt]: orderId } },
  });
  return earlier + 1;
}

/**
 * Paid orders of customers who first came through tracked web traffic but that were not tracked
 * themselves (recurring orders, admin-created orders, another device): ids after the
 * customer's first attributed order.
 */
/**
 * Line items of commerce orders (items table + product names), as stored in
 * marketing_order_attribution.items. Map orderId → items.
 */
async function defaultLookupOrderItems(orderIds) {
  const out = new Map();
  if (!orderIds.length) return out;
  // eslint-disable-next-line global-require
  const { item, product } = require("../../models");
  const rows = await item.findAll({
    where: { orderId: orderIds, deleted: false },
    attributes: ["orderId", "productId", "qty", "price", "productName", "categoryId", "type"],
    raw: true,
  });
  const productIds = [...new Set(rows.map((r) => r.productId).filter(Boolean))];
  const names = new Map(
    productIds.length
      ? (await product.findAll({ where: { id: productIds }, attributes: ["id", "name"], raw: true, paranoid: false })).map((p) => [
        Number(p.id),
        p.name,
      ])
      : [],
  );
  for (const r of rows) {
    if (!r.productId || (r.type && r.type !== "product")) continue;
    const list = out.get(Number(r.orderId)) || [];
    list.push({
      productId: r.productId,
      name: r.productName || names.get(Number(r.productId)),
      qty: r.qty,
      lineTotal: r.price,
      categoryId: r.categoryId,
    });
    out.set(Number(r.orderId), list);
  }
  for (const [id, list] of out) out.set(id, cleanOrderItems(list));
  return out;
}

async function defaultFindUntrackedPaidOrders(customers) {
  if (!customers.length) return [];
  // eslint-disable-next-line global-require
  const { order } = require("../../models");
  // eslint-disable-next-line global-require
  const { Op } = require("sequelize");
  const minFirst = Math.min(...customers.map((c) => c.firstOrderId));
  const rows = await order.findAll({
    where: {
      userId: customers.map((c) => c.customerUserId),
      paymentStatus: "done",
      deleted: { [Op.not]: true },
      id: { [Op.gt]: minFirst },
    },
    attributes: ["id", "userId", "totalBill", "invoicePaidDate"],
    order: [["id", "ASC"]],
    limit: 2000,
    raw: true,
  });
  const firstByCustomer = new Map(customers.map((c) => [Number(c.customerUserId), c.firstOrderId]));
  return rows.filter((r) => Number(r.id) > (firstByCustomer.get(Number(r.userId)) ?? Infinity));
}

async function emitOrderCompleted(row, { revenue, paidAt, repeat, inheritedFrom }) {
  const lastTouch = parseJson(row.lastTouch);
  const { clickIds, ...touch } = lastTouch;
  // A late payment must not stretch the visit or the visitor's last-seen time.
  await ingestEvent(
    {
      id: `order_completed-${row.orderId}`,
      visitorId: row.visitorId,
      sessionId: row.sessionId,
      eventType: "order_completed",
      timestamp: paidAt.toISOString(),
      landingPageSlug: row.landingPageSlug,
      attribution: touch,
      clickIds: clickIds || {},
      metadata: {
        site: "server",
        orderId: Number(row.orderId),
        revenue,
        currency: row.currency || "usd",
        firstLandingPageSlug: row.firstLandingPageSlug,
        repeat: Boolean(repeat),
        ...(inheritedFrom ? { inheritedFromOrderId: Number(inheritedFrom) } : {}),
      },
    },
    { touchIdentity: false },
  );
}

/**
 * @param {{ lookupOrders?: (ids: number[]) => Promise<any[]>,
 *   lookupCustomerOrderSeq?: (userId: number, orderId: number) => Promise<number|null>,
 *   findUntrackedPaidOrders?: (customers: {customerUserId: number, firstOrderId: number}[]) => Promise<any[]>,
 *   now?: Date, orderIds?: number[], customerUserIds?: number[] }} [options]
 *   orderIds / customerUserIds limit the sync to those orders / customers (tests).
 */
async function syncPaidOrders(options = {}) {
  const lookupOrders = options.lookupOrders || defaultLookupOrders;
  const lookupSeq = options.lookupCustomerOrderSeq || defaultCustomerOrderSeq;
  const now = options.now || new Date();
  const onlyIds = Array.isArray(options.orderIds) ? options.orderIds.map(Number) : null;
  const db = getMarketingSequelize();
  const pending = await db.query(
    `SELECT order_id AS orderId, customer_user_id AS customerUserId, visitor_id AS visitorId,
            session_id AS sessionId, landing_page_slug AS landingPageSlug,
            first_landing_page_slug AS firstLandingPageSlug, last_touch AS lastTouch, currency
     FROM marketing_order_attribution
     WHERE status = 'created' AND created_at >= :since ${onlyIds ? "AND order_id IN (:onlyIds)" : ""}
     ORDER BY created_at LIMIT ${SYNC_BATCH}`,
    {
      replacements: {
        since: toSqlUtc(new Date(now.getTime() - PAYMENT_WATCH_DAYS * 24 * 60 * 60 * 1000)),
        onlyIds: onlyIds && onlyIds.length ? onlyIds : [0],
      },
      type: QueryTypes.SELECT,
    },
  );

  let paid = 0;
  let voided = 0;
  if (pending.length) {
    const orders = await lookupOrders(pending.map((row) => row.orderId));
    const byId = new Map(orders.map((o) => [Number(o.id), o]));

    for (const row of pending) {
      const commerce = byId.get(Number(row.orderId));
      if (!commerce || commerce.deleted === true || commerce.deleted === 1) {
        // eslint-disable-next-line no-await-in-loop
        await db.query(
          "UPDATE marketing_order_attribution SET status = 'void' WHERE order_id = :orderId AND status = 'created'",
          { replacements: { orderId: row.orderId } },
        );
        voided += 1;
        continue;
      }
      if (commerce.paymentStatus !== "done") continue;

      const revenue = toAmount(commerce.totalBill) ?? 0;
      const paidAt = paidAtFrom(commerce.invoicePaidDate, now);
      const customerUserId = Number(row.customerUserId || commerce.userId) || null;
      // eslint-disable-next-line no-await-in-loop
      const seq = customerUserId ? await lookupSeq(customerUserId, Number(row.orderId)) : null;
      // eslint-disable-next-line no-await-in-loop
      await emitOrderCompleted(row, { revenue, paidAt, repeat: seq > 1 });
      // eslint-disable-next-line no-await-in-loop
      await db.query(
        `UPDATE marketing_order_attribution
         SET status = 'paid', paid_at = :paidAt, revenue = :revenue, customer_user_id = :customerUserId,
             customer_order_seq = :seq, is_repeat = :isRepeat
         WHERE order_id = :orderId AND status = 'created'`,
        {
          replacements: {
            paidAt: toSqlUtc(paidAt),
            revenue,
            customerUserId,
            seq,
            isRepeat: seq > 1 ? 1 : 0,
            orderId: row.orderId,
          },
        },
      );
      paid += 1;
    }
  }

  const inherited = await creditUntrackedRepeatOrders(db, { ...options, now, lookupSeq });
  return { checked: pending.length, paid, voided, inherited };
}

/**
 * Repeat orders without their own tracking are credited to the source of the customer's first
 * attributed order (lifetime value per source). Rows get is_repeat = 1 and
 * inherited_from_order_id; each gets one order_completed event (deterministic id).
 */
async function creditUntrackedRepeatOrders(db, options) {
  const findUntracked = options.findUntrackedPaidOrders || defaultFindUntrackedPaidOrders;
  const lookupItems = options.lookupOrderItems || defaultLookupOrderItems;
  const onlyCustomers = Array.isArray(options.customerUserIds) ? options.customerUserIds.map(Number) : null;
  if (Array.isArray(options.orderIds) && !onlyCustomers) return 0; // scoped test run
  const originals = await db.query(
    `SELECT m.* FROM marketing_order_attribution m
     JOIN (SELECT customer_user_id, MIN(order_id) AS first_order FROM marketing_order_attribution
           WHERE customer_user_id IS NOT NULL AND inherited_from_order_id IS NULL AND status = 'paid'
             ${onlyCustomers ? "AND customer_user_id IN (:onlyCustomers)" : ""}
           GROUP BY customer_user_id) f
       ON f.customer_user_id = m.customer_user_id AND f.first_order = m.order_id`,
    {
      replacements: { onlyCustomers: onlyCustomers && onlyCustomers.length ? onlyCustomers : [0] },
      type: QueryTypes.SELECT,
    },
  );
  if (!originals.length) return 0;
  const byCustomer = new Map(originals.map((o) => [Number(o.customer_user_id), o]));
  const candidates = await findUntracked(
    originals.map((o) => ({ customerUserId: Number(o.customer_user_id), firstOrderId: Number(o.order_id) })),
  );
  if (!candidates.length) return 0;
  const known = await db.query("SELECT order_id FROM marketing_order_attribution WHERE order_id IN (:ids)", {
    replacements: { ids: candidates.map((c) => Number(c.id)) },
    type: QueryTypes.SELECT,
  });
  const knownIds = new Set(known.map((k) => Number(k.order_id)));
  const asJson = (v) => (typeof v === "string" ? v : JSON.stringify(v || {}));
  const newIds = candidates.map((c) => Number(c.id)).filter((id) => !knownIds.has(id)).slice(0, SYNC_BATCH);
  const itemsByOrder = await lookupItems(newIds).catch(() => new Map());
  let credited = 0;
  for (const c of candidates) {
    if (knownIds.has(Number(c.id)) || credited >= SYNC_BATCH) continue;
    const original = byCustomer.get(Number(c.userId));
    if (!original) continue;
    const revenue = toAmount(c.totalBill) ?? 0;
    const paidAt = paidAtFrom(c.invoicePaidDate, options.now);
    // eslint-disable-next-line no-await-in-loop
    const seq = await options.lookupSeq(Number(c.userId), Number(c.id));
    // eslint-disable-next-line no-await-in-loop
    const [, inserted] = await db.query(
      `INSERT IGNORE INTO marketing_order_attribution
         (order_id, customer_user_id, visitor_id, session_id, landing_page_slug, first_landing_page_slug,
          first_touch, last_touch, order_total, currency, status, paid_at, revenue,
          customer_order_seq, is_repeat, inherited_from_order_id, items)
       VALUES (:orderId, :customerUserId, :visitorId, :sessionId, :landingPageSlug, :firstLandingPageSlug,
          :firstTouch, :lastTouch, :revenue, :currency, 'paid', :paidAt, :revenue, :seq, 1, :fromOrder, :items)`,
      {
        replacements: {
          orderId: Number(c.id),
          customerUserId: Number(c.userId),
          visitorId: original.visitor_id,
          sessionId: original.session_id,
          landingPageSlug: original.landing_page_slug,
          firstLandingPageSlug: original.first_landing_page_slug,
          firstTouch: asJson(original.first_touch),
          lastTouch: asJson(original.last_touch),
          revenue,
          currency: original.currency || "usd",
          paidAt: toSqlUtc(paidAt),
          seq,
          fromOrder: Number(original.order_id),
          items: itemsByOrder.get(Number(c.id)) ? JSON.stringify(itemsByOrder.get(Number(c.id))) : null,
        },
        type: QueryTypes.INSERT,
      },
    );
    if (!inserted) continue;
    // eslint-disable-next-line no-await-in-loop
    await emitOrderCompleted(
      {
        orderId: c.id,
        visitorId: original.visitor_id,
        sessionId: original.session_id,
        landingPageSlug: original.landing_page_slug,
        firstLandingPageSlug: original.first_landing_page_slug,
        lastTouch: original.last_touch,
        currency: original.currency,
      },
      { revenue, paidAt, repeat: true, inheritedFrom: original.order_id },
    );
    credited += 1;
  }
  return credited;
}

module.exports = {
  defaultLookupOrderItems,
  recordOrderCreated,
  recordOrderCreatedSafe,
  syncPaidOrders,
  paidAtFrom,
};
