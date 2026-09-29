const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const analyticsController = require("../../controllers/analytics.controller");
const consentLogController = require("../../controllers/consentLog.controller");
const productAnalyticsController = require("../../controllers/productAnalytics.controller");

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
router.get("/consent", consentLogController.summary);
router.get("/consent/:consentId", consentLogController.lookup);

module.exports = router;
