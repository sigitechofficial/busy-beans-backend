/**
 * Product & store events (Phase 16): server-side derivation of the product an event is about,
 * the signed-in customer id, and strict cleaning of commerce event metadata.
 *
 * Product pages on the website: /products/{name-slug}-{id} (canonical), /products/detail/{id},
 * /shop/{...}-{id}. The trailing digits are the commerce product id.
 */
const MAX_METADATA_BYTES = 16 * 1024;
const PRODUCT_ID = /^[\w-]{1,64}$/;

/** Website events about the store (all accepted from the public ingest). */
const COMMERCE_EVENT_TYPES = new Set([
  "view_item_list",
  "select_item",
  "add_to_cart",
  "remove_from_cart",
  "update_cart_qty",
  "view_cart",
  "begin_checkout",
  "login",
  "sign_up",
  "quote_requested",
]);

function productIdFromPath(pathname) {
  const clean = String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "");
  const m =
    clean.match(/^\/products\/detail\/(\d{1,20})$/) ||
    clean.match(/^\/products\/(?:[^/]*-)?(\d{1,20})$/) ||
    clean.match(/^\/shop\/(?:[^/]*-)?(\d{1,20})$/);
  return m ? m[1] : null;
}

function cleanProductId(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return PRODUCT_ID.test(s) ? s : null;
}

/** Account id of a signed-in customer (digits only), or null. */
function cleanCustomerId(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return /^\d{1,12}$/.test(s) ? s : null;
}

function str(value, max) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : undefined;
}

function qty(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? n : undefined;
}

function cleanItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const productId = cleanProductId(raw.productId ?? raw.id);
  if (!productId) return null;
  return dropUndefined({
    productId,
    name: str(raw.name, 200),
    category: str(raw.category, 100),
    qty: qty(raw.qty ?? raw.quantity) ?? 1,
    price: money(raw.price),
  });
}

function dropUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/**
 * Commerce event metadata is replaced by a whitelisted copy (other keys dropped); the site /
 * account fields added by the tracker are kept.
 */
function cleanCommerceMetadata(eventType, metadata) {
  const m = metadata && typeof metadata === "object" ? metadata : {};
  const keep = dropUndefined({
    site: str(m.site, 32),
    isAuthenticated: typeof m.isAuthenticated === "boolean" ? m.isAuthenticated : undefined,
    accountType: str(m.accountType, 16),
    customerUserId: cleanCustomerId(m.customerUserId) ?? undefined,
  });
  switch (eventType) {
    case "add_to_cart":
    case "remove_from_cart":
    case "select_item": {
      const item = cleanItem(m) || {};
      return dropUndefined({
        ...keep,
        ...item,
        value: money(m.value),
        list: str(m.list, 100),
        position: qty(m.position),
      });
    }
    case "update_cart_qty":
      return dropUndefined({ ...keep, productId: cleanProductId(m.productId) ?? undefined, from: qty(m.from), to: qty(m.to) });
    case "view_cart":
    case "begin_checkout": {
      const items = (Array.isArray(m.items) ? m.items : []).slice(0, 50).map(cleanItem).filter(Boolean);
      return dropUndefined({ ...keep, items, value: money(m.value) });
    }
    case "view_item_list":
      return dropUndefined({ ...keep, list: str(m.list, 100), category: str(m.category, 100), count: qty(m.count) });
    case "quote_requested":
      return dropUndefined({
        ...keep,
        productId: cleanProductId(m.productId) ?? undefined,
        name: str(m.name, 200),
        qty: qty(m.qty),
        formType: str(m.formType, 32),
      });
    case "login":
    case "sign_up":
      return dropUndefined({ ...keep, method: str(m.method, 32) });
    default:
      return m;
  }
}

/** Items stored with an order (productId, name, qty, lineTotal, categoryId). */
function cleanOrderItems(items) {
  if (!Array.isArray(items)) return null;
  const out = items
    .slice(0, 100)
    .map((raw) => {
      const productId = cleanProductId(raw?.productId ?? raw?.id);
      if (!productId) return null;
      return dropUndefined({
        productId,
        name: str(raw.name, 200),
        qty: qty(raw.qty ?? raw.quantity) ?? 1,
        lineTotal: money(raw.lineTotal ?? raw.price),
        categoryId: cleanProductId(raw.categoryId) ?? undefined,
      });
    })
    .filter(Boolean);
  return out.length ? out : null;
}

module.exports = {
  MAX_METADATA_BYTES,
  COMMERCE_EVENT_TYPES,
  productIdFromPath,
  cleanProductId,
  cleanCustomerId,
  cleanCommerceMetadata,
  cleanOrderItems,
};
