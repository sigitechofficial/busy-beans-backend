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
    } = data;

    const hiUser = `Hi ${contactName}!`;

    const fullAddress = `${addressLineOne}, ${addressLineTwo}, ${city}, ${state}, ${country}, ${zipCode}`;

    // Same template design — ONLY replaced placeholders []
    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>We've received your coffee machine request</title>
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
                  We've received your coffee<br />machine request
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
                  Thank you for submitting your request for the <strong>${data?.machineName}</strong>
                  through our website. We've received your details, and our team
                  will be reaching out to you shortly to confirm your requirements
                  and guide you with the next steps.
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin: 20px 0 10px 0;
                  "
                >
                  <strong>Here's a quick summary of your request:</strong>
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin: 0;
                  "
                >
                  <strong>Machine:</strong> ${data?.machineName}<br />
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
                  Our representative will contact you within 24 hours to confirm
                  your request and process your order.
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 0;
                  "
                >
                  We appreciate your interest and look forward to helping you
                  get the perfect coffee machine for your business.
                </p>

                <p style="font-size: 14px; line-height: 22px; color: #333333">
                  If you have any questions, feel free to reach out to our support
                  team.
                </p>
              </td>
            </tr>
       ${footer}
`;

    // Send Email
    transporter.sendMail(
      {
        from: process.env.EMAIL_USERNAME,
        to: [data?.email, "sigidevelopers@gmail.com"],
        subject: `${hiUser} Your Coffee Machine Request Has Been Received`,
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
