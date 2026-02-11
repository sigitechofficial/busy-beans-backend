const { emailLog } = require("../models");

/**
 * Log an email send attempt to email_logs (success or failure).
 * Does not throw - if DB insert fails, only logs to console so email flow is not broken.
 * @param {Object} params
 * @param {string} params.emailType - invoice_sent | invoice_reminder | paid_receipt | paid_receipt_admin | supplier_new_order | order_shipped
 * @param {number} params.orderId
 * @param {string} [params.orderType] - customer | local-partner (default: customer)
 * @param {string|string[]} params.recipients - email(s)
 * @param {string} [params.emailSent] - "Success" | "Failed" (default: "Success")
 * @param {string} [params.errorMessage] - error details when emailSent is "Failed"
 * @param {Object} [params.metadata] - optional { subject, invoiceNumber, etc. }
 */
async function logEmailOutcome({
  emailType,
  orderId,
  orderType = "customer",
  recipients,
  emailSent = "Success",
  errorMessage = null,
  metadata = null,
}) {
  try {
    const recipientsStr = Array.isArray(recipients)
      ? recipients.join(", ")
      : String(recipients || "");
    await emailLog.create({
      emailType,
      orderId,
      orderType,
      recipients: recipientsStr,
      emailSent,
      errorMessage: errorMessage || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
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
