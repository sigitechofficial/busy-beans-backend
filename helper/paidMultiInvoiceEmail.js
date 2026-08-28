const fs = require("fs");
const path = require("path");

const { attachments } = require("./attactments");
const { sendMailPromise } = require("./transpoter");
const Footer = require("./footer");
const generateFooterHtml = require("./footerLocalpatner");
const { header } = require("./header");
const {
  logEmailSuccess,
  logEmailOutcome,
} = require("../utils/emailLogOnSuccess");
const GenerateInvoicePdf = require("../utils/generateInvoicePdf");

function buildInvoiceRows(orders) {
  return orders
    .map(
      (o) => `
      <tr>
        <td style="padding: 10px;">${o.invoiceNumber || ""}</td>
        <td style="padding: 10px;">${o.id}</td>
        <td style="padding: 10px; text-align: right;">$${parseFloat(o.lineAmount || o.totalBill || 0).toFixed(2)}</td>
      </tr>`,
    )
    .join("");
}

async function ensureInvoicePdf(orderRow) {
  const folderPath = path.join(__dirname, "..", "public", "invoicePDFs");
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const pdfFileName = `invoice-00${orderRow.id}.pdf`;
  const pdfPath = path.join(folderPath, pdfFileName);

  if (!fs.existsSync(pdfPath)) {
    await GenerateInvoicePdf(orderRow, orderRow.id);
  }

  return {
    filename: pdfFileName,
    path: pdfPath,
    contentType: "application/pdf",
  };
}

async function sendMultiInvoicePaidEmail({
  to,
  orders,
  grandTotal,
  checkoutBatchId,
  isAdminCopy = false,
}) {
  const first = orders[0] || {};
  let footer = await Footer();

  if (first?.salesRep) {
    const partner = first.salesRep;
    footer = generateFooterHtml({
      address: `${partner?.address}, ${partner?.city}, ${partner?.state}, ${partner?.zipCode}, ${partner?.country}`,
      supportEmail: `${partner?.email}`,
      supportNumber: `${partner.countryCode} ${partner.phoneNumber}`,
    });
  }

  const invoiceRows = buildInvoiceRows(orders);
  const invoiceLabels = orders
    .map((o) => o.invoiceNumber || `#${o.id}`)
    .join(", ");

  const pdfAttachments = [];
  for (const orderRow of orders) {
    pdfAttachments.push(await ensureInvoicePdf(orderRow));
  }

  const emailAttachments = [...attachments().footer, ...pdfAttachments];

  const subject = isAdminCopy
    ? `Payment received — Invoices ${invoiceLabels}`
    : `Payment Confirmation — Invoices ${invoiceLabels}`;

  const intro = isAdminCopy
    ? `A combined payment of <strong>$${parseFloat(grandTotal).toFixed(2)}</strong> was received for the following invoices:`
    : `Thank you for your payment of <strong>$${parseFloat(grandTotal).toFixed(2)}</strong>. The following invoices have been paid in full:`;

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to,
    bcc: ["sigidevelopers@gmail.com"],
    subject,
    replyTo: first.patnerEmail || "info@busybeancoffee.com",
    attachments: emailAttachments,
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Confirmation</title>
  </head>
  <body style="margin:0;padding:10px 0;font-family:Arial,sans-serif;background-color:#f8f8f8;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;max-width:600px;">
      <tr><td align="center" style="padding:20px 0">${header}</td></tr>
      <tr>
        <td style="padding:20px 37px;font-size:22px;font-weight:bold;">
          Combined Invoice Payment Received
        </td>
      </tr>
      <tr>
        <td style="padding:0 37px 20px;font-size:16px;line-height:1.5;">
          ${intro}
        </td>
      </tr>
      <tr>
        <td style="padding:0 37px 10px;">
          <table width="100%" cellspacing="0" cellpadding="5" style="border-collapse:collapse;background-color:#f3f3f3;">
            <tr style="background-color:#e0e0e0;">
              <th style="text-align:left;padding:10px;">Invoice #</th>
              <th style="text-align:left;padding:10px;">Order ID</th>
              <th style="text-align:right;padding:10px;">Amount</th>
            </tr>
            ${invoiceRows}
            <tr style="background-color:#e0e0e0;">
              <td colspan="2" style="padding:10px;font-weight:bold;">Total</td>
              <td style="padding:10px;font-weight:bold;text-align:right;">$${parseFloat(grandTotal).toFixed(2)}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 37px 20px;font-size:16px;line-height:1.5;">
          Invoice PDFs are attached for your records.
        </td>
      </tr>
      ${footer}
    </table>
  </body>
</html>`,
  };

  try {
    const info = await sendMailPromise(mailOptions);
    await logEmailSuccess({
      emailType: "multi_invoice_paid",
      orderId: first.id,
      orderType: "customer",
      recipients: to,
      metadata: {
        subject: mailOptions.subject,
        checkoutBatchId,
        invoiceNumbers: invoiceLabels,
        isAdminCopy,
      },
      zeptoRequestId: info?.request_id,
    });
  } catch (error) {
    await logEmailOutcome({
      emailType: "multi_invoice_paid",
      orderId: first.id,
      orderType: "customer",
      recipients: to,
      emailSent: "Failed",
      errorMessage: error?.message || String(error),
      metadata: {
        subject: mailOptions.subject,
        checkoutBatchId,
        isAdminCopy,
      },
    });
    throw error;
  }
}

module.exports = sendMultiInvoicePaidEmail;
