/**
 * Phase 17 access contract (local API only): prices only for signed-in customers, admin catalog and
 * subscription APIs closed to guests and customers, job endpoints behind the job key.
 *
 *   node scripts/productAccessTest.js            (API on API_TEST_URL, default http://localhost:8013)
 *
 * Creates a temporary customer, mints short-lived local tokens (admin + customer) straight into
 * Redis the way login does, and removes all of it at the end. Job-key checks run only when the API
 * was started with INTERNAL_JOB_API_KEY and the same value is in this process's env.
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { user, account, subscription, sequelize } = require("../models");

// The API started with local.js uses REDIS_HOST / REDIS_PORT; tokens are stored like login does.
const redisClient = redis.createClient({
  socket: {
    host: String(process.env.REDIS_HOST || "localhost").replace(/['";]/g, ""),
    port: Number(String(process.env.REDIS_PORT || "6379").replace(/['";]/g, "")) || 6379,
  },
});

const API = (process.env.API_TEST_URL || "http://localhost:8013").replace(/\/+$/, "");
const FORBIDDEN_KEYS = ["price", "wholesalePrice", "sku", "quantity", "productCode", "pricePer"];
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function request(path, { token, method = "GET", headers = {}, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
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

/** Allowed: 2xx with status "success". Refused: 401/403, or restrictTo's 200 { status: "fail" }. */
function refused(r) {
  return r.status === 401 || r.status === 403 || r.status === 404 || (r.status === 200 && r.json?.status === "fail");
}

function keysDeep(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
}

async function mintToken(entity, record) {
  const token = jwt.sign({ id: record.id, email: record.email, entity }, process.env.JWT_SECRET, { expiresIn: "10m" });
  await redisClient.set(token, `${entity}${record.id}`, { EX: 600 });
  await redisClient.sAdd(`${entity}${record.id}`, token);
  return token;
}

async function run() {
  await redisClient.connect();
  const admin = await account.findOne({ where: { deleted: 0, status: 1 }, order: [["id", "ASC"]] });
  if (!admin) throw new Error("No active admin account in the local DB");
  const stamp = Date.now();
  const customer = await user.create(
    { name: "Access Test", email: `access-test-${stamp}@example.test`, status: 1, deleted: 0 },
    { hooks: false },
  );
  const tokens = [];
  try {
    const adminToken = await mintToken("admin", admin);
    const customerToken = await mintToken("user", customer);
    tokens.push(["admin", admin.id, adminToken], ["user", customer.id, customerToken]);

    // 1) Admin product list / detail: guests 401, customers refused, staff get prices.
    const guestList = await request("/api/v1/admin/product?limit=2");
    check(guestList.status === 401, `admin/product without token must be 401 (got ${guestList.status})`);
    const customerList = await request("/api/v1/admin/product?limit=2", { token: customerToken });
    check(refused(customerList), `admin/product with a customer token must be refused (got ${customerList.status} ${customerList.json?.status})`);
    const adminList = await request("/api/v1/admin/product?limit=2", { token: adminToken });
    const adminRows = adminList.json?.data?.data || [];
    check(adminList.status === 200 && adminRows.length > 0 && "price" in adminRows[0], "admin/product with an admin token must return products with prices");
    const productId = adminRows[0]?.id;
    const customerDetail = await request(`/api/v1/admin/product/${productId}`, { token: customerToken });
    check(refused(customerDetail), `admin/product/:id with a customer token must be refused (got ${customerDetail.status})`);
    for (const path of ["/api/v1/admin/products/sales-rep", "/api/v1/admin/products/sales-rep/import"]) {
      const r = await request(path, { token: customerToken });
      check(refused(r), `${path} with a customer token must be refused (got ${r.status} ${r.json?.status})`);
    }

    // 2) Catalog writes: customers refused (nothing is changed: the guard runs before the handler).
    const writes = [
      ["POST", "/api/v1/admin/product"],
      ["PATCH", `/api/v1/admin/product/${productId}`],
      ["DELETE", `/api/v1/admin/product/${productId}`],
      ["POST", "/api/v1/admin/category/"],
      ["PATCH", "/api/v1/admin/category/1"],
      ["DELETE", "/api/v1/admin/category/1"],
    ];
    for (const [method, path] of writes) {
      const r = await request(path, { token: customerToken, method, body: {} });
      check(refused(r), `${method} ${path} with a customer token must be refused (got ${r.status} ${r.json?.status})`);
    }

    // 3) Public catalog: no price-like keys anywhere; only active products.
    const pubList = await request("/api/v1/public/catalog/products?limit=100");
    const pubRows = pubList.json?.data?.data || [];
    check(pubList.status === 200 && pubRows.length > 0, "public catalog must list products");
    const pubDetail = await request(`/api/v1/public/catalog/products/${pubRows[0]?.id}`);
    const pubCats = await request("/api/v1/public/catalog/categories");
    for (const [label, r] of [["list", pubList], ["detail", pubDetail], ["categories", pubCats]]) {
      const leaked = FORBIDDEN_KEYS.filter((k) => keysDeep(r.json).has(k));
      check(leaked.length === 0, `public catalog ${label} must not contain ${leaked.join(", ")}`);
    }
    const [{ active }] = await sequelize.query(
      "SELECT COUNT(*) AS active FROM products p JOIN categories c ON c.id = p.categoryId AND c.status = 1 AND c.deleted = 0 WHERE p.status = 1 AND p.deleted = 0 AND p.deletedAt IS NULL",
      { type: sequelize.QueryTypes.SELECT },
    );
    check(Number(pubList.json?.pagination?.totalItems) === Number(active), `public catalog total ${pubList.json?.pagination?.totalItems} must equal active products ${active}`);
    const inactive = await sequelize.query("SELECT id FROM products WHERE status = 0 AND deletedAt IS NULL LIMIT 1", {
      type: sequelize.QueryTypes.SELECT,
    });
    if (inactive[0]) {
      const r = await request(`/api/v1/public/catalog/products/${inactive[0].id}`);
      check(r.status === 404, `inactive product ${inactive[0].id} must be 404 in the public catalog (got ${r.status})`);
    }
    check((await request("/api/v1/public/catalog/products/999999999")).status === 404, "unknown product must be 404");

    // 4) Signed-in customers still get their prices from the customer API.
    const priced = await request("/api/v1/users/product?limit=5", { token: customerToken });
    check(priced.status === 200 && (priced.json?.data?.data || []).every((p) => p.price !== undefined), "users/product must return prices to a customer");
    check((await request("/api/v1/users/product?limit=5")).status === 401, "users/product without token must be 401");

    // 5) Machines: never a price on the public endpoints (the website does not show them).
    for (const token of [undefined, customerToken, adminToken]) {
      const r = await request("/api/v1/users/coffee-machine", { token });
      const leaked = ["price", "pricePer"].filter((k) => keysDeep(r.json).has(k));
      check(r.status === 200 && leaked.length === 0, `users/coffee-machine must not return ${leaked.join(", ")} (token: ${token ? "yes" : "no"})`);
    }

    // 6) Subscription management: staff only.
    check((await request("/api/v1/subscription/list")).status === 401, "subscription/list without token must be 401");
    const subCustomer = await request("/api/v1/subscription/list", { token: customerToken });
    check(refused(subCustomer), `subscription/list with a customer token must be refused (got ${subCustomer.status} ${subCustomer.json?.status})`);
    const subAdmin = await request("/api/v1/subscription/list", { token: adminToken });
    check(subAdmin.status === 200 && subAdmin.json?.status !== "fail", `subscription/list with an admin token must work (got ${subAdmin.status})`);
    const addonsAdmin = await request("/api/v1/subscription/addons", { token: adminToken });
    check(addonsAdmin.status === 200 && addonsAdmin.json?.status !== "fail", `subscription/addons with an admin token must work (got ${addonsAdmin.status})`);

    // 7) Customer subscription routes: signed in, and only the customer's own (or unassigned).
    const other = await subscription.findOne({ where: { userId: { [require("sequelize").Op.ne]: null } }, attributes: ["id", "userId"] });
    const anyId = other?.id || 1;
    check((await request(`/api/v1/users/subscription/${anyId}`)).status === 401, "users/subscription/:id without token must be 401");
    if (other) {
      const r = await request(`/api/v1/users/subscription/${other.id}`, { token: customerToken });
      check(r.status === 404, `another customer's subscription must be 404 (got ${r.status})`);
      const pi = await request(`/api/v1/users/subscription/${other.id}/create-payment-intent/${other.userId}`, { token: customerToken });
      check(pi.status === 404, `payment intent for someone else's subscription must be 404 (got ${pi.status})`);
      const staff = await request(`/api/v1/users/subscription/${other.id}`, { token: adminToken });
      check(staff.status === 200, `staff may open any subscription on the customer route (got ${staff.status})`);
    } else {
      console.log("[product-access] no subscription with a customer in the local DB: ownership check skipped");
    }
    const wrongUser = await request(`/api/v1/users/subscription/${anyId}/create-payment-intent/${customer.id + 1}`, { token: customerToken });
    check(wrongUser.status === 404, `payment intent for another :userId must be 404 (got ${wrongUser.status})`);

    // 8) Job endpoints: job key or staff token.
    const jobPath = "/api/v1/admin/order-management/pending-pdfs-list";
    const customerJob = await request(jobPath, { token: customerToken });
    check(customerJob.status === 403, `job endpoint with a customer token must be 403 (got ${customerJob.status})`);
    const staffJob = await request(jobPath, { token: adminToken });
    check(staffJob.status === 200, `job endpoint with an admin token must work (got ${staffJob.status})`);
    if (process.env.INTERNAL_JOB_API_KEY) {
      check((await request(jobPath)).status === 401, "job endpoint without key must be 401 when the key is set");
      check((await request(jobPath, { headers: { "x-job-key": "wrong" } })).status === 401, "job endpoint with a wrong key must be 401");
      const keyed = await request(jobPath, { headers: { "x-job-key": process.env.INTERNAL_JOB_API_KEY } });
      check(keyed.status === 200, `job endpoint with the key must work (got ${keyed.status})`);
    } else {
      console.log("[product-access] INTERNAL_JOB_API_KEY not set here: job-key checks skipped");
    }
  } finally {
    for (const [entity, id, token] of tokens) {
      await redisClient.del(token).catch(() => {});
      await redisClient.sRem(`${entity}${id}`, token).catch(() => {});
    }
    await customer.destroy({ force: true, hooks: false });
  }

  if (failures.length) {
    console.error(`[product-access] ${failures.length} failed:\n - ${failures.join("\n - ")}`);
    process.exit(1);
  }
  console.log("[product-access] passed");
  process.exit(0);
}

run().catch((error) => {
  console.error("[product-access] error:", error.message);
  process.exit(1);
});
