const catchAsync = require("../../utils/catchAsync");
const analyticsEventsService = require("../services/analyticsEvents.service");
const { sendError } = require("../utils/httpResponses");

/**
 * Revenue events are recorded by the backend only (orderAttribution.service); accepting them
 * from this public endpoint would let anyone add revenue to the dashboard.
 */
const SERVER_ONLY_EVENT_TYPES = new Set([
  "order_created",
  "order_completed",
  "payment_completed",
  "subscription_payment",
]);

exports.createEvent = catchAsync(async (req, res) => {
  try {
    const eventType = typeof req.body?.eventType === "string" ? req.body.eventType.trim() : "";
    if (SERVER_ONLY_EVENT_TYPES.has(eventType)) {
      return sendError(res, 400, `${eventType} events are recorded server-side.`, "VALIDATION_ERROR");
    }
    await analyticsEventsService.ingestEvent(req.body || {});
    return res.status(204).send();
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    return sendError(res, 500, "Failed to ingest event.", "INTERNAL_ERROR");
  }
});
