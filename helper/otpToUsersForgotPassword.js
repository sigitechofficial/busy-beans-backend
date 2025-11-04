const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const attachment = attachments();
const { transporter } = require('./transpoter');
const Footer = require('./footer');
const { header } = require('./header');
const { emailDateFormate } = require('../utils/emailDateFormate');

module.exports = async function ({ email, name = '', otp = '' }) {
  let footer = await Footer();
  let hiCustomer = `Hi ${name}!`;
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: [`${email}`, 'sigidevelopers@gmail.com'], //`${email}` list of receivers
      subject: `Password Reset OTP Code – Busy Bean Coffee Inc.`, // Subject line
      attachments: attachment.footer,
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
    <title>Busy Bean</title>
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
        <td align="center" style="padding: 5px 0">
           ${header}
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
          ${hiCustomer}
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
          We received a request to reset your <b>Busy Bean Coffee Inc.</b> account password.  
          Please use the following One-Time Password (OTP) to proceed:
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-top: 10px;
            padding-left: 37px;
            font-family: 'Chivo', sans-serif;
            color: #86644c;
            font-size: 60px;
            font-weight: bold;
            letter-spacing: 25px;
            text-align: center;
          "
        >
          ${otp}
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 10px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.5;
          "
        >
          This code is valid for <b>15 minutes</b>.  
          If you didn’t request a password reset, please ignore this email.
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
            text-align: start;
          "
        >
          Need help? Contact us at
          <a
            href="mailto:info@busybeancoffee.com"
            style="color: #86644c; text-decoration: underline"
            >info@busybeancoffee.com</a
          >.
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
