// routes/qbo.js
const r = require("express").Router();
const ctrl = require("../controllers/admin/quikbooksController");
const QBO = require("../controllers/quickBooks");

r.get("/auth/login", ctrl.authLogin);
// r.get('/auth/callback', ctrl.authCallback);
// r.get('/status', ctrl.status);
r.post("/customers/import", ctrl.importCustomers);
r.post("/order-invoice/create/:orderId", ctrl.createInvoiceForOrder);
// r.post('/disconnect', ctrl.disconnect);
r.post("/ping", ctrl.ping);

const usedCodes = new Set();

r.post("/auth/exchange", async (req, res) => {
  try {
    const fullUrl = String(req.body?.fullUrl || "");
    const u = new URL(fullUrl);
    const code = u.searchParams.get("code") || "";

    if (!code)
      return res.status(400).json({ status: "error", error: "missing_code" });

    if (usedCodes.has(code)) {
      return res.status(409).json({
        status: "error",
        error: "already_exchanged",
        message: "This authorization code was already used.",
      });
    }
    usedCodes.add(code);
    setTimeout(() => usedCodes.delete(code), 10 * 60 * 1000); // clean up

    const out = await QBO.exchangeFromFullUrl(fullUrl);
    return res.status(200).json({ status: "success", data: out });
  } catch (e) {
    // on hard failures you may want to *not* delete from usedCodes for a short period
    const st = e?.response?.status || 500;
    const body = e?.response?.data || null;
    return res.status(st).json({
      status: "error",
      httpStatus: st,
      error: body?.error || e?.code || "oauth_exchange_failed",
      message:
        body?.error_description ||
        body?.message ||
        e?.message ||
        "OAuth exchange failed",
      detail: body,
    });
  }
});

module.exports = r;
