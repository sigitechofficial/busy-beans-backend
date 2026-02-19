const { emailLog } = require("../../models");
const { Op } = require("sequelize");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { response } = require("../../utils/response");

/**
 * GET /api/v1/admin/order-management/email-log
 * List email log (success and/or failed) with optional filters.
 * Query: emailType, orderId, emailSent (Success|Failed), from (date YYYY-MM-DD), to (date YYYY-MM-DD), page, limit
 */
exports.getEmailLog = catchAsync(async (req, res, next) => {
  const {
    emailType,
    orderId,
    partnerOrderId,
    emailSent,
    from,
    to,
    page = 1,
    limit = 20,
  } = req.query;

  const where = {};

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
  const output = response({ data: log });
  res.status(200).json(output);
});
