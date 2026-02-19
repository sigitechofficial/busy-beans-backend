const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const { sendMailPromise } = require("./transpoter");
const Footer = require("./footer");
const { header } = require("./header");

/**
 * Send subscription cancellation confirmation email
 * @param {Object} data
 * @param {string} data.customerEmail - Recipient email
 * @param {string} [data.userName] - Customer name
 * @param {Date|string} [data.periodEnd] - When access ends (for cancel at period end)
 * @param {boolean} [data.cancelAtPeriodEnd] - If true, access until periodEnd; else already ended
 */
module.exports = async function subscriptionCancellationEmail({ data }) {
  try {
    const footer = await Footer();
    const attachment = attachments();

    const {
      customerEmail,
      userName = "Valued Customer",
      periodEnd,
      cancelAtPeriodEnd = true,
    } = data;

    const periodEndFormatted =
      periodEnd &&
      new Date(periodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

    const hiUser = `Hi ${userName}!`;

    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Subscription Cancelled</title>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f2f2f2;
      font-family: Arial, sans-serif;
    "
  >
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      width="100%"
      style="background-color: #f2f2f2; padding: 40px 0"
    >
      <tr>
        <td align="center">
          <table
            cellpadding="0"
            cellspacing="0"
            width="100%"
            style="
              max-width: 600px;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            "
          >
            <tr>
              <td align="center" style="padding: 30px 20px 10px">
                ${header}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 10px 20px">
                <h2 style="font-size: 24px; color: #000000; margin: 0">
                  Subscription Cancelled
                </h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 30px 30px">
                <p style="font-size: 16px; font-weight: bold; color: #000000; margin-bottom: 15px;">
                  ${hiUser}
                </p>
                <p style="font-size: 14px; line-height: 22px; color: #333333; margin-top: 0;">
                  Your Busy Beans subscription has been cancelled as requested.
                </p>
                ${
                  cancelAtPeriodEnd && periodEndFormatted
                    ? `
                <div style="background-color: #f9f9f9; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #d4a017;">
                  <p style="font-size: 14px; line-height: 22px; color: #333333; margin: 0;">
                    <strong>Your access continues until ${periodEndFormatted}.</strong><br />
                    You can continue to enjoy your subscription benefits until the end of your current billing period.
                  </p>
                </div>
                `
                    : `
                <p style="font-size: 14px; line-height: 22px; color: #333333; margin-top: 10px;">
                  If you did not request this cancellation or have any questions, please contact our support team.
                </p>
                `
                }
                <p style="font-size: 14px; line-height: 22px; color: #333333; margin-top: 20px;">
                  We're sorry to see you go. You can resubscribe anytime at
                  <a href="https://busybeancoffee.com" style="color: #d4a017;"> busybeancoffee.com</a>.
                </p>
                <p style="font-size: 14px; line-height: 22px; color: #333333; margin-top: 20px;">
                  Thank you for being a Busy Beans customer.
                </p>
              </td>
            </tr>
            ${footer}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: customerEmail,
      bcc: "sigidevelopers@gmail.com",
      subject: "Your Busy Beans Subscription Has Been Cancelled",
      html: htmlTemplate,
      attachments: attachment.footer,
      replyTo: "noreply@busybeancoffee.com",
    };

    await sendMailPromise(mailOptions);
    console.log("✅ Subscription cancellation email sent to:", customerEmail);
    return { success: true };
  } catch (error) {
    console.error("❌ Subscription cancellation email error:", error.message);
    throw error;
  }
};
