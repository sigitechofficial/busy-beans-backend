// routes/qbo.js
const r = require("express").Router();
const ctrl = require("../controllers/admin/quikbooksController");
const QBO = require("../controllers/quickBooks");

r.get("/auth/login", ctrl.authLogin);
// r.get('/auth/callback', ctrl.authCallback);
// r.get('/status', ctrl.status);
r.post("/customers/import", ctrl.importCustomers);
// r.post('/disconnect', ctrl.disconnect);
r.post("/ping", ctrl.ping);

r.post("/auth/exchange", async (req, res) => {
  try {
    const fullUrl = String(req.body?.fullUrl || "");
    console.log("[EXCHANGE] fullUrl=", fullUrl);
    if (!fullUrl.includes("code=") || !fullUrl.includes("realmId=")) {
      return res.status(400).json({
        status: "error",
        message:
          "Send { fullUrl: window.location.href } from the browser after Intuit redirect",
      });
    }
    const out = await QBO.exchangeFromFullUrl(fullUrl);
    console.log(
      "[EXCHANGE] OK realmId=",
      out.realmId,
      "access.len=",
      (out.access_token || "").length
    );
    return res.status(200).json({ status: "success", data: out });
  } catch (e) {
    const st = e?.response?.status || 500;
    const body = e?.response?.data || null;
    console.error("[EXCHANGE] FAIL status=", st, "body=", body || e?.message);
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
