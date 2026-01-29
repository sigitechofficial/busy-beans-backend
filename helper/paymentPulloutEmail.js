const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const { transporter } = require("./transpoter");
let Footer = require("./footer");
const generateFooterHtml = require("./footerLocalpatner");
const { header } = require("./header");
const { emailDateFormate } = require("../utils/emailDateFormate");

/**
 * Sends a professional email notification to local partner when admin pulls out payment
 * @param {Object} params - Email parameters
 * @param {string} params.partnerEmail - Partner's email address
 * @param {Object} params.partner - Partner object from database
 * @param {number} params.amount - Total amount pulled out
 * @param {Array} params.orderList - List of orders with details
 * @param {string} params.dateAndTime - Date and time of the pullout (from frontend to avoid timezone issues)
 */
module.exports = async function sendPaymentPulloutEmail({
  partnerEmail,
  partner,
  amount,
  orderList,
  dateAndTime,
}) {
  try {
    let footer = await Footer();

    // Use partner's footer if available

    const emailAttachments = [...attachments().footer];

    // Build order rows HTML
    let orderRows = "";
    orderList.forEach((order) => {
      orderRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">#${order.id}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${order.invoiceNumber || "N/A"}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">$${parseFloat(order.localPatnerCommission || 0).toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600; color: #8F5D46;">$${parseFloat(order.adminReceivableAmount || 0).toFixed(2)}</td>
        </tr>
      `;
    });

    // Calculate totals
    const totalCommission = orderList
      .reduce((sum, order) => sum + parseFloat(order.localPatnerCommission || 0), 0)
      .toFixed(2);

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: [partnerEmail],
      bcc: ["sigidevelopers@gmail.com"],
      subject: `Payment Pullout Notification - $${parseFloat(amount).toFixed(2)} Processed`,
      replyTo: "info@busybeancoffee.com",
      attachments: emailAttachments,
      html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,100..900;1,100..900&display=swap"
      rel="stylesheet"
    />
    <title>Payment Pullout Notification - Busy Bean Coffee</title>
  </head>
  <body
    style="
      margin: 0;
      padding: 10px 0px;
      font-family: Arial, sans-serif;
      background-color: #f8f8f8;
    "
  >
    <table
      align="center"
      border="0"
      cellpadding="0"
      cellspacing="0"
      width="100%"
      style="border-collapse: collapse; max-width: 650px"
    >
      <!-- Header -->
      <tr>
        <td align="center" style="padding: 20px 0">
          ${header}
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td
          style="
            padding: 30px 40px 20px 40px;
            font-family: 'Chivo', sans-serif;
            color: #1a1a1a;
            font-size: 24px;
            font-weight: 700;
          "
        >
          Payment Pullout Notification
        </td>
      </tr>

      <!-- Main Message -->
      <tr>
        <td
          style="
            padding: 0px 40px 20px 40px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.6;
          "
        >
          Dear ${partner?.srName || "Partner"},
          <br /><br />
          This is to inform you that we have processed a payment pullout from your connected bank account as part of our regular settlement process.
        </td>
      </tr>

      <!-- Amount Summary Box -->
      <tr>
        <td style="padding: 0px 40px 20px 40px;">
          <table
            width="100%"
            cellspacing="0"
            cellpadding="20"
            style="
              border-collapse: collapse;
              background: linear-gradient(135deg, #8F5D46 0%, #6B4530 100%);
              border-radius: 12px;
            "
          >
            <tr>
              <td style="text-align: center;">
                <div style="color: rgba(255, 255, 255, 0.9); font-size: 14px; font-family: 'Chivo', sans-serif; margin-bottom: 8px;">
                  Total Amount Pulled Out
                </div>
                <div style="color: #ffffff; font-size: 36px; font-weight: 700; font-family: 'Chivo', sans-serif;">
                  $${parseFloat(amount).toFixed(2)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Transaction Details Header -->
      <tr>
        <td
          style="
            padding: 20px 40px 10px 40px;
            font-family: 'Chivo', sans-serif;
            color: #1a1a1a;
            font-size: 18px;
            font-weight: 600;
          "
        >
          Transaction Breakdown
        </td>
      </tr>

      <!-- Orders Table -->
      <tr>
        <td style="padding: 0px 40px 20px 40px;">
          <table
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              border-collapse: collapse;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            "
          >
            <thead>
              <tr style="background-color: #f8f5f3;">
                <th style="text-align: left; padding: 14px 12px; font-family: 'Chivo', sans-serif; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                  Order ID
                </th>
                <th style="text-align: left; padding: 14px 12px; font-family: 'Chivo', sans-serif; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                  Invoice
                </th>
                <th style="text-align: right; padding: 14px 12px; font-family: 'Chivo', sans-serif; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                  Your Commission
                </th>
                <th style="text-align: right; padding: 14px 12px; font-family: 'Chivo', sans-serif; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                  Amount Pulled
                </th>
              </tr>
            </thead>
            <tbody style="font-family: 'Chivo', sans-serif; font-size: 14px; color: #333333;">
              ${orderRows}
            </tbody>
            <tfoot>
              <tr style="background-color: #f0ebe8;">
                <td colspan="2" style="padding: 14px 12px; font-weight: 600; font-family: 'Chivo', sans-serif; font-size: 15px;">
                  Total
                </td>
                <td style="text-align: right; padding: 14px 12px; font-weight: 600; font-family: 'Chivo', sans-serif; font-size: 15px;">
                  $${totalCommission}
                </td>
                <td style="text-align: right; padding: 14px 12px; font-weight: 700; font-family: 'Chivo', sans-serif; font-size: 15px; color: #8F5D46;">
                  $${parseFloat(amount).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </td>
      </tr>

      <!-- Important Information -->
      <tr>
        <td
          style="
            padding: 20px 40px;
            background-color: #fff9f5;
            margin: 0 40px;
            border-left: 4px solid #8F5D46;
            font-family: 'Chivo', sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: rgba(0, 0, 0, 0.8);
          "
        >
          <strong style="color: #8F5D46;">📋 Important Information:</strong><br /> 
          • Your commission amounts remain credited to your partner account<br />
          • This pullout covers the admin receivable amounts for the orders listed above
        </td>
      </tr>

      <!-- Call to Action / Support -->
      <tr>
        <td
          style="
            padding: 30px 40px 20px 40px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 15px;
            line-height: 1.6;
          "
        >
          If you have any questions or concerns about this transaction, please don't hesitate to contact us. You can view detailed reports in your partner dashboard or reach out to our support team.
          <br /><br />
          Thank you for your continued partnership with Busy Bean Coffee!
          <br /><br />
          <strong>Best regards,</strong><br />
          <span style="color: #8F5D46; font-weight: 600;">Busy Bean Coffee, Inc.</span>
        </td>
      </tr>

      <!-- Footer -->
      ${footer}
    </table>
  </body>
</html>`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error("❌ Error sending payment pullout email:", error);
      } else {
        console.log("✅ Payment pullout email sent successfully:", info.response);
      }
    });
  } catch (error) {
    console.error("❌ Error in sendPaymentPulloutEmail:", error);
    throw error;
  }
};
