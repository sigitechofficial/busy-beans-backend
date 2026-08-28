const dotenv = require("dotenv");

dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const attachment = attachments();
const { transporter } = require("./transpoter");
let Footer = require("./footer");
let { header } = require("./header");

const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL;

module.exports = async function sendGetInTouchEmail({ data }) {
  try {
    const footer = await Footer();
    const { name, email, phone, company, teamSize, preferredDate, notes } =
      data;

    const safeName = escapeHtml(name || "N/A");
    const requestEmail = sanitizeHref(email || "");
    const safeEmail = escapeHtml(email || "N/A");
    const safePhone = escapeHtml(phone || "N/A");
    const safeCompany = escapeHtml(company || "N/A");
    const safeTeamSize = escapeHtml(teamSize || "N/A");
    const safePreferredDate = escapeHtml(preferredDate || "N/A");
    const safeNotes = escapeHtml(notes || "N/A");
    const safePhoneHref = sanitizeHref(phone);
    const safeEmailHref = sanitizeHref(email);

    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>New Get in Touch Enquiry</title>
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
                <h2 style="font-size: 18px; color: #000000; margin: 0">
                  New Get in Touch Enquiry
                </h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 30px 10px">
                <p
                  style="
                    font-size: 16px;
                    font-weight: bold;
                    color: #000000;
                    margin-bottom: 8px;
                  "
                >
                  Admin Notification
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 0;
                  "
                >
                  A new enquiry has been submitted through the Get in Touch form.
                  Please review the details below and follow up with the customer.
                </p>

                <table
                  style="
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                    margin-top: 12px;
                  "
                >
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Name
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeName}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Email
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      <a href="mailto:${safeEmailHref}" style="color: #0066cc">${safeEmail}</a>
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Phone
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      <a href="tel:${safePhoneHref}" style="color: #0066cc">${safePhone}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Company
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeCompany}
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Team Size
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeTeamSize}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Preferred Date
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safePreferredDate}
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td
                      valign="top"
                      style="padding: 10px; border: 1px solid #ddd; font-weight: bold"
                    >
                      Notes
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeNotes}
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    font-size: 13px;
                    line-height: 20px;
                    color: #666666;
                    margin: 18px 0 0 0;
                  "
                >
                  This email was generated automatically from the website contact form.
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

    transporter.sendMail(
      {
        from: process.env.EMAIL_USERNAME,
        to: ADMIN_NOTIFY_EMAIL,
        bcc: ["sigidevelopers@gmail.com"],
        subject: `[Busy Beans] New Get in Touch Enquiry - ${name || "Unknown"}`,
        html: htmlTemplate,
        attachments: attachment.footer,
        replyTo: requestEmail || undefined,
      },
      (error, info) => {
        if (error) {
          console.error("getInTouch email error:", error);
        } else {
          console.log("getInTouch email sent:", info);
        }
      },
    );
  } catch (err) {
    console.log("Email sending error:", err);
  }
};

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeHref(value) {
  if (!value) return "";
  return String(value).replace(/"/g, "").trim();
}
