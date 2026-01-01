const express = require("express");
const r = express.Router();
const auth = require("../middlewares/protect");
const { protect } = auth;
// ✅ Middleware (already exists)
const ensureQboConnection = require("../middlewares/qboAuth");
const ctrl = require("../controllers/admin/quikbooksController");

// ✅ Controller (final integrated version)

// 🔐 AUTH
// 🔐 Login (OAuth start)

r.use(protect);

/**
 * @swagger
 * /qbo/save-qbo-credentials:
 *   post:
 *     summary: Save QuickBooks credentials
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Credentials saved
 *       401:
 *         description: Unauthorized
 */
r.post("/save-qbo-credentials", ctrl.saveQboCredentials);

/**
 * @swagger
 * /qbo/auth/login:
 *   get:
 *     summary: Initiate QuickBooks OAuth login
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OAuth URL
 *       401:
 *         description: Unauthorized
 */
r.get("/auth/login", ctrl.authLogin);

/**
 * @swagger
 * /qbo/auth/exchange:
 *   post:
 *     summary: Exchange OAuth code for tokens
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               realmId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens exchanged
 *       401:
 *         description: Unauthorized
 */
r.post("/auth/exchange", ctrl.authExchange);
// r.use(ensureQboConnection);

/**
 * @swagger
 * /qbo/ping:
 *   get:
 *     summary: Ping QuickBooks connection
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Connection status
 *       401:
 *         description: Unauthorized
 */
r.get("/ping", ctrl.ping);

// 👥 CUSTOMERS

/**
 * @swagger
 * /qbo/customers/import:
 *   post:
 *     summary: Import customers from QuickBooks
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Customers imported
 *       401:
 *         description: Unauthorized
 */
r.post("/customers/import", ctrl.importCustomers);

// 🧾 INVOICES

/**
 * @swagger
 * /qbo/order-invoice/create/{orderId}:
 *   post:
 *     summary: Create invoice in QuickBooks for order
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice created
 *       401:
 *         description: Unauthorized
 */
r.post(
  "/order-invoice/create/:orderId",

  ctrl.createInvoiceForOrder
);

/**
 * @swagger
 * /qbo/order-invoice/create-multiple:
 *   post:
 *     summary: Create multiple invoices in QuickBooks
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Invoices created
 *       401:
 *         description: Unauthorized
 */
r.post(
  "/order-invoice/create-multiple",

  ctrl.createMultipleInvoicesForOrders
);

/**
 * @swagger
 * /qbo/order-invoice/update/{orderId}:
 *   post:
 *     summary: Update invoice in QuickBooks for order
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice updated
 *       401:
 *         description: Unauthorized
 */
r.post(
  "/order-invoice/update/:orderId",

  ctrl.updateInvoiceForOrder
);

// 💰 PAYMENTS

/**
 * @swagger
 * /qbo/order-payment/sync/{orderId}:
 *   post:
 *     summary: Sync order payment with QuickBooks
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment synced
 *       401:
 *         description: Unauthorized
 */
r.post(
  "/order-payment/sync/:orderId",

  ctrl.syncOrderPayment
);

/**
 * @swagger
 * /qbo/order-payment/sync-multiple:
 *   post:
 *     summary: Sync multiple order payments with QuickBooks
 *     tags: [QuickBooks]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Payments synced
 *       401:
 *         description: Unauthorized
 */
r.post(
  "/order-payment/sync-multiple",

  ctrl.syncMultipleOrderPayments
);

// r.get("/test/income-accounts", async (req, res) => {
//   const { QboToken } = require("../models");
//   const { QBO, MINOR, headers } = require("../services/qboHelpers");
//   const axios = require("axios");

//   try {
//     const token = await QboToken.findOne();
//     if (!token) throw new Error("No QBO token in DB");

//     const query = `select Id, Name, AccountType from Account where AccountType = 'Income'`;
//     const url = `${QBO(token.realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(query)}`;

//     const response = await axios.get(url, {
//       headers: headers(token.accessToken),
//     });
//     res.json(response.data);
//   } catch (err) {
//     res.status(500).json({
//       error: err.message,
//       detail: err.response?.data || null,
//     });
//   }
// });

module.exports = r;
