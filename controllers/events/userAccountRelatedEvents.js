const userAccountApprove = require("../../helper/userAccountApprove");
const userAccountCreated = require("../../helper/userAccountCreated");
const customerRegistrationAdminNotify = require("../../helper/customerRegistrationAdminNotify");
const otpToUsers = require("../../helper/otpToUsers");
const otpToUsersForgotPassword = require("../../helper/otpToUsersForgotPassword");
const { salesRep } = require("../../models");
const {
  sendIfAllowed,
  lookupUserIdByEmail,
  hqPerson,
} = require("../../utils/emailSendGate");

exports.userAccountApproveEvent = async ({ email, name }) => {
  try {
    const userId = await lookupUserIdByEmail(email);
    await sendIfAllowed({
      recipientType: "customer",
      recipientId: userId,
      emailType: "account_approved",
      recipients: email,
      send: async () => {
        await userAccountApprove({ email, name });
      },
    });
    console.log(
      "🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀",
    );
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.userAccountApprove = ~ error:", error);
  }
};

exports.userAccountCreatedEvent = async ({ email, name }) => {
  try {
    await sendIfAllowed({
      ...hqPerson(),
      emailType: "welcome_internal",
      recipients: "sigidevelopers@gmail.com",
      send: async () => {
        await userAccountCreated({ email, name });
      },
    });
    console.log(
      "🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀",
    );
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.userAccountApprove = ~ error:", error);
  }
};

exports.customerRegistrationAdminNotifyEvent = async ({ customer }) => {
  try {
    let notifyEmail = null;
    let recipientType = "admin";
    let localPartnerName = null;
    let gateRecipient = hqPerson();

    if (customer?.salesRepId) {
      const partner = await salesRep.findOne({
        where: { id: customer.salesRepId, deleted: 0, status: true },
        attributes: ["id", "email", "srName"],
      });
      if (partner?.email) {
        notifyEmail = partner.email;
        recipientType = "localPartner";
        localPartnerName = partner.srName;
        gateRecipient = {
          recipientType: "partner",
          recipientId: partner.id,
        };
      }
    }

    if (!notifyEmail) {
      notifyEmail = process.env.ADMIN_NOTIFY_EMAIL || null;
      recipientType = "admin";
      gateRecipient = hqPerson();
    }

    if (!notifyEmail) {
      console.log(
        "customerRegistrationAdminNotifyEvent: no recipient email configured",
      );
      return false;
    }

    await sendIfAllowed({
      ...gateRecipient,
      emailType: "customer_registration_notify",
      recipients: notifyEmail,
      send: async () => {
        await customerRegistrationAdminNotify({
          name: customer?.name,
          email: customer?.email,
          phone: customer?.phoneNumber,
          company: customer?.companyName,
          userId: customer?.id,
          address: customer?.addresses?.[0],
          notifyEmail,
          recipientType,
          localPartnerName,
        });
      },
    });
    console.log(
      "🚀 ~~~~~ eventDrivenCommunication customerRegistrationAdminNotify~~~~~~~ 🚀",
    );
    return true;
  } catch (error) {
    console.log(
      "🚀 ~ exports.customerRegistrationAdminNotifyEvent ~ error:",
      error,
    );
  }
};

exports.otpToUsersEvent = async ({ email, name, otp }) => {
  try {
    otpToUsers({ email: email, name: name, otp: otp });
    console.log(
      "🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀",
    );
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.userAccountApprove = ~ error:", error);
  }
};

exports.otpToUsersForgotPasswordEvent = async ({ email, name, otp }) => {
  try {
    otpToUsersForgotPassword({ email: email, name: name, otp: otp });
    console.log(
      "🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀",
    );
    return true;
  } catch (error) {
    console.log("🚀 ~ exports.userAccountApprove = ~ error:", error);
  }
};
