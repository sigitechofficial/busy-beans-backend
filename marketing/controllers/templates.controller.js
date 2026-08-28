const catchAsync = require("../../utils/catchAsync");
const templatesService = require("../services/templates.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.listCustom = catchAsync(async (_req, res) => {
  const data = await templatesService.listCustomTemplates();
  return sendData(res, 200, data);
});

exports.getCustomById = catchAsync(async (req, res) => {
  const row = await templatesService.getCustomTemplateById(req.params.id);
  if (!row) return sendError(res, 404, "Template not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.createCustom = catchAsync(async (req, res) => {
  const row = await templatesService.createCustomTemplate(req.body || {});
  return sendData(res, 201, row);
});

exports.updateCustom = catchAsync(async (req, res) => {
  try {
    const row = await templatesService.updateCustomTemplate(req.params.id, req.body || {});
    if (!row) return sendError(res, 404, "Template not found.", "NOT_FOUND");
    return sendData(res, 200, row);
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, error.code);
    }
    throw error;
  }
});

exports.deleteCustom = catchAsync(async (req, res) => {
  const deleted = await templatesService.deleteCustomTemplate(req.params.id);
  if (!deleted) return sendError(res, 404, "Template not found.", "NOT_FOUND");
  return res.status(204).send();
});

exports.getBuiltinOverride = catchAsync(async (req, res) => {
  const data = await templatesService.getBuiltinOverride(req.params.templateId);
  return sendData(res, 200, data);
});

exports.upsertBuiltinOverride = catchAsync(async (req, res) => {
  const data = await templatesService.upsertBuiltinOverride(
    req.params.templateId,
    req.body || {},
  );
  return sendData(res, 200, data);
});
