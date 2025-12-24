const express = require("express");
const router = express.Router();
const Controller = require("../controllers/webhook/webhookController");
const MetaController = require("../controllers/webhook/metaWebhookController");

const catchAsync = require("../utils/catchAsync");

// Stripe webhook (needs raw body - handled in app.js)
router.post(
  "/busy-beans-coffee",
  catchAsync(Controller.stripeSubscriptionWebhookEventHandler)
);

// Meta (Facebook/Instagram) Lead Ads webhook
// GET endpoint for webhook verification
router.get("/meta-leads", MetaController.verifyMetaWebhook);

// POST endpoint for receiving lead data (uses JSON body parser from app.js)
router.post("/meta-leads", catchAsync(MetaController.handleMetaLeadWebhook));

module.exports = router;
