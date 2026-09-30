const express = require("express");
const rateLimit = require("express-rate-limit");
const touchpointsController = require("../../controllers/touchpoints.controller");
const analyticsEventsController = require("../../controllers/analyticsEvents.controller");
const { dropBotTracking } = require("../../utils/requestMeta");
const globalTrackingController = require("../../controllers/globalTracking.controller");
const consentLogController = require("../../controllers/consentLog.controller");

const router = express.Router();

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.MARKETING_TRACKING_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many tracking requests. Please try again shortly.",
    code: "RATE_LIMITED",
  },
});

const consentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.MARKETING_CONSENT_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" },
});

router.get("/settings", globalTrackingController.getPublicSettings);

// Crawlers / headless browsers / HTTP libraries get 204 and nothing is stored.
router.post("/touchpoints", ingestLimiter, dropBotTracking, touchpointsController.createTouchpoint);
router.post("/events", ingestLimiter, dropBotTracking, analyticsEventsController.createEvent);
// Cookie banner choices (proof of consent). Stricter limit: a person saves a choice rarely.
router.post("/consent", consentLimiter, dropBotTracking, consentLogController.record);

module.exports = router;
