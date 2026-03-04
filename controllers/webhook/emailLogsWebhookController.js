/**
 * Email Logs Webhook Controller (ZeptoMail)
 *
 * Receives webhooks from ZeptoMail for events like email opened, clicked, softbounce, etc.
 * Payload shape: { event_name: ["opened"|"clicked"|"softbounce"], event_message: [ { request_id, email_info, event_data } ] }
 * Updates emailLog by zeptoRequestId = request_id from event_message.
 *
 * Verification: Set X_ZEPTO_WEBHOOK_SECRET in .env to the same value as in Zepto "Authorization headers" value.
 * Optional: X_ZEPTO_WEBHOOK_HEADER = header name Zepto sends (default: x-zepto-webhook-secret).
 *
 * Route: POST /webhook/email-logs
 */

const { Op } = require("sequelize");
const { emailLog } = require("../../models");

function toValidDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Prefer actual event timestamp for open/click/bounce and only fallback to processed_time.
 */
function getEventTime(msg) {
  const eventData = Array.isArray(msg?.event_data)
    ? msg.event_data[0]
    : msg?.event_data;
  const details = Array.isArray(eventData?.details)
    ? eventData.details[0]
    : eventData?.details;

  const detailTime = toValidDate(details?.time);
  if (detailTime) return detailTime;

  const processedTime = toValidDate(msg?.email_info?.processed_time);
  if (processedTime) return processedTime;

  return new Date();
}

function normalizeEventName(eventName) {
  return String(eventName || "")
    .toLowerCase()
    .trim();
}

function buildRequestIdCandidates(msg) {
  const rawRequestId = msg?.request_id;
  const emailReference = msg?.email_info?.email_reference;
  const candidates = [];
  const push = (val) => {
    if (!val || typeof val !== "string") return;
    const v = val.trim();
    if (!v) return;
    if (!candidates.includes(v)) candidates.push(v);
    const beforeAt = v.split("@")[0]?.trim();
    if (beforeAt && !candidates.includes(beforeAt)) candidates.push(beforeAt);
  };
  push(rawRequestId);
  push(emailReference);
  return candidates;
}

/**
 * Handle ZeptoMail webhook (opened, clicked, softbounce, etc.)
 * Responds 200 quickly so Zepto doesn't retry.
 */
exports.handleEmailLogsWebhook = async (req, res) => {
  try {
    const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = req.body || {};
    const eventNames = Array.isArray(payload.event_name)
      ? payload.event_name
      : [];
    const eventMessages = Array.isArray(payload.event_message)
      ? payload.event_message
      : [];
    const eventName = eventNames[0];

    // Zepto "Verify" can hit this endpoint with an empty/test payload.
    // Acknowledge immediately with 200 so verification does not hang.
    const isVerificationPing =
      eventNames.length === 0 && eventMessages.length === 0;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[emailLogsWebhook][${traceId}] Incoming meta:`,
        JSON.stringify(
          {
            method: req.method,
            url: req.originalUrl,
            contentType: req.get("content-type"),
            payloadKeys: Object.keys(payload || {}),
            eventNames,
            eventMessageCount: eventMessages.length,
          },
          null,
          2,
        ),
      );
    }

    if (isVerificationPing) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[emailLogsWebhook][${traceId}] Verification ping received`,
        );
      }
      return res.status(200).type("text/plain").send("OK");
    }

    let matchedCount = 0;
    let updatedOpen = 0;
    let updatedClick = 0;
    let updatedSoftBounce = 0;
    let skippedNoRequestId = 0;
    let skippedNoMatch = 0;
    let skippedLikelyPrefetch = 0;

    const normalizedEvent = normalizeEventName(eventName);

    for (let i = 0; i < eventMessages.length; i += 1) {
      const msg = eventMessages[i];
      const requestIdCandidates = buildRequestIdCandidates(msg);
      if (requestIdCandidates.length === 0) {
        skippedNoRequestId += 1;
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[emailLogsWebhook][${traceId}] msg#${i + 1}: skipped (no request_id/email_reference in payload)`,
          );
        }
        continue;
      }

      const log = await emailLog.findOne({
        where: { zeptoRequestId: { [Op.in]: requestIdCandidates } },
      });
      if (!log) {
        skippedNoMatch += 1;
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[emailLogsWebhook][${traceId}] msg#${i + 1}: no emailLog match for candidates=${JSON.stringify(requestIdCandidates)}`,
          );
        }
        continue;
      }
      matchedCount += 1;
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[emailLogsWebhook][${traceId}] msg#${i + 1}: matched emailLog id=${log.id}, zeptoRequestId=${log.zeptoRequestId}`,
        );
      }

      const eventTime = getEventTime(msg);
      if (
        normalizedEvent === "opened" ||
        normalizedEvent === "open" ||
        normalizedEvent === "email_open" ||
        normalizedEvent === "email_opened"
      ) {
        // Count all opens. Skipping is disabled because supplier_new_order uses openCount=-1 offset.
        // Keep env support; default 0 means no skip.
        const prefetchWindowSec = Number(
          process.env.EMAIL_OPEN_PREFETCH_WINDOW_SEC || 0,
        );
        const sentAtMs = log?.sentAt ? new Date(log.sentAt).getTime() : NaN;
        const eventMs = eventTime.getTime();
        const isLikelyPrefetch =
          prefetchWindowSec > 0 &&
          Number.isFinite(sentAtMs) &&
          Number.isFinite(eventMs) &&
          log.firstOpenedAt == null &&
          eventMs >= sentAtMs &&
          eventMs - sentAtMs <= prefetchWindowSec * 1000;
        if (isLikelyPrefetch) {
          skippedLikelyPrefetch += 1;
          if (process.env.NODE_ENV !== "production") {
            console.log(
              `[emailLogsWebhook][${traceId}] msg#${i + 1}: OPEN skipped as likely prefetch (event ${Math.round((eventMs - sentAtMs) / 1000)}s after sentAt, window=${prefetchWindowSec}s)`,
            );
          }
          continue;
        }

        const nextOpenCount = (log.openCount || 0) + 1;
        await emailLog.update(
          {
            lastOpenedAt: eventTime,
            openCount: nextOpenCount,
            ...(log.firstOpenedAt == null ? { firstOpenedAt: eventTime } : {}),
          },
          { where: { id: log.id } },
        );
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[emailLogsWebhook][${traceId}] msg#${i + 1}: OPEN updated id=${log.id} openCount ${log.openCount || 0} -> ${nextOpenCount}, firstOpenedAt=${log.firstOpenedAt || "set-now"}, lastOpenedAt=${eventTime.toISOString()}`,
          );
        }
        updatedOpen += 1;
      } else if (
        normalizedEvent === "clicked" ||
        normalizedEvent === "click" ||
        normalizedEvent === "email_click" ||
        normalizedEvent === "email_clicked"
      ) {
        const nextClickCount = (log.clickCount || 0) + 1;
        await emailLog.update(
          { clickCount: nextClickCount },
          { where: { id: log.id } },
        );
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[emailLogsWebhook][${traceId}] msg#${i + 1}: CLICK updated id=${log.id} clickCount ${log.clickCount || 0} -> ${nextClickCount}`,
          );
        }
        updatedClick += 1;
      } else if (
        normalizedEvent === "softbounce" ||
        normalizedEvent === "soft_bounce"
      ) {
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
            `[emailLogsWebhook][${traceId}] msg#${i + 1}: SOFTBOUNCE updated id=${log.id} at=${eventTime.toISOString()} reason=${reason || "(unchanged)"}`,
          );
        }
        updatedSoftBounce += 1;
      } else if (process.env.NODE_ENV !== "production") {
        console.log(
          `[emailLogsWebhook][${traceId}] msg#${i + 1}: event '${normalizedEvent}' not handled; no DB update`,
        );
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[emailLogsWebhook][${traceId}] Summary:`,
        JSON.stringify(
          {
            eventName: normalizedEvent,
            received: eventMessages.length,
            matched: matchedCount,
            updatedOpen,
            updatedClick,
            updatedSoftBounce,
            skippedNoRequestId,
            skippedNoMatch,
            skippedLikelyPrefetch,
          },
          null,
          2,
        ),
      );
    }

    res.status(200).type("text/plain").send("OK");
  } catch (err) {
    console.error("[emailLogsWebhook] Error:", err.message);
    res.status(200).type("text/plain").send("OK");
  }
};
