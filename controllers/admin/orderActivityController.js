/**
 * GET /api/v1/admin/order-management/activity/:orderType/:orderId  (orderType: customer | partner)
 *
 * One timeline per order: activity log (utils/orderActivity.js) + unit price changes
 * (orderItemPriceLogs), newest first. Access: HQ (sub-admins need order view permission) and the
 * order's local partner (middlewares/adminAccess.js); customers and suppliers never.
 */
const AppError = require("../../utils/appError");
const catchAsync = require("../../utils/catchAsync");
const { order, partnerOrder, orderActivityLog, orderItemPriceLog } = require("../../models");

const money = (n) => (n === null || n === undefined ? "—" : `$${Number(n).toFixed(2)}`);
const parse = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

exports.list = catchAsync(async (req, res, next) => {
  const { orderType, orderId } = req.params;
  if (!["customer", "partner"].includes(orderType)) {
    return next(new AppError("orderType must be customer or partner.", 400));
  }
  const isPartner = orderType === "partner";
  const exists = await (isPartner ? partnerOrder : order).findOne({ where: { id: orderId }, attributes: ["id"], raw: true });
  if (!exists) return next(new AppError("Order not found", 404));

  const activity = await orderActivityLog.findAll({
    where: isPartner ? { partnerOrderId: orderId } : { orderId },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: 500,
    raw: true,
  });
  const prices = isPartner
    ? []
    : await orderItemPriceLog.findAll({ where: { orderId }, order: [["createdAt", "DESC"], ["id", "DESC"]], limit: 500, raw: true });

  const entries = [
    ...activity.map((a) => ({
      id: `a${a.id}`,
      at: a.createdAt,
      action: a.action,
      summary: a.summary,
      details: parse(a.details),
      actor: { entity: a.actorEntity, id: a.actorId, name: a.actorName },
    })),
    ...prices.map((p) => ({
      id: `p${p.id}`,
      at: p.createdAt,
      action: `price_${p.action}`,
      summary:
        p.action === "reset"
          ? `Unit price reset to catalog for ${p.productName || `product ${p.productId}`}: ${money(p.oldUnitPrice)} → ${money(p.newUnitPrice)}`
          : `Unit price ${p.action === "set" ? "set" : "changed"} for ${p.productName || `product ${p.productId}`}: ${money(p.oldUnitPrice)} → ${money(p.newUnitPrice)} (catalog ${money(p.catalogUnitPrice)})`,
      details: { productId: p.productId, qty: p.qty, catalogUnitPrice: p.catalogUnitPrice, oldUnitPrice: p.oldUnitPrice, newUnitPrice: p.newUnitPrice },
      actor: { entity: p.changedByEntity, id: p.changedById, name: p.changedByName },
    })),
  ].sort((x, y) => new Date(y.at) - new Date(x.at) || String(y.id).localeCompare(String(x.id)));

  res.status(200).json({ status: "success", data: { entries } });
});
