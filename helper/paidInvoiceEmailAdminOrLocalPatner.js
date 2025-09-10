const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const { transporter } = require('./transpoter');
const Footer = require('./footer');
const { header } = require('./header');
const { emailDateFormate } = require('../utils/emailDateFormate');
const GenerateInvoicePdf = require('../utils/generateInvoicePdf');

// async function downloadPDF(pdfUrl, outputPath) {
//   const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
//   fs.writeFileSync(outputPath, response.data);
// }
module.exports = async function ({ email, data, invoice }) {
  // console.log('ðŸš€ ~ data:', data);
  //will use from env BASE URL
  let footer = await Footer();

  const on = emailDateFormate(data?.on || data?.createdAt);
  console.log('__dirname:', __dirname);

  const folderPath = path.join(__dirname, '..', 'public', 'invoicePDFs');
  // Create the folder if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true }); // Ensures parent folders are created if missing
    console.log("📁 'public/invoicePDFs' folder created.");
  }

  const pdfFileName = `invoice-00${data.id}.pdf`; // or use your original naming
  let pdfPath = path.join(folderPath, pdfFileName);

  // Now it's safe to check file existence
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    await GenerateInvoicePdf(data, data.id);
    pdfPath = path.join(folderPath, pdfFileName);
    console.error(`📁 New invoice Generated: ${pdfPath}`);
  } else {
    console.error(`📁 invoice Found no need to create New one: ${pdfPath}`);
  }

  const emailAttachments = [
    ...attachments().footer,
    {
      filename: `invoice-00${data.id}.pdf`,
      path: pdfPath,
      contentType: 'application/pdf',
    },
  ];
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

  items = items.join('');
  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: ['sigidevelopers@gmail.com', email], //`${email}` list of receivers
      subject: `Busy Bean Coffee Invoice #${data?.invoiceNumber || ''} Payment Completed`, // Subject line
      replyTo: data.email,
      attachments: emailAttachments,
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
            padding-top: 20px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.5;
          "
        >
        The customer has successfully completed the payment for <strong>Busy Beans Coffee order #${data.id}</strong>.  
        <br />
        You can review the order details below.
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
          <span style="color: rgba(0, 0, 0, 0.6)">${data?.companyName || ''}</span><br />
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
             If you have any questions or need further details, please reply to this email. 
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
