const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const attachment = attachments();
const { transporter } = require('./transpoter');
let Footer = require('./footer');

module.exports = async function ({
  email,
  name = '',
  boardingLink = '',
  password,
}) {
  console.log('🚀 ~ boardingLink:', boardingLink);
  let footer = await Footer();
  let hiUser = `Hi ${name}!`;
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: [`${email}`, 'sigidevelopers@gmail.com'], //`${email}` list of receivers
      subject: `${hiUser}! Welcome to Busy Bean. To start receiving online payments connect your Stripe account`, // Subject line
      attachments: attachment.footer,
      replyTo: 'noreply@busybeancoffee.com',
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
    <title>Welcome to Busy Bean</title>
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
      style="border-collapse: collapse; max-width: 600px"
    >
      <tr>
        <td align="center" style="padding: 20px 0">
          <img
            src="cid:logo"
            alt="Image"
            width="316"
            height="147"
            style="border-radius: 16px"
          />
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            font-family: 'Chivo', sans-serif;
            color: #000000;
            font-size: 24px;
            font-weight: bold;
            line-height: 1.5;
          "
        >
          ${hiUser}
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.5;
          "
        >
          To start receiving online payments from your customers directly
          through Busy Bean, you'll need to connect your Stripe account. Stripe
          is our trusted payment processor, enabling secure and efficient
          transactions.
        </td>
      </tr>
      <!-- Insert below the "To start receiving online payments..." paragraph and above "If you have any questions..." -->
   <br>
       <tr>
  <td
    style="
      padding-left: 37px;
      padding-right: 37px;
      font-family: 'Chivo', sans-serif;
      font-size: 16px;
    "
  >
    <a
      href="${boardingLink}"
      style="
        display: inline-block;
        background-color: #905E47;
        color: #ffffff !important;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 4px;
        font-weight: bold;
      "
    >
      Connect Your Stripe Account
    </a>
  </td>
</tr>

      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 30px;
            font-family: 'Chivo', sans-serif;
            font-size: 18px;
            font-weight: bold;
            color: #000000;
          "
        >
          Why connect your Stripe account?
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 10px;
            font-family: 'Chivo', sans-serif;
            font-size: 16px;
            color: rgba(0, 0, 0, 0.8);
            line-height: 1.4;
          "
        >
          <strong>• Seamless Payments:</strong> Allow your customers to pay you
          directly through your Busy Bean bookings and invoices.<br /><br />
          <strong>• Secure Transactions:</strong> Benefit from Stripe's
          industry-leading security and fraud prevention measures.<br /><br />
          <strong>• Automated Payouts:</strong> Easily manage your earnings with
          automated transfers to your bank account.
        </td>
      </tr>

      
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 20px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.5;
          "
        >
          If you have any questions, feel free to reach out to our support team.
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
    },
  );
};
