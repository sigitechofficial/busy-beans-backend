/**
 * One-off backfill for product analytics (Phase 16). Dry run by default; idempotent.
 *   node marketing/scripts/backfillProductAnalytics.js [--apply] [--with-customers]
 *
 *   1. product_id on existing product-page events (/products/{slug}-{id}, /products/detail/{id},
 *      /shop/{slug}-{id})
 *   2. page_type = 'not_found' for website views of paths that are not website routes
 *      (404s recorded before the website marked them), so they leave the Site pages report
 *   3. items on existing marketing_order_attribution rows, from the commerce items table
 *   4. --with-customers: customer_user_id on existing events from metadata.customerUserId
 *      (views recorded before the cookie banner existed)
 *   Page-stat rollups are cleared (rebuilt on next read) when anything changed.
 */
require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { productIdFromPath, cleanCustomerId } = require("../utils/productEvents");
const { defaultLookupOrderItems } = require("../services/orderAttribution.service");

// CLI flags; run() options override them when called from a data migration.
let APPLY = process.argv.includes("--apply");
let WITH_CUSTOMERS = process.argv.includes("--with-customers");

/** First path segments of the website's routes (busy-bean-website-new-nextjs/src/app). */
const WEBSITE_ROUTES = new Set([
  "", "api", "campaign-tracking", "cart", "checkout", "contact", "financing", "forgot-password",
  "help-and-support", "invoice-payment-failure", "invoice-payment-success", "lp", "machine",
  "network-error", "no-internet", "order-history", "our-story", "payment", "paymentCheck",
  "paymentCompleted", "privacy-policy", "products", "profile", "recepies", "reset-password", "shop",
  "sign-in", "sign-up", "signup-step2", "signup-step3", "subscription-payment", "terms-conditions",
  "test-network", "timeline", "verify-email", "verify-otp", "sitemap.xml", "robots.txt",
]);

function isWebsiteRoute(pathname) {
  const first = String(pathname || "/").split(/[?#]/)[0].replace(/^\/+/, "").split("/")[0];
  return WEBSITE_ROUTES.has(first);
}

async function run({ apply = APPLY, withCustomers = WITH_CUSTOMERS } = {}) {
  APPLY = apply;
  WITH_CUSTOMERS = withCustomers;
  const db = getMarketingSequelize();
  const q = (sql, replacements = {}) => db.query(sql, { replacements, type: QueryTypes.SELECT });
  const x = (sql, replacements = {}) => db.query(sql, { replacements });
  let changed = 0;

  // 1. product ids
  const productEvents = await q(
    `SELECT id, pathname FROM marketing_analytics_events
     WHERE product_id IS NULL AND page_type = 'site' AND (pathname LIKE '/products/%' OR pathname LIKE '/shop/%')`,
  );
  const withProduct = productEvents.map((e) => ({ id: e.id, pid: productIdFromPath(e.pathname) })).filter((e) => e.pid);
  console.log(`[backfill] product ids: ${withProduct.length} event(s)`);
  if (APPLY) for (const e of withProduct) await x("UPDATE marketing_analytics_events SET product_id = :pid WHERE id = :id", e);
  changed += withProduct.length;

  // 2. 404 views
  const sitePaths = await q(
    `SELECT pathname, COUNT(*) AS n FROM marketing_analytics_events
     WHERE page_type = 'site' AND pathname IS NOT NULL AND (site = 'customer-website' OR site IS NULL)
     GROUP BY pathname`,
  );
  const notFound = sitePaths.filter((p) => !isWebsiteRoute(p.pathname));
  for (const p of notFound) console.log(`[backfill] not a website route: ${p.pathname} (${p.n} event(s))`);
  if (APPLY && notFound.length) {
    await x("UPDATE marketing_analytics_events SET page_type = 'not_found' WHERE page_type = 'site' AND pathname IN (:paths)", {
      paths: notFound.map((p) => p.pathname),
    });
  }
  changed += notFound.length;

  // 3. order items
  const orders = await q("SELECT order_id AS orderId FROM marketing_order_attribution WHERE items IS NULL");
  const itemsByOrder = orders.length ? await defaultLookupOrderItems(orders.map((o) => Number(o.orderId))) : new Map();
  console.log(`[backfill] order items: ${itemsByOrder.size} of ${orders.length} attributed order(s) have commerce items`);
  if (APPLY) {
    for (const [orderId, items] of itemsByOrder) {
      if (items) await x("UPDATE marketing_order_attribution SET items = :items WHERE order_id = :orderId AND items IS NULL", { items: JSON.stringify(items), orderId });
    }
  }
  changed += itemsByOrder.size;

  // 4. customers (opt-in flag)
  const customerEvents = await q(
    `SELECT id, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.customerUserId')) AS cid FROM marketing_analytics_events
     WHERE customer_user_id IS NULL AND JSON_EXTRACT(metadata, '$.customerUserId') IS NOT NULL`,
  );
  const linkable = customerEvents.map((e) => ({ id: e.id, cid: cleanCustomerId(e.cid) })).filter((e) => e.cid);
  console.log(`[backfill] customer links: ${linkable.length} event(s)${WITH_CUSTOMERS ? "" : " (skipped: pass --with-customers)"}`);
  if (APPLY && WITH_CUSTOMERS) for (const e of linkable) await x("UPDATE marketing_analytics_events SET customer_user_id = :cid WHERE id = :id", e);
  if (WITH_CUSTOMERS) changed += linkable.length;

  if (APPLY && changed > 0) {
    await x("DELETE FROM marketing_daily_page_stats");
    await x("DELETE FROM marketing_daily_rollup_runs");
    console.log("[backfill] page-stat rollups cleared (rebuilt on next read)");
  }
  console.log(APPLY ? "[backfill] applied" : "[backfill] dry run — nothing changed (pass --apply)");
}

module.exports = { run };

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[backfill] failed:", error.message);
      process.exit(1);
    });
}
