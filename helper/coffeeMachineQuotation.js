const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { attachments } = require("./attactments");
const attachment = attachments();
const { transporter } = require("./transpoter");
let Footer = require("./footer");

module.exports = async function ({
  email,
  name = "",
  boardingLink = "",
  password,
}) {
  console.log("🚀 ~ boardingLink:", boardingLink);
  let footer = await Footer();
  let hiUser = `Hi ${name}!`;
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: [`${email}`, "sigidevelopers@gmail.com"], //`${email}` list of receivers
      subject: `${hiUser}! Welcome to Busy Bean. To start receiving online payments connect your Stripe account`, // Subject line
      attachments: attachment.footer,
      replyTo: "noreply@busybeancoffee.com",
      html: `<!DOCTYPE html>
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
                  Hi [Customer Name]!
                </p>
                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 0;
                  "
                >
                  Thank you for submitting your request for the [Machine
                  Name/Model] through our website. We've received your details,
                  and our team will be reaching out to you shortly to confirm
                  your requirements and guide you with the next steps.
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
                  <strong>Machine:</strong> [Machine Name]<br />
                  <strong>Name:</strong> [Customer Name]<br />
                  <strong>Phone:</strong> [Phone Number]<br />
                  <strong>Address:</strong> [Customer Address]<br />
                  <strong>Notes/Requirements:</strong> [If provided]
                </p>

                <p
                  style="
                    font-size: 14px;
                    line-height: 22px;
                    color: #333333;
                    margin-top: 20px;
                  "
                >
                  Our representative will contact you within [X hours / 1
                  working day] to confirm your request and process your order.
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
                  If you have any questions, feel free to reach out to our
                  support team.
                </p>
              </td>
            </tr>
       ${footer}
      `,
    },
    function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log(info);
      }
    }
  );
};
