/**
 * Customer invoice editing (local API only): who may edit / send invoices, custom unit prices with
 * the "Edit unit price" permission (utils/invoiceLinePricing.js), kept prices, minimums, totals,
 * commission, extra charges and the price-change log.
 *
 *   node scripts/invoicePriceEditTest.js        (API on API_TEST_URL, default http://localhost:8013)
 *
 * Start the API with mail and QuickBooks disabled for this run (EMAIL_PASSWORD="" ZEPTO_API_TOKEN=""
 * QBO_CLIENT_ID="" QBO_CLIENT_SECRET="" QBO_ENV=sandbox in its env): invoice edits sync QuickBooks.
 * Creates temporary customers, orders, sub-admins and tokens, and removes all of it at the end.
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const redis = require("redis");
const {
  account,
  user,
  order,
  item,
  product,
  salesRep,
  subAdmin,
  employee,
  supplier,
  permission,
  userDiscount,
  orderItemPriceLog,
  sequelize,
} = require("../models");

const redisClient = redis.createClient({
  socket: {
    host: String(process.env.REDIS_HOST || "localhost").replace(/['";]/g, ""),
    port: Number(String(process.env.REDIS_PORT || "6379").replace(/['";]/g, "")) || 6379,
  },
});

const API = (process.env.API_TEST_URL || "http://localhost:8013").replace(/\/+$/, "");
const RUN = `ipe${Date.now().toString(36)}`;
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const tokens = [];
const created = { users: [], orders: [], subAdmins: [], discounts: [], employees: [] };

async function request(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
const refused = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && r.json?.status === "fail");
const ok = (r) => r.status === 200 && r.json?.status === "success";

async function mintToken(entity, record) {
  const token = jwt.sign({ id: record.id, email: record.email, entity }, process.env.JWT_SECRET, { expiresIn: "10m" });
  await redisClient.set(token, `${entity}${record.id}`, { EX: 600 });
  await redisClient.sAdd(`${entity}${record.id}`, token);
  tokens.push([entity, record.id, token]);
  return token;
}

async function makeCustomer(n) {
  const u = await user.create(
    { name: `Invoice Test ${n}`, email: `${RUN}-${n}@example.test`, status: 1, deleted: 0 },
    { hooks: false },
  );
  created.users.push(u.id);
  return u;
}
async function makeOrder(fields) {
  const o = await order.create({ createdBy: "admin", paymentStatus: "pending", totalBill: 0, ...fields });
  created.orders.push(o.id);
  return o;
}
async function makeSubAdmin(n, keys) {
  const s = await subAdmin.create({
    name: `Invoice Test Sub ${n}`,
    email: `${RUN}-sub${n}@example.test`,
    password: "not-used-token-only",
    status: true,
    verificationRequired: false,
    loginVerificationDone: true,
  });
  created.subAdmins.push(s.id);
  await permission.bulkCreate(keys.map((key) => ({ key, subAdminId: s.id })));
  return s;
}

const lines = (orderId) =>
  item.findAll({ where: { orderId }, order: [["id", "ASC"]], raw: true });
const orderRow = (id) => order.findByPk(id, { raw: true });
const SHIP = { shippingCharges: "10" }; // fixed shipping: no weight-table lookup
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

async function run() {
  await redisClient.connect();
  const admin = await account.findOne({ where: { deleted: 0, status: 1 }, order: [["id", "ASC"]] });
  if (!admin) throw new Error("No active admin account in the local DB");
  const [pA, pB] = await product.findAll({
    where: { deleted: 0, status: 1 },
    order: [["id", "ASC"]],
    limit: 2,
    raw: true,
  });
  const dropship = await salesRep.findOne({ where: { deleted: 0, status: 1, partnerType: "dropship-partner" }, raw: true });
  const otherPartner = await salesRep.findOne({
    where: { deleted: 0, status: 1, id: { [require("sequelize").Op.ne]: dropship.id } },
    raw: true,
  });

  // Fixtures: HQ customer with 10% on pA's category; a dropship partner's customer.
  const hqCustomer = await makeCustomer("hq");
  const d = await userDiscount.create({ userId: hqCustomer.id, categoryId: pA.categoryId, percentage: 10, status: 1, deleted: 0 });
  created.discounts.push(d.id);
  const partnerCustomer = await makeCustomer("partner");
  const hqOrder = await makeOrder({ userId: hqCustomer.id });
  const partnerOrderRow = await makeOrder({ userId: partnerCustomer.id, salesRepId: dropship.id, createdBy: "sales-rep" });

  const adminToken = await mintToken("admin", admin);
  const customerToken = await mintToken("user", hqCustomer);
  const orderKeys = ["orders_view", "orders_update", "orders_scope_customer", "orders_scope_partner", "customer-orders_view", "customer-orders_scope_customer"];
  const subPlain = await makeSubAdmin(1, orderKeys);
  const subPrice = await makeSubAdmin(2, [...orderKeys, "invoice_edit-price"]);
  const subPlainToken = await mintToken("subAdmin", subPlain);
  const subPriceToken = await mintToken("subAdmin", subPrice);
  const ownPartnerToken = await mintToken("localPartner", dropship);
  const otherPartnerToken = await mintToken("localPartner", otherPartner);

  const update = (id, body, token) =>
    request(`/api/v1/admin/order-management/update-order/${id}`, { token, method: "PATCH", body });

  // 1) Who may edit.
  let r = await update(hqOrder.id, { items: [{ productId: pA.id, qty: 1 }], order: SHIP }, null);
  check(r.status === 401, `update without token must be 401 (got ${r.status})`);
  r = await update(hqOrder.id, { items: [{ productId: pA.id, qty: 1 }], order: { ...SHIP, paymentStatus: "done" } }, customerToken);
  check(refused(r), `customer token must be refused (got ${r.status} ${r.json?.status})`);
  check((await orderRow(hqOrder.id)).paymentStatus === "pending", "customer could not mark the order paid");
  r = await update(partnerOrderRow.id, { items: [{ productId: pA.id, qty: 1 }], order: SHIP }, otherPartnerToken);
  check(r.status === 403, `another partner's token must be 403 (got ${r.status})`);

  // 2) Catalog pricing (new lines) + only known order fields are saved.
  r = await update(
    hqOrder.id,
    {
      items: [{ productId: pA.id, qty: 2 }, { productId: pB.id, qty: 1 }],
      order: { ...SHIP, note: `${RUN} note`, paymentStatus: "done", totalBill: 1, invoiceId: "cs_fake" },
      typeCharges: [],
    },
    subPlainToken,
  );
  check(ok(r), `sub-admin catalog edit must succeed (got ${r.status} ${r.json?.message})`);
  let o = await orderRow(hqOrder.id);
  let ls = await lines(hqOrder.id);
  const listA = Number(pA.price);
  const listB = Number(pB.price);
  const pctB = pB.categoryId === pA.categoryId ? 10 : 0;
  const expectA = listA * 2 * 0.9;
  const expectB = listB * (1 - pctB / 100);
  check(ls.length === 2, `two lines expected (got ${ls.length})`);
  check(near(ls[0].price, expectA) && Number(ls[0].priceOverride) === 0, `line A catalog price with 10% (got ${ls[0]?.price}, want ${expectA.toFixed(2)})`);
  check(near(ls[0].catalogUnitPrice, listA * 0.9), "line A catalogUnitPrice recorded");
  check(o.note === `${RUN} note`, "note saved");
  check(o.paymentStatus === "pending" && o.invoiceId === null, "paymentStatus / invoiceId not settable from the browser");
  check(near(o.totalBill, expectA + expectB + 10), `totalBill = lines + shipping (got ${o.totalBill})`);

  // 3) Custom price: refused without the permission, nothing saved.
  r = await update(hqOrder.id, { items: [{ id: ls[0].id, productId: pA.id, qty: 2, unitPrice: 99.5 }, { id: ls[1].id, productId: pB.id, qty: 1 }], order: SHIP, typeCharges: [] }, subPlainToken);
  check(r.status === 403 && /permission to change unit prices/i.test(r.json?.message || ""), `custom price without permission must be 403 (got ${r.status} ${r.json?.message})`);
  check(near((await lines(hqOrder.id))[0].price, expectA), "refused edit changed nothing");

  // 4) Validation.
  for (const [value, re] of [[0, /at least \$0.01/], [-5, /at least \$0.01/], [12.345, /2 decimals/], ["abc", /must be a number/]]) {
    r = await update(hqOrder.id, { items: [{ id: ls[0].id, productId: pA.id, qty: 2, unitPrice: value }], order: SHIP, typeCharges: [] }, subPriceToken);
    check(r.status === 400 && re.test(r.json?.message || ""), `unit price ${value} must be refused (got ${r.status} ${r.json?.message})`);
  }
  r = await update(hqOrder.id, { items: [{ productId: pA.id, qty: 0 }], order: SHIP, typeCharges: [] }, adminToken);
  check(r.status === 400, `qty 0 must be refused (got ${r.status})`);
  r = await update(hqOrder.id, { items: [{ productId: pA.id, qty: 1 }], order: SHIP, typeCharges: [{ name: "Credit", qty: 1, price: "-5", total: -5 }] }, adminToken);
  check(r.status === 400, `negative extra charge must be refused (got ${r.status})`);

  // 5) Custom price with the permission: refused until confirmed (screen checkbox), then final
  //    price (no discount), logged.
  ls = await lines(hqOrder.id);
  r = await update(
    hqOrder.id,
    { items: [{ id: ls[0].id, productId: pA.id, qty: 2, unitPrice: 99.5 }, { id: ls[1].id, productId: pB.id, qty: 1 }], order: SHIP, typeCharges: [] },
    subPriceToken,
  );
  check(r.status === 400 && /confirm the unit price changes/i.test(r.json?.message || ""), `unconfirmed manual price change must be refused (got ${r.status} ${r.json?.message})`);
  check(near((await lines(hqOrder.id))[0].price, expectA), "unconfirmed price change saved nothing");
  r = await update(
    hqOrder.id,
    {
      items: [{ id: ls[0].id, productId: pA.id, qty: 2, unitPrice: 99.5 }, { id: ls[1].id, productId: pB.id, qty: 1 }],
      order: SHIP,
      typeCharges: [{ name: "Setup", code: "SETUP", qty: 1, price: "25", total: 25 }],
      confirmPriceChanges: true,
    },
    subPriceToken,
  );
  check(ok(r), `custom price with permission must succeed (got ${r.status} ${r.json?.message})`);
  ls = await lines(hqOrder.id);
  o = await orderRow(hqOrder.id);
  const lineA = ls.find((l) => l.productId === pA.id);
  check(near(lineA.price, 199) && near(lineA.unitPrice, 99.5) && Number(lineA.priceOverride) === 1 && near(lineA.discount, 0), `custom line: 2 × 99.50 = 199, no discount (got ${lineA.price} / ${lineA.unitPrice} / ${lineA.discount})`);
  check(ls.some((l) => l.type === "charges" && near(l.price, 25)), "extra charge saved");
  check(near(o.totalBill, 199 + expectB + 25 + 10), `totalBill with custom price (got ${o.totalBill})`);
  let logs = await orderItemPriceLog.findAll({ where: { orderId: hqOrder.id }, raw: true });
  check(logs.length === 1 && logs[0].action === "set" && near(logs[0].newUnitPrice, 99.5) && near(logs[0].oldUnitPrice, listA * 0.9) && logs[0].changedByEntity === "subAdmin", "price change logged (set, old, new, who)");

  // 6) Kept on later edits by users without the permission (qty change keeps the unit price).
  r = await update(
    hqOrder.id,
    { items: [{ id: lineA.id, productId: pA.id, qty: 3 }, { productId: pB.id, qty: 1 }], order: SHIP, typeCharges: [{ name: "Setup", code: "SETUP", qty: 1, price: "25", total: 25 }] },
    subPlainToken,
  );
  check(ok(r), `edit by sub-admin without permission must succeed (got ${r.status} ${r.json?.message})`);
  const kept = (await lines(hqOrder.id)).find((l) => l.productId === pA.id);
  check(near(kept.price, 298.5) && Number(kept.priceOverride) === 1, `custom price kept: 3 × 99.50 = 298.50 (got ${kept.price})`);
  r = await update(hqOrder.id, { items: [{ id: kept.id, productId: pA.id, qty: 3, resetPrice: true }], order: SHIP, typeCharges: [] }, subPlainToken);
  check(r.status === 403, `reset without permission must be 403 (got ${r.status})`);

  // 7) Invoice PDF "Update" (no order object, no charges list): works, keeps charges and custom price.
  const before = await lines(hqOrder.id);
  r = await update(hqOrder.id, { items: before.filter((l) => l.type !== "charges").map((l) => ({ id: l.id, productId: l.productId, qty: l.qty })) }, adminToken);
  check(ok(r), `PDF update without order object must succeed (got ${r.status} ${r.json?.message})`);
  const afterPdf = await lines(hqOrder.id);
  check(afterPdf.some((l) => l.type === "charges" && near(l.price, 25)), "PDF update keeps the extra charge");
  check(near(afterPdf.find((l) => l.productId === pA.id).price, 298.5), "PDF update keeps the custom price");

  // 8) Reset to catalog by admin (logged as reset).
  r = await update(hqOrder.id, { items: [{ id: kept.id, productId: pA.id, qty: 3, resetPrice: true }], order: SHIP, typeCharges: [] }, adminToken);
  check(ok(r), `admin reset must succeed (got ${r.status} ${r.json?.message})`);
  const reset = (await lines(hqOrder.id)).find((l) => l.productId === pA.id);
  check(near(reset.price, listA * 3 * 0.9) && Number(reset.priceOverride) === 0, `reset back to catalog (got ${reset.price})`);
  logs = await orderItemPriceLog.findAll({ where: { orderId: hqOrder.id }, order: [["id", "ASC"]], raw: true });
  check(logs.length === 2 && logs[1].action === "reset" && logs[1].changedByEntity === "admin", "reset logged");

  // 9) Dropship partner's customer: minimum = partner wholesale, commission = price − wholesale.
  r = await update(partnerOrderRow.id, { items: [{ productId: pA.id, qty: 2 }], order: SHIP, typeCharges: [] }, ownPartnerToken);
  check(ok(r), `own partner may edit its customer's invoice (got ${r.status} ${r.json?.message})`);
  const [partnerLine] = await lines(partnerOrderRow.id);
  const wholesaleUnit = Number(partnerLine.wholesalePrice) / 2;
  r = await update(partnerOrderRow.id, { items: [{ id: partnerLine.id, productId: pA.id, qty: 2, unitPrice: 50 }], order: SHIP, typeCharges: [] }, ownPartnerToken);
  check(r.status === 403, `local partner has no unit-price permission (got ${r.status})`);
  if (wholesaleUnit > 0.01) {
    const below = Math.round((wholesaleUnit - 0.01) * 100) / 100;
    r = await update(partnerOrderRow.id, { items: [{ id: partnerLine.id, productId: pA.id, qty: 2, unitPrice: below }], order: SHIP, typeCharges: [] }, adminToken);
    check(r.status === 400 && /Minimum unit price/.test(r.json?.message || ""), `below partner wholesale must be refused (got ${r.status} ${r.json?.message})`);
    const custom = Math.round((wholesaleUnit + 5) * 100) / 100;
    r = await update(partnerOrderRow.id, { items: [{ id: partnerLine.id, productId: pA.id, qty: 2, unitPrice: custom }], order: SHIP, typeCharges: [], confirmPriceChanges: true }, adminToken);
    check(ok(r), `custom price above wholesale must succeed (got ${r.status} ${r.json?.message})`);
    const [pl] = await lines(partnerOrderRow.id);
    check(near(pl.salerCommission, 10), `partner commission = (custom − wholesale) × qty = 10 (got ${pl.salerCommission})`);
  } else {
    failures.push("dropship test product has no wholesale price; minimum check not exercised");
  }
  const details = await request(`/api/v1/admin/order-details/${partnerOrderRow.id}`, { token: adminToken });
  check(details.json?.data?.pricing?.canEditUnitPrice === true, "order details: admin may edit unit prices");
  check(near(details.json?.data?.pricing?.minUnitPrices?.[pA.id], wholesaleUnit), "order details: per-product minimum (partner wholesale)");
  const detailsSub = await request(`/api/v1/admin/order-details/${hqOrder.id}`, { token: subPlainToken });
  check(detailsSub.json?.data?.pricing?.canEditUnitPrice === false, `order details: sub-admin without permission may not edit unit prices (got ${detailsSub.status} ${JSON.stringify(detailsSub.json?.data?.pricing ?? detailsSub.json?.message)})`);

  // 10) Send invoice: ownership + only invoice stamps.
  r = await request(`/api/v1/admin/order-management/send-invoice/${partnerOrderRow.id}`, {
    token: otherPartnerToken,
    method: "POST",
    body: { order: { orderId: partnerOrderRow.id } },
  });
  check(r.status === 403, `send invoice for another partner's order must be 403 (got ${r.status})`);
  r = await request(`/api/v1/admin/order-management/send-invoice`, {
    token: customerToken,
    method: "POST",
    body: { order: [{ orderId: hqOrder.id, paymentStatus: "done" }] },
  });
  check(refused(r), `bulk send with a customer token must be refused (got ${r.status})`);
  check((await orderRow(hqOrder.id)).paymentStatus === "pending", "bulk send could not mark paid");

  // 11) Permission matrix: every account type against an HQ customer's invoice and a local partner's
  //     customer's invoice (catalog edit, custom price), send-invoice scope, and the price log's "who".
  const hqOrder2 = await makeOrder({ userId: hqCustomer.id });
  const partnerOrder2 = await makeOrder({ userId: partnerCustomer.id, salesRepId: dropship.id, createdBy: "sales-rep" });
  const seed = (id) => update(id, { items: [{ productId: pB.id, qty: 1 }], order: SHIP, typeCharges: [] }, adminToken);
  await seed(hqOrder2.id);
  await seed(partnerOrder2.id);
  const makeEmployee = async (n, fields) => {
    const e = await employee.create({
      name: `Invoice Test Employee ${n}`,
      email: `${RUN}-emp${n}@example.test`,
      password: "not-used-token-only",
      verificationRequired: false,
      loginVerificationDone: true,
      status: true,
      ...fields,
    });
    created.employees.push(e.id);
    return e;
  };
  const adminEmployee = await makeEmployee(1, { employeeOf: "Admin", accountId: admin.id });
  const partnerEmployee = await makeEmployee(2, { employeeOf: "Local Partner", salesRepId: dropship.id });
  const otherPartnerEmployee = await makeEmployee(3, { employeeOf: "Local Partner", salesRepId: otherPartner.id });
  const supplierRow = await supplier.findOne({ where: { deleted: 0 }, raw: true });
  const actors = {
    admin: adminToken,
    "sub: customer-orders only": await mintToken("subAdmin", await makeSubAdmin(3, ["customer-orders_view", "customer-orders_update"])),
    "sub: orders, Admin scope": await mintToken("subAdmin", await makeSubAdmin(4, ["orders_view", "orders_update", "orders_scope_customer"])),
    "sub: orders, Local Partner scope": await mintToken("subAdmin", await makeSubAdmin(5, ["orders_view", "orders_update", "orders_scope_partner"])),
    "sub: partner-orders only": await mintToken("subAdmin", await makeSubAdmin(6, ["partner-orders_view", "partner-orders_update"])),
    "sub: price key only": await mintToken("subAdmin", await makeSubAdmin(7, ["invoice_edit-price"])),
    "sub: orders + price": subPriceToken,
    "sub: price, admin customers only": await mintToken("subAdmin", await makeSubAdmin(9, [...orderKeys, "invoice_edit-price-customer"])),
    "sub: price, partner customers only": await mintToken("subAdmin", await makeSubAdmin(10, [...orderKeys, "invoice_edit-price-partner"])),
    "admin employee": await mintToken("adminEmployee", adminEmployee),
    "own partner": ownPartnerToken,
    "own partner employee": await mintToken("partnerEmployee", partnerEmployee),
    "other partner": otherPartnerToken,
    "other partner employee": await mintToken("partnerEmployee", otherPartnerEmployee),
    supplier: supplierRow ? await mintToken("supplier", supplierRow) : null,
    customer: customerToken,
  };
  // [HQ catalog edit, HQ custom price, partner-customer catalog edit, partner-customer custom price]
  const expected = {
    admin: [true, true, true, true],
    "sub: customer-orders only": [true, false, true, false],
    "sub: orders, Admin scope": [true, false, false, false],
    "sub: orders, Local Partner scope": [false, false, true, false],
    "sub: partner-orders only": [false, false, false, false],
    "sub: price key only": [false, false, false, false],
    "sub: orders + price": [true, true, true, true],
    "sub: price, admin customers only": [true, true, true, false],
    "sub: price, partner customers only": [true, false, true, true],
    "admin employee": [true, false, true, false],
    "own partner": [false, false, true, false],
    "own partner employee": [false, false, true, false],
    "other partner": [false, false, false, false],
    "other partner employee": [false, false, false, false],
    supplier: [false, false, false, false],
    customer: [false, false, false, false],
  };
  const labels = ["HQ edit", "HQ price", "partner-customer edit", "partner-customer price"];
  const wholesaleB = Number((await lines(partnerOrder2.id))[0]?.wholesalePrice || 0);
  const customB = Math.round((wholesaleB + 3) * 100) / 100;
  const matrix = [];
  for (const [actor, token] of Object.entries(actors)) {
    if (!token) continue;
    const row = [];
    for (const [orderId, unitPrice] of [[hqOrder2.id, undefined], [hqOrder2.id, 77.77], [partnerOrder2.id, undefined], [partnerOrder2.id, customB]]) {
      const [line] = (await lines(orderId)).filter((l) => l.type !== "charges");
      const input = { id: line.id, productId: pB.id, qty: unitPrice === undefined ? (Number(line.qty) % 3) + 1 : Number(line.qty) };
      if (unitPrice !== undefined) input.unitPrice = unitPrice;
      const res = await update(orderId, { items: [input], order: SHIP, typeCharges: [], ...(unitPrice !== undefined ? { confirmPriceChanges: true } : {}) }, token);
      row.push(ok(res));
      // back to catalog so every actor starts from the same state
      if (unitPrice !== undefined && ok(res)) {
        const [again] = await lines(orderId);
        await update(orderId, { items: [{ id: again.id, productId: pB.id, qty: Number(again.qty), resetPrice: true }], order: SHIP, typeCharges: [] }, adminToken);
      }
    }
    matrix.push([actor, row]);
    row.forEach((got, i) => {
      const want = expected[actor][i];
      check(got === want, `matrix ${actor} / ${labels[i]}: expected ${want ? "allowed" : "refused"}, got ${got ? "allowed" : "refused"}`);
    });
  }
  console.log("[invoice-price-edit] permission matrix (HQ edit | HQ price | partner-customer edit | partner-customer price)");
  for (const [actor, row] of matrix) console.log(`  ${actor.padEnd(34)} ${row.map((v) => (v ? "allowed" : "refused").padEnd(9)).join(" ")}`);

  // Send invoice: the same scope rule (POST = create permission).
  const sendSub = await mintToken("subAdmin", await makeSubAdmin(8, ["orders_view", "orders_create", "orders_scope_partner"]));
  r = await request(`/api/v1/admin/order-management/send-invoice/${hqOrder2.id}`, { token: sendSub, method: "POST", body: { order: { orderId: hqOrder2.id } } });
  check(r.status === 403, `send by a Local-Partner-scope sub-admin for an HQ customer must be 403 (got ${r.status})`);

  // Audit: each price change records who (entity, id, name) and when.
  const subRow = await subAdmin.findOne({ where: { email: `${RUN}-sub2@example.test` }, raw: true });
  const audit = await orderItemPriceLog.findAll({ where: { orderId: [hqOrder2.id, partnerOrder2.id] }, order: [["id", "ASC"]], raw: true });
  const byEntity = (e) => audit.filter((a) => a.changedByEntity === e);
  check(byEntity("admin").length > 0 && byEntity("admin").every((a) => a.changedById === admin.id && a.changedByName === (admin.name || admin.email)), "audit: admin rows carry the admin's id and name");
  const subRows = await subAdmin.findAll({ where: { id: byEntity("subAdmin").map((a) => a.changedById) }, raw: true });
  const subNames = new Map(subRows.map((x) => [x.id, x.name]));
  check(byEntity("subAdmin").length > 0 && byEntity("subAdmin").some((a) => a.changedById === subRow.id) && byEntity("subAdmin").every((a) => subNames.get(a.changedById) === a.changedByName), "audit: sub-admin rows carry that sub-admin's id and name");
  check(audit.every((a) => ["admin", "subAdmin"].includes(a.changedByEntity)), "audit: only permitted users appear in the price log");
  check(audit.filter((a) => a.action === "set").length === 6 && audit.filter((a) => a.action === "reset").length === 6, `audit: 6 custom prices set and 6 resets logged (got ${audit.map((a) => a.action).join(",")})`);
  check(audit.every((a) => Math.abs(Date.now() - new Date(a.createdAt).getTime()) < 10 * 60 * 1000), "audit: timestamps are current");
  console.log("[invoice-price-edit] price log sample:");
  for (const a of audit.slice(0, 4)) {
    console.log(`  ${new Date(a.createdAt).toISOString()}  order ${a.orderId}  ${a.action.padEnd(6)} ${a.changedByEntity}#${a.changedById} "${a.changedByName}"  ${a.oldUnitPrice} → ${a.newUnitPrice} (catalog ${a.catalogUnitPrice})`);
  }

  // 12) Paid / payment in progress: locked.
  await order.update({ paymentIntentId: `pi_${RUN}` }, { where: { id: hqOrder.id } });
  r = await update(hqOrder.id, { items: [{ productId: pA.id, qty: 1 }], order: SHIP, typeCharges: [] }, adminToken);
  check(r.status === 400 && /payment is in progress|already paid/i.test(r.json?.message || ""), `payment in progress must lock edits (got ${r.status} ${r.json?.message})`);
}

async function cleanup() {
  for (const [entity, id, token] of tokens) {
    await redisClient.del(token).catch(() => {});
    await redisClient.sRem(`${entity}${id}`, token).catch(() => {});
  }
  if (created.orders.length) {
    await orderItemPriceLog.destroy({ where: { orderId: created.orders } });
    await sequelize.query("DELETE FROM orderActivityLogs WHERE orderId IN (:ids)", { replacements: { ids: created.orders } });
    await item.destroy({ where: { orderId: created.orders } });
    await order.destroy({ where: { id: created.orders }, force: true });
  }
  if (created.discounts.length) await userDiscount.destroy({ where: { id: created.discounts }, force: true });
  if (created.employees.length) await employee.destroy({ where: { id: created.employees }, force: true });
  if (created.subAdmins.length) {
    await permission.destroy({ where: { subAdminId: created.subAdmins }, force: true });
    await subAdmin.destroy({ where: { id: created.subAdmins }, force: true });
  }
  if (created.users.length) await user.destroy({ where: { id: created.users }, force: true });
}

run()
  .catch((error) => {
    failures.push(`crashed: ${error.stack || error.message}`);
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      failures.push(`cleanup failed: ${error.message}`);
    }
    if (failures.length) {
      console.error(`[invoice-price-edit] ${failures.length} failure(s)`);
      failures.forEach((f) => console.error(`  ✗ ${f}`));
      process.exitCode = 1;
    } else {
      console.log("[invoice-price-edit] passed");
    }
    await redisClient.quit().catch(() => {});
    await sequelize.close().catch(() => {});
  });
