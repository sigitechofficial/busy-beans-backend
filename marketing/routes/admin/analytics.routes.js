const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const analyticsController = require("../../controllers/analytics.controller");
const consentLogController = require("../../controllers/consentLog.controller");
const productAnalyticsController = require("../../controllers/productAnalytics.controller");
const reportsController = require("../../controllers/reports.controller");
const outcomeReportsController = require("../../controllers/outcomeReports.controller");
const conversionReportsController = require("../../controllers/conversionReports.controller");

const router = express.Router();

router.use(marketingProtect);

router.get("/dashboard", analyticsController.dashboard);
router.get("/pages", analyticsController.pages);
router.get("/pages/:slug", analyticsController.pageDetail);
router.get("/products", productAnalyticsController.products);
router.get("/products/:productId", productAnalyticsController.productDetail);
router.get("/store", productAnalyticsController.store);
router.get("/time-patterns", productAnalyticsController.timePatterns);
router.get("/broken-links", productAnalyticsController.brokenLinks);
router.get("/journey", productAnalyticsController.journey);
router.get("/pii-access-log", productAnalyticsController.piiAccessLog);
// Reporting (Phase A): shared filters, attribution model, CSV (utils/reportQuery.js).
router.get("/reports/overview", reportsController.overview);
router.get("/reports/acquisition", reportsController.acquisition);
router.get("/reports/leads", reportsController.leads);
router.get("/reports/leads/export", reportsController.exportLeads);
// Reporting (Phase B): conversion behaviour.
router.get("/reports/forms", conversionReportsController.forms);
router.get("/reports/ctas", conversionReportsController.ctas);
router.get("/reports/funnel", conversionReportsController.funnel);
router.get("/reports/timing", conversionReportsController.timing);
router.get("/reports/trends", conversionReportsController.trends);
// Reporting (Phase C): business outcomes, attribution comparison, audience.
router.get("/reports/lead-quality", outcomeReportsController.leadQuality);
router.get("/reports/revenue", outcomeReportsController.revenue);
router.get("/reports/attribution-comparison", outcomeReportsController.attributionComparison);
router.get("/reports/audience/new-returning", outcomeReportsController.newReturning);
router.get("/reports/audience/direct", outcomeReportsController.direct);
router.get("/reports/audience/referrer-urls", outcomeReportsController.referrerUrls);
router.get("/consent", consentLogController.summary);
router.get("/consent/:consentId", consentLogController.lookup);

module.exports = router;
