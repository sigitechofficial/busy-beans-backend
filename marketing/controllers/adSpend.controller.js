const catchAsync = require("../../utils/catchAsync");
const adSpend = require("../services/adSpend.service");
const { rangeFromQuery } = require("../utils/reportQuery");
const { sendData, sendError } = require("../utils/httpResponses");

/** Ad spend entered by the marketing team (Acquisition › Ad spend). See services/adSpend.service.js. */

const ID = /^\d{1,10}$/;
const handle = (fn) =>
  catchAsync(async (req, res) => {
    try {
      return await fn(req, res);
    } catch (error) {
      if (error.code === "VALIDATION_ERROR") return sendError(res, 400, error.message, "VALIDATION_ERROR");
      throw error;
    }
  });

/** GET /admin/analytics/ad-spend?range|from&to — entries overlapping the period (+ their share of it); no period = all. */
exports.list = handle(async (req, res) => {
  const range = req.query.range || req.query.from || req.query.to ? rangeFromQuery(req.query) : null;
  const entries = await adSpend.listEntries(range ? { fromDay: range.fromDay, toDay: range.toDay } : {});
  const rows = range ? entries.map((e) => ({ ...e, inPeriod: adSpend.allocated(e, range) })) : entries;
  const total = Math.round(rows.reduce((s, e) => s + (range ? e.inPeriod : e.amount), 0) * 100) / 100;
  return sendData(res, 200, {
    entries: rows,
    total,
    period: range ? { timeZone: range.tz, preset: range.preset, from: range.fromDay || null, to: range.toDay || null } : null,
  });
});

/** POST /admin/analytics/ad-spend { source, medium?, campaign, periodStart, periodEnd, amount, notes? } */
exports.create = handle(async (req, res) => {
  const entry = await adSpend.createEntry(req.body || {}, { userId: req.marketingUser?.sub || req.marketingUser?.id });
  return sendData(res, 201, entry);
});

/** PATCH /admin/analytics/ad-spend/:id (any of the create fields) */
exports.update = handle(async (req, res) => {
  if (!ID.test(req.params.id)) return sendError(res, 400, "Invalid id.", "VALIDATION_ERROR");
  const entry = await adSpend.updateEntry(req.params.id, req.body || {});
  if (!entry) return sendError(res, 404, "Spend entry not found.", "NOT_FOUND");
  return sendData(res, 200, entry);
});

/** DELETE /admin/analytics/ad-spend/:id */
exports.remove = handle(async (req, res) => {
  if (!ID.test(req.params.id)) return sendError(res, 400, "Invalid id.", "VALIDATION_ERROR");
  const ok = await adSpend.deleteEntry(req.params.id);
  if (!ok) return sendError(res, 404, "Spend entry not found.", "NOT_FOUND");
  return sendData(res, 200, { deleted: true });
});
