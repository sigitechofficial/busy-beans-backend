const catchAsync = require("../../utils/catchAsync");
const leadSubmissionsAdminService = require("../services/leadSubmissionsAdmin.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.list = catchAsync(async (req, res) => {
  const includeTest = req.query.includeTest === "true" || req.query.includeTest === "1";
  const data = await leadSubmissionsAdminService.listLeads({ includeTest });
  return sendData(res, 200, data);
});

exports.getById = catchAsync(async (req, res) => {
  const row = await leadSubmissionsAdminService.getLeadById(req.params.id);
  if (!row) return sendError(res, 404, "Lead not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.update = catchAsync(async (req, res) => {
  try {
    const row = await leadSubmissionsAdminService.updateLead(
      req.params.id,
      req.body || {},
    );
    if (!row) return sendError(res, 404, "Lead not found.", "NOT_FOUND");
    return sendData(res, 200, row);
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    return sendError(res, 500, "Failed to update lead.", "INTERNAL_ERROR");
  }
});

exports.remove = catchAsync(async (req, res) => {
  const result = await leadSubmissionsAdminService.deleteLead(req.params.id);
  if (!result.deleted) return sendError(res, 404, "Lead not found.", "NOT_FOUND");
  return res.status(204).send();
});
