/**
 * Product & store analytics contract (Phase 16). Local DB only: builds a known scenario on a fixed
 * past day (Tue 2026-01-20, America/New_York), checks every report + ingest derivations +
 * customer-details masking / audit, then removes every row it wrote.
 *   node marketing/scripts/productAnalyticsTest.js
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const analyticsEventsService = require("../services/analyticsEvents.service");
const pa = require("../services/productAnalytics.service");
const pageStats = require("../services/pageStats.service");
const { parseReportRange } = require("../utils/businessTime");
const { roleCanViewCustomerDetails } = require("../services/piiAccess.service");

const TZ = "America/New_York";
const DAY = "2026-01-20"; // Tuesday; UTC-5

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function eq(actual, expected, label) {
  assert(actual === expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function run() {
  process.env.MARKETING_REPORT_TIMEZONE = TZ;
  const db = getMarketingSequelize();
  const suffix = Date.now();
  const P1 = String(8800000 + (suffix % 100000));
  const P2 = String(Number(P1) + 1);
  const C = String(1800000000 + (suffix % 1000000));
  const orderId = 2200000000 + (suffix % 100000000);
  const vA = `pa-visitor-a-${suffix}`;
  const vB = `pa-visitor-b-${suffix}`;
  const sA1 = `pa-sa1-${suffix}`;
  const sA2 = `pa-sa2-${suffix}`;
  const sB1 = `pa-sb1-${suffix}`;
  const testUser = `pa-test-user-${suffix}`;
  const p1Path = `/products/alpha-blend-${P1}`;
  const p2Path = `/products/beta-roast-${P2}`;
  let n = 0;
  const ev = (visitorId, sessionId, eventType, ts, pathname, extra = {}) =>
    analyticsEventsService.ingestEvent({
      id: `ev-pa-${suffix}-${(n += 1)}`,
      visitorId,
      sessionId,
      eventType,
      timestamp: ts,
      pathname,
      site: "customer-website",
      ...extra,
      metadata: { site: "customer-website", deviceType: "desktop", ...(extra.metadata || {}) },
    });
  const google = { attribution: { source: "google", medium: "cpc" } };
  const facebook = { attribution: { source: "facebook", medium: "paid_social" } };
  const stubs = {
    lookupProducts: async (ids) =>
      new Map(ids.map(String).filter((id) => id === P1 || id === P2).map((id) => [id, { name: id === P1 ? "Alpha Blend" : "Beta Roast", image: null, price: 10, category: "Coffee Beans" }])),
    lookupCustomers: async (ids) => new Map(ids.map(String).filter((id) => id === C).map((id) => [id, { name: "Test Buyer", email: "buyer@example.test", company: "Test Co", phone: null }])),
  };
  const superAdmin = { userId: testUser, email: "sa@example.test", role: "Super Admin", canViewCustomerDetails: true };
  const editor = { userId: testUser, email: "ed@example.test", role: "Editor", canViewCustomerDetails: roleCanViewCustomerDetails("Editor") };

  try {
    eq(editor.canViewCustomerDetails, false, "Editor has no customer-details permission by default");

    // Visitor A (signed-in customer C) — visit 1: google ad, views P1, cart, checkout, order.
    await ev(vA, sA1, "page_view", "2026-01-20T15:00:00Z", p1Path, { ...google, customerUserId: C });
    await ev(vA, sA1, "page_engagement", "2026-01-20T15:01:00Z", p1Path, { ...google, customerUserId: C, metadata: { activeMs: 30000, maxScrollPct: 60 } });
    await ev(vA, sA1, "add_to_cart", "2026-01-20T15:02:00Z", p1Path, {
      ...google, customerUserId: C, metadata: { productId: P1, name: "Alpha Blend", qty: 2, price: 10, evil: "<x>" },
    });
    await ev(vA, sA1, "view_cart", "2026-01-20T15:03:00Z", "/cart", { ...google, customerUserId: C, metadata: { items: [{ productId: P1, qty: 2, price: 10 }], value: 20 } });
    await ev(vA, sA1, "begin_checkout", "2026-01-20T15:05:00Z", "/checkout", { ...google, customerUserId: C, metadata: { items: [{ productId: P1, qty: 2, price: 10 }], value: 20 } });
    await ev(vA, sA1, "login", "2026-01-20T14:59:00Z", "/sign-in", { customerUserId: C, metadata: { method: "password", password: "never-stored" } });
    await analyticsEventsService.ingestEvent({
      id: `order_created-${orderId}`, visitorId: vA, sessionId: sA1, eventType: "order_created",
      timestamp: "2026-01-20T15:10:00Z", metadata: { site: "server", orderId, orderTotal: 20 },
    });
    await db.query(
      `INSERT INTO marketing_order_attribution
         (order_id, customer_user_id, visitor_id, session_id, status, paid_at, revenue, order_total, items, created_at)
       VALUES (?, ?, ?, ?, 'paid', '2026-01-20 16:00:00', 20, 20, ?, '2026-01-20 15:10:00')`,
      { replacements: [orderId, C, vA, sA1, JSON.stringify([{ productId: P1, name: "Alpha Blend", qty: 2, lineTotal: 20 }])] },
    );
    // Visitor A — visit 2: views P1 again (repeat viewer).
    await ev(vA, sA2, "page_view", "2026-01-20T20:00:00Z", p1Path, { ...google, customerUserId: C });

    // Visitor B (guest) — listing, P1, P2, adds P2, never orders; hits a 404.
    await ev(vB, sB1, "view_item_list", "2026-01-20T17:29:00Z", "/products", { ...facebook, metadata: { list: "shop", category: "all", count: 10 } });
    await ev(vB, sB1, "select_item", "2026-01-20T17:29:30Z", "/products", { ...facebook, metadata: { productId: P1, position: 1, list: "shop" } });
    await ev(vB, sB1, "page_view", "2026-01-20T17:30:00Z", p1Path, facebook);
    await ev(vB, sB1, "page_view", "2026-01-20T17:31:00Z", p2Path, facebook);
    await ev(vB, sB1, "add_to_cart", "2026-01-20T17:32:00Z", p2Path, { ...facebook, metadata: { productId: P2, name: "Beta Roast", qty: 1, price: 5 } });
    await ev(vB, sB1, "page_view", "2026-01-20T17:33:00Z", "/nope-broken", { ...facebook, metadata: { notFound: true } });
    await db.query(
      `INSERT INTO lead_submissions (landing_page_slug, visitor_id, session_id, page_url, fields, test_mode, submitted_at)
       VALUES (NULL, ?, ?, 'https://example.test/contact', '{}', 0, '2026-01-20 17:34:00')`,
      { replacements: [vB, sB1] },
    );
    const [lead] = await db.query("SELECT id FROM lead_submissions WHERE visitor_id = ? LIMIT 1", { replacements: [vB], type: QueryTypes.SELECT });

    // Ingest derivations
    const stored = await db.query(
      `SELECT event_type AS t, pathname AS p, product_id AS pid, customer_user_id AS cid, page_type AS pt, metadata
       FROM marketing_analytics_events WHERE visitor_id IN (?, ?)`,
      { replacements: [vA, vB], type: QueryTypes.SELECT },
    );
    const find = (t, p) => stored.find((s) => s.t === t && (!p || s.p === p));
    eq(String(find("page_view", p1Path).pid), P1, "product id derived from product URL");
    eq(String(stored.find((s) => s.t === "page_view" && s.p === p1Path && s.cid)?.cid), C, "customer id stored for signed-in view");
    eq(stored.filter((s) => s.t === "page_view" && s.p === p1Path && s.cid === null).length, 1, "guest view has no customer id");
    eq(String(find("add_to_cart", p2Path).pid), P2, "product id from cart event metadata");
    eq(find("page_view", "/nope-broken").pt, "not_found", "404 view marked not_found");
    const cartMeta = typeof find("add_to_cart", p1Path).metadata === "string" ? JSON.parse(find("add_to_cart", p1Path).metadata) : find("add_to_cart", p1Path).metadata;
    assert(!("evil" in cartMeta) && cartMeta.qty === 2, "commerce metadata whitelisted");
    const loginMeta = typeof find("login").metadata === "string" ? JSON.parse(find("login").metadata) : find("login").metadata;
    assert(!("password" in loginMeta) && loginMeta.method === "password", "login metadata keeps only the method");
    let tooBig = false;
    try {
      await ev(vB, sB1, "cta_click", "2026-01-20T17:35:00Z", "/", { metadata: { label: "x".repeat(20000) } });
    } catch (error) {
      tooBig = error.code === "VALIDATION_ERROR";
    }
    assert(tooBig, "metadata over 16 KB rejected");

    const range = parseReportRange(DAY, DAY, TZ);

    // Product report
    const report = await pa.getProductReport(range, stubs);
    const r1 = report.rows.find((r) => r.productId === P1);
    const r2 = report.rows.find((r) => r.productId === P2);
    assert(r1 && r2, "both products reported");
    eq(r1.name, "Alpha Blend", "catalog name");
    eq(r1.views, 3, "P1 views");
    eq(r1.viewers, 2, "P1 viewers");
    eq(r1.sessions, 3, "P1 sessions");
    eq(r1.repeatViewers, 1, "P1 repeat viewers");
    eq(r1.signedInViewers, 1, "P1 signed-in viewers");
    eq(r1.avgEngagedSec, 10, "P1 avg active time (30 s / 3 views)");
    eq(r1.addToCart, 1, "P1 add to cart");
    eq(r1.cartRate, 33.3, "P1 cart rate");
    eq(r1.listClicks, 1, "P1 list clicks");
    eq(r1.listImpressions, 1, "P1 list impressions");
    eq(r1.cartPageViews, 1, "P1 cart page views");
    eq(r1.checkouts, 1, "P1 checkouts");
    eq(r1.orders, 1, "P1 orders");
    eq(r1.units, 2, "P1 units");
    eq(r1.revenue, 20, "P1 revenue");
    eq(r1.orderRate, 50, "P1 view→order rate");
    eq(r1.topSource, "google", "P1 top source");
    eq(r2.views, 1, "P2 views");
    eq(r2.addToCart, 1, "P2 add to cart");
    eq(r2.orders, 0, "P2 orders");

    // Product detail (Super Admin)
    const detail = await pa.getProductDetail(range, P1, superAdmin, stubs);
    eq(detail.daily.length, 1, "one day");
    eq(detail.daily[0].views, 3, "daily views");
    eq(detail.daily[0].revenue, 20, "daily revenue");
    eq(detail.heatmap.cells[1][10], 1, "heatmap Tue 10:00 (15:00Z)");
    eq(detail.heatmap.cells[1][12], 1, "heatmap Tue 12:00 (17:30Z)");
    eq(detail.heatmap.cells[1][15], 1, "heatmap Tue 15:00 (20:00Z)");
    eq(detail.alsoViewed[0]?.productId, P2, "also viewed P2");
    eq(detail.customers.length, 1, "one signed-in customer");
    const c1 = detail.customers[0];
    assert(c1.name === "Test Buyer" && c1.email === "buyer@example.test" && c1.views === 2 && c1.visits === 2 && c1.addedToCart && c1.ordered, `customer row: ${JSON.stringify(c1)}`);
    eq(detail.recentViews.length, 3, "recent views");

    // Product detail (Editor): masked, not audited
    const masked = await pa.getProductDetail(range, P1, editor, stubs);
    const m1 = masked.customers[0];
    assert(m1.name === `Customer #${C}` && m1.email === null && m1.masked === true, `masked customer: ${JSON.stringify(m1)}`);
    eq(masked.customerDetailsHidden, true, "masked flag");

    // Store funnel + abandoned carts
    const store = await pa.getStoreFunnel(range, superAdmin, stubs);
    const steps = Object.fromEntries(store.funnel.map((f) => [f.step, f.sessions]));
    eq(steps.product_view, 3, "funnel product views");
    eq(steps.add_to_cart, 2, "funnel carts");
    eq(steps.view_cart, 1, "funnel cart page");
    eq(steps.begin_checkout, 1, "funnel checkout");
    eq(steps.order_created, 1, "funnel orders");
    eq(steps.paid, 1, "funnel paid");
    eq(store.abandonedCarts.count, 1, "abandoned carts");
    eq(store.abandonedCarts.value, 5, "abandoned value");
    eq(store.abandonedCarts.rate, 50, "abandon rate");
    eq(store.abandonedCarts.recent[0].customer, null, "guest cart has no customer");

    // Time patterns + broken links
    const times = await pa.getTimePatterns(range);
    eq(times.productViews.cells[1][10], 1, "product view heatmap Tue 10:00");
    eq(times.productViews.cells[1][12], 2, "product view heatmap Tue 12:00 (P1 + P2)");
    eq(times.productViews.cells[1][15], 1, "product view heatmap Tue 15:00");
    const broken = await pa.getBrokenLinks(range);
    eq(broken.find((b) => b.pathname === "/nope-broken")?.hits, 1, "broken link listed");

    // Journeys
    const byCustomer = await pa.getVisitorJourney({ customerUserId: C }, superAdmin, stubs);
    assert(byCustomer.found && byCustomer.summary.visits === 2 && byCustomer.summary.productViews === 2 && byCustomer.summary.orders === 1, `customer journey summary ${JSON.stringify(byCustomer.summary)}`);
    eq(byCustomer.customer.name, "Test Buyer", "journey customer name");
    const view = byCustomer.sessions.flatMap((s) => s.events).find((e) => e.kind === "view" && e.productId === P1 && e.activeSec);
    eq(view?.activeSec, 30, "active time folded into the product view");
    assert(byCustomer.sessions.flatMap((s) => s.events).some((e) => e.kind === "login"), "sign-in in journey");
    let forbidden = false;
    try {
      await pa.getVisitorJourney({ customerUserId: C }, editor, stubs);
    } catch (error) {
      forbidden = error.code === "PII_FORBIDDEN" && error.status === 403;
    }
    assert(forbidden, "Editor cannot open a customer journey");
    const byOrderEditor = await pa.getVisitorJourney({ orderId }, editor, stubs);
    assert(byOrderEditor.found && byOrderEditor.customer.masked && byOrderEditor.customer.email === null, "order journey masked for Editor");
    const byLead = await pa.getVisitorJourney({ leadId: `sub_${lead.id}` }, superAdmin, stubs);
    assert(byLead.found && byLead.sessions.flatMap((s) => s.events).some((e) => e.notFound), "lead journey shows the 404");

    // Audit: rows for Super Admin requests with identified customers only
    const audit = await db.query(
      "SELECT action, subject, customer_ids AS ids FROM marketing_pii_access_log WHERE marketing_user_id = ? ORDER BY id",
      { replacements: [testUser], type: QueryTypes.SELECT },
    );
    const actions = audit.map((a) => a.action);
    assert(actions.includes("product_customers") && actions.includes("journey"), `audit actions ${JSON.stringify(actions)}`);
    assert(audit.every((a) => (typeof a.ids === "string" ? JSON.parse(a.ids) : a.ids).includes(C)), "audit rows list the customer");
    eq(audit.length, 2, "no audit rows for masked (Editor) or guest-only responses");

    // Site page credited with the order through the entry page of the ordering visit
    await pageStats.rollupDay(DAY, TZ);
    const site = await pageStats.getPageStats({ range, pageType: "site", pageSlug: `products-alpha-blend-${P1}` });
    eq(site.rows[0]?.orders, 1, "product page credited with the order (entry page)");
    eq(site.rows[0]?.revenue, 20, "product page revenue");
    eq(site.rows[0]?.productId, P1, "site row product id");
    const notFoundRow = await pageStats.getPageStats({ range, pageType: "site", pageSlug: "nope-broken" });
    eq(notFoundRow.rows.length, 0, "404 not in site pages");
  } finally {
    const visitors = [vA, vB];
    await db.query("DELETE FROM marketing_analytics_events WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM marketing_sessions WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM marketing_visitors WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM lead_submissions WHERE visitor_id IN (?)", { replacements: [visitors] });
    await db.query("DELETE FROM marketing_order_attribution WHERE order_id = ?", { replacements: [orderId] });
    await db.query("DELETE FROM marketing_pii_access_log WHERE marketing_user_id = ?", { replacements: [testUser] });
    await db.query("DELETE FROM marketing_daily_page_stats WHERE stat_date = ?", { replacements: [DAY] });
    await db.query("DELETE FROM marketing_daily_rollup_runs WHERE stat_date = ?", { replacements: [DAY] });
  }
  // eslint-disable-next-line no-console
  console.log("[product-analytics] passed");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[product-analytics] failed:", error.message);
    process.exit(1);
  });
