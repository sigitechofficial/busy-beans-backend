const { emailLog } = require("../models");

/**
 * Log a successful email send to email_logs (success-only tracking).
 * Does not throw - if DB insert fails, only logs to console so email flow is not broken.
 * @param {Object} params
 * @param {string} params.emailType - invoice_sent | invoice_reminder | paid_receipt | paid_receipt_admin | supplier_new_order
 * @param {number} params.orderId
 * @param {string} [params.orderType] - customer | local-partner (default: customer)
 * @param {string|string[]} params.recipients - email(s) that received the email
 * @param {Object} [params.metadata] - optional { subject, invoiceNumber, etc. }
 */
async function logEmailSuccess({
  emailType,
  orderId,
  orderType = "customer",
  recipients,
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
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    console.error("[emailLogOnSuccess] Failed to log successful email:", err.message);
  }
}

module.exports = { logEmailSuccess };
