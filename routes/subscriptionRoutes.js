const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/admin/subscriptionController");

// Create a new subscription
router.post("/create", subscriptionController.createSubscription);

// Get subscription by ID
router.get("/:id", subscriptionController.getSubscription);

// Cancel subscription
router.post("/:id/cancel", subscriptionController.cancelSubscription);

// List all subscriptions (can filter by email or status)
router.get("/list", subscriptionController.listSubscriptions);

// List all available add-ons
router.get("/addons", subscriptionController.listAddons);

module.exports = router;
