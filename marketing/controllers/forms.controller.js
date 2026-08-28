const catchAsync = require("../../utils/catchAsync");
const formsService = require("../services/forms.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.list = catchAsync(async (_req, res) => {
  const data = await formsService.listForms();
  return sendData(res, 200, data);
});

exports.getById = catchAsync(async (req, res) => {
  const row = await formsService.getFormById(req.params.id);
  if (!row) return sendError(res, 404, "Form not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.create = catchAsync(async (req, res) => {
  const row = await formsService.createForm(req.body || {}, req.marketingUser);
  return sendData(res, 201, row);
});

exports.update = catchAsync(async (req, res) => {
  const row = await formsService.updateForm(req.params.id, req.body || {}, req.marketingUser);
  if (!row) return sendError(res, 404, "Form not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.duplicate = catchAsync(async (req, res) => {
  const row = await formsService.duplicateForm(req.params.id, req.marketingUser);
  if (!row) return sendError(res, 404, "Form not found.", "NOT_FOUND");
  return sendData(res, 201, row);
});

exports.publish = catchAsync(async (req, res) => {
  const row = await formsService.publishForm(req.params.id, req.marketingUser);
  if (!row) return sendError(res, 404, "Form not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.archive = catchAsync(async (req, res) => {
  const row = await formsService.archiveForm(req.params.id, req.marketingUser);
  if (!row) return sendError(res, 404, "Form not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.remove = catchAsync(async (req, res) => {
  const result = await formsService.deleteForm(req.params.id);
  if (!result.deleted && result.reason === "NOT_FOUND") {
    return sendError(res, 404, "Form not found.", "NOT_FOUND");
  }
  if (!result.deleted && result.reason === "IN_USE") {
    return sendError(res, 409, "Form is in use on landing pages.", "FORM_IN_USE", {
      usageCount: result.usageCount,
    });
  }
  return res.status(204).send();
});
