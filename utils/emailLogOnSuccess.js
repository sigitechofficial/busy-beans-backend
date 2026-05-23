const { Op } = require("sequelize");
const { emailLog } = require("../models");

const INVOICE_EMAIL_TYPES = ["invoice_sent", "invoice_reminder"];

/**
 * Mark prior failed sends as resolved after a successful retry for the same order + email type.
 * Invoice sent and reminder are treated as one family: success on either resolves failed rows for both.
 * @returns {number} rows updated
 */
async function markPriorFailuresResolved({ emailType, orderId, orderType }) {
  if (!orderId || !emailType) return 0;

  const isLocalPartner = orderType === "local-partner";
  const where = {
    orderType,
    emailSent: "Failed",
    retrySuccess: { [Op.or]: [{ [Op.is]: null }, false] },
  };

  if (INVOICE_EMAIL_TYPES.includes(emailType)) {
    where.emailType = { [Op.in]: INVOICE_EMAIL_TYPES };
  } else {
    where.emailType = emailType;
  }

  if (isLocalPartner) {
    where.partnerOrderId = orderId;
  } else {
    where.orderId = orderId;
  }

  const [affectedCount] = await emailLog.update({ retrySuccess: true }, { where });
  return affectedCount;
}

/**
 * Log an email send attempt to email_logs (success or failure).
 * Does not throw - if DB insert fails, only logs to console so email flow is not broken.
 * @param {Object} params
 * @param {string} params.emailType - invoice_sent | invoice_reminder | paid_receipt | paid_receipt_admin | supplier_new_order | order_shipped | order_confirmation
 * @param {number} params.orderId
 * @param {string} [params.orderType] - customer | local-partner (default: customer)
 * @param {string|string[]} params.recipients - email(s)
 * @param {string} [params.emailSent] - "Success" | "Failed" (default: "Success")
 * @param {string} [params.errorMessage] - error details when emailSent is "Failed"
 * @param {Object} [params.metadata] - optional { subject, invoiceNumber, etc. }
 * @param {string} [params.zeptoRequestId] - ZeptoMail request_id from send response (for webhooks)
 * @param {boolean|null} [params.retrySuccess] - null = initial send; true/false = retry outcome
 */
async function logEmailOutcome({
  emailType,
  orderId,
  orderType = "customer",
  recipients,
  emailSent = "Success",
  errorMessage = null,
  metadata = null,
  zeptoRequestId = null,
  retrySuccess = null,
}) {
  try {
    let finalRetrySuccess = retrySuccess;

    if (emailSent === "Success") {
      try {
        const resolvedCount = await markPriorFailuresResolved({
          emailType,
          orderId,
          orderType,
        });
        if (finalRetrySuccess == null && resolvedCount > 0) {
          finalRetrySuccess = true;
        }
      } catch (err) {
        console.error(
          "[emailLogOutcome] Failed to mark prior failures resolved:",
          err.message,
        );
      }
    }

    const initialOpenCount = emailType === "supplier_new_order" ? -1 : 0;
    const recipientsStr = Array.isArray(recipients)
      ? recipients.join(", ")
      : String(recipients || "");
    const isLocalPartner = orderType === "local-partner";
    await emailLog.create({
      emailType,
      orderId: isLocalPartner ? null : orderId,
      partnerOrderId: isLocalPartner ? orderId : null,
      orderType,
      recipients: recipientsStr,
      emailSent,
      errorMessage: errorMessage || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      zeptoRequestId: zeptoRequestId || null,
      retrySuccess: finalRetrySuccess,
      // Supplier new-order is noisy due to scanner/prefetch opens; start from -1 to offset that.
      openCount: initialOpenCount,
      clickCount: 0,
    });
  } catch (err) {
    console.error("[emailLogOutcome] Failed to log email:", err.message);
  }
}

/** @deprecated Use logEmailOutcome with emailSent. Kept for compatibility. */
async function logEmailSuccess(params) {
  return logEmailOutcome({ ...params, emailSent: "Success" });
}

module.exports = { logEmailSuccess, logEmailOutcome };
