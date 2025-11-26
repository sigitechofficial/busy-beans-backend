const ejs = require("ejs");
const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs");
const { account } = require("../models"); // adjust path to your models

const generateInvoicePdf = async (data, invoiceId, issueDate) => {
  const currentUTC = new Date().toISOString().split("T")[0];
  const [year, month, day] = currentUTC.split("-");
  data.on = `${day}/${month}/${year}`;
  const adm = await account.findOne({
    attributes: [
      "email",
      "supportEmail",
      "phoneNumber",
      "countryCode",
      "address",
      "city",
      "state",
      "zipCode",
      "country",
    ],
  });

  const templatePath = path.join(__dirname, "../views/invoice-template.ejs");
  const html = await ejs.renderFile(templatePath, { order: data, admin: adm });

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const outputPath = path.join(
    __dirname,
    `../public/invoicePDFs/invoice-00${invoiceId}.pdf`
  );
  await page.pdf({ path: outputPath, format: "A4" });

  await browser.close();

  return { outputPath, fileName: `invoice-00${invoiceId}.pdf` };
};

module.exports = generateInvoicePdf;
