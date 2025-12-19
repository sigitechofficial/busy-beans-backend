const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/admin/subscriptionController");

// Create a new subscription
router.post("/create", subscriptionController.createSubscription);

// List all subscriptions (can filter by email or status) - MUST come before /:id
router.get("/list", subscriptionController.listSubscriptions);

// List all available add-ons - MUST come before /:id
router.get("/addons", subscriptionController.listAddons);

// Get subscription by ID - MUST come after specific routes
router.get("/:id", subscriptionController.getSubscription);

// Cancel subscription
router.post("/:id/cancel", subscriptionController.cancelSubscription);

// Reactivate subscription
router.post("/:id/reactivate", subscriptionController.reactivateSubscription);

// Complete pending payment
router.post(
  "/:id/complete-payment",
  subscriptionController.completeSubscriptionPayment
);

module.exports = router;
