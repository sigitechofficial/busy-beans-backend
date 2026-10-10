/**
 * Audit trail (local API only): who changed customers, local partners (incl. price list),
 * suppliers, sub-admins (incl. permissions), employees and products (price changes), which fields
 * (old → new), and when;
 * order created / marked paid (person or system); who may read the history.
 *
 *   node scripts/auditTrailTest.js        (API on API_TEST_URL, default http://localhost:8013)
 *
 * Run the API with mail, QuickBooks and Stripe disabled (see securityAccessTest.js). Creates
 * temporary records and removes them (and their history) at the end.
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const redis = require("redis");
const {
  account,
  user,
  salesRep,
  supplier,
  subAdmin,
  employee,
  permission,
  order,
  category,
  userDiscount,
  salesRepProductPrice,
  product,
  auditLog,
  orderActivityLog,
  sequelize,
} = require("../models");
const { registerOrderHooks } = require("../utils/orderActivity");

const redisClient = redis.createClient({
  socket: {
    host: String(process.env.REDIS_HOST || "localhost").replace(/['";]/g, ""),
    port: Number(String(process.env.REDIS_PORT || "6379").replace(/['";]/g, "")) || 6379,
  },
});
const API = (process.env.API_TEST_URL || "http://localhost:8013").replace(/\/+$/, "");
const RUN = `aud${Date.now().toString(36)}`;
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const tokens = [];
const created = { users: [], partners: [], suppliers: [], subAdmins: [], employees: [], orders: [], products: [] };

async function call(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* not JSON */
  }
  return { status: res.status, json };
}
async function mint(entity, record) {
  const token = jwt.sign({ id: record.id, email: record.email, entity }, process.env.JWT_SECRET, { expiresIn: "10m" });
  await redisClient.set(token, `${entity}${record.id}`, { EX: 600 });
  await redisClient.sAdd(`${entity}${record.id}`, token);
  tokens.push([entity, record.id, token]);
  return token;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const history = (entityType, entityId) =>
  auditLog.findAll({ where: { entityType, entityId }, order: [["id", "ASC"]], raw: true }).then((rows) => rows.map((r) => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })));

async function run() {
  await redisClient.connect();
  const admin = await account.findOne({ where: { deleted: 0, status: 1 }, order: [["id", "ASC"]] });
  const tAdmin = await mint("admin", admin);
  const cat = await category.findOne({ where: { deleted: 0 }, raw: true });

  // ---- customer: details + discounts ----
  const p1 = await salesRep.create({ srName: `${RUN} Partner`, email: `${RUN}-p@example.test`, status: true, deleted: false, partnerType: "dropship-partner", registerBy: "email" });
  created.partners.push(p1.id);
  const cust = await user.create({ name: `${RUN} Customer`, email: `${RUN}-c@example.test`, companyName: "Old Co", status: 1, deleted: 0, salesRepId: p1.id }, { hooks: false });
  created.users.push(cust.id);
  let r = await call(`/api/v1/admin/customer-update/${cust.id}`, {
    token: tAdmin,
    method: "PATCH",
    body: { info: { companyName: "New Co" }, userDiscount: [{ categoryId: cat.id, percentage: 15, userId: cust.id }] },
  });
  check(r.status === 200, `customer update succeeded (got ${r.status} ${r.json?.message})`);
  await wait(400);
  let h = await history("customer", cust.id);
  const upd = h.find((e) => e.action === "updated");
  check(upd && upd.changes?.companyName?.from === "Old Co" && upd.changes?.companyName?.to === "New Co", `customer edit records companyName old → new (got ${JSON.stringify(upd?.changes)})`);
  check(upd && upd.changes?.discounts && JSON.stringify(upd.changes.discounts).includes("15%"), "customer edit records the category discount change");
  check(upd?.actorEntity === "admin" && upd?.actorName && upd?.createdAt, "customer edit records who (admin + name) and when");
  r = await call(`/api/v1/admin/customer-update/${cust.id}`, { token: tAdmin, method: "PATCH", body: { info: { companyName: "New Co" } } });
  await wait(400);
  check((await history("customer", cust.id)).length === h.length, "saving without changes records nothing");
  // (DELETE /customer-discounts/:userId only lists discounts: nothing changes, nothing is recorded)
  const beforeList = (await history("customer", cust.id)).length;
  r = await call(`/api/v1/admin/customer-discounts/${cust.id}`, { token: tAdmin, method: "DELETE" });
  await wait(400);
  check((await history("customer", cust.id)).length === beforeList, "listing discounts records nothing");

  // ---- local partner: details + price list ----
  r = await call(`/api/v1/admin/sales-rep/${p1.id}`, { token: tAdmin, method: "PATCH", body: { creditLimit: 500 } });
  await wait(400);
  let ph = await history("partner", p1.id);
  check(ph.some((e) => e.action === "updated" && Number(e.changes?.creditLimit?.to) === 500), `partner credit limit change recorded (got ${r.status} ${JSON.stringify(ph.map((e) => e.changes))})`);
  r = await call(`/api/v1/admin/sales-rep-product-price`, { token: tAdmin, method: "POST", body: [{ productId: 1, salesRepId: p1.id, price: 10, wholesalePrice: 5 }] });
  await wait(600);
  ph = await history("partner", p1.id);
  check(ph.some((e) => e.action === "price_list_changed"), `partner price list change recorded (got ${r.status} ${r.json?.message})`);

  // ---- supplier ----
  const sup = await supplier.create({ supplierName: `${RUN} Supplier`, email: `${RUN}-s@example.test`, status: true, deleted: false, isDefaultSupplier: false, registerBy: "email", verificationRequired: false, loginVerificationDone: true });
  created.suppliers.push(sup.id);
  r = await call(`/api/v1/admin/supplier/${sup.id}`, { token: tAdmin, method: "PATCH", body: { phoneNum: "5550000" } });
  await wait(400);
  check((await history("supplier", sup.id)).some((e) => e.changes?.phoneNum?.to === "5550000"), `supplier edit recorded (got ${r.status} ${r.json?.message})`);

  // ---- product: price change + delete ----
  const prod = await product.create({ name: `${RUN} Product`, quantity: "10", unit: "lbs", image: "test.png", price: 20, wholesalePrice: 12, categoryId: cat?.id, status: true, deleted: false });
  created.products.push(prod.id);
  r = await call(`/api/v1/admin/product/${prod.id}`, { token: tAdmin, method: "PATCH", body: { price: "24.50", wholesalePrice: "12" } });
  await wait(400);
  let prh = await history("product", prod.id);
  const priceEntry = prh.find((e) => e.action === "updated");
  check(
    priceEntry && Number(priceEntry.changes?.price?.from) === 20 && Number(priceEntry.changes?.price?.to) === 24.5 && !priceEntry.changes?.wholesalePrice,
    `product price change recorded old → new, unchanged wholesale not listed (got ${r.status} ${JSON.stringify(priceEntry?.changes)})`,
  );
  check((priceEntry?.summary || "").includes("$20.00 → $24.50") && priceEntry?.actorEntity === "admin", `product price summary + who (got ${priceEntry?.summary})`);
  r = await call(`/api/v1/admin/product/${prod.id}`, { token: tAdmin, method: "PATCH", body: { price: "24.50" } });
  await wait(400);
  check((await history("product", prod.id)).length === prh.length, "saving a product without changes records nothing");
  r = await call(`/api/v1/admin/product/${prod.id}`, { token: tAdmin, method: "DELETE" });
  await wait(400);
  prh = await history("product", prod.id);
  check(prh.some((e) => e.action === "deleted"), `product delete recorded (got ${r.status} ${JSON.stringify(prh.map((e) => e.action))})`);

  // ---- sub-admin: created + permissions ----
  r = await call(`/api/v1/admin/sub-admin`, {
    token: tAdmin,
    method: "POST",
    body: { name: `${RUN} Sub`, email: `${RUN}-sub@example.test`, password: "Passw0rd!x", features: [{ feature: "orders", view: true }] },
  });
  await wait(500);
  const sub = await subAdmin.findOne({ where: { email: `${RUN}-sub@example.test` }, raw: true });
  if (sub) created.subAdmins.push(sub.id);
  check(sub && (await history("subAdmin", sub.id)).some((e) => e.action === "created"), `sub-admin creation recorded (got ${r.status} ${r.json?.message})`);
  if (sub) {
    r = await call(`/api/v1/admin/sub-admin/${sub.id}`, {
      token: tAdmin,
      method: "PATCH",
      body: { name: `${RUN} Sub`, email: `${RUN}-sub@example.test`, features: [{ feature: "orders", view: true, update: true }, { feature: "invoice", "edit-price-customer": true }] },
    });
    await wait(500);
    const perm = (await history("subAdmin", sub.id)).find((e) => e.changes?.permissions);
    check(perm && perm.changes.permissions.added.includes("invoice_edit-price-customer") && perm.changes.permissions.added.includes("orders_update"), `granted permissions recorded (got ${r.status} ${JSON.stringify(perm?.changes)})`);
  }

  // ---- employee ----
  const emp = await employee.create({ name: `${RUN} Emp`, email: `${RUN}-e@example.test`, password: "x", employeeOf: "Admin", accountId: admin.id, status: true, verificationRequired: false, loginVerificationDone: true });
  created.employees.push(emp.id);
  r = await call(`/api/v1/admin/employee/${emp.id}`, { token: tAdmin, method: "PATCH", body: { name: `${RUN} Emp Renamed` } });
  await wait(400);
  check((await history("employee", emp.id)).some((e) => e.changes?.name?.to === `${RUN} Emp Renamed`), `employee edit recorded (got ${r.status} ${r.json?.message})`);

  // ---- orders: created / marked paid (system here, admin through the API) ----
  registerOrderHooks();
  const o1 = await order.create({ userId: cust.id, createdBy: "admin", paymentStatus: "pending", totalBill: 10 });
  created.orders.push(o1.id);
  await order.update({ paymentStatus: "done", paymentMethod: "card" }, { where: { id: o1.id } });
  await wait(400);
  const oa = await orderActivityLog.findAll({ where: { orderId: o1.id }, raw: true });
  check(oa.some((e) => e.action === "order_created" && e.actorEntity === "system"), "order created without a signed-in user is recorded as System");
  check(oa.some((e) => e.action === "marked_paid" && e.actorEntity === "system"), "payment without a signed-in user (e.g. Stripe webhook) is recorded as System");
  const o2 = await order.create({ userId: cust.id, createdBy: "admin", paymentStatus: "pending", totalBill: 20 });
  created.orders.push(o2.id);
  r = await call(`/api/v1/admin/edit-order`, { token: tAdmin, method: "PATCH", body: { orderId: o2.id, orderData: { paymentStatus: "done", paymentMethod: "cash" } } });
  await wait(600);
  const ob = await orderActivityLog.findAll({ where: { orderId: o2.id, action: "marked_paid" }, raw: true });
  check(r.status === 200 && ob.length === 1 && ob[0].actorEntity === "admin" && ob[0].actorName && (ob[0].summary || "").startsWith("Marked paid ("), `manual mark-paid recorded once, with the admin and the saved method (got ${r.status}, ${JSON.stringify(ob.map((e) => [e.actorEntity, e.summary]))})`);

  // ---- who may read history ----
  const tP1 = await mint("localPartner", p1);
  const p2 = await salesRep.findOne({ where: { deleted: 0, status: 1, id: { [require("sequelize").Op.ne]: p1.id } }, raw: true });
  const tP2 = await mint("localPartner", p2);
  const tCust = await mint("user", cust);
  const supTok = await mint("supplier", sup);
  const subView = await subAdmin.create({ name: `${RUN} Viewer`, email: `${RUN}-v@example.test`, password: "x", status: true, verificationRequired: false, loginVerificationDone: true });
  created.subAdmins.push(subView.id);
  await permission.bulkCreate([{ key: "customer_view", subAdminId: subView.id }]);
  const tView = await mint("subAdmin", subView);
  const okRead = (res) => res.status === 200 && Array.isArray(res.json?.data?.entries);
  check(okRead(await call(`/api/v1/admin/audit/customer/${cust.id}`, { token: tAdmin })), "admin reads customer history");
  check(okRead(await call(`/api/v1/admin/audit/customer/${cust.id}`, { token: tP1 })), "the customer's own partner reads its history");
  check((await call(`/api/v1/admin/audit/customer/${cust.id}`, { token: tP2 })).status === 404, "another partner cannot read the customer's history");
  check((await call(`/api/v1/admin/audit/supplier/${sup.id}`, { token: tP1 })).status === 403, "a partner cannot read supplier history");
  check((await call(`/api/v1/admin/audit/product/${prod.id}`, { token: tP1 })).status === 403, "a partner cannot read product history");
  check(okRead(await call(`/api/v1/admin/audit/product/${prod.id}`, { token: tAdmin })), "admin reads product history");
  check((await call(`/api/v1/admin/audit/customer/${cust.id}`, { token: tCust })).status === 403, "a customer cannot read history");
  check((await call(`/api/v1/admin/audit/customer/${cust.id}`, { token: supTok })).status === 403, "a supplier cannot read history");
  check(okRead(await call(`/api/v1/admin/audit/customer/${cust.id}`, { token: tView })), "a sub-admin with customer view reads customer history");
  check((await call(`/api/v1/admin/audit/supplier/${sup.id}`, { token: tView })).status === 403, "a sub-admin without supplier permission cannot read supplier history");
}

async function cleanup() {
  for (const [entity, id, token] of tokens) {
    await redisClient.del(token).catch(() => {});
    await redisClient.sRem(`${entity}${id}`, token).catch(() => {});
  }
  const ids = (a) => (a.length ? a : [0]);
  await sequelize.query("DELETE FROM orderActivityLogs WHERE orderId IN (:ids)", { replacements: { ids: ids(created.orders) } });
  if (created.orders.length) await order.destroy({ where: { id: created.orders }, force: true });
  for (const [type, list] of [["customer", created.users], ["partner", created.partners], ["supplier", created.suppliers], ["subAdmin", created.subAdmins], ["employee", created.employees], ["product", created.products]]) {
    if (list.length) await auditLog.destroy({ where: { entityType: type, entityId: list } });
  }
  if (created.users.length) await userDiscount.destroy({ where: { userId: created.users }, force: true });
  if (created.partners.length) await salesRepProductPrice.destroy({ where: { salesRepId: created.partners }, force: true });
  if (created.subAdmins.length) await permission.destroy({ where: { subAdminId: created.subAdmins }, force: true });
  if (created.employees.length) await permission.destroy({ where: { employeeId: created.employees }, force: true });
  if (created.users.length) await user.destroy({ where: { id: created.users }, force: true });
  if (created.employees.length) await employee.destroy({ where: { id: created.employees }, force: true });
  if (created.subAdmins.length) await subAdmin.destroy({ where: { id: created.subAdmins }, force: true });
  if (created.suppliers.length) await supplier.destroy({ where: { id: created.suppliers }, force: true });
  if (created.products.length) await product.destroy({ where: { id: created.products }, force: true });
  if (created.partners.length) await salesRep.destroy({ where: { id: created.partners }, force: true });
}

run()
  .catch((error) => failures.push(`crashed: ${error.stack || error.message}`))
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      failures.push(`cleanup failed: ${error.message}`);
    }
    if (failures.length) {
      console.error(`[audit-trail] ${failures.length} failure(s)`);
      failures.forEach((f) => console.error(`  ✗ ${f}`));
      process.exitCode = 1;
    } else {
      console.log("[audit-trail] passed");
    }
    await redisClient.quit().catch(() => {});
    await sequelize.close().catch(() => {});
  });
