const dotenv = require('dotenv')
dotenv.config({ path: '../.env' })

const { attachments } = require('./attactments')
const attachment = attachments()
const { transporter } = require('./transpoter')
const { footer } = require('./footer')
const { emailDateFormate } = require('../utils/emailDateFormate')

module.exports = function ({ email,data, invoice}) {
  console.log("🚀 ~ data:", data)
  let hiSupplierName = `Hope you're doing well`
 
  let items = [] 
  data?.items.forEach((ele) => {
    let temp = `
            <tr>
              <td style="padding: 10px;">${ele.product}</td>
              <td style="padding: 10px;">${ele.qty}</td>
              <td style="padding: 10px;">$${ele.price}</td>
              <td style="padding: 10px;">$${(parseFloat(ele?.price) * ele?.qty).toFixed(2)}</td>
            </tr>
            `
    temp = items.push(temp);
    return temp;
  });

  items = items.join('');  
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: email, //`${email}` list of receivers
      subject: `Your Order ${data.id} – Please Complete Your Payment`, // Subject line
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
           Complete Payment for Order ${data.id}
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
         You have placed an order on Busy Bean. Please review the details below and click the button to pay your invoice.
        </td>
      </tr>
       <tr align="center">
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 20px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          "
        >
          <a
            href="${invoice?.hostedInvoiceUrl}"
            style="
              padding: 10px 20px;
              background-color: #86644c;
              color: #ffffff;
              text-decoration: none;
              border-radius: 5px;
              font-family: 'Chivo', sans-serif;
              font-size: 16px;
            "
          >
            Pay Invoice
          </a>
          
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
              <td style="text-align: left; padding: 10px; font-weight: bold;">VAT</td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;"></td>
              <td style="text-align: left; padding: 10px; font-weight: bold;">$${data.vat}</td>
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
          If you'd like to place an order or need a customized package, feel free to contact us directly. We're happy to serve you quality coffee, delivered fresh.<br>Looking forward to your response!
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
