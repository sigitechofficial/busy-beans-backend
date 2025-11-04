const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const { attachments } = require('./attactments');
const attachment = attachments();
const { transporter } = require('./transpoter');
let Footer = require('./footer');
const generateFooterHtml = require('./footerLocalpatner');
const { emailDateFormate } = require('../utils/emailDateFormate');

module.exports = async function ({ email, data }) {
  let footer = await Footer();

  let hiSupplierName = `Hi ${data.supplierName}`;

  const lcoalPatner = data?.salesRep;
  if (lcoalPatner) {
    footer = generateFooterHtml({
      address: `${lcoalPatner?.address}, ${lcoalPatner?.city}, ${lcoalPatner?.state}, ${lcoalPatner?.zipCode}, ${lcoalPatner?.country}`,
      supportEmail: `${lcoalPatner?.email}`,
      supportNumber: `${lcoalPatner.countryCode} ${lcoalPatner.phoneNumber}`,
    });
  }

  console.log('🚀 ~ footer:', email);
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
    if (ele.type == 'product') {
      let temp = `
            <tr>
              <td style="padding: 10px;">${ele.supplierSku || ''}</td>
              <td style="padding: 10px;">${ele.product || ele.productName} ${ele.grind || ''}</td>
              <td style="padding: 10px;">${ele.qty || ''}</td>
            </tr>
            `;
      temp = items.push(temp);
      return temp;
    }
  });

  items = items.join('');
  const on = emailDateFormate(data?.on);
  const htmlSnipit = `
  <span style="color: #161616ff; font-weight: 600">Deliver To</span><br>
  ${data?.companyName ? `<span style="margin: 0; color:black;">${data.companyName}</span><br>` : ''}
  ${data?.customerName ? `<span style="margin: 0; color:black;">${data.customerName}</span><br>` : ''}
  ${data?.address?.companyaddress ? `<span style="margin: 0; color:black;">${data.address.companyaddress}</span><br>` : ''}
  ${data?.address?.addressLineOne ? `<span style="margin: 0; color:black;">${data.address.addressLineOne}</span><br>` : ''}
  ${data?.address?.addressLineTwo ? `<span style="margin: 0; color:black;">${data.address.addressLineTwo}</span><br>` : ''}
  ${
    data?.address?.town || data?.address?.state || data?.address?.zipCode
      ? `
    <span style="margin: 0; color:black;">
      ${data.address.town || ''} ${data.address.state || ''} ${data.address.zipCode || ''}
    </span><br>`
      : ''
  }
  ${data?.address?.country ? `<span style="margin: 0; color:black;">${data.address.country}</span><br>` : ''}
  ${data?.countryCode && data?.phoneNumber ? `<span style="margin: 0; color:black;">Phone: ${data.countryCode}${data.phoneNumber}</span><br>` : ''}
  ${on ? `<span style="margin-top: 20px; color:black;">Dispatched on ${on}</span>` : ''}
`;

  transporter.sendMail(
    {
      from: process.env.EMAIL_USERNAME, // sender address
      to: ['sigidevelopers@gmail.com', email], //`${email}` list of receivers
      subject: `${hiSupplierName}, You’ve Received a New Order #${data.id} to Fulfill`, // Subject line
      attachments: attachment.footer,
      replyTo: data?.patnerEmail || 'info@busybeancoffee.com',
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
                  width="250"
                  height="100"
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
          Please ship the following order.
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
          <h3>Order #${data?.id}</h3>
        </td>
      </tr>
      <tr>
        <td
          style="
            padding-left: 37px;
            padding-right: 37px;
            padding-top: 0px;
            font-family: 'Chivo', sans-serif;
            color: rgba(0, 0, 0, 0.8);
            font-size: 16px;
            line-height: 1.5;
          "
        >
        ${htmlSnipit}
      </tr>
      <tr>
        <td style="padding-left: 37px; padding-right: 37px; padding-top: 10px; font-family: 'Nunito', sans-serif; font-size: 14px; line-height: 1.5;">
          <table width="100%" cellspacing="0" cellpadding="5" style="border-collapse: collapse; background-color: #f3f3f3;">
            <tr style="background-color: #e0e0e0;">
              <th style="text-align: left; padding: 10px; font-weight: bold;">SKU</th>
            <th style="text-align: left; padding: 10px; font-weight: bold;">Item</th>
              <th style="text-align: left; padding: 10px; font-weight: bold;">Quantity</th>
            </tr>
           ${items}
            <tr>
              <td style="padding: 10px;"><b>Total</b><td>
              <td style="padding: 10px;"><b>${data?.totalQuantity}</b></td>
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
