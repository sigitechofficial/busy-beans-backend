/**
 * Revenue attribution contract (Phase 8) + repeat customers (Phase 13). Local DB only: writes
 * test rows, removes them after.
 * Uses fake order ids and a stubbed commerce lookup, so no real order is read or changed.
 *   node marketing/scripts/orderAttributionTest.js
 * Optional: MARKETING_TEST_BASE_URL=http://localhost:8013 also checks that the public ingest
 * endpoint refuses revenue events.
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const analyticsEventsService = require("../services/analyticsEvents.service");
const touchpointsService = require("../services/touchpoints.service");
const analyticsDashboardService = require("../services/analyticsDashboard.service");
const { recordOrderCreated, syncPaidOrders, paidAtFrom } = require("../services/orderAttribution.service");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const db = getMarketingSequelize();
  const suffix = Date.now();
  const visitorId = `contract-oa-visitor-${suffix}`;
  const sessionId = `contract-oa-session-${suffix}`;
  const slug = "contract-test-slug";
  const paidOrderId = 2000000000 + (suffix % 100000000);
  const voidOrderId = paidOrderId + 1;
  const source = `contract-src-${suffix}`;
  const campaign = `contract-cmp-${suffix}`;
  const repeatOrderId = paidOrderId + 5;
  const customerUserId = 1900000000 + (suffix % 1000000);
  const orderIds = [paidOrderId, voidOrderId];

  try {
    // A visit that went through a landing page.
    const visitAt = new Date(Date.now() - 60_000).toISOString();
    await analyticsEventsService.ingestEvent({
      id: `ev-oa-lp-${suffix}`,
      visitorId,
      sessionId,
      eventType: "landing_page_view",
      timestamp: visitAt,
      pathname: `/lp/${slug}`,
      landingPageSlug: slug,
      metadata: { site: "customer-website" },
    });

    await touchpointsService.ingestTouchpoint({
      id: `tp-oa-${suffix}`,
      visitorId,
      sessionId,
      timestamp: visitAt,
      source,
      medium: "paid_social",
      campaign,
      landingPage: slug,
      isLandingPage: true,
    });

    const noContext = await recordOrderCreated({ orderId: voidOrderId + 1, analytics: undefined });
    assert(noContext.recorded === false, "An order without analytics context must not be attributed");

    const analytics = {
      visitorId,
      sessionId,
      firstTouch: { source, campaign, medium: "paid_social" },
      lastTouch: { source, campaign, medium: "paid_social", evil: "<dropped>" },
      clickIds: { fbclid: "abc" },
    };
    const created = await recordOrderCreated({ orderId: paidOrderId, customerUserId, orderTotal: 42.5, analytics });
    assert(created.recorded, "Attribution row should be written");
    assert(created.landingPageSlug === slug, `Landing page should come from the visitor's session, got ${created.landingPageSlug}`);
    await recordOrderCreated({ orderId: voidOrderId, orderTotal: 10, analytics });
    const again = await recordOrderCreated({ orderId: paidOrderId, orderTotal: 42.5, analytics });
    assert(again.recorded === false, "Re-recording the same order must not insert twice");

    const [row] = await db.query(
      "SELECT landing_page_slug, first_landing_page_slug, last_touch, status FROM marketing_order_attribution WHERE order_id = ?",
      { replacements: [paidOrderId], type: QueryTypes.SELECT },
    );
    const lastTouch = typeof row.last_touch === "string" ? JSON.parse(row.last_touch) : row.last_touch;
    assert(row.status === "created" && row.first_landing_page_slug === slug, "Row status/first landing page wrong");
    assert(!("evil" in lastTouch) && lastTouch.source === source, "Touch data must be whitelisted");

    const [createdEvent] = await db.query(
      "SELECT landing_page_slug, page_type, site FROM marketing_analytics_events WHERE id = ?",
      { replacements: [`order_created-${paidOrderId}`], type: QueryTypes.SELECT },
    );
    assert(createdEvent && createdEvent.landing_page_slug === slug, "order_created event must carry the landing page");
    assert(createdEvent.page_type === null && createdEvent.site === "server", "order_created is a server event");

    const [sessionBefore] = await db.query("SELECT ended_at FROM marketing_sessions WHERE session_id = ?", {
      replacements: [sessionId],
      type: QueryTypes.SELECT,
    });

    // Not paid yet: nothing happens.
    const pendingLookup = async (ids) => ids.filter((id) => id === paidOrderId).map((id) => ({ id, paymentStatus: "pending", totalBill: "42.50" }));
    const first = await syncPaidOrders({ lookupOrders: pendingLookup, orderIds });
    assert(first.paid === 0 && first.voided === 1, `Unpaid order must wait; missing order must be voided (${JSON.stringify(first)})`);

    // Paid now — a minute after the visit (reports only count payments up to today).
    const later = new Date();
    const paidLookup = async (ids) => ids.map((id) => ({ id, paymentStatus: "done", totalBill: "42.50", invoicePaidDate: null, deleted: false }));
    // First paid order of this customer; the untracked repeat order is their second.
    const seqStub = async (userId, orderId) => (Number(orderId) === repeatOrderId ? 2 : 1);
    const second = await syncPaidOrders({ lookupOrders: paidLookup, lookupCustomerOrderSeq: seqStub, orderIds, now: later });
    assert(second.paid === 1, `Paid order must be completed (${JSON.stringify(second)})`);
    const third = await syncPaidOrders({ lookupOrders: paidLookup, orderIds, now: later });
    assert(third.checked === 0 && third.paid === 0, "Sync must be idempotent");

    const [completed] = await db.query(
      "SELECT landing_page_slug, metadata, attribution, timestamp FROM marketing_analytics_events WHERE id = ?",
      { replacements: [`order_completed-${paidOrderId}`], type: QueryTypes.SELECT },
    );
    const meta = typeof completed.metadata === "string" ? JSON.parse(completed.metadata) : completed.metadata;
    const attr = typeof completed.attribution === "string" ? JSON.parse(completed.attribution) : completed.attribution;
    assert(completed.landing_page_slug === slug, "order_completed must carry the landing page");
    assert(Number(meta.revenue) === 42.5 && attr.source === source, "order_completed must carry revenue and last touch");

    const [sessionAfter] = await db.query("SELECT ended_at FROM marketing_sessions WHERE session_id = ?", {
      replacements: [sessionId],
      type: QueryTypes.SELECT,
    });
    assert(String(sessionAfter.ended_at) === String(sessionBefore.ended_at), "A later payment must not extend the session");

    const [paidRow] = await db.query("SELECT status, revenue FROM marketing_order_attribution WHERE order_id = ?", {
      replacements: [paidOrderId],
      type: QueryTypes.SELECT,
    });
    assert(paidRow.status === "paid" && Number(paidRow.revenue) === 42.5, "Row must be marked paid with revenue");

    // Repeat order placed without tracking (another device / admin) → credited to the first order's source.
    const untracked = async (customers) => {
      const mine = customers.find((c) => c.customerUserId === customerUserId);
      return mine ? [{ id: repeatOrderId, userId: customerUserId, totalBill: "20.00", invoicePaidDate: null }] : [];
    };
    const opts = { lookupOrders: paidLookup, lookupCustomerOrderSeq: seqStub, findUntrackedPaidOrders: untracked, now: later };
    const scoped = await syncPaidOrders({ ...opts, orderIds });
    assert(scoped.inherited === 0, "An order-scoped sync must not credit repeat orders");
    const repeat = await syncPaidOrders({ ...opts, orderIds: [0], customerUserIds: [customerUserId] });
    assert(repeat.inherited === 1, `Untracked repeat order must be credited (${JSON.stringify(repeat)})`);
    const repeatAgain = await syncPaidOrders({ ...opts, orderIds: [0], customerUserIds: [customerUserId] });
    assert(repeatAgain.inherited === 0, "Repeat crediting must be idempotent");
    const [firstRow] = await db.query(
      "SELECT customer_order_seq AS seq, is_repeat AS isRepeat FROM marketing_order_attribution WHERE order_id = ?",
      { replacements: [paidOrderId], type: QueryTypes.SELECT },
    );
    assert(Number(firstRow.seq) === 1 && Number(firstRow.isRepeat) === 0, "First order must be seq 1, not repeat");
    const [repeatRow] = await db.query(
      `SELECT status, revenue, customer_order_seq AS seq, is_repeat AS isRepeat, inherited_from_order_id AS fromOrder,
              landing_page_slug AS slug FROM marketing_order_attribution WHERE order_id = ?`,
      { replacements: [repeatOrderId], type: QueryTypes.SELECT },
    );
    assert(
      repeatRow && repeatRow.status === "paid" && Number(repeatRow.revenue) === 20 && Number(repeatRow.seq) === 2 &&
        Number(repeatRow.isRepeat) === 1 && Number(repeatRow.fromOrder) === paidOrderId && repeatRow.slug === slug,
      `Inherited row wrong: ${JSON.stringify(repeatRow)}`,
    );
    const [repeatEvent] = await db.query("SELECT metadata FROM marketing_analytics_events WHERE id = ?", {
      replacements: [`order_completed-${repeatOrderId}`],
      type: QueryTypes.SELECT,
    });
    const repeatMeta = typeof repeatEvent.metadata === "string" ? JSON.parse(repeatEvent.metadata) : repeatEvent.metadata;
    assert(repeatMeta.repeat === true && repeatMeta.inheritedFromOrderId === paidOrderId, "Repeat event metadata wrong");

    const dashboard = await analyticsDashboardService.getDashboard({});
    const lp = dashboard.landingPages.find((r) => r.landingPageSlug === slug);
    assert(lp && lp.revenue >= 42.5 && lp.orders >= 1, "Dashboard landing page must show the order revenue");
    const src = (dashboard.marketing.trafficSources || []).find((r) => r.source === source);
    const cmp = (dashboard.marketing.utmCampaigns || []).find((r) => r.campaign === campaign);
    assert(src && src.revenue === 62.5, `Traffic source revenue wrong (${src && src.revenue})`);
    assert(cmp && cmp.revenue === 62.5, "Campaign revenue wrong");
    const cust = (dashboard.customers?.bySource || []).find((r) => r.source === source);
    assert(
      cust && cust.customers === 1 && cust.newCustomers === 1 && cust.repeatCustomers === 1 && cust.orders === 2 &&
        cust.revenue === 62.5 && cust.repeatRevenue === 20,
      `Customers-by-source row wrong: ${JSON.stringify(cust)}`,
    );
    assert(dashboard.executive.repeatCustomers >= 1 && dashboard.executive.repeatRevenue >= 20, "Executive repeat KPIs wrong");
    const tsm = (dashboard.marketing.trafficSourceMediums || []).find((r) => r.source === source);
    assert(tsm && tsm.visitors === 1 && tsm.orders === 2 && tsm.revenue === 62.5, `Source/medium row wrong: ${JSON.stringify(tsm)}`);

    assert(paidAtFrom("2020-01-02", new Date()).toISOString() === "2020-01-02T12:00:00.000Z", "Past paid date → noon UTC");

    const base = process.env.MARKETING_TEST_BASE_URL;
    if (base) {
      const res = await fetch(`${base.replace(/\/+$/, "")}/api/public/tracking/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `ev-oa-fake-${suffix}`, visitorId, sessionId, eventType: "order_completed", metadata: { revenue: 999999 } }),
      });
      assert(res.status === 400, `Public ingest must refuse order_completed (got ${res.status})`);
    }
  } finally {
    await db.query("DELETE FROM marketing_order_attribution WHERE order_id IN (?)", { replacements: [[...orderIds, voidOrderId + 1, repeatOrderId]] });
    await db.query("DELETE FROM marketing_analytics_events WHERE visitor_id = ?", { replacements: [visitorId] });
    await db.query("DELETE FROM marketing_touchpoints WHERE visitor_id = ?", { replacements: [visitorId] });
    await db.query("DELETE FROM marketing_sessions WHERE visitor_id = ?", { replacements: [visitorId] });
    await db.query("DELETE FROM marketing_visitors WHERE visitor_id = ?", { replacements: [visitorId] });
  }

  // eslint-disable-next-line no-console
  console.log("[order-attribution] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[order-attribution] failed:", error.message);
    process.exit(1);
  });
