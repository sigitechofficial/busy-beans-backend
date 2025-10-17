// controllers/qbo.routes.controller.js
// Minimal stateless routes with heavy logs.
// - GET  /qbo/auth/login        -> { authUrl }
// - POST /qbo/auth/exchange     -> { access_token, realmId, ... }  (body.fullUrl = window.location.href)
// - GET  /qbo/ping              -> headers x-qbo-access / x-qbo-realmid OR query/body
// - POST /qbo/customers/import  -> same headers with token/realm; imports users without qboCustomerId

const QBO = require("../quickBooks"); // adjust path if needed
const { user, billingAddress, address, order, item } = require("../../models"); // adjust path if needed
const { Op, literal, fn, col } = require("sequelize");

function getTokenFromReq(req) {
  const accessToken =
    req.headers["x-qbo-access"] ||
    req.body?.accessToken ||
    req.query?.accessToken;
  const realmId =
    req.headers["x-qbo-realmid"] || req.body?.realmId || req.query?.realmId;
  return { accessToken, realmId };
}

/* ----------------------- GET /qbo/auth/login ----------------------- */
exports.authLogin = async (req, res) => {
  try {
    const state = String(req.query.state || `csrf-${Date.now()}`);
    const url = await QBO.getAuthUrl(state);
    console.log(
      "[ROUTE:/qbo/auth/login]",
      "state=",
      state,
      "url.len=",
      url.length
    );
    return res
      .status(200)
      .json({ status: "success", data: { authUrl: url, state } });
  } catch (e) {
    console.error("[ROUTE:/qbo/auth/login] ERR", e?.message);
    return res.status(500).json({
      status: "error",
      message: "Failed to build auth URL",
      detail: e?.message,
    });
  }
};

/* ---------------------- POST /qbo/auth/exchange -------------------- */
/* Body: { fullUrl: window.location.href } (from your frontend after Intuit redirects to your UI) */
exports.authExchange = async (req, res) => {
  try {
    const fullUrl = String(req.body?.fullUrl || "");
    console.log("[ROUTE:/qbo/auth/exchange] fullUrl=", fullUrl);
    if (!fullUrl.includes("code=") || !fullUrl.includes("realmId=")) {
      return res.status(400).json({
        status: "error",
        message:
          "Send { fullUrl: window.location.href } from your browser after redirect",
      });
    }
    const out = await QBO.exchangeFromFullUrl(fullUrl);
    // token lengths only (no full token in response logs)
    console.log(
      "[ROUTE:/qbo/auth/exchange] OK",
      "realmId=",
      out.realmId,
      "access.len=",
      (out.access_token || "").length,
      "refresh.len=",
      (out.refresh_token || "").length
    );
    return res.status(200).json({ status: "success", data: out });
  } catch (e) {
    const st = e?.response?.status || 500;
    const body = e?.response?.data;
    console.error(
      "[ROUTE:/qbo/auth/exchange] ERR status=",
      st,
      "body=",
      body || e?.message
    );
    return res.status(st).json({
      status: "error",
      httpStatus: st,
      error: body?.error || e?.code || "oauth_exchange_failed",
      message:
        body?.error_description ||
        body?.message ||
        e?.message ||
        "OAuth exchange failed",
      detail: body || null,
    });
  }
};

/* ---------------------------- GET /qbo/ping ------------------------ */
exports.ping = async (req, res) => {
  try {
    const { accessToken, realmId } = getTokenFromReq(req);
    console.log(
      "[ROUTE:/qbo/ping] token=",
      accessToken ? "yes" : "no",
      "realmId=",
      realmId
    );

    if (!accessToken || !realmId) {
      return res.status(400).json({
        status: "error",
        message:
          "Provide x-qbo-access and x-qbo-realmid headers (or body/query accessToken, realmId)",
      });
    }

    const info = await QBO.getCompanyInfoWithToken(accessToken, realmId);
    console.log("[ROUTE:/qbo/ping] OK company=", info?.CompanyName);
    return res.json({
      status: "success",
      data: { companyName: info?.CompanyName || null },
    });
  } catch (e) {
    const st = e?.response?.status || e?.httpStatus || 500;
    console.error(
      "[ROUTE:/qbo/ping] ERR status=",
      st,
      "body=",
      e?.response?.data || e?.body || e?.message
    );
    return res.status(st).json({
      status: "error",
      httpStatus: st,
      error:
        e?.response?.data?.fault?.error?.[0]?.code || e?.code || "ping_failed",
      message:
        e?.response?.data?.fault?.error?.[0]?.message ||
        e?.response?.data?.error_description ||
        e?.message ||
        "Ping failed",
      detail: e?.response?.data || e?.body || null,
    });
  }
};

/* --------------------- POST /qbo/customers/import ------------------ */
/* Headers (or body/query): x-qbo-access, x-qbo-realmid
   Body optional: { ids: [1,2,3] } to limit which users to import
*/
exports.importCustomers = async (req, res) => {
  const started = Date.now();
  try {
    const { accessToken, realmId } = getTokenFromReq(req);
    console.log(
      "[ROUTE:/qbo/customers/import] token=",
      accessToken ? "yes" : "no",
      "realmId=",
      realmId
    );

    if (!accessToken || !realmId) {
      return res.status(400).json({
        status: "error",
        message:
          "Provide x-qbo-access and x-qbo-realmid (or body/query accessToken, realmId)",
      });
    }

    // quick sanity ping (helps catch 3200 immediately)
    // try {
    //   //   await QBO.getCompanyInfoWithToken(accessToken, realmId);
    //   console.log("[ROUTE:/qbo/customers/import] sanity ping OK");
    // } catch (e) {
    //   const st = e?.response?.status || e?.httpStatus || 500;
    //   console.error(
    //     "[ROUTE:/qbo/customers/import] sanity ping FAIL status=",
    //     st,
    //     "body=",
    //     e?.response?.data || e?.body || e?.message
    //   );
    //   return res.status(st).json({
    //     status: "error",
    //     httpStatus: st,
    //     message: "Auth failed on ping (check keys/env/redirect & token).",
    //     detail: e?.response?.data || e?.body || e?.message,
    //   });
    // }

    const where = { qboCustomerId: null };
    if (Array.isArray(req.body?.ids) && req.body.ids.length)
      where.id = req.body.ids;

    const users = await user.findAll({
      where,
      include: [
        { model: address, limit: 1 },
        { model: billingAddress, limit: 1 },
      ],
    });
    // return res.json(users)
    console.log("[ROUTE:/qbo/customers/import] users.count=", users.length);

    const results = [];
    for (const u of users) {
      console.log(
        "[ROUTE:/qbo/customers/import] creating userId=",
        u.id,
        "name=",
        u.name,
        "email=",
        u.email
      );
      try {
        const { id } = await QBO.createCustomerBasicWithToken(
          accessToken,
          realmId,
          u
        );
        // optionally persist the qbo id if your schema has it:
        if ("qboCustomerId" in u) {
          await u.update({ qboCustomerId: id });
        }
        results.push({ userId: u.id, status: "ok", qboCustomerId: id });
        console.log(
          "[ROUTE:/qbo/customers/import] SUCCESS userId=",
          u.id,
          "qboId=",
          id
        );
      } catch (e) {
        const err0 = e?.response?.data?.fault?.error?.[0];
        const code = err0?.code || e?.code || "qbo_error";
        const message = err0?.message || e?.message || "QBO error";
        const detail = err0?.detail || e?.response?.data || null;
        console.error(
          "[ROUTE:/qbo/customers/import] ERROR userId=",
          u.id,
          "code=",
          code,
          "msg=",
          message,
          "detail=",
          detail
        );
        results.push({ userId: u.id, status: "error", code, message, detail });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Bulk import finished",
      count: results.length,
      tookMs: Date.now() - started,
      results,
    });
  } catch (e) {
    const st = e?.response?.status || 500;
    console.error(
      "[ROUTE:/qbo/customers/import] FATAL",
      st,
      e?.response?.data || e?.message
    );
    return res.status(st).json({
      status: "error",
      httpStatus: st,
      message: e?.message || "Import failed",
      detail: e?.response?.data || null,
    });
  }
};

// Create a QBO Invoice for a single order (no ItemIds; we ensure generic items internally)
// ---- PASTE INTO your qbo route controller file ----
// Requires: getTokenFromReq(req), QBO (require('./controllers/quickbooks')) already loaded

exports.createInvoiceForOrder = async (req, res) => {
  const started = Date.now();
  try {
    const { accessToken, realmId } = getTokenFromReq(req);
    console.log(
      "[ROUTE:/qbo/invoices/create] token=",
      accessToken ? "yes" : "no",
      "realmId=",
      realmId
    );

    if (!accessToken || !realmId) {
      return res.status(400).json({
        status: "error",
        message:
          "Provide x-qbo-access and x-qbo-realmid OR ?accessToken=&realmId= OR body accessToken/realmId",
      });
    }

    const doc = await order.findOne({
      where: { id: req.params.orderId },
      include: [
        {
          model: user,
          attributes: ["id", "qboCustomerId"],
        },
        {
          model: item,
          attributes: [
            "id",
            [
              literal(
                `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              "singleUnitWeight",
            ],
            ["weight", "itemWeights"],
            "qty",
            "productName",
            "price",
            "discount",
            "orderId",
            "productId",
            "wholesalePrice",
            "type",
          ],
        },
      ],
      attributes: [
        "id",
        [
          literal(
            `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "customerName",
        ],
        [
          literal(
            `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`
          ),
          "salesRepName",
        ],
        "totalBill",
        "vat",
        "shippingCharges",
        "invoiceNumber",
      ],
    });
    const orderData = JSON.parse(JSON.stringify(doc));

    if (!orderData) {
      return res.status(400).json({
        status: "error",
        message: "Body must include { order: {...} }",
      });
    }

    // optional email via QBO
    if (req.body?.sendEmail === true) orderData.sendEmail = true;

    // create the invoice (no queries path)
    const result = await QBO.createInvoiceFromOrderNoQuery(
      accessToken,
      realmId,
      orderData
    );

    // optionally send email from QBO (separate endpoint) if requested
    if (orderData.sendEmail === true && result?.id) {
      const sendUrl = `${HOST}/v3/company/${realmId}/invoice/${result.id}/send?minorversion=${MINOR_VERSION}`;
      await axios.post(sendUrl, null, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        validateStatus: () => true,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Invoice created",
      tookMs: Date.now() - started,
      qboInvoiceId: result?.id,
      qbo: result?.raw,
    });
  } catch (e) {
    const st = e?.httpStatus || e?.response?.status || 500;
    console.error(
      "[ROUTE:/qbo/invoices/create] ERROR",
      st,
      e?.detail || e?.response?.data || e?.message
    );
    return res.status(st).json({
      status: "error",
      httpStatus: st,
      message: e?.message || "Invoice creation failed",
      detail: e?.detail || e?.response?.data || null,
    });
  }
};

//    const doc = await order.findOne({
//       where: { id: req.params.orderId },
//       include: [
//         {
//           model: user,
//           attributes: ["id", "qboCustomerId"],
//         },
//         {
//           model: item,
//           attributes: [
//             "id",
//             [
//               literal(
//                 `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
//               ),
//               "product",
//             ],
//             [
//               literal(
//                 `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`
//               ),
//               "singleUnitWeight",
//             ],
//             ["weight", "itemWeights"],
//             "qty",
//             "productName",
//             "price",
//             "discount",
//             "orderId",
//             "productId",
//             "wholesalePrice",
//             "type",
//           ],
//         },
//       ],
//       attributes: [
//         "id",
//         [
//           literal(
//             `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
//           ),
//           "customerName",
//         ],
//         [
//           literal(
//             `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
//           ),
//           "companyName",
//         ],
//         [
//           literal(
//             `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`
//           ),
//           "salesRepName",
//         ],
//         "totalBill",
//         "vat",
//         "shippingCharges",
//         "invoiceNumber",
//       ],
//     });
//     const orderData = JSON.parse(JSON.stringify(doc));
