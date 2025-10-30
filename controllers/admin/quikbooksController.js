// controllers/qbo.routes.controller.js
// Minimal stateless routes with heavy logs.
// - GET  /qbo/auth/login        -> { authUrl }
// - POST /qbo/auth/exchange     -> { access_token, realmId, ... }  (body.fullUrl = window.location.href)
// - GET  /qbo/ping              -> headers x-qbo-access / x-qbo-realmid OR query/body
// - POST /qbo/customers/import  -> same headers with token/realm; imports users without qboCustomerId

const QBO = require("../quickBooks"); // adjust path if needed
const QBOINVOICE = require("../quickBooksInvoice"); // adjust path if needed
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
        if ("qboCustomerId" in u && id) {
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

// exports.createInvoiceForOrder = async (req, res) => {
//   const started = Date.now();
//   try {
//     const { accessToken, realmId } = getTokenFromReq(req);
//     console.log(
//       "[ROUTE:/qbo/invoices/create] token=",
//       accessToken ? "yes" : "no",
//       "realmId=",
//       realmId
//     );

//     if (!accessToken || !realmId) {
//       return res.status(400).json({
//         status: "error",
//         message:
//           "Provide x-qbo-access and x-qbo-realmid OR ?accessToken=&realmId= OR body accessToken/realmId",
//       });
//     }

//     const doc = await order.findOne({
//       where: { id: req.params.orderId },
//       include: [
//         {
//           model: user,
//           attributes: ["id", "qboCustomerId"],
//         },
//         {
//           model: address,
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
//             `(SELECT users.qboCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`
//           ),
//           "qboCustomerId",
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

//     if (!orderData) {
//       return res.status(400).json({
//         status: "error",
//         message: "Body must include { order: {...} }",
//       });
//     }

//     const qboInvoiceId = await QBO.createInvoiceForOrderWithToken(
//       accessToken,
//       realmId,
//       orderData
//     );
//   } catch (e) {}
// };
function httpError(res, code, message, extra = {}) {
  return res.status(code).json({
    status: "error",
    message,
    ...extra,
  });
}

function pickQboError(err) {
  // Axios-style error parsing
  const status = err?.response?.status || 500;
  const data = err?.response?.data;
  const headers = err?.response?.headers;

  // QBO often returns { Fault: { Error: [{ Message, Detail, code }], type } }
  const fault = data?.Fault;
  const errors = Array.isArray(fault?.Error)
    ? fault.Error.map((e) => ({
        code: e?.code,
        message: e?.Message,
        detail: e?.Detail,
      }))
    : undefined;

  const summary =
    errors
      ?.map((e) =>
        `${e.code || ""} ${e.message || ""} ${e.detail || ""}`.trim()
      )
      .join(" | ") ||
    data?.message ||
    err?.message ||
    "Unknown QuickBooks error";

  return {
    status,
    summary,
    // Include raw details but keep them nested
    raw: {
      data,
      headers,
    },
  };
}

exports.createInvoiceForOrder = async (req, res) => {
  const started = Date.now();

  try {
    // 0) Tokens
    const { accessToken, realmId } = getTokenFromReq(req) || {};
    console.log("🚀 ~ accessToken, realmId:", accessToken, realmId);
    if (!accessToken || !realmId) {
      return httpError(
        res,
        400,
        "Missing QuickBooks credentials please login."
      );
    }

    // 1) Validate param
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return httpError(res, 400, "Invalid or missing :orderId path parameter.");
    }

    // 2) Fetch order with required associations (unchanged, just wrapped)
    const doc = await order.findOne({
      where: { id: req.params.orderId },
      include: [
        {
          model: user,
          attributes: ["id", "qboCustomerId"],
        },
        {
          model: address,
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
            `(SELECT users.qboCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "qboCustomerId",
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
        "quickBooksInvoiceId",
        "paymentMethod",
        "paymentIntentId",
        "paymentStatus",
        "invoicePaidDate",
        "invoiceDate",
        "shippingCompany",
        "termDays",
        "note",
        "trackingNumber",
        [
          literal(
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.orderId = order.id LIMIT 1)`
          ),
          "shippingDate",
        ],
      ],
    });

    if (!doc) {
      return httpError(res, 404, `Order not found with id=${orderId}.`);
    }

    // 3) Raw JSON (plain JS object)
    const orderData = JSON.parse(JSON.stringify(doc));
    console.log("🚀 ~ orderData:", orderData);

    if (orderData.quickBooksInvoiceId) {
      return httpError(
        res,
        400,
        "This order already has a linked QuickBooks invoice."
      );
    }
    // 4) Validate QuickBooks customer link
    const qboCustomerId =
      orderData?.qboCustomerId ||
      orderData?.user?.qboCustomerId ||
      orderData?.User?.qboCustomerId; // in case of different casing
    if (!qboCustomerId) {
      return httpError(
        res,
        400,
        "This order has no linked QuickBooks customer (qboCustomerId). Please link the customer first."
      );
    }

    const clientId = process.env.QBO_CLIENT_ID;
    console.log("🚀 ~ clientId:", clientId);
    const clientSecret = process.env.QBO_CLIENT_SECRET;
    console.log("🚀 ~ clientSecret:", clientSecret);

    // 5) Call service to create the invoice in QBO
    //    Keep the service responsible for mapping order → QBO payload
    const result = await QBOINVOICE.createInvoiceFromOrder({
      accessToken,
      realmId,
      clientId,
      clientSecret,
      order: orderData,
      qboCustomerId,
    });

    // 6) Success response
    const durationMs = Date.now() - started;
    if (result) {
      if (orderData.paymentStatus == "done") {
        const method = QBOINVOICE.mapPaymentMethodName(orderData.paymentMethod); // optional mapper
        const pay = await QBOINVOICE.createPaymentForInvoice({
          accessToken,
          realmId,
          invoiceId: result.id,
          customerId: orderData.qboCustomerId,
          amount: result.totalAmt,
          paymentMethodName: method, // optional
          refNumber: orderData.invoiceNumber, // optional
          paidDate: orderData.invoicePaidDate, // optional
        });
        console.log("[pay] =>", pay);
      }
      await order.update(
        { quickBooksInvoiceId: result?.id || result?.Invoice?.Id || null },
        {
          where: { id: orderId },
        }
      );
    }

    return res.status(201).json({
      status: "ok",
      message: "Invoice created in QuickBooks.",
      data: {
        invoiceId: result?.id || result?.Invoice?.Id || null,
        docNumber: result?.docNumber || result?.Invoice?.DocNumber || null,
        totalAmt: result?.totalAmt || result?.Invoice?.TotalAmt || null,
        dueDate: result?.dueDate || result?.Invoice?.DueDate || null,
        // feel free to include more as needed
      },
      meta: {
        realmId,
        orderId,
        durationMs,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - started;

    // Differentiate axios/QBO error vs generic
    const qboErr = pickQboError(err);
    if (
      qboErr.status !== 500 ||
      qboErr.summary !== "Unknown QuickBooks error"
    ) {
      // Known QBO/API error
      return res.status(qboErr.status).json({
        status: "error",
        message: qboErr.summary,
        meta: { durationMs },
        debug: process.env.NODE_ENV === "production" ? undefined : qboErr.raw,
      });
    }

    // Unknown/unexpected error
    return res.status(500).json({
      status: "error",
      message: err?.message || "Internal Server Error",
      meta: { durationMs },
      debug:
        process.env.NODE_ENV === "production"
          ? undefined
          : { stack: err?.stack, raw: err },
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
