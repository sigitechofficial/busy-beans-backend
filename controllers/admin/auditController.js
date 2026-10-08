/**
 * GET /api/v1/admin/audit/:entityPath/:entityId
 *   entityPath: customer · sales-rep · supplier · sub-admin · employee · product
 *
 * History of one record (utils/auditTrail.js), newest first. The paths reuse the permission
 * areas of those screens (sub-admins need view permission on that area); local partners only see
 * their own customers' history (middlewares/adminAccess.js); customers and suppliers never.
 */
const AppError = require("../../utils/appError");
const catchAsync = require("../../utils/catchAsync");
const { auditLog } = require("../../models");

const ENTITY_BY_PATH = {
  customer: "customer",
  "sales-rep": "partner",
  supplier: "supplier",
  "sub-admin": "subAdmin",
  employee: "employee",
  product: "product",
};

const parse = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

exports.list = catchAsync(async (req, res, next) => {
  const entityType = ENTITY_BY_PATH[req.params.entityPath];
  if (!entityType) return next(new AppError("Unknown history type.", 400));
  const rows = await auditLog.findAll({
    where: { entityType, entityId: req.params.entityId },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: 500,
    raw: true,
  });
  res.status(200).json({
    status: "success",
    data: {
      entries: rows.map((r) => ({
        id: r.id,
        at: r.createdAt,
        action: r.action,
        summary: r.summary,
        changes: parse(r.changes),
        actor: { entity: r.actorEntity, id: r.actorId, name: r.actorName },
      })),
    },
  });
});
