/**
 * Email Logs Webhook Controller (ZeptoMail)
 *
 * Receives webhooks from ZeptoMail for events like email opened, clicked, softbounce, etc.
 * Payload shape: { event_name: ["opened"|"clicked"|"softbounce"], event_message: [ { request_id, email_info, event_data } ] }
 * Updates emailLog by zeptoRequestId = request_id from event_message.
 *
 * Route: POST /webhook/email-logs
 */

const { emailLog } = require("../../models");

/**
 * Parse event time from event_message item (e.g. email_info.processed_time or event_data.details[0].time)
 */
function getEventTime(msg) {
  if (msg?.email_info?.processed_time)
    return new Date(msg.email_info.processed_time);
  const details = msg?.event_data?.[0]?.details?.[0];
  if (details?.time) return new Date(details.time);
  return new Date();
}

/**
 * Handle ZeptoMail webhook (opened, clicked, softbounce, etc.)
 * Responds 200 quickly so Zepto doesn't retry.
 */
exports.handleEmailLogsWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const eventNames = Array.isArray(payload.event_name)
      ? payload.event_name
      : [];
    const eventMessages = Array.isArray(payload.event_message)
      ? payload.event_message
      : [];
    const eventName = eventNames[0];

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[emailLogsWebhook] event_name:",
        eventName,
        "event_message count:",
        eventMessages.length,
      );
    }

    for (const msg of eventMessages) {
      const requestId = msg.request_id || msg.email_info?.email_reference;
      if (!requestId) continue;

      const log = await emailLog.findOne({
        where: { zeptoRequestId: requestId },
      });
      if (!log) continue;

      const eventTime = getEventTime(msg);

      if (eventName === "opened") {
        await emailLog.update(
          {
            lastOpenedAt: eventTime,
            openCount: (log.openCount || 0) + 1,
            ...(log.firstOpenedAt == null ? { firstOpenedAt: eventTime } : {}),
          },
          { where: { id: log.id } },
        );
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[emailLogsWebhook] Updated open for emailLog id:",
            log.id,
          );
        }
      } else if (eventName === "clicked") {
        await emailLog.update(
          { clickCount: (log.clickCount || 0) + 1 },
          { where: { id: log.id } },
        );
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[emailLogsWebhook] Updated click for emailLog id:",
            log.id,
          );
        }
      } else if (eventName === "softbounce") {
        const details = msg?.event_data?.[0]?.details?.[0];
        const reason = details
          ? [
              details.reason,
              details.diagnostic_message,
              details.bounced_recipient,
            ]
              .filter(Boolean)
              .join("; ")
          : null;
        await emailLog.update(
          {
            softBouncedAt: eventTime,
            softBounceReason: reason || log.softBounceReason,
          },
          { where: { id: log.id } },
        );
        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[emailLogsWebhook] Updated softbounce for emailLog id:",
            log.id,
          );
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[emailLogsWebhook] Error:", err.message);
    res.status(200).json({ received: true });
  }
};
