const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const attachment = attachments();
const { transporter } = require("./transpoter");
let Footer = require("./footer");
let { header } = require("./header");

module.exports = async function ({ data }) {
  try {
    let footer = await Footer();

    // Extract data fields
    const {
      contactName,
      contactPhone,
      contactEmail,
      addressLineOne,
      addressLineTwo,
      city,
      state,
      country,
      zipCode,
      company,
      role,
      type,
      leadSource,
      preferredContact,
      businessType,
      snapshotType,
      snapshotUseCase,
      snapshotVolume,
      snapshotTimeline,
      estimatedValue,
      notes,
      userId,
      machineId,
    } = data;

    const fullAddress = `${addressLineOne}, ${addressLineTwo}, ${city}, ${state}, ${country}, ${zipCode}`;

    // Admin notification template
    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>New Coffee Machine Lead Received</title>
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
                  New Coffee Machine Lead Received
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
                  A new coffee machine lead has been submitted through the website.
                  Please review the details below and follow up with the customer.
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin: 20px 0 10px 0;
                  "
                >
                  <strong>Lead Details:</strong>
                </p>

                <table
                  style="
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                    margin-bottom: 20px;
                  "
                >
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Machine
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${data?.machineName} ${machineId ? `(ID: ${machineId})` : ""}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Type
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${type || "N/A"}
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Contact Name
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${contactName}
                    </td>
                  </tr>
                  ${
                    role
                      ? `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Role
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${role}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  <tr ${role ? "" : 'style="background-color: #f9f9f9"'}>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Company
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${company || "N/A"}
                    </td>
                  </tr>
                  <tr ${role ? 'style="background-color: #f9f9f9"' : ""}>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Email
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      <a href="mailto:${contactEmail}" style="color: #0066cc">${contactEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Phone
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      <a href="tel:${contactPhone}" style="color: #0066cc">${contactPhone}</a>
                    </td>
                  </tr>
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Preferred Contact
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${preferredContact || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Address
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${fullAddress}
                    </td>
                  </tr>
                  ${
                    businessType
                      ? `
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Business Type
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${businessType}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    leadSource
                      ? `
                  <tr ${businessType ? "" : 'style="background-color: #f9f9f9"'}>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Lead Source
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${leadSource}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    snapshotUseCase
                      ? `
                  <tr ${(businessType && !leadSource) || (!businessType && leadSource) ? 'style="background-color: #f9f9f9"' : ""}>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Use Case
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${snapshotUseCase}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    snapshotVolume
                      ? `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Volume
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${snapshotVolume}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    snapshotTimeline
                      ? `
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Timeline
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${snapshotTimeline}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    estimatedValue
                      ? `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      Estimated Value
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${estimatedValue}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    userId
                      ? `
                  <tr style="background-color: #f9f9f9">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold">
                      User ID
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${userId}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                  ${
                    notes
                      ? `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; vertical-align: top">
                      Notes/Requirements
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd">
                      ${notes}
                    </td>
                  </tr>
                  `
                      : ""
                  }
                </table>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 20px;
                    background-color: #fff3cd;
                    padding: 10px;
                    border-left: 4px solid #ffc107;
                  "
                >
                  <strong>Action Required:</strong> Please contact this lead within 24 hours
                  to confirm their requirements and process their request.
                </p>

                <p style="font-size: 14px; line-height: 22px; color: #333333">
                  This is an automated notification. Please do not reply to this email.
                </p>
              </td>
            </tr>
       ${footer}
`;

    // Send Email to Admin
    transporter.sendMail(
      {
        from: process.env.EMAIL_USERNAME,
        to: "sigidevelopers@gmail.com",
        subject: `New Lead: ${contactName} - ${data?.machineName}`,
        html: htmlTemplate,
        attachments: attachment.footer,
        replyTo: contactEmail,
      },
      function (error, info) {
        if (error) {
          console.log("Admin email error:", error);
        } else {
          console.log("Admin email sent:", info);
        }
      }
    );
  } catch (err) {
    console.log("Admin email sending error:", err);
  }
};
