const catchAsync = require("../../utils/catchAsync");
const analyticsEventsService = require("../services/analyticsEvents.service");
const { sendError } = require("../utils/httpResponses");
const { hasMarketingSession } = require("../services/leadTestMode.service");

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

const SERVER_RECORDED_EVENT_TYPES = new Set(["lead_created"]);

exports.createEvent = catchAsync(async (req, res) => {
  try {
    const eventType = typeof req.body?.eventType === "string" ? req.body.eventType.trim() : "";
    if (SERVER_ONLY_EVENT_TYPES.has(eventType)) {
      return sendError(res, 400, `${eventType} events are recorded server-side.`, "VALIDATION_ERROR");
    }
    // lead_created is recorded by the server when it stores a (non-test) lead; a browser copy
    // (older website bundles still send one) is accepted and ignored, so it can't be spoofed.
    if (SERVER_RECORDED_EVENT_TYPES.has(eventType)) return res.status(204).send();
    await analyticsEventsService.ingestEvent(req.body || {}, {
      staff: hasMarketingSession(req.headers.authorization),
      fromBrowser: true,
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    return sendError(res, 500, "Failed to ingest event.", "INTERNAL_ERROR");
  }
});
