/**
 * Who can reach what (local API only): customers only their own records, invoice pay links
 * (code, owner, legacy), Stripe-verified payment confirmation, admin API by account type
 * (customer / supplier / partner / partner employee / admin employee), partner id rewriting,
 * order-status field allow-lists and public form rate limits.
 *
 *   node scripts/securityAccessTest.js        (API on API_TEST_URL, default http://localhost:8013)
 *
 * Run the API with mail, QuickBooks and Stripe disabled (EMAIL_PASSWORD="" ZEPTO_API_TOKEN=""
 * QBO_CLIENT_ID="" QBO_CLIENT_SECRET="" STRIPE_SECRET_KEY=""): allowed payment calls then fail at
 * Stripe instead of creating anything. Creates temporary customers, orders, an address, a
 * subscription and employees, and removes all of it at the end.
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const redis = require("redis");
const {
  account,
  user,
  order,
  partnerOrder,
  address,
  salesRep,
  supplier,
  employee,
  subscription,
  coffeeMachine,
  sequelize,
} = require("../models");
const { newPayToken, invoicePayUrl } = require("../utils/payLink");
const ejs = require("ejs");
const path = require("path");

const redisClient = redis.createClient({
  socket: {
    host: String(process.env.REDIS_HOST || "localhost").replace(/['";]/g, ""),
    port: Number(String(process.env.REDIS_PORT || "6379").replace(/['";]/g, "")) || 6379,
  },
});
const API = (process.env.API_TEST_URL || "http://localhost:8013").replace(/\/+$/, "");
const RUN = `sec${Date.now().toString(36)}`;
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const tokens = [];
const created = { users: [], orders: [], partnerOrders: [], addresses: [], employees: [], subscriptions: [] };

async function call(path, { token, method = "GET", body } = {}) {
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
const blocked = (r) => r.status === 401 || r.status === 403 || r.status === 404 || (r.status === 200 && r.json?.status === "fail");
const passedGate = (r) => r.status !== 403 && r.status !== 404 && r.status !== 401 && !(r.status === 200 && r.json?.status === "fail");

async function mint(entity, record) {
  const token = jwt.sign({ id: record.id, email: record.email, entity }, process.env.JWT_SECRET, { expiresIn: "10m" });
  await redisClient.set(token, `${entity}${record.id}`, { EX: 600 });
  await redisClient.sAdd(`${entity}${record.id}`, token);
  tokens.push([entity, record.id, token]);
  return token;
}
async function customer(n, fields = {}) {
  const u = await user.create({ name: `Sec ${n}`, email: `${RUN}-${n}@example.test`, status: 1, deleted: 0, ...fields }, { hooks: false });
  created.users.push(u.id);
  return u;
}
async function makeOrder(fields) {
  const o = await order.create({ createdBy: "admin", paymentStatus: "pending", totalBill: 50, ...fields });
  created.orders.push(o.id);
  return o;
}
const orderRow = (id) => order.findByPk(id, { raw: true });
const rowsOf = (r) => {
  const d = r.json?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.orders)) return d.orders;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
};

async function run() {
  await redisClient.connect();
  const admin = await account.findOne({ where: { deleted: 0, status: 1 }, order: [["id", "ASC"]] });
  const [p1, p2] = await salesRep.findAll({ where: { deleted: 0, status: 1, partnerType: "dropship-partner" }, order: [["id", "ASC"]], limit: 2, raw: true });
  const s1 = await supplier.findOne({ where: { deleted: 0 }, raw: true });

  const A = await customer("A");
  const B = await customer("B");
  const C = await customer("C", { salesRepId: p1.id }); // partner P1's customer
  const D = await customer("D", { salesRepId: p2.id }); // partner P2's customer
  const oA = await makeOrder({ userId: A.id });
  const oB = await makeOrder({ userId: B.id, invoiceDate: new Date(), payToken: newPayToken() });
  const oLegacy = await makeOrder({ userId: B.id, invoiceDate: new Date(), payLinkLegacy: true });
  const oC = await makeOrder({ userId: C.id, salesRepId: p1.id, supplierId: s1.id });
  const oD = await makeOrder({ userId: D.id, salesRepId: p2.id });
  const addrB = await address.create({ userId: B.id, addressLineOne: `${RUN} 1 Secret St`, town: "Probe", status: 1, deleted: 0 });
  created.addresses.push(addrB.id);
  const machine = await coffeeMachine.findOne({ raw: true });
  let subB = null;
  if (machine) {
    subB = await subscription.create({
      userId: B.id,
      customerEmail: B.email,
      totalPrice: 1,
      status: "active",
      machineId: machine.id,
      subscriptionDays: 30,
      machinePrice: 1,
      productsTotal: 0,
      addonsTotal: 0,
      stripeSubscriptionId: `sub_${RUN}`,
    });
    created.subscriptions.push(subB.id);
  }
  const mkEmp = async (n, fields) => {
    const e = await employee.create({ name: `Sec Emp ${n}`, email: `${RUN}-emp${n}@example.test`, password: "x", verificationRequired: false, loginVerificationDone: true, status: true, ...fields });
    created.employees.push(e.id);
    return e;
  };
  const p1Emp = await mkEmp(1, { employeeOf: "Local Partner", salesRepId: p1.id });
  const p2Emp = await mkEmp(2, { employeeOf: "Local Partner", salesRepId: p2.id });
  const hqEmp = await mkEmp(3, { employeeOf: "Admin", accountId: admin.id });

  const tA = await mint("user", A);
  const tAdmin = await mint("admin", admin);
  const tP1 = await mint("localPartner", p1);
  const tP1Emp = await mint("partnerEmployee", p1Emp);
  const tS1 = await mint("supplier", s1);
  const tHqEmp = await mint("adminEmployee", hqEmp);

  /* ---- 1) Customers: only their own records (website routes) ---- */
  check((await call(`/api/v1/users/order-details/${oA.id}`, { token: tA })).status === 200, "customer reads own order");
  check((await call(`/api/v1/users/order-details/${oB.id}`, { token: tA })).status === 404, "customer cannot read another customer's order");
  const own = await call(`/api/v1/users/order-details/${oA.id}`, { token: tA });
  check(!("unitPrice" in (own.json?.data?.order?.items?.[0] || {})), "customer order payload has no internal unit-price fields");
  check((await call(`/api/v1/users/view-customer-detail/${A.id}`, { token: tA })).status === 200, "customer reads own profile");
  check((await call(`/api/v1/users/view-customer-detail/${B.id}`, { token: tA })).status === 404, "customer cannot read another customer's profile");
  let r = await call(`/api/v1/users/address/add-new/${B.id}`, { token: tA, method: "POST", body: { address: { streetAddress: "x" } } });
  check(r.status === 404, `customer cannot add an address to another customer (got ${r.status})`);
  r = await call(`/api/v1/users/drawer/update-profile`, { token: tA, method: "PUT", body: { addressId: addrB.id, addressData: { addressLineOne: "HACKED" } } });
  check(r.status === 404, `customer cannot edit another customer's address (got ${r.status})`);
  check((await address.findByPk(addrB.id, { raw: true })).addressLineOne === `${RUN} 1 Secret St`, "other customer's address unchanged");
  if (subB) {
    r = await call(`/api/v1/users/subscriptions/${subB.id}/cancel`, { token: tA, method: "POST" });
    check(r.status === 404, `customer cannot cancel another customer's subscription (got ${r.status})`);
    r = await call(`/api/v1/users/subscriptions/${subB.id}/reactivate`, { token: tA, method: "POST" });
    check(r.status === 404, `customer cannot reactivate another customer's subscription (got ${r.status})`);
  }

  /* ---- 2) Payments: Stripe-verified confirmation; pay links ---- */
  r = await call(`/api/v1/users/invoices/${oB.id}/confirm-payment`, { token: tA, method: "POST", body: { paymentIntentId: "pi_fakefakefake123", adminReceivableAmount: 0 } });
  check(r.status === 400 && (await orderRow(oB.id)).paymentStatus === "pending", `fake payment id must not mark paid (got ${r.status}, ${(await orderRow(oB.id)).paymentStatus})`);
  r = await call(`/api/v1/users/invoices/${oB.id}/confirm-payment`, { token: tA, method: "POST", body: { paymentIntentId: "not-a-pi" } });
  check(r.status === 400 && (await orderRow(oB.id)).paymentStatus === "pending", "invalid payment reference refused");
  r = await call(`/api/v1/users/invoices/${oB.id}/create-payment-intent`, { token: tA, method: "POST", body: {} });
  check(r.status === 404, `start payment for someone else's invoice without the link code must be 404 (got ${r.status})`);
  r = await call(`/api/v1/users/invoices/${oB.id}/create-payment-intent`, { token: tA, method: "POST", body: { t: oB.payToken } });
  check(passedGate(r), `start payment with the invoice's link code passes the gate (got ${r.status})`);
  const fetchInvoice = (id, body) => call(`/api/v1/admin/order-management/fetch-invoice/${id}`, { method: "POST", body: { orderType: "customer", ...body } });
  check((await fetchInvoice(oB.id, {})).status === 404, "guest without code cannot open a payment page");
  check((await fetchInvoice(oB.id, { t: "wrong-code-wrong-code-wrong-cod" })).status === 404, "guest with a wrong code cannot open a payment page");
  check(passedGate(await fetchInvoice(oB.id, { t: oB.payToken })), "guest with the link code can open the payment page (shareable)");
  check(passedGate(await fetchInvoice(oLegacy.id, {})), "old email link (no code) still works during the transition");
  check((await fetchInvoice(oA.id, {})).status === 404, "order number alone (not emailed before) opens nothing");
  // Backward compatibility: old links must never look broken.
  check(passedGate(await fetchInvoice(oLegacy.id, { t: "stale-or-mangled-code" })), "old link with a stray / mangled code still works");
  const oLegacyPaid = await makeOrder({ userId: B.id, invoiceDate: new Date(), payLinkLegacy: true, paymentStatus: "done" });
  r = await fetchInvoice(oLegacyPaid.id, {});
  check(r.status === 200 && r.json?.status === "already-paid", `old link to a paid invoice says "already paid" (got ${r.status} ${r.json?.status})`);
  const oNewPaid = await makeOrder({ userId: B.id, invoiceDate: new Date(), payToken: newPayToken(), paymentStatus: "done" });
  r = await fetchInvoice(oNewPaid.id, {});
  check(r.status === 200 && r.json?.status === "already-paid" && !Object.keys(r.json?.data || {}).length, `paid invoice without code says "already paid" and shows nothing else (got ${r.status} ${JSON.stringify(r.json)})`);
  const oLegacyNoDate = await makeOrder({ userId: B.id, payLinkLegacy: true });
  check(passedGate(await fetchInvoice(oLegacyNoDate.id, {})), "old link to an order without invoice date (copied from the website) still works");
  // In-page card payment needs a login (always has); a signed-in customer on an old link still passes.
  r = await call(`/api/v1/users/invoices/${oLegacy.id}/create-payment-intent`, { token: tA, method: "POST", body: {} });
  check(passedGate(r), `old link: in-page card payment still starts for a signed-in customer without a code (got ${r.status})`);
  // Email and PDF links carry the code; the PDF template uses it.
  const oFresh = await makeOrder({ userId: B.id, invoiceDate: new Date() });
  const link = await invoicePayUrl({ id: oFresh.id, orderOf: "customer" });
  const freshCode = (await orderRow(oFresh.id)).payToken;
  check(freshCode && link.includes(`orderId=${oFresh.id}`) && link.includes("orderType=customer") && link.includes(`t=${encodeURIComponent(freshCode)}`), `invoice link carries id, type and code (got ${link})`);
  check(passedGate(await fetchInvoice(oFresh.id, { t: new URL(link).searchParams.get("t") })), "the emailed / PDF link opens the payment page");
  check(link === (await invoicePayUrl({ id: oFresh.id, orderOf: "customer" })), "the code stays the same on resend (earlier emails keep working)");
  const pdfHtml = await ejs.renderFile(path.join(__dirname, "../views/invoice-template.ejs"), { order: { id: oFresh.id, items: [], user: {} }, admin: {}, payLink: link }).catch((e) => `render failed: ${e.message}`);
  check(pdfHtml.includes(link.replace(/&/g, "&amp;")), "invoice PDF's Pay Online link is the coded link");
  if (!pdfHtml.includes(link.replace(/&/g, "&amp;"))) console.log("[security-access] PDF render sample:", String(pdfHtml).slice(0, 200));
  // Invoice PDFs are never downloadable by URL (they used to be: /public/invoicePDFs/invoice-00<id>.pdf).
  {
    const fsx = require("fs");
    const dir = path.join(__dirname, "../public/invoicePDFs");
    const probe = "invoice-00probe-security-test.pdf";
    fsx.mkdirSync(dir, { recursive: true });
    fsx.writeFileSync(path.join(dir, probe), "%PDF-1.4 test");
    try {
      for (const url of [`/public/invoicePDFs/${probe}`, `/public/./invoicePDFs/${probe}`, `/public//invoicePDFs/${probe}`, `/public/INVOICEPDFS/${probe}`, `/public/%69nvoicePDFs/${probe}`, `/public/products/../invoicePDFs/${probe}`]) {
        // Raw request: fetch() would clean up ./ and ../ before sending.
        const status = await new Promise((resolve) => {
          const u = new URL(API);
          require("http").get({ host: u.hostname, port: u.port, path: url }, (r) => { r.resume(); resolve(r.statusCode); }).on("error", () => resolve(0));
        });
        const resp = { status };
        check(resp.status !== 200, `invoice PDF not downloadable: ${url} (got ${resp.status})`);
      }
      const img = fsx.readdirSync(path.join(__dirname, "../public/products")).find((f) => /.(jpe?g|png|webp)$/i.test(f));
      if (img) check((await fetch(`${API}/public/products/${img}`)).status === 200, "product images are still served");
    } finally {
      fsx.unlinkSync(path.join(dir, probe));
    }
  }
  // Emergency switch reopens by number (env read per request: checked by unit, not by restarting the API).
  {
    const prev = process.env.PAY_LINK_REQUIRE_CODE;
    process.env.PAY_LINK_REQUIRE_CODE = "false";
    const { invoicePayAccess } = require("../middlewares/invoicePayAccess");
    let passed = false;
    await new Promise((resolve) => {
      const req = { params: { orderId: oA.id }, body: { orderType: "customer" }, query: {}, headers: {} };
      const res = { status: () => ({ json: resolve }) };
      invoicePayAccess("orderId")(req, res, (err) => { passed = !err; resolve(); });
    });
    if (prev === undefined) delete process.env.PAY_LINK_REQUIRE_CODE; else process.env.PAY_LINK_REQUIRE_CODE = prev;
    check(passed, "PAY_LINK_REQUIRE_CODE=false lets an invoice open by number");
  }
  r = await call(`/api/v1/admin/order-management/fetch-invoice/${oA.id}`, { token: tA, method: "POST", body: { orderType: "customer" } });
  check(passedGate(r), `signed-in owner can open their own payment page without a code (got ${r.status})`);
  const detailsAdmin = await call(`/api/v1/admin/order-details/${oA.id}`, { token: tAdmin });
  check(typeof detailsAdmin.json?.data?.payUrl === "string" && /[?&]t=/.test(detailsAdmin.json.data.payUrl), "staff order details include the shareable pay link");

  /* ---- 3) Admin API by account type ---- */
  for (const [label, path] of [["orders list", "/orders?page=1&limit=5"], ["order details", `/order-details/${oB.id}`], ["customer balances", "/customer-management/invoice-customers-balance"], ["partner orders", "/partner-order/orders-list"]]) {
    r = await call(`/api/v1/admin${path}`, { token: tA });
    check(blocked(r), `customer token blocked from admin ${label} (got ${r.status})`);
  }
  r = await call(`/api/v1/admin/shipping-charges-on-weight/customer/${A.id}`, { token: tA, method: "POST", body: {} });
  check(passedGate(r), `customer may get their own checkout shipping cost (got ${r.status})`);
  r = await call(`/api/v1/admin/shipping-charges-on-weight/customer/${B.id}`, { token: tA, method: "POST", body: {} });
  check(r.status === 404, `customer cannot use another customer's id for shipping (got ${r.status})`);

  // Partner P1
  check((await call(`/api/v1/admin/order-details/${oC.id}`, { token: tP1 })).status === 200, "partner reads own customer's order");
  check((await call(`/api/v1/admin/order-details/${oD.id}`, { token: tP1 })).status === 404, "partner cannot read another partner's order");
  check((await call(`/api/v1/admin/order-details/${oB.id}`, { token: tP1 })).status === 404, "partner cannot read an HQ customer's order");
  check((await call(`/api/v1/admin/view-customer-detail/${C.id}`, { token: tP1 })).status === 200, "partner reads own customer");
  check((await call(`/api/v1/admin/view-customer-detail/${D.id}`, { token: tP1 })).status === 404, "partner cannot read another partner's customer");
  r = await call(`/api/v1/admin/orders?page=1&limit=50&type=all&salesRepId=${p2.id}`, { token: tP1 });
  const p1Ids = rowsOf(r).map((o) => Number(o.id));
  check(r.status === 200 && !p1Ids.includes(oD.id) && !p1Ids.includes(oB.id), "partner order list: never another partner's or HQ orders, even when asking for another partner");
  r = await call(`/api/v1/admin/order-cancel`, { token: tP1, method: "PATCH", body: { orderId: oD.id, orderData: { statusId: 6 } } });
  check(r.status === 404, `partner cannot change another partner's order status (got ${r.status})`);
  r = await call(`/api/v1/admin/edit-cheque`, { token: tP1, method: "PATCH", body: { chequeId: 0, cheque: {} } });
  check(r.status === 404, `partner cannot edit a cheque that isn't theirs (got ${r.status})`);
  r = await call(`/api/v1/admin/qbo/synced-orders-admin-before-march-2026`, { token: tP1 });
  check(r.status === 403, `partner blocked from HQ QuickBooks admin (got ${r.status})`);
  r = await call(`/api/v1/admin/customer-management/customer-list/employee-id/${p2Emp.id}`, { token: tP1 });
  check(r.status === 404, `partner cannot list another partner's employee's customers (got ${r.status})`);
  r = await call(`/api/v1/admin/customer-management/customer-list/sale-rep-id/${p2.id}`, { token: tP1 });
  check(!JSON.stringify(r.json || {}).includes(`${RUN}-D@`), "partner asking for another partner's customers gets only their own");
  // Partner employee: their screens send the employee id where the partner id goes
  const viaPartner = await call(`/api/v1/admin/order-navigation-counts/sales-rep/${p1.id}`, { token: tP1 });
  r = await call(`/api/v1/admin/order-navigation-counts/sales-rep/${p1Emp.id}`, { token: tP1Emp });
  check(r.status === 200 && JSON.stringify(r.json?.data) === JSON.stringify(viaPartner.json?.data), `partner employee's screen (employee id in the URL) gets their partner's figures (got ${r.status})`);
  const otherPartner = await call(`/api/v1/admin/order-navigation-counts/sales-rep/${p2.id}`, { token: tP1 });
  check(JSON.stringify(otherPartner.json?.data) === JSON.stringify(viaPartner.json?.data), "partner asking for another partner's figures gets their own");
  check((await call(`/api/v1/admin/order-details/${oD.id}`, { token: tP1Emp })).status === 404, "partner employee cannot read another partner's order");

  // Supplier S1
  r = await call(`/api/v1/admin/orders?page=1&limit=50&type=all&supplierId=999999`, { token: tS1 });
  const sIds = rowsOf(r).map((o) => Number(o.id));
  const asAdmin = await call(`/api/v1/admin/orders?page=1&limit=50&type=all&supplierId=${s1.id}`, { token: tAdmin });
  check(r.status === 200 && r.json?.pagination?.totalItems === asAdmin.json?.pagination?.totalItems && sIds.includes(oC.id) && !sIds.includes(oB.id), `supplier order list: exactly the orders assigned to them (got ${r.json?.pagination?.totalItems}, admin sees ${asAdmin.json?.pagination?.totalItems})`);
  check((await call(`/api/v1/admin/order-details/${oC.id}`, { token: tS1 })).status === 200, "supplier reads an order assigned to them");
  check((await call(`/api/v1/admin/order-details/${oB.id}`, { token: tS1 })).status === 404, "supplier cannot read an order not assigned to them");
  check((await call(`/api/v1/admin/view-customer-detail/${B.id}`, { token: tS1 })).status === 403, "supplier blocked from customer details");
  check((await call(`/api/v1/admin/customer-management/invoice-customers-balance`, { token: tS1 })).status === 403, "supplier blocked from customer balances");
  r = await call(`/api/v1/admin/order-dispatch`, { token: tS1, method: "PATCH", body: { orderId: oB.id, orderData: { statusId: 5 } } });
  check(r.status === 404, `supplier cannot dispatch an order not assigned to them (got ${r.status})`);
  r = await call(`/api/v1/admin/edit-order`, { token: tS1, method: "PATCH", body: { orderId: oC.id, orderData: { paymentStatus: "done" } } });
  check(r.status === 403 && (await orderRow(oC.id)).paymentStatus === "pending", `supplier cannot use edit-order / mark paid (got ${r.status})`);

  // Admin employee: full access; missing permission keys are only logged (log mode)
  check((await call(`/api/v1/admin/order-details/${oB.id}`, { token: tHqEmp })).status === 200, "admin employee unchanged (log mode)");
  // Admin unaffected
  check((await call(`/api/v1/admin/order-details/${oD.id}`, { token: tAdmin })).status === 200, "admin unaffected");

  /* ---- 4) Activity history: who did what, when; only for people who may see the order ---- */
  const tP2 = await mint("localPartner", p2);
  r = await call(`/api/v1/admin/order-management/update-order/${oC.id}`, {
    token: tAdmin,
    method: "PATCH",
    body: { items: [{ productId: 1, qty: 2 }], order: { shippingCharges: "10" }, typeCharges: [] },
  });
  check(r.status === 200, `admin edits partner customer's invoice (got ${r.status} ${r.json?.message})`);
  r = await call(`/api/v1/admin/order-management/update-tracking-number`, {
    token: tAdmin,
    method: "PATCH",
    body: { orderId: oC.id, orderType: "customer", trackingNumber: `TRK-${RUN}` },
  });
  r = await call(`/api/v1/admin/order-management/send-invoice/${oC.id}`, { token: tAdmin, method: "POST", body: { order: { orderId: oC.id } } });
  await new Promise((resolve) => setTimeout(resolve, 500)); // logs are written after the response
  const act = await call(`/api/v1/admin/order-management/activity/customer/${oC.id}`, { token: tAdmin });
  const actions = (act.json?.data?.entries || []).map((e) => e.action);
  check(act.status === 200 && actions.includes("invoice_edited"), `activity shows the invoice edit (got ${act.status} ${actions.join(",")})`);
  check(actions.includes("invoice_sent"), "activity shows the invoice send");
  check(actions.includes("tracking_updated"), "activity shows the tracking number update");
  const edited = (act.json?.data?.entries || []).find((e) => e.action === "invoice_edited");
  check(edited?.actor?.entity === "admin" && edited?.actor?.name && edited?.at && edited?.details?.after?.lines?.length === 1, "activity entry records who (admin + name), when, and the after lines");
  check((await call(`/api/v1/admin/order-management/activity/customer/${oC.id}`, { token: tP1 })).status === 200, "the order's partner can read its activity");
  check((await call(`/api/v1/admin/order-management/activity/customer/${oC.id}`, { token: tP2 })).status === 404, "another partner cannot read the activity");
  check(blocked(await call(`/api/v1/admin/order-management/activity/customer/${oC.id}`, { token: tA })), "a customer cannot read the activity");
  check((await call(`/api/v1/admin/order-management/activity/customer/${oC.id}`, { token: tS1 })).status === 403, "a supplier cannot read the activity");
  await sequelize.query("DELETE FROM orderActivityLogs WHERE orderId IN (:ids)", { replacements: { ids: created.orders } });
  await sequelize.query("DELETE FROM items WHERE orderId IN (:ids)", { replacements: { ids: created.orders } });

  /* ---- 5) Public form rate limit (shared 10/min per IP) ---- */
  let limited = false;
  for (let i = 0; i < 12 && !limited; i += 1) {
    const res = await call(`/api/v1/users/get-in-touch`, { method: "POST", body: {} });
    if (res.status === 429) limited = true;
  }
  check(limited, "contact / tasting form is rate limited");
}

async function cleanup() {
  for (const [entity, id, token] of tokens) {
    await redisClient.del(token).catch(() => {});
    await redisClient.sRem(`${entity}${id}`, token).catch(() => {});
  }
  if (created.subscriptions.length) await subscription.destroy({ where: { id: created.subscriptions }, force: true });
  if (created.addresses.length) await address.destroy({ where: { id: created.addresses }, force: true });
  await sequelize.query("DELETE FROM addresses WHERE userId IN (:ids)", { replacements: { ids: created.users.length ? created.users : [0] } });
  if (created.orders.length) await order.destroy({ where: { id: created.orders }, force: true });
  if (created.partnerOrders.length) await partnerOrder.destroy({ where: { id: created.partnerOrders }, force: true });
  if (created.employees.length) await employee.destroy({ where: { id: created.employees }, force: true });
  if (created.users.length) await user.destroy({ where: { id: created.users }, force: true });
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
      console.error(`[security-access] ${failures.length} failure(s)`);
      failures.forEach((f) => console.error(`  ✗ ${f}`));
      process.exitCode = 1;
    } else {
      console.log("[security-access] passed");
    }
    await redisClient.quit().catch(() => {});
    await sequelize.close().catch(() => {});
    // The in-process middleware check opens the app's own Redis client: don't wait for it.
    process.exit(process.exitCode || 0);
  });
