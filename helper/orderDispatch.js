const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const { transporter } = require('./transpoter');
let Footer = require('./footer');
const generateFooterHtml = require('./footerLocalpatner');
const { header } = require('./header');
const { emailDateFormate } = require('../utils/emailDateFormate');

// async function downloadPDF(pdfUrl, outputPath) {
//   const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
//   fs.writeFileSync(outputPath, response.data);
// }

module.exports = async function ({ email, data, invoice }) {
  console.log('ðŸš€ ~ data:', data);
  //will use from env BASE URL
  let footer = await Footer();
  const lcoalPatner = data?.salesRep;
  if (lcoalPatner) {
    footer = generateFooterHtml({
      address: `${lcoalPatner?.address}, ${lcoalPatner?.city}, ${lcoalPatner?.state}, ${lcoalPatner?.zipCode}, ${lcoalPatner?.country}`,
      supportEmail: `${lcoalPatner?.email}`,
      supportNumber: `${lcoalPatner.countryCode} ${lcoalPatner.phoneNumber}`,
    });
    // console.log("🚀 ~ footer:", footer)
  }

  let items = [];
  data?.items.forEach((ele) => {
    let temp = `
            <tr>
              <td style="padding: 10px;">${ele.product || ele.productName} ${ele.grind || ''} </td>
              <td style="padding: 10px;">${ele.qty}</td>
              <td style="padding: 10px;">$${parseFloat((ele.price / ele.qty).toFixed(2))}</td>
              <td style="padding: 10px;">$${ele?.price}</td>
            </tr>
            `;
    temp = items.push(temp);
    return temp;
  });

  items = items.join('');
  const on = emailDateFormate(data?.on);
  email.push('sigidevelopers@gmail.com');
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: email, //`${email}` list of receivers
      subject: `Busy Bean Coffee Update: Order #${data.id} Has Been Shipped.`, // Subject line
      attachments: attachments().footer,
      replyTo: data?.patnerEmail || 'noreply@busybeancoffee.com',
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
      </tr>
      <tr>
    
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
        Your Busy Beans Coffee order <strong>#${data.id}</strong> has been shipped and is on its way to you!<br />
        Sit tight, your fresh coffee will be arriving soon. You can find the full order details below.
      </td>
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
          <span style="font-weight: 600">Po Number:</span>
          <span style="color: #54a24a; font-weight: 600">${data?.poNumber || ''}</span><br />
          <span style="font-weight: 600">Order Date:</span>
          <span style="color: rgba(0, 0, 0, 0.7)">${on}</span><br />
          <span style="font-weight: 600">Company Name:</span>
          <span style="color: rgba(0, 0, 0, 0.6)">${data?.companyName}</span><br />
           <span style="font-weight: 600">Shipping Company:</span>
          <span style="color: rgba(0, 0, 0, 0.6)">${data?.shippingCompany || ''}</span><br />
          <span style="font-weight: 600">Tracking Number:</span>
          <span style="color: rgba(0, 0, 0, 0.6)">${data?.trackingNumber || ''}</span><br />
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
          If you'd like to place an order or need a customized package, feel free to visit our <a href="https://busybeancoffee.com" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
  website
</a>. We're happy to serve you quality coffee, delivered fresh.<br>If you have any questions or need further details, please reply to this email. 
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
