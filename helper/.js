const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const attachment = attachments();
const { transporter } = require('./transpoter');
const { footer } = require('./footer');
const { emailDateFormate } = require('../utils/emailDateFormate');
const { header } = require('./header');

module.exports = function ({ email, data, satge = 'Confirmed', invoice }) {
  const addressParts = [
    data?.address?.companyaddress,
    data?.address?.addressLineOne,
    data?.address?.addressLineTwo,
    data?.address?.town,
    data?.address?.state,
    data?.address?.zipCode,
    data?.address?.country,
  ];

  const DeliveryAddress = addressParts
    .filter((part) => part && part.trim() !== '') // remove null/undefined/empty strings
    .join(', ')
    .concat('.');

  let items = [];
  data?.items.forEach((ele) => {
    let temp = `
             <tr>
              <td style="padding: 10px;">${ele.product}</td>
              <td style="padding: 10px;">${ele.qty}</td>
              <td style="padding: 10px;">$${parseFloat((ele.price / ele.qty).toFixed(2))}</td>
              <td style="padding: 10px;">$${ele?.price}</td>
            </tr>
            `;
    temp = items.push(temp);
    return temp;
  });

  const on = emailDateFormate(data?.on);
  items = items.join('');
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: ['sigidevelopers@gmail.com', email], //`${email}` list of receivers
      subject: `${data?.companyName} Just Placed an Order – #${data.id}`, // Subject line
      attachments: attachment.footer,
      replyTo: data?.email,
      html: ` <!DOCTYPE html>
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
         A new order <strong>#${data.id}</strong> has been placed by <strong>${data?.companyName}</strong> on 
      <strong>
        <a href="https://busybeancoffee.com" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
          Busy Bean Coffee
        </a>
      </strong>.
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
            font-size: 18px;
            font-weight: bold;
          "
        >
          Order Details:
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 6px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.5;
          "
        >
          <span style="font-weight: 600">Order ID:</span>
          <span style="color: #54a24a; font-weight: 600">${data?.id}</span><br />
          <span style="font-weight: 600">Order Date:</span>
          <span style="color: rgba(0, 0, 0, 0.7)">${on}</span><br />
          <span style="font-weight: 600">Company Name:</span>
          <span style="color: rgba(0, 0, 0, 0.6)">${data?.companyName}</span><br />
          <span style="font-weight: 600">Delivery Address:</span>
          <span style="color: rgba(0, 0, 0, 0.6)">${DeliveryAddress}</span>
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
              <td style="text-align: left; padding: 10px; font-weight: bold;">Shipping charges</td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;">$${data.shippingCharges}</td>
            </tr>
            <tr style="background-color: #e0e0e0;">
              <td style="text-align: left; padding: 10px; font-weight: bold;">Total</td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;">$${data.totalBill}</td>
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
          If you have any questions or need further details, please reply to this email. 
          
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
