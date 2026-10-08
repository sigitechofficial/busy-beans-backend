/**
 * Customer-facing routes (/api/v1/users/*) that take a customer / order / address id from the
 * request: a customer may only reach their own records. Staff keep their access (HQ: any customer;
 * local partner and partner employee: only their own customers); suppliers never.
 *
 * Unknown or foreign records answer 404 (never "exists but forbidden"), so ids can't be probed.
 */
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { user, order, address, billingAddress } = require("../models");

const HQ = ["admin", "subAdmin", "adminEmployee"];
const PARTNER = ["localPartner", "partnerEmployee"];

const notFound = (what) => new AppError(`${what} not found`, 404);

/** May this account act for customer `customerId`? */
async function canActForCustomer(reqUser, customerId) {
  if (!reqUser || !customerId) return false;
  if (reqUser.entity === "user") return String(reqUser.id) === String(customerId);
  if (HQ.includes(reqUser.entity)) return true;
  if (PARTNER.includes(reqUser.entity)) {
    const customer = await user.findOne({ where: { id: customerId }, attributes: ["salesRepId"], raw: true });
    return Boolean(customer) && Number(customer.salesRepId) === Number(reqUser.localPartnerId);
  }
  return false;
}

/** May this account see / pay order `orderRow` (customer order or partner order)? */
function canActForOrder(reqUser, orderRow, { partnerOrder: isPartnerOrder = false } = {}) {
  if (!reqUser || !orderRow) return false;
  if (HQ.includes(reqUser.entity)) return true;
  if (PARTNER.includes(reqUser.entity)) return Number(orderRow.salesRepId) === Number(reqUser.localPartnerId);
  if (reqUser.entity === "user") return !isPartnerOrder && String(orderRow.userId) === String(reqUser.id);
  return false;
}

/** :id (or another param) is a customer id: only that customer, their partner, or HQ. */
const ownCustomerParam = (param = "id") =>
  catchAsync(async (req, res, next) => {
    if (!(await canActForCustomer(req.user, req.params[param]))) return next(notFound("Customer"));
    next();
  });

/** :id (or another param) is a customer order id. */
const ownOrderParam = (param = "id") =>
  catchAsync(async (req, res, next) => {
    const row = await order.findOne({
      where: { id: req.params[param] },
      attributes: ["id", "userId", "salesRepId"],
      raw: true,
    });
    if (!canActForOrder(req.user, row)) return next(notFound("Order"));
    next();
  });

/**
 * Booking / checkout: the customer is the signed-in customer. Staff booking for a customer must be
 * allowed to act for that customer.
 */
const ownCustomerInBody = catchAsync(async (req, res, next) => {
  if (req.user?.entity === "user") {
    req.body = req.body || {};
    req.body.order = { ...(req.body.order || {}), userId: req.user.id };
    return next();
  }
  if (!(await canActForCustomer(req.user, req.body?.order?.userId))) return next(notFound("Customer"));
  next();
});

/** Profile update: the shipping / billing address ids in the body must belong to the customer. */
const ownProfileAddresses = catchAsync(async (req, res, next) => {
  const me = req.user?.id;
  if (req.body?.addressId) {
    const row = await address.findOne({ where: { id: req.body.addressId }, attributes: ["userId"], raw: true });
    if (!row || String(row.userId) !== String(me)) return next(notFound("Address"));
  }
  if (req.body?.billingAddressId) {
    const row = await billingAddress.findOne({ where: { id: req.body.billingAddressId }, attributes: ["userId"], raw: true });
    if (!row || String(row.userId) !== String(me)) return next(notFound("Address"));
  }
  next();
});

module.exports = {
  canActForCustomer,
  canActForOrder,
  ownCustomerParam,
  ownOrderParam,
  ownCustomerInBody,
  ownProfileAddresses,
};
