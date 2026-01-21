const express = require("express");
const router = express.Router();
const Controller = require("../controllers/Webhook/webhookController");
const SubscriptionWebhookController = require("../controllers/Webhook/subscriptionWebhookController");
const MetaController = require("../controllers/Webhook/metaWebhookController");

const catchAsync = require("../utils/catchAsync");

// Stripe webhook (needs raw body - handled in app.js)
router.post(
  "/busy-beans-coffee",
  catchAsync(Controller.stripeSubscriptionWebhookEventHandler)
);

// Stripe subscription webhook (separate endpoint for subscription events)
// Needs raw body - handled in app.js
// Endpoint: /webhook/busy-beans-coffee/subscriptions
router.post(
  "/subscriptions",
  catchAsync(SubscriptionWebhookController.handleSubscriptionWebhook)
);

// Meta (Facebook/Instagram) Lead Ads webhook
// GET endpoint for webhook verification
router.get("/meta-leads", MetaController.verifyMetaWebhook);

// POST endpoint for receiving lead data (uses JSON body parser from app.js)
router.post("/meta-leads", catchAsync(MetaController.handleMetaLeadWebhook));

module.exports = router;
