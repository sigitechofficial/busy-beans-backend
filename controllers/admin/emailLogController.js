const { emailLog, order, partnerOrder } = require("../../models");
const { Op, literal } = require("sequelize");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { response } = require("../../utils/response");

const LOCAL_PARTNER_ENTITIES = ["localPartner", "partnerEmployee"];

function isLocalPartnerUser(req) {
  return (
    !!req.user?.localPartnerId &&
    LOCAL_PARTNER_ENTITIES.includes(req.user?.entity)
  );
}

function buildSalesRepEmailLogFilter(salesRepId) {
  const repId = Number(salesRepId);
  if (!Number.isInteger(repId) || repId <= 0) {
    return { id: { [Op.is]: null } };
  }

  return {
    [Op.or]: [
      {
        orderId: {
          [Op.in]: literal(
            `(SELECT id FROM orders WHERE salesRepId = ${repId})`,
          ),
        },
      },
      {
        partnerOrderId: {
          [Op.in]: literal(
            `(SELECT id FROM partnerOrders WHERE salesRepId = ${repId})`,
          ),
        },
      },
    ],
  };
}

async function assertEmailLogAccessibleToSalesRep(log, salesRepId) {
  if (log.orderId) {
    const owned = await order.findOne({
      where: { id: log.orderId, salesRepId },
      attributes: ["id"],
      raw: true,
    });
    return !!owned;
  }
  if (log.partnerOrderId) {
    const owned = await partnerOrder.findOne({
      where: { id: log.partnerOrderId, salesRepId },
      attributes: ["id"],
      raw: true,
    });
    return !!owned;
  }
  return false;
}

/**
 * GET /api/v1/admin/order-management/email-log
 * List email log (success and/or failed) with optional filters.
 * Local partners only see logs for orders / partner orders under their salesRepId.
 * Query: emailType, orderId, emailSent (Success|Failed), retrySuccess (true|false|null), from (date YYYY-MM-DD), to (date YYYY-MM-DD), page, limit
 */
exports.getEmailLog = catchAsync(async (req, res, next) => {
  const {
    emailType,
    orderId,
    partnerOrderId,
    emailSent,
    retrySuccess,
    from,
    to,
    page = 1,
    limit = 20,
  } = req.query;

  const where = {};

  if (isLocalPartnerUser(req)) {
    Object.assign(where, buildSalesRepEmailLogFilter(req.user.localPartnerId));
  }

  if (emailType) {
    where.emailType = emailType;
  }
  if (orderId) {
    where.orderId = Number(orderId);
  }
  if (partnerOrderId) {
    where.partnerOrderId = Number(partnerOrderId);
  }
  if (emailSent) {
    where.emailSent = emailSent;
  }
  if (retrySuccess !== undefined && retrySuccess !== "") {
    const normalized = String(retrySuccess).toLowerCase();
    if (normalized === "true" || normalized === "1") {
      where.retrySuccess = true;
    } else if (normalized === "false" || normalized === "0") {
      where.retrySuccess = false;
    } else if (normalized === "null" || normalized === "initial") {
      where.retrySuccess = { [Op.is]: null };
    } else {
      return next(
        new AppError(
          "Invalid retrySuccess. Use true, false, or null (initial send).",
          400,
        ),
      );
    }
  }
  if (from || to) {
    where.sentAt = {};
    if (from) where.sentAt[Op.gte] = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.sentAt[Op.lte] = toDate;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const { count, rows } = await emailLog.findAndCountAll({
    where,
    order: [["sentAt", "DESC"]],
    limit: limitNum,
    offset,
    raw: true,
  });

  const output = response({
    data: {
      emailLogs: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    },
  });
  res.status(200).json(output);
});

/**
 * GET /api/v1/admin/order-management/email-log/:id
 * Get a single email log entry by id.
 */
exports.getEmailLogById = catchAsync(async (req, res, next) => {
  const log = await emailLog.findByPk(req.params.id, { raw: true });
  if (!log) {
    return next(new AppError("Email log entry not found", 404));
  }

  if (isLocalPartnerUser(req)) {
    const allowed = await assertEmailLogAccessibleToSalesRep(
      log,
      req.user.localPartnerId,
    );
    if (!allowed) {
      return next(new AppError("Email log entry not found", 404));
    }
  }

  const output = response({ data: log });
  res.status(200).json(output);
});
