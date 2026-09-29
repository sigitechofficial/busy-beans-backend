const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/admin/subscriptionController");
const addonController = require("../controllers/admin/addonController");
const auth = require("../middlewares/protect");

// Subscription management is admin panel only (staff tokens); customers use /api/v1/users/subscription*.
router.use(auth.protect, auth.restrictTo(...auth.STAFF_ENTITIES));

/**
 * @swagger
 * /api/v1/subscription/create:
 *   post:
 *     summary: Create a new subscription
 *     tags: [Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Subscription created
 */
router.post("/create", subscriptionController.createSubscription);

/**
 * @swagger
 * /api/v1/subscription/list:
 *   get:
 *     summary: List all subscriptions
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of subscriptions
 */
router.get("/list", subscriptionController.listSubscriptions);

/**
 * @swagger
 * /api/v1/subscription/addons:
 *   get:
 *     summary: List all available add-ons (for subscription selection)
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: List of add-ons
 */
router.get("/addons", subscriptionController.listAddons);

/**
 * @swagger
 * /api/v1/subscription/addons/all:
 *   get:
 *     summary: Get all addons (with filtering, sorting, pagination)
 *     tags: [Addons]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all addons
 */
router.get("/addons", addonController.getAllAddons);

/**
 * @swagger
 * /api/v1/subscription/addons/{id}:
 *   get:
 *     summary: Get addon by ID
 *     tags: [Addons]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Addon details
 *       404:
 *         description: Addon not found
 */
router.get("/addons/:id", addonController.getAddon);

/**
 * @swagger
 * /api/v1/subscription/addons:
 *   post:
 *     summary: Create a new addon
 *     tags: [Addons]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               status:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Addon created successfully
 *       400:
 *         description: Bad request - validation error
 */
router.post("/addons", addonController.createAddon);

/**
 * @swagger
 * /api/v1/subscription/addons/{id}:
 *   patch:
 *     summary: Update an addon
 *     tags: [Addons]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               status:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Addon updated successfully
 *       404:
 *         description: Addon not found
 */
router.patch("/addons/:id", addonController.updateAddon);

/**
 * @swagger
 * /api/v1/subscription/addons/{id}:
 *   delete:
 *     summary: Delete an addon (soft delete)
 *     tags: [Addons]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Addon deleted successfully
 *       404:
 *         description: Addon not found
 */
router.delete("/addons/:id", addonController.deleteAddon);

/**
 * @swagger
 * /api/v1/subscription/{id}:
 *   get:
 *     summary: Get subscription by ID
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Subscription details
 *       404:
 *         description: Subscription not found
 */
router.get("/:id", subscriptionController.getSubscription);

/**
 * @swagger
 * /api/v1/subscription/{id}/cancel:
 *   post:
 *     summary: Cancel a subscription
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Subscription cancelled
 */
router.post("/:id/cancel", subscriptionController.cancelSubscription);

/**
 * @swagger
 * /api/v1/subscription/{id}/reactivate:
 *   post:
 *     summary: Reactivate a cancelled subscription
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Subscription reactivated
 */
router.post("/:id/reactivate", subscriptionController.reactivateSubscription);

/**
 * @swagger
 * /api/v1/subscription/{id}/complete-payment:
 *   post:
 *     summary: Complete pending payment for subscription
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment completed
 */
router.post(
  "/:id/complete-payment",
  subscriptionController.completeSubscriptionPayment
);

module.exports = router;
