const subscriptionCancellationEmail = require("../../helper/subscriptionCancellationEmail");
const {
  sendIfAllowed,
  lookupUserIdByEmail,
} = require("../../utils/emailSendGate");

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
    const userId = await lookupUserIdByEmail(customerEmail);
    await sendIfAllowed({
      recipientType: "customer",
      recipientId: userId,
      emailType: "subscription_cancellation",
      recipients: customerEmail,
      send: async () => {
        await subscriptionCancellationEmail({
          data: {
            customerEmail,
            userName: userName || "Valued Customer",
            periodEnd,
            cancelAtPeriodEnd,
          },
        });
      },
    });
    return true;
  } catch (error) {
    console.error("❌ subscriptionCancellationEmailEvent error:", error.message);
    return false;
  }
};
