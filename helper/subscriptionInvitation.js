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

    const {
      customerEmail,
      userName,
      subscriptionId,
      machine,
      products = [],
      addons = [],
      machinePrice,
      productsTotal,
      addonsTotal,
      totalPrice,
      subscriptionDays,
      requires3DSecure = false, // Flag to indicate if 3D Secure authentication is required
    } = data;

    const frontendPaymentUrl = `https://busybeancoffee.com/subscription-payment/${subscriptionId}`;
    const hiUser = `Hi ${userName || "Valued Customer"}!`;

    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount || 0);
    };

    // Generate products list HTML
    const productsHtml =
      products.length > 0
        ? `
      <div style="margin-top: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <h3 style="font-size: 16px; margin: 0 0 10px 0; color: #333;">Products</h3>
        ${products
          .map(
            (p) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; color: #555;">
            <span>${p.sku} (x${p.quantity})</span>
            <span>${formatCurrency(p.totalPrice)}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `
        : "";

    // Generate addons list HTML
    const addonsHtml =
      addons.length > 0
        ? `
      <div style="margin-top: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <h3 style="font-size: 16px; margin: 0 0 10px 0; color: #333;">Add-ons</h3>
        ${addons
          .map(
            (a) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; color: #555;">
            <span>${a.name || (a.addon ? a.addon.name : "Custom Addon")} (x${a.quantity})</span>
            <span>${formatCurrency(a.totalPrice)}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `
        : "";

    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Complete Your Subscription</title>
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
                  Complete Your Subscription
                </h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 30px 30px">
                <p style="font-size: 16px; font-weight: bold; color: #000000; margin-bottom: 15px;">
                  ${hiUser}
                </p>
                ${
                  requires3DSecure
                    ? `
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                  <p style="font-size: 14px; line-height: 22px; color: #856404; margin: 0; font-weight: bold;">
                    🔒 3D Secure Authentication Required
                  </p>
                  <p style="font-size: 14px; line-height: 22px; color: #856404; margin: 10px 0 0 0;">
                    Your subscription has been created successfully! However, your payment card requires additional authentication (3D Secure). 
                    Please click the button below to complete the secure authentication process and activate your subscription.
                  </p>
                </div>
                <p style="font-size: 14px; line-height: 22px; color: #333333; margin-top: 0;">
                  Please review the subscription details below and click the button to complete the 3D Secure authentication.
                </p>
                `
                    : `
                <p style="font-size: 14px; line-height: 22px; color: #333333; margin-top: 0;">
                  Thank you for choosing Busy Beans! Your subscription has been created and is pending payment. 
                  Please review the details below and click the button to complete your subscription.
                </p>
                `
                }

                <!-- Subscription Details Box -->
                <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <h3 style="margin-top: 0; color: #d4a017; border-bottom: 2px solid #d4a017; padding-bottom: 10px;">Subscription Summary</h3>
                  
                  <!-- Machine -->
                  <div style="margin-top: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <h3 style="font-size: 16px; margin: 0 0 5px 0; color: #333;">Machine</h3>
                    <div style="display: flex; justify-content: space-between; font-size: 14px; color: #555;">
                      <span>${machine.name} (${subscriptionDays} Days)</span>
                      <span>${formatCurrency(machinePrice)}</span>
                    </div>
                  </div>

                  ${productsHtml}
                  ${addonsHtml}

                  <!-- Total -->
                  <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #000;">
                    <span>Total Amount</span>
                    <span>${formatCurrency(totalPrice)}</span>
                  </div>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${frontendPaymentUrl}" 
                     style="background-color: #d4a017; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                    ${requires3DSecure ? "Complete 3D Secure Authentication" : "Buy Subscription"}
                  </a>
                  <p style="margin-top: 15px; font-size: 12px; color: #888;">
                    Or copy this link: <a href="${frontendPaymentUrl}" style="color: #666;">${frontendPaymentUrl}</a>
                  </p>
                </div>

                <p style="font-size: 14px; line-height: 22px; color: #333333; margin-top: 20px;">
                  If you have any questions, feel free to contact our support team.
                </p>
              </td>
            </tr>
            ${footer}
`;

    // Send Email
    transporter.sendMail(
      {
        from: process.env.EMAIL_USERNAME,
        to: [customerEmail, "sigidevelopers@gmail.com"], // Send to customer and developers
        subject: requires3DSecure
          ? `Action Required: Complete 3D Secure Authentication for Your Subscription`
          : `Complete Your Busy Beans Subscription`,
        html: htmlTemplate,
        attachments: attachment.footer,
        replyTo: "noreply@busybeancoffee.com",
      },
      function (error, info) {
        if (error) {
          console.log("Email error:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      }
    );
  } catch (err) {
    console.log("Email sending error:", err);
  }
};
