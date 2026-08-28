const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const { sendMailPromise } = require("./transpoter");
const Footer = require("./footer");
const { header } = require("./header");
const { logEmailOutcome } = require("../utils/emailLogOnSuccess");
const layout = require("./dailyEodDigestLayout");

/**
 * Admin daily operations summary email.
 */
module.exports = async function sendAdminDailyEodDigest({
  email,
  adminName,
  digest,
}) {
  const footer = await Footer();
  const to = Array.isArray(email) ? email : [email];
  const subject = `Busy Bean Coffee · Daily Summary · ${digest.reportDate}`;

  const own = digest.ownCustomers || {};
  const dropship = digest.dropshipPartnerCustomers || {};
  const restocks = digest.partnerRestocks || {};

  const adminReceivableNote = `
    <div style="font-family:'Chivo',Arial,sans-serif; font-size:12px; color:${layout.COLORS.coffee}; padding-top:10px; font-weight:600;">
      Admin receivable: ${layout.formatMoney(dropship.payments?.adminReceivable || 0)}
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
        `Hello ${layout.escapeHtml(adminName || "Admin")},<br /><br />Here is your end-of-day operations briefing for Busy Bean Coffee.`,
      )}
      ${layout.sectionTitle("Own customers")}
      ${layout.metricsRow(
        layout.metricCard(
          "Orders received",
          own.orders?.count,
          own.orders?.totalBill,
        ),
        layout.metricCard(
          "Payments received",
          own.payments?.count,
          own.payments?.totalBill,
        ),
      )}
      ${layout.sectionTitle("Dropship partner customers")}
      ${layout.metricsRow(
        layout.metricCard(
          "Orders received",
          dropship.orders?.count,
          dropship.orders?.totalBill,
        ),
        layout.metricCard(
          "Customer payments",
          dropship.payments?.count,
          dropship.payments?.totalBill,
          adminReceivableNote,
        ),
      )}
      ${layout.sectionTitle("Partner restocks")}
      ${layout.metricsRow(
        layout.metricCard(
          "Orders received",
          restocks.orders?.count,
          restocks.orders?.totalBill,
        ),
        layout.metricCard(
          "Payments received",
          restocks.payments?.count,
          restocks.payments?.totalBill,
        ),
      )}
      ${layout.footnoteBlock([
        "Cancelled orders (status 6) are excluded.",
        "Orders are counted by business date (on).",
        "Payments: invoice paid date if set, otherwise order date (on).",
        "Dropship partner payments: status done, admin receivable > 0; date uses pullout date, else invoice paid date, else on.",
        "Admin receivable = total bill − partner commission (same as invoice / Stripe).",
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
        recipientType: "admin",
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
        recipientType: "admin",
      },
    });
    throw error;
  }
};
