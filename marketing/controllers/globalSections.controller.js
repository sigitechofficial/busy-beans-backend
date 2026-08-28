const catchAsync = require("../../utils/catchAsync");
const globalSectionsService = require("../services/globalSections.service");
const { sendData, sendError } = require("../utils/httpResponses");

exports.list = catchAsync(async (_req, res) => {
  const data = await globalSectionsService.listGlobalSections();
  return sendData(res, 200, data);
});

exports.getById = catchAsync(async (req, res) => {
  const row = await globalSectionsService.getGlobalSectionById(req.params.id);
  if (!row) return sendError(res, 404, "Global section not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.create = catchAsync(async (req, res) => {
  const row = await globalSectionsService.createGlobalSection(req.body || {});
  return sendData(res, 201, row);
});

exports.update = catchAsync(async (req, res) => {
  const row = await globalSectionsService.updateGlobalSection(req.params.id, req.body || {});
  if (!row) return sendError(res, 404, "Global section not found.", "NOT_FOUND");
  return sendData(res, 200, row);
});

exports.remove = catchAsync(async (req, res) => {
  const result = await globalSectionsService.deleteGlobalSection(req.params.id);
  if (!result.deleted && result.reason === "NOT_FOUND") {
    return sendError(res, 404, "Global section not found.", "NOT_FOUND");
  }
  if (!result.deleted && result.reason === "IN_USE") {
    return sendError(
      res,
      409,
      "Global section is in use on landing pages.",
      "GLOBAL_SECTION_IN_USE",
      { usageCount: result.usageCount },
    );
  }
  return res.status(204).send();
});

exports.detach = catchAsync(async (req, res) => {
  const data = await globalSectionsService.detachGlobalSection(req.params.id);
  return sendData(res, 200, data);
});
