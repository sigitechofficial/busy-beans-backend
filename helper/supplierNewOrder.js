const dotenv = require('dotenv')
dotenv.config({ path: '../.env' })

const { attachments } = require('./attactments')
const attachment = attachments()
const { transporter } = require('./transpoter')
const { footer } = require('./footer')
const { emailDateFormate } = require('../utils/emailDateFormate')

module.exports = function ({ email,data,}) {
  let hiSupplierName = `Hi ${data.supplierName}`
 
  let items = [] 
  data?.items.forEach((ele) => {
    let temp = `
            <tr>
              <td style="padding: 10px;">${ele.product}</td>
              <td style="padding: 10px;">${ele.qty}</td>
            </tr>
            `
    temp = items.push(temp);
    return temp;
  });

    items = items.join('');  
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: [`${email}`], //`${email}` list of receivers
      subject: `${hiSupplierName}! A new order has been placed on Busy Bean..`, // Subject line
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
          New Order Received – Order #${data.id}</td>
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
          A new order has been placed on <strong>Busy Bean</strong>. Below are
          the order details:
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
          <span style="color: rgba(0, 0, 0, 0.7)">${data?.on}</span><br />
          <span style="font-weight: 600">Customer Name:</span>
          <span style="color: rgba(0, 0, 0, 0.6)">${data?.customerName}</span><br />
          <span style="font-weight: 600">Delivery Address:</span>
          <span style="color: rgba(0, 0, 0, 0.6)">{{DeliveryAddress}}</span>
        </td>
      </tr>
      <tr>
        <td style="padding-left: 37px; padding-right: 37px; padding-top: 10px; font-family: 'Nunito', sans-serif; font-size: 14px; line-height: 1.5;">
          <table width="100%" cellspacing="0" cellpadding="5" style="border-collapse: collapse; background-color: #f3f3f3;">
            <tr style="background-color: #e0e0e0;">
              <th style="text-align: left; padding: 10px; font-weight: bold;">Item</th>
              <th style="text-align: left; padding: 10px; font-weight: bold;">Quantity</th>
            </tr>
           ${items}
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
          Please process this order at your earliest convenience. If you have
          any questions or need further details, feel free to contact us at
          <a
            href="mailto:info@busybeancoffee.com"
            style="color: #ef250b; text-decoration: underline"
            >info@busybeancoffee.com</a
          >.
        </td>
      </tr>
       ${footer}
      `,
    },
    function (error, info) {
      if (error) {
        console.log(error)
      } else {
        console.log(info)
      }
    },
  )
}
