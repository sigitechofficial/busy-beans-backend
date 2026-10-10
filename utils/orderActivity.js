/**
 * Order / invoice activity history: who did what and when (table orderActivityLogs). Logging never
 * breaks the action itself. Routes whose controllers are not changed log through
 * `activityOnSuccess` (only after a successful response); invoice edits log from the controller
 * with before / after values.
 */
const { orderActivityLog } = require("../models");

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function actorOf(req) {
  const u = req?.user;
  if (!u) return { actorEntity: "guest", actorId: null, actorName: null };
  return {
    actorEntity: u.entity || null,
    actorId: Number.isFinite(Number(u.id)) ? Number(u.id) : null,
    actorName: u.name || u.srName || u.supplierName || u.email || null,
  };
}

async function logOrderActivity({ req, actor, orderId = null, partnerOrderId = null, action, summary = null, details = null }) {
  try {
    await orderActivityLog.create({
      orderId: orderId ? Number(orderId) : null,
      partnerOrderId: partnerOrderId ? Number(partnerOrderId) : null,
      action,
      summary: summary ? String(summary).slice(0, 255) : null,
      details: details ? JSON.stringify(details) : null,
      ...(actor || actorOf(req)),
    });
  } catch (error) {
    console.error("[order-activity] not logged:", error.message);
  }
}

/**
 * Route middleware: after a successful response (2xx, payload status not fail/error), log the
 * entries returned by `describe(req, payload)` (one entry or an array; may be async).
 */
function activityOnSuccess(describe) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    let payload;
    res.json = (body) => {
      payload = body;
      return originalJson(body);
    };
    res.on("finish", async () => {
      if (res.statusCode >= 400) return;
      if (payload && ["fail", "error"].includes(payload.status)) return;
      try {
        const entries = await describe(req, payload);
        for (const entry of [].concat(entries || [])) {
          if (entry && entry.action) await logOrderActivity({ req, ...entry });
        }
      } catch (error) {
        console.error("[order-activity] describe failed:", error.message);
      }
    });
    next();
  };
}

/* ---------- describers for routes logged by activityOnSuccess ---------- */

const JOURNEY_ACTIONS = {
  "assign-supplier": ["supplier_assigned", "Supplier assigned"],
  "supplier-acknowledgement": ["status_acknowledged", "Order acknowledged by supplier"],
  "order-dispatch": ["status_dispatched", "Order dispatched"],
  "order-deliver": ["status_delivered", "Order delivered"],
  "order-cancel": ["status_cancelled", "Order cancelled"],
  "edit-order": ["order_updated", "Order updated"],
  "add-cheque": ["cheque_added", "Cheque recorded"],
};

/** Order status / cheque routes (body: orderId | partnerOrderId, orderData, cheque). */
function describeJourney(req) {
  const key = String(req.path || "").replace(/^\/+|\/+$/g, "");
  const [action, label] = JOURNEY_ACTIONS[key] || ["order_updated", "Order updated"];
  const { orderId, partnerOrderId, orderData = {}, cheque } = req.body || {};
  const ids = partnerOrderId ? { partnerOrderId } : { orderId };
  const changed = orderData && typeof orderData === "object" ? Object.keys(orderData) : [];
  const entries = [
    {
      ...ids,
      action,
      summary: label + (orderData?.supplierId ? ` (supplier #${orderData.supplierId})` : ""),
      details: {
        fields: changed,
        statusId: orderData?.statusId,
        supplierId: orderData?.supplierId,
        trackingNumber: orderData?.trackingNumber,
        cheque: cheque && typeof cheque === "object" ? { number: cheque.chequeNumber, bank: cheque.bankName, date: cheque.chequeDate } : undefined,
      },
    },
  ];
  // "Marked paid" is recorded by the order model hook (registerOrderHooks), for every path.
  return entries;
}

/* ---------- model hooks: order created, order paid (every path, incl. Stripe webhooks / jobs) ---------- */

let hooksRegistered = false;

/** Actor for hook-logged entries: the signed-in user of the request, else the system. */
function hookActor() {
  // eslint-disable-next-line global-require
  const { currentUser } = require("./requestContext");
  const u = currentUser();
  return u ? actorOf({ user: u }) : { actorEntity: "system", actorId: null, actorName: "System" };
}

function registerOrderHooks() {
  if (hooksRegistered) return;
  hooksRegistered = true;
  // eslint-disable-next-line global-require
  const { order, partnerOrder } = require("../models");
  const ORDER_KIND = { "direct-invoice": "Direct invoice", "regular-order": "Order" };

  for (const [Model, idKey, label] of [
    [order, "orderId", "Order"],
    [partnerOrder, "partnerOrderId", "Partner order"],
  ]) {
    Model.addHook("afterCreate", "activityCreated", (row) => {
      const actor = hookActor();
      const kind = ORDER_KIND[row.type] || label;
      logOrderActivity({
        actor,
        [idKey]: row.id,
        action: "order_created",
        summary: actor.actorEntity === "system" ? `${kind} created automatically (recurring / system)` : `${kind} created`,
        details: { type: row.type || null, createdBy: row.createdBy || null, totalBill: row.totalBill ?? null },
      });
    });

    const paidEntry = (id, method, intentId) => {
      const actor = hookActor();
      logOrderActivity({
        actor,
        [idKey]: id,
        action: "marked_paid",
        summary:
          actor.actorEntity === "system"
            ? `Paid${method ? ` (${method})` : ""} — confirmed by Stripe / system`
            : `Marked paid${method ? ` (${method})` : ""}`,
        details: { paymentMethod: method || null, paymentIntentId: intentId || null },
      });
    };

    // Model.update(...) (bulk): find which orders actually flip to paid, then log them.
    Model.addHook("beforeBulkUpdate", "activityPaidBefore", async (options) => {
      if (options?.attributes?.paymentStatus !== "done" || !options.where) return;
      try {
        const rows = await Model.findAll({ where: options.where, attributes: ["id", "paymentStatus"], raw: true, transaction: options.transaction });
        options.becamePaidIds = rows.filter((r) => r.paymentStatus !== "done").map((r) => r.id);
      } catch {
        options.becamePaidIds = [];
      }
    });
    Model.addHook("afterBulkUpdate", "activityPaidAfter", (options) => {
      for (const id of options?.becamePaidIds || []) {
        paidEntry(id, options.attributes?.paymentMethod, options.attributes?.paymentIntentId);
      }
    });
    // instance.update / save
    Model.addHook("afterUpdate", "activityPaidInstance", (row) => {
      if (row.changed && row.changed("paymentStatus") && row.paymentStatus === "done") {
        paidEntry(row.id, row.paymentMethod, row.paymentIntentId);
      }
    });
  }
}

module.exports = {
  money,
  actorOf,
  logOrderActivity,
  activityOnSuccess,
  describeJourney,
  registerOrderHooks,
};
