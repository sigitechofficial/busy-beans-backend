/**
 * Audit trail for customers, local partners, suppliers, sub-admins, employees and products: who created,
 * changed or deleted them, and which fields changed (old → new). Table auditLogs.
 *
 * Routes are wrapped with `auditRoute(...)`: the record is snapshotted before the controller runs
 * and again after a successful response; only tracked fields that changed are stored. Passwords,
 * tokens, OTPs and bank / Stripe details are never tracked. Logging never breaks the action.
 */
const {
  auditLog,
  user,
  salesRep,
  supplier,
  subAdmin,
  employee,
  userDiscount,
  permission,
  category,
  salesRepProductPrice,
  product,
  skuSupplier,
} = require("../models");
const { actorOf } = require("./orderActivity");

const money = (v) => (v === null || v === undefined || v === "" ? "0.00" : Number(v).toFixed(2));

const ENTITIES = {
  customer: {
    model: user,
    label: "Customer",
    fields: [
      "name",
      "email",
      "phoneNumber",
      "countryCode",
      "companyName",
      "saleTaxNumber",
      "emailToSendInvoices",
      "dispatchEmail",
      "status",
      "approvedByAdmin",
      "deleted",
      "defaultDiscount",
      "preferredPaymentMethod",
      "salesRepId",
      "employeeId",
    ],
    name: (r) => r?.name || r?.companyName || r?.email,
    async extra(id) {
      const rows = await userDiscount.findAll({ where: { userId: id, deleted: 0 }, attributes: ["categoryId", "productId", "percentage"], raw: true });
      if (!rows.length) return { discounts: {} };
      const cats = await category.findAll({ where: { id: rows.map((r) => r.categoryId).filter(Boolean) }, attributes: ["id", "name"], raw: true });
      const catName = new Map(cats.map((c) => [c.id, c.name]));
      const discounts = {};
      for (const r of rows) {
        const key = r.categoryId ? catName.get(r.categoryId) || `Category ${r.categoryId}` : `Product ${r.productId}`;
        discounts[key] = `${Number(r.percentage || 0)}%`;
      }
      return { discounts };
    },
  },
  partner: {
    model: salesRep,
    label: "Local partner",
    fields: ["srName", "email", "phoneNumber", "countryCode", "country", "state", "city", "zipCode", "address", "territoryName", "status", "deleted", "partnerType", "creditLimit"],
    name: (r) => r?.srName || r?.email,
  },
  supplier: {
    model: supplier,
    label: "Supplier",
    fields: ["supplierName", "email", "phoneNum", "countryCode", "country", "state", "city", "zipCode", "addressOne", "addressTwo", "businessWeb", "supplierType", "status", "isDefaultSupplier", "deleted"],
    name: (r) => r?.supplierName || r?.email,
  },
  subAdmin: {
    model: subAdmin,
    label: "Sub-admin",
    fields: ["name", "email", "phoneNumber", "countryCode", "status", "deleted"],
    name: (r) => r?.name || r?.email,
    async extra(id) {
      const rows = await permission.findAll({ where: { subAdminId: id }, attributes: ["key"], raw: true });
      return { permissions: rows.map((r) => r.key).filter(Boolean).sort() };
    },
  },
  employee: {
    model: employee,
    label: "Employee",
    fields: ["name", "email", "phoneNumber", "countryCode", "status", "deleted", "employeeOf", "commissionPercentage", "salesRepId"],
    name: (r) => r?.name || r?.email,
    async extra(id) {
      const rows = await permission.findAll({ where: { employeeId: id }, attributes: ["key"], raw: true });
      return { permissions: rows.map((r) => r.key).filter(Boolean).sort() };
    },
  },
  product: {
    model: product,
    label: "Product",
    fields: ["name", "price", "wholesalePrice", "quantity", "unit", "weight", "grind", "sku", "productCode", "status", "deleted"],
    name: (r) => r?.name,
    async extra(id) {
      const row = await product.findOne({ where: { id }, attributes: ["categoryId"], raw: true, paranoid: false });
      const cat = row?.categoryId ? await category.findOne({ where: { id: row.categoryId }, attributes: ["name"], raw: true }) : null;
      const skus = await skuSupplier.findAll({ where: { productId: id }, attributes: ["supplierId", "supplierSku"], raw: true });
      const sups = await supplier.findAll({ where: { id: skus.map((s) => s.supplierId).filter(Boolean) }, attributes: ["id", "supplierName"], raw: true, paranoid: false });
      const supName = new Map(sups.map((s) => [s.id, s.supplierName]));
      return {
        category: cat?.name || (row?.categoryId ? `Category ${row.categoryId}` : null),
        supplierSkus: skus
          .filter((s) => s.supplierSku)
          .map((s) => `${supName.get(s.supplierId) || `Supplier ${s.supplierId}`}: ${s.supplierSku}`)
          .sort(),
      };
    },
  },
};

async function snapshot(entityType, id) {
  const def = ENTITIES[entityType];
  if (!def || !id) return null;
  const row = await def.model.findOne({ where: { id }, attributes: ["id", ...def.fields], raw: true, paranoid: false });
  if (!row) return null;
  const extra = def.extra ? await def.extra(id) : {};
  return { ...row, ...extra };
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** { field: { from, to } } for tracked fields that changed; lists (permissions) as added / removed. */
function diff(before, after) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  keys.delete("id");
  for (const k of keys) {
    const from = before ? before[k] : undefined;
    const to = after ? after[k] : undefined;
    if (same(from, to)) continue;
    if (Array.isArray(from) || Array.isArray(to)) {
      const a = new Set(from || []);
      const b = new Set(to || []);
      changes[k] = { added: [...b].filter((x) => !a.has(x)), removed: [...a].filter((x) => !b.has(x)) };
    } else if ((from && typeof from === "object") || (to && typeof to === "object")) {
      const sub = diff(from || {}, to || {});
      if (Object.keys(sub).length) changes[k] = sub;
    } else {
      changes[k] = { from: from ?? null, to: to ?? null };
    }
  }
  return changes;
}

async function logAudit({ req, entityType, entityId, action, summary, changes }) {
  try {
    await auditLog.create({
      entityType,
      entityId: entityId ? Number(entityId) : null,
      action,
      summary: summary ? String(summary).slice(0, 255) : null,
      changes: changes && Object.keys(changes).length ? JSON.stringify(changes) : null,
      ...actorOf(req),
    });
  } catch (error) {
    console.error("[audit] not logged:", error.message);
  }
}

/** Id of a record just created, from the response or (fallback) by the email in the request. */
async function createdId(entityType, req, payload) {
  const d = payload?.data;
  const fromPayload = d?.id ?? d?.data?.id ?? d?.user?.id ?? d?.customer?.id ?? d?.salesRep?.id ?? d?.supplier?.id ?? d?.employee?.id ?? d?.product?.id;
  if (fromPayload) return fromPayload;
  const email = req.body?.email || req.body?.userData?.email;
  if (!email) return null;
  const row = await ENTITIES[entityType].model.findOne({ where: { email }, attributes: ["id"], order: [["id", "DESC"]], raw: true });
  return row?.id || null;
}

const describeChanges = (entityType, action, changes, snap) => {
  const def = ENTITIES[entityType];
  const who = def.name(snap) ? ` ${def.name(snap)}` : "";
  if (action === "created") return `${def.label}${who} created`;
  if (action === "deleted") return `${def.label}${who} deleted`;
  const fields = Object.keys(changes || {});
  const priceMoves = ["price", "wholesalePrice"]
    .filter((k) => changes?.[k])
    .map((k) => `${k === "price" ? "price" : "wholesale"} $${money(changes[k].from)} → $${money(changes[k].to)}`);
  if (entityType === "product" && priceMoves.length) {
    const others = fields.filter((k) => k !== "price" && k !== "wholesalePrice");
    return `${def.label}${who} ${priceMoves.join(", ")}${others.length ? `; also edited: ${others.join(", ")}` : ""}`.slice(0, 255);
  }
  if (changes?.status) return `${def.label}${who} ${changes.status.to ? "activated" : "blocked"}${fields.length > 1 ? " and edited" : ""}`;
  if (changes?.approvedByAdmin && fields.length === 1) return `${def.label}${who} ${changes.approvedByAdmin.to ? "approved" : "approval removed"}`;
  return `${def.label}${who} edited: ${fields.join(", ")}`.slice(0, 255);
};

/**
 * Route middleware.
 * @param {"customer"|"partner"|"supplier"|"subAdmin"|"employee"|"product"} entityType
 * @param {"created"|"updated"|"deleted"} action
 * @param {(req) => any} [idOf] record id from the request (not needed for "created")
 */
function auditRoute(entityType, action, idOf = (req) => req.params.id) {
  return async (req, res, next) => {
    let before = null;
    let id = action === "created" ? null : idOf(req);
    try {
      if (id) before = await snapshot(entityType, id);
    } catch (error) {
      console.error("[audit] snapshot failed:", error.message);
    }
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
        if (action === "created") id = await createdId(entityType, req, payload);
        if (!id) return;
        const after = await snapshot(entityType, id);
        let finalAction = action;
        if (action === "updated" && after?.deleted && !before?.deleted) finalAction = "deleted";
        const changes = finalAction === "created" ? diff({}, after) : diff(before, after);
        if (finalAction === "updated" && !Object.keys(changes).length) return;
        await logAudit({
          req,
          entityType,
          entityId: id,
          action: finalAction,
          summary: describeChanges(entityType, finalAction, changes, after || before),
          changes: finalAction === "created" ? undefined : changes,
        });
      } catch (error) {
        console.error("[audit] failed:", error.message);
      }
    });
    next();
  };
}

/* ---------- local partner price list (salesRepProductPrices) ---------- */

function partnerIdsIn(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => partnerIdsIn(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "salesRepId" && v) out.add(Number(v));
      else if (v && typeof v === "object") partnerIdsIn(v, out);
    }
  }
  return out;
}

async function priceListSnapshot(partnerId) {
  const rows = await salesRepProductPrice.findAll({ where: { salesRepId: partnerId, deleted: 0 }, attributes: ["productId", "price", "wholesalePrice"], raw: true });
  const names = new Map(
    (await product.findAll({ where: { id: rows.map((r) => r.productId) }, attributes: ["id", "name"], raw: true })).map((p) => [p.id, p.name]),
  );
  const out = {};
  for (const r of rows) out[names.get(r.productId) || `Product ${r.productId}`] = { price: r.price, wholesale: r.wholesalePrice };
  return out;
}

/** Price list routes: which partners' price lists changed, and how. */
function auditPriceList() {
  return async (req, res, next) => {
    const ids = partnerIdsIn(req.body);
    if (req.params?.id) {
      const row = await salesRepProductPrice.findOne({ where: { id: req.params.id }, attributes: ["salesRepId"], raw: true }).catch(() => null);
      if (row?.salesRepId) ids.add(Number(row.salesRepId));
    }
    const before = {};
    for (const pid of ids) before[pid] = await priceListSnapshot(pid).catch(() => ({}));
    const originalJson = res.json.bind(res);
    let payload;
    res.json = (body) => {
      payload = body;
      return originalJson(body);
    };
    res.on("finish", async () => {
      if (res.statusCode >= 400 || (payload && ["fail", "error"].includes(payload.status))) return;
      for (const pid of ids) {
        try {
          const changes = diff(before[pid], await priceListSnapshot(pid));
          if (!Object.keys(changes).length) continue;
          await logAudit({
            req,
            entityType: "partner",
            entityId: pid,
            action: "price_list_changed",
            summary: `Price list changed: ${Object.keys(changes).length} product(s)`,
            changes,
          });
        } catch (error) {
          console.error("[audit] price list failed:", error.message);
        }
      }
    });
    next();
  };
}

module.exports = { ENTITIES, snapshot, diff, logAudit, auditRoute, auditPriceList };
