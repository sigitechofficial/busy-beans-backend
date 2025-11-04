const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const attachment = attachments();
const { transporter } = require('./transpoter');
const { header } = require('./header');
let Footer = require('./footer');
module.exports = async function (OTP, data, type) {
  console.log('🚀 ~ OTP:', OTP);
  let footer = await Footer();

  let heading = `Reset password`;
  let preOtpText = `We found a request for forgot password.
  Its okay! its happens. Use this OTP for
  reset your password.`;

  let postOtpText = `If you didn’t request this, please ignore this email. your password won’t change until you access the link above and create a new one.`;

  if (type && type == 'verification') {
    heading = 'Account verification';
    preOtpText = `We found a request account verification.
       Use this OTP for
      to verify your account.`;

    postOtpText = `If you didn’t request this, please ignore this email.`;
  }
  let subject = preOtpText;
  const name = `${data.name}`;
  const to = [data.email];
  console.log(
    '🚀 ~ sigidevelopers:',
    attachment.footer.concat(attachment.security),
  );
  const otp = `${OTP}`;
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      attachments: attachment.footer,
      replyTo: 'noreply@busybeancoffee.com',
      html: `
      
<!DOCTYPE html>
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
          ${header}
        </td>
      </tr>
      <tr>
        <td
          align="center"
          style="
            padding: 20px;
            font-family: 'Chivo', sans-serif;
            color: #000000;
            font-size: 24px;
            font-weight: bold;
            line-height: 1.5;
          "
        >
          OTP Verification Email
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
          Hi ${name}!
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
         ${postOtpText}
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 20px;
            font-family: 'Chivo', sans-serif;
            color: #ef250b;
            font-size: 20px;
            font-weight: bold;
            line-height: 1.5;
            text-align: start;
          "
        >
          ${OTP}
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
          This code is valid for 60 sec. Do not share it
          with anyone.
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
            text-align: center;
          "
        >
          Need help? Contact us at
          <a
            href="mailto:support@busybean.com"
            style="color: #ef250b; text-decoration: underline"
            >support@busybean.com</a
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
