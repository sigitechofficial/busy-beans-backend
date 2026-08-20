const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const { sendMailPromise } = require("./transpoter");
const Footer = require("./footer");
const { header } = require("./header");
const { logEmailOutcome } = require("../utils/emailLogOnSuccess");
const layout = require("./dailyEodDigestLayout");

/**
 * Partner daily summary — only that partner's customer orders.
 */
module.exports = async function sendPartnerDailyEodDigest({
  email,
  partnerName,
  digest,
}) {
  const footer = await Footer();
  const to = Array.isArray(email) ? email : [email];
  const subject = `Your Daily Summary · ${digest.reportDate}`;

  const commissionNote = `
    <div style="font-family:'Chivo',Arial,sans-serif; font-size:12px; color:${layout.COLORS.coffee}; padding-top:10px; font-weight:600;">
      Your commission: ${layout.formatMoney(digest.payments?.commission || 0)}
    </div>
  `;

  const html = `${layout.shellOpen({ title: subject })}
      ${layout.headerBlock(header)}
      ${layout.titleBlock({
        title: "Daily Operations Summary",
        displayDate: digest.displayDate,
        timezone: digest.timezone,
      })}
      ${layout.introBlock(
        `Hello ${layout.escapeHtml(partnerName || "Partner")},<br /><br />Here is your end-of-day summary for your Busy Bean Coffee customers.`,
      )}
      ${layout.sectionTitle("Your customers")}
      ${layout.metricsRow(
        layout.metricCard(
          "Orders received",
          digest.orders?.count,
          digest.orders?.totalBill,
        ),
        layout.metricCard(
          "Payments received",
          digest.payments?.count,
          digest.payments?.totalBill,
          commissionNote,
        ),
      )}
      ${layout.footnoteBlock([
        "This summary includes only your assigned customer orders.",
        "Cancelled orders are excluded.",
        "Orders are counted by business date (on).",
        "Payments: invoice paid date if set, otherwise order date (on).",
      ])}
      ${footer}
    </table>
  </body>
</html>`;

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to,
    bcc: ["sigidevelopers@gmail.com"],
    subject,
    replyTo: "info@busybeancoffee.com",
    attachments: [...attachments().footer],
    html,
  };

  try {
    const info = await sendMailPromise(mailOptions);
    await logEmailOutcome({
      emailType: "daily_eod_report",
      orderId: null,
      orderType: "customer",
      recipients: to,
      emailSent: "Success",
      metadata: {
        subject,
        reportDate: digest.reportDate,
        recipientType: "partner",
      },
      zeptoRequestId: info?.requestId || info?.messageId || null,
    });
    return info;
  } catch (error) {
    await logEmailOutcome({
      emailType: "daily_eod_report",
      orderId: null,
      orderType: "customer",
      recipients: to,
      emailSent: "Failed",
      errorMessage: error?.message || String(error),
      metadata: {
        subject,
        reportDate: digest.reportDate,
        recipientType: "partner",
      },
    });
    throw error;
  }
};
