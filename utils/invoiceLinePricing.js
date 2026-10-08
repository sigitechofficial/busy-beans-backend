/**
 * Product lines of a customer invoice when it is edited (manageOrderController.updateOrder).
 *
 * Each line is one of:
 *   catalog  — new line (or "reset to catalog"): list price (product, or the local partner's price
 *              list) minus the customer's category discount, as at order booking
 *   kept     — existing line the editor did not re-price: keeps the price it was saved with (a custom
 *              price stays custom, whoever edits the invoice later)
 *   override — custom unit price typed by a user with the "Edit unit price" permission: final price,
 *              no category discount on top; never below the partner's wholesale for a dropship
 *              partner's customer (the partner's commission would go negative)
 *
 * items.price stays the line total (what Stripe, QuickBooks and the PDF read); items.unitPrice /
 * priceOverride / catalogUnitPrice describe how it was priced.
 */
/** Sub-admin keys: HQ (admin) customers' invoices, local partners' customers' invoices; the plain key = both. */
const PRICE_EDIT_PERMISSION = "invoice_edit-price";
const PRICE_EDIT_CUSTOMER = "invoice_edit-price-customer";
const PRICE_EDIT_PARTNER = "invoice_edit-price-partner";
const MAX_UNIT_PRICE = 999999.99;
const MAX_QTY = 100000;

class PricingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const cents = (n) => Math.round(Number(n) * 100);
const sameCents = (a, b) => cents(a) === cents(b);
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const money = (n) => `$${(Math.round(Number(n) * 100) / 100).toFixed(2)}`;

/**
 * HQ admin always; sub-admins with the permission for that kind of customer (admin customer or a
 * local partner's customer); nobody else (employees, partners).
 */
function canEditUnitPrice(user, { partnerCustomer = false } = {}) {
  if (!user) return false;
  if (user.entity === "admin") return true;
  if (user.entity !== "subAdmin") return false;
  const keys = Array.isArray(user.permissionKeys)
    ? user.permissionKeys
    : (user.permissions || []).map((p) => p?.key).filter(Boolean);
  return keys.includes(PRICE_EDIT_PERMISSION) || keys.includes(partnerCustomer ? PRICE_EDIT_PARTNER : PRICE_EDIT_CUSTOMER);
}

/** Catalog unit price (list price minus the customer's category discount) of a product row. */
const catalogUnitPriceOf = (row) => {
  const list = Number(row?.price || 0);
  return round2(list - (list * Number(row?.discountPercentage || 0)) / 100);
};

const isDropshipPartner = ({ salesRepId, partnerType }) => Boolean(salesRepId) && partnerType !== "direct-partner";

/** Lowest custom unit price allowed for a product on this order (null = only the $0.01 floor). */
function minUnitPrice(order, wholesaleUnit) {
  if (!isDropshipPartner(order)) return null;
  const w = Number(wholesaleUnit);
  return Number.isFinite(w) && w > 0 ? round2(w) : null;
}

/** undefined = not given; number = valid; throws on anything else. */
function parseUnitPrice(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new PricingError(`Unit price for ${label} must be a number.`);
  if (n < 0.01) throw new PricingError(`Unit price for ${label} must be at least $0.01.`);
  if (n > MAX_UNIT_PRICE) throw new PricingError(`Unit price for ${label} is too high.`);
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
    throw new PricingError(`Unit price for ${label} can have at most 2 decimals.`);
  }
  return round2(n);
}

function parseQty(value, label) {
  const raw = value === undefined || value === null || value === "" ? 1 : value;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_QTY) {
    throw new PricingError(`Quantity for ${label} must be a whole number of at least 1.`);
  }
  return n;
}

/**
 * @param {object} args
 * @param {Array}  args.inputItems    [{ id?, productId, qty, unitPrice?, resetPrice? }] from the screen
 * @param {Map}    args.products      productId → { id, name, price, wholesalePrice, discountPercentage, weight, categoryId }
 * @param {Array}  args.existingLines current product lines of the order (plain rows)
 * @param {object} args.order         { salesRepId, partnerType }
 * @param {boolean} args.canEdit      user may set custom unit prices
 * @returns {{ lines: object[], changes: object[], totals: { itemsPrice, discount, weight, commission } }}
 */
function priceInvoiceLines({ inputItems, products, existingLines = [], order, canEdit }) {
  const unmatched = [...existingLines];
  const takeExisting = (input) => {
    let idx = -1;
    if (input.id !== undefined && input.id !== null && input.id !== "") {
      idx = unmatched.findIndex((l) => Number(l.id) === Number(input.id) && Number(l.productId) === Number(input.productId));
    }
    if (idx === -1) idx = unmatched.findIndex((l) => Number(l.productId) === Number(input.productId));
    return idx === -1 ? null : unmatched.splice(idx, 1)[0];
  };
  const denied = () => new PricingError("You don't have permission to change unit prices.", 403);

  const lines = [];
  const changes = [];
  const totals = { itemsPrice: 0, discount: 0, weight: 0, commission: 0 };

  for (const input of inputItems) {
    const product = products.get(Number(input.productId));
    if (!product) throw new PricingError(`Product ${input.productId} no longer exists. Remove it from the invoice.`);
    const label = product.name || `product ${product.id}`;
    const qty = parseQty(input.qty, label);
    const requested = parseUnitPrice(input.unitPrice, label);
    const existing = takeExisting(input);

    const listUnit = Number(product.price || 0);
    const discountPct = Number(product.discountPercentage || 0);
    const catalogUnit = listUnit - (listUnit * discountPct) / 100;
    const catalogWholesaleUnit = Number(product.wholesalePrice || 0);

    const oldQty = existing ? Math.max(1, Number(existing.qty) || 1) : null;
    const wasOverride = Boolean(existing?.priceOverride);
    const savedUnit = existing
      ? wasOverride && existing.unitPrice !== null && existing.unitPrice !== undefined
        ? Number(existing.unitPrice)
        : Number(existing.price || 0) / oldQty
      : null;

    let mode;
    let action = null;
    if (input.resetPrice === true) {
      if (wasOverride && !canEdit) throw denied();
      mode = "catalog";
      if (wasOverride) action = "reset";
    } else if (requested !== undefined) {
      if (existing && sameCents(requested, savedUnit)) {
        mode = "kept";
      } else if (sameCents(requested, catalogUnit)) {
        if (wasOverride && !canEdit) throw denied();
        mode = "catalog";
        if (wasOverride) action = "reset";
      } else {
        if (!canEdit) throw denied();
        mode = "override";
        action = wasOverride ? "changed" : "set";
      }
    } else {
      mode = existing ? "kept" : "catalog";
    }

    let price;
    let discount;
    let wholesaleUnit;
    let unitPrice;
    let priceOverride;
    if (mode === "catalog") {
      const gross = listUnit * qty;
      discount = (gross * discountPct) / 100;
      price = gross - discount;
      wholesaleUnit = catalogWholesaleUnit;
      unitPrice = round2(price / qty);
      priceOverride = false;
    } else if (mode === "kept") {
      const savedWholesaleUnit = Number(existing.wholesalePrice || 0) / oldQty;
      if (qty === oldQty) {
        price = Number(existing.price || 0);
        discount = Number(existing.discount || 0);
      } else {
        price = round2(savedUnit * qty);
        discount = round2((Number(existing.discount || 0) / oldQty) * qty);
      }
      wholesaleUnit = savedWholesaleUnit;
      priceOverride = wasOverride;
      unitPrice = wasOverride ? round2(savedUnit) : round2(price / qty);
    } else {
      const min = minUnitPrice(order, catalogWholesaleUnit);
      if (min !== null && cents(requested) < cents(min)) {
        throw new PricingError(`Minimum unit price for ${label} is ${money(min)} (the partner's wholesale price).`);
      }
      price = round2(requested * qty);
      discount = 0;
      wholesaleUnit = catalogWholesaleUnit;
      unitPrice = requested;
      priceOverride = true;
    }

    const line = {
      productId: product.id,
      categoryId: product.categoryId,
      qty,
      price,
      discount,
      weight: Number(product.weight || 0) * qty,
      unitPrice,
      priceOverride,
      catalogUnitPrice: round2(catalogUnit),
    };
    if (order.salesRepId) {
      if (order.partnerType === "direct-partner") {
        line.salerCommission = price;
        line.wholesalePrice = 0;
      } else {
        line.wholesalePrice = wholesaleUnit * qty;
        line.salerCommission = price - line.wholesalePrice;
      }
    } else {
      line.wholesalePrice = 0;
      line.salerCommission = 0;
    }
    lines.push(line);

    totals.itemsPrice += price;
    totals.discount += discount;
    totals.weight += line.weight;
    totals.commission += line.salerCommission;

    if (action) {
      changes.push({
        productId: product.id,
        productName: product.name || null,
        qty,
        action,
        catalogUnitPrice: round2(catalogUnit),
        oldUnitPrice: existing ? round2(savedUnit) : null,
        newUnitPrice: unitPrice,
      });
    }
  }

  return { lines, changes, totals };
}

module.exports = {
  PRICE_EDIT_PERMISSION,
  PRICE_EDIT_CUSTOMER,
  PRICE_EDIT_PARTNER,
  catalogUnitPriceOf,
  PricingError,
  canEditUnitPrice,
  minUnitPrice,
  priceInvoiceLines,
  parseUnitPrice,
};
