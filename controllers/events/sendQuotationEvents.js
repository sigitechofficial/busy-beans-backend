const sendQuotation = require("../../helper/sendQuotation");
const {
  sendIfAllowed,
  lookupUserIdByEmail,
} = require("../../utils/emailSendGate");

exports.sendQuotationEvent = async ({ email, data, localPatner }) => {
  try {
    const userId = await lookupUserIdByEmail(email);
    await sendIfAllowed({
      recipientType: "customer",
      recipientId: userId,
      emailType: "quotation",
      recipients: email,
      send: async () => {
        await sendQuotation({
          email: email,
          data: data,
          localPatner: localPatner,
        });
      },
    });
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.sendQuotation = ~ error:", error);
  }
};
