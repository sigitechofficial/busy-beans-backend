const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');

const generateInvoicePdf = async (data, invoiceId, issueDate) => {
  // Get today's date in UTC and format it as DD/MM/YYYY
  const currentUTC = new Date().toISOString().split('T')[0]; // e.g., 2025-07-16
  const [year, month, day] = currentUTC.split('-');
  data.on = `${day}/${month}/${year}`; // e.g., 16/07/2025

  const templatePath = path.join(__dirname, '../views/invoice-template.ejs');
  const html = await ejs.renderFile(templatePath, { order: data });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outputPath = path.join(
    __dirname,
    `../public/invoicePDFs/invoice-00${invoiceId}.pdf`,
  );
  await page.pdf({ path: outputPath, format: 'A4' });

  await browser.close();

  return { outputPath, fileName: `invoice-00${invoiceId}.pdf` };
};

module.exports = generateInvoicePdf;
