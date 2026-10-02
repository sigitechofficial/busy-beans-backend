const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const attachment = attachments();
const { transporter } = require("./transpoter");
const { customerEmailRecipients, leadAlertRecipients } = require("../utils/emailRecipients");
let Footer = require("./footer");
let { header } = require("./header");

module.exports = async function ({ lead, quotationAmount }) {
  try {
    let footer = await Footer();

    // Extract lead data fields
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
    } = lead;

    const hiUser = `Hi ${contactName}!`;

    const fullAddress = `${addressLineOne || ""}, ${addressLineTwo || ""}, ${city || ""}, ${state || ""}, ${country || ""}, ${zipCode || ""}`;

    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Your Quotation is Ready</title>
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
                  Your Quotation is Ready!
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
                  Hi ${contactName}!
                </p>
                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 0;
                  "
                >
                  Thank you for your interest in our products and services. Based on your request, we are pleased to provide you with a customized quotation.
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin: 20px 0 10px 0;
                  "
                >
                  <strong>Quotation Details:</strong>
                </p>

                <div
                  style="
                    background-color: #f9f9f9;
                    padding: 20px;
                    border-radius: 5px;
                    margin: 15px 0;
                  "
                >
                  <p
                    style="
                      font-size: 18px;
                      font-weight: bold;
                      color: #000000;
                      margin: 0;
                    "
                  >
                    Quotation Amount: <span style="color: #4CAF50;">$${quotationAmount || estimatedValue || "TBD"}</span>
                  </p>
                </div>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin: 20px 0 10px 0;
                  "
                >
                  <strong>Your Request Summary:</strong>
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin: 0;
                  "
                >
                  <strong>Type:</strong> ${type || "N/A"}<br />
                  <strong>Contact Name:</strong> ${contactName}<br />
                  ${role ? `<strong>Role:</strong> ${role}<br />` : ""}
                  <strong>Company:</strong> ${company || "N/A"}<br />
                  <strong>Email:</strong> ${contactEmail}<br />
                  <strong>Phone:</strong> ${contactPhone}<br />
                  <strong>Preferred Contact:</strong> ${preferredContact || "N/A"}<br />
                  <strong>Address:</strong> ${fullAddress}<br />
                  ${businessType ? `<strong>Business Type:</strong> ${businessType}<br />` : ""}
                  ${leadSource ? `<strong>Lead Source:</strong> ${leadSource}<br />` : ""}
                  ${snapshotUseCase ? `<strong>Use Case:</strong> ${snapshotUseCase}<br />` : ""}
                  ${snapshotVolume ? `<strong>Volume:</strong> ${snapshotVolume}<br />` : ""}
                  ${snapshotTimeline ? `<strong>Timeline:</strong> ${snapshotTimeline}<br />` : ""}
                  ${estimatedValue ? `<strong>Estimated Value:</strong> ${estimatedValue}<br />` : ""}
                  <strong>Notes/Requirements:</strong> ${notes || "None"}
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 20px;
                  "
                >
                  Our team is ready to discuss this quotation with you and answer any questions you may have. We are committed to providing you with the best solution for your business needs.
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 0;
                  "
                >
                  If you would like to proceed with this quotation or need any modifications, please feel free to contact us directly.
                </p>

                <p style="font-size: 14px; line-height: 22px; color: #333333">
                  We look forward to working with you!
                </p>
              </td>
            </tr>
       ${footer}
`;

    // Send Email
    // Customer + developer copy, or only the staging test recipient (Email Configuration → Recipients).
    const to = await customerEmailRecipients(contactEmail);
    if (!to.length) return;
    transporter.sendMail(
      {
        from: process.env.EMAIL_USERNAME,
        to,
        subject: `${hiUser} Your Quotation is Ready`,
        html: htmlTemplate,
        attachments: attachment.footer,
        replyTo: "noreply@busybeancoffee.com",
      },
      function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log(info);
        }
      }
    );
  } catch (err) {
    console.log("Email sending error:", err);
  }
};
