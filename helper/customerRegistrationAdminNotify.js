const dotenv = require("dotenv");

dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const attachment = attachments();
const { transporter } = require("./transpoter");
const Footer = require("./footer");
const { header } = require("./header");

function formatAddress(address) {
  if (!address) return "N/A";
  const parts = [
    address.companyaddress,
    address.addressLineOne,
    address.addressLineTwo,
    address.town,
    address.state,
    address.zipCode,
    address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "N/A";
}

module.exports = async function sendCustomerRegistrationAdminNotify({
  name,
  email,
  phone,
  company,
  userId,
  address,
  notifyEmail,
  recipientType = "admin",
  localPartnerName,
}) {
  try {
    if (!notifyEmail) {
      console.log("customerRegistrationAdminNotify: missing notifyEmail");
      return;
    }

    const footer = await Footer();
    const location = formatAddress(address);
    const isLocalPartner = recipientType === "localPartner";

    const safeName = escapeHtml(name || "N/A");
    const requestEmail = sanitizeHref(email || "");
    const safeEmail = escapeHtml(email || "N/A");
    const safePhone = escapeHtml(phone || "N/A");
    const safeCompany = escapeHtml(company || "N/A");
    const safeLocation = escapeHtml(location);
    const safeUserId = escapeHtml(userId ?? "N/A");
    const safeLocalPartnerName = escapeHtml(localPartnerName || "N/A");
    const safePhoneHref = sanitizeHref(phone);
    const safeEmailHref = sanitizeHref(email);

    const notificationTitle = isLocalPartner
      ? "Local Partner Notification"
      : "Admin Notification";

    const introText = isLocalPartner
      ? `A new customer has registered and verified their email in your territory${localPartnerName ? ` (${safeLocalPartnerName})` : ""}. The account is pending approval. Please review the details below and approve the account in the admin panel.`
      : "A new customer has registered and verified their email. The account is pending admin approval. Please review the details below and approve the account in the admin panel.";

    const emailSubject = isLocalPartner
      ? `[Busy Beans] New Customer Registration in Your Territory - ${name || "Unknown"}`
      : `[Busy Beans] New Customer Registration - ${name || "Unknown"}`;

    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>New Customer Registration</title>
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
                  New Customer Registration
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
                  ${notificationTitle}
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 0;
                  "
                >
                  ${introText}
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
                      Customer ID
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeUserId}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Name
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeName}
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Email
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      <a href="mailto:${safeEmailHref}" style="color: #0066cc">${safeEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Phone
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      <a href="tel:${safePhoneHref}" style="color: #0066cc">${safePhone}</a>
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Company
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeCompany}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Location
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${safeLocation}
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Status
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      Email verified — pending admin approval
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
                  Approve via admin API:
                  PATCH /api/v1/admin/customer-approve/${safeUserId}
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
        to: notifyEmail,
        bcc: ["sigidevelopers@gmail.com"],
        subject: emailSubject,
        html: htmlTemplate,
        attachments: attachment.footer,
        replyTo: requestEmail || undefined,
      },
      (error, info) => {
        if (error) {
          console.error("customerRegistrationAdminNotify error:", error);
        } else {
          console.log("customerRegistrationAdminNotify sent:", info);
        }
      },
    );
  } catch (err) {
    console.log("customerRegistrationAdminNotify error:", err);
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
