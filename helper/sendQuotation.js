const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const attachment = attachments();
const { transporter } = require('./transpoter');
let Footer = require('./footer');

const generateFooterHtml = require('./footerLocalpatner');
const { header } = require('./header');

const { emailDateFormate } = require('../utils/emailDateFormate');

module.exports = async function ({ email, data, lcoalPatner }) {
  let footer = await Footer();

  if (lcoalPatner) {
    footer = generateFooterHtml({
      address: `${lcoalPatner?.address}, ${lcoalPatner?.city}, ${lcoalPatner?.state}, ${lcoalPatner?.zipCode}, ${lcoalPatner?.country}`,
      supportEmail: `${lcoalPatner?.email}`,
      supportNumber: `${lcoalPatner.countryCode} ${lcoalPatner.phoneNumber}`,
    });
    // console.log("🚀 ~ footer:", footer)
  }

  console.log('ðŸš€ ~ data:', data);
  let hiSupplierName = `Hope you're doing well`;

  let items = [];
  data?.items.forEach((ele) => {
    let temp = `
            <tr>
              <td style="padding: 10px;">${ele.name}</td>
              <td style="padding: 10px;">${ele.qty}</td>
              <td style="padding: 10px;">$${ele.price}</td>
              <td style="padding: 10px;">$${(parseFloat(ele?.price) * ele?.qty).toFixed(2)}</td>
            </tr>
            `;
    temp = items.push(temp);
    return temp;
  });

  items = items.join('');
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: ['sigidevelopers@gmail.com', email], //`${email}` list of receivers
      subject: `We are excited to share with you a customized quotation for our premium coffee blends`, // Subject line
      attachments: attachment.footer,
      replyTo: lcoalPatner?.email || 'noreply@busybeancoffee.com',
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
          ${hiSupplierName},
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
         I hope this message finds you well. We are excited to share with you a customized quotation for our premium coffee blends, curated to suit your taste and business needs.<br>Please find below the details of our offer:
        </td>
      </tr>
      <tr>
        <td style="padding-left: 37px; padding-right: 37px; padding-top: 10px; font-family: 'Nunito', sans-serif; font-size: 14px; line-height: 1.5;">
          <table width="100%" cellspacing="0" cellpadding="5" style="border-collapse: collapse; background-color: #f3f3f3;">
            <tr style="background-color: #e0e0e0;">
              <th style="text-align: left; padding: 10px; font-weight: bold;">Item</th>
              <th style="text-align: left; padding: 10px; font-weight: bold;">Quantity</th>
              <th style="text-align: left; padding: 10px; font-weight: bold;">Unit Price</th>
              <th style="text-align: left; padding: 10px; font-weight: bold;">Amount</th>
            </tr>
           ${items}
           <tr style="background-color: #e0e0e0;">
              <td style="text-align: left; padding: 10px; font-weight: bold;">Total</td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;">$${data.itemsPrice}</td>
            </tr>
          </table>
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
          If you'd like to place an order or need a customized package, feel free to contact us directly. We're happy to serve you quality coffee, delivered fresh.<br>Looking forward to your response!
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
