const express = require("express");
const r = express.Router();

// ✅ Middleware (already exists)
const ensureQboConnection = require("../middlewares/qboAuth");

// ✅ Controller (final integrated version)
const ctrl = require("../controllers/admin/quikbooksController");

// 🔐 AUTH
// 🔐 Login (OAuth start)
r.get("/auth/login", ctrl.authLogin);
// 🔐 Exchange (OAuth callback)
r.post("/auth/exchange", ctrl.authExchange);
r.get("/ping", ensureQboConnection, ctrl.ping);

// 👥 CUSTOMERS
r.post("/customers/import", ensureQboConnection, ctrl.importCustomers);

// 🧾 INVOICES
r.post(
  "/order-invoice/create/:orderId",
  ensureQboConnection,
  ctrl.createInvoiceForOrder
);
r.post(
  "/order-invoice/update/:orderId",
  ensureQboConnection,
  ctrl.updateInvoiceForOrder
);

// 💰 PAYMENTS
r.post(
  "/order-payment/sync/:orderId",
  ensureQboConnection,
  ctrl.syncOrderPayment
);

r.get("/test/income-accounts", async (req, res) => {
  const { QboToken } = require("../models");
  const { QBO, MINOR, headers } = require("../services/qboHelpers");
  const axios = require("axios");

  try {
    const token = await QboToken.findOne();
    if (!token) throw new Error("No QBO token in DB");

    const query = `select Id, Name, AccountType from Account where AccountType = 'Income'`;
    const url = `${QBO(token.realmId)}/query?minorversion=${MINOR}&query=${encodeURIComponent(query)}`;

    const response = await axios.get(url, {
      headers: headers(token.accessToken),
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      detail: err.response?.data || null,
    });
  }
});

module.exports = r;
