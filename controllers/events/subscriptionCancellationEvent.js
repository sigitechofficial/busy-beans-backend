const subscriptionCancellationEmail = require("../../helper/subscriptionCancellationEmail");

/**
 * Send subscription cancellation email
 * @param {Object} params
 * @param {string} params.customerEmail - Customer email
 * @param {string} [params.userName] - Customer name
 * @param {Date|string} [params.periodEnd] - When access ends (for cancel at period end)
 * @param {boolean} [params.cancelAtPeriodEnd] - If true, access until periodEnd; else already ended
 */
exports.subscriptionCancellationEmailEvent = async ({
  customerEmail,
  userName,
  periodEnd,
  cancelAtPeriodEnd = true,
}) => {
  try {
    if (!customerEmail) {
      console.warn("⚠️ subscriptionCancellationEmailEvent: customerEmail required");
      return false;
    }
    await subscriptionCancellationEmail({
      data: {
        customerEmail,
        userName: userName || "Valued Customer",
        periodEnd,
        cancelAtPeriodEnd,
      },
    });
    return true;
  } catch (error) {
    console.error("❌ subscriptionCancellationEmailEvent error:", error.message);
    return false;
  }
};
