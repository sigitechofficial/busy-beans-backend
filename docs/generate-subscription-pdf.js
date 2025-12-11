const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

async function generatePDF() {
  // Read the markdown file
  const markdownPath = path.join(
    __dirname,
    "Subscription_API_Frontend_Integration_Guide.md"
  );
  const markdownContent = fs.readFileSync(markdownPath, "utf8");

  // Convert markdown to HTML
  const htmlContent = convertMarkdownToHTML(markdownContent);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Set content
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  // Generate PDF
  const pdfPath = path.join(
    __dirname,
    "Subscription_API_Frontend_Integration_Guide.pdf"
  );
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      right: "15mm",
      bottom: "20mm",
      left: "15mm",
    },
  });

  await browser.close();
  console.log(`✅ PDF generated successfully: ${pdfPath}`);
}

function convertMarkdownToHTML(markdown) {
  let html = markdown;
  const lines = html.split("\n");
  const result = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let inList = false;
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        result.push(
          `<pre><code>${escapeHtml(codeBlockContent.join("\n"))}</code></pre>`
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Handle headers
    if (trimmed.startsWith("#### ")) {
      closeList();
      result.push(`<h4>${trimmed.substring(5)}</h4>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeList();
      result.push(`<h3>${trimmed.substring(4)}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      result.push(`<h2>${trimmed.substring(3)}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeList();
      result.push(`<h1>${trimmed.substring(2)}</h1>`);
      continue;
    }

    // Handle horizontal rules
    if (trimmed === "---") {
      closeList();
      result.push("<hr>");
      continue;
    }

    // Handle list items
    if (trimmed.match(/^[\-\*] /) || trimmed.match(/^\d+\. /)) {
      if (!inList) {
        inList = true;
      }
      const content = trimmed.replace(/^[\-\*] |^\d+\. /, "");
      listItems.push(processInlineFormatting(content));
      continue;
    }

    // Close list if we hit a non-list line
    if (inList && trimmed) {
      closeList();
    }

    // Handle empty lines
    if (!trimmed) {
      if (
        result.length > 0 &&
        !result[result.length - 1].match(/^<(h[1-6]|hr|pre|ul|ol)/)
      ) {
        result.push("<br>");
      }
      continue;
    }

    // Regular paragraph
    result.push(`<p>${processInlineFormatting(trimmed)}</p>`);
  }

  // Close any open list
  closeList();

  function closeList() {
    if (inList && listItems.length > 0) {
      result.push(
        `<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`
      );
      listItems = [];
      inList = false;
    }
  }

  function processInlineFormatting(text) {
    // Convert bold
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Convert italic
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Convert inline code
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    return text;
  }

  const content = result.join("\n");

  // Wrap in HTML structure
  const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Subscription API - Frontend Integration Guide</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
      background: #fff;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-top: 30px;
      margin-bottom: 20px;
      font-size: 2em;
    }
    h2 {
      color: #34495e;
      border-bottom: 2px solid #ecf0f1;
      padding-bottom: 8px;
      margin-top: 25px;
      margin-bottom: 15px;
      font-size: 1.5em;
    }
    h3 {
      color: #555;
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 1.2em;
    }
    h4 {
      color: #666;
      margin-top: 15px;
      margin-bottom: 8px;
      font-size: 1.1em;
    }
    p {
      margin-bottom: 15px;
      text-align: justify;
    }
    ul, ol {
      margin-left: 30px;
      margin-bottom: 15px;
    }
    li {
      margin-bottom: 8px;
    }
    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #e74c3c;
    }
    pre {
      background-color: #2c3e50;
      color: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      margin-bottom: 20px;
      font-size: 0.85em;
    }
    pre code {
      background-color: transparent;
      color: #ecf0f1;
      padding: 0;
    }
    hr {
      border: none;
      border-top: 2px solid #ecf0f1;
      margin: 30px 0;
    }
    strong {
      color: #2c3e50;
      font-weight: 600;
    }
    .header-info {
      background-color: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 30px;
    }
    .header-info p {
      margin-bottom: 5px;
    }
    @media print {
      body {
        padding: 0;
      }
      h1, h2, h3, h4 {
        page-break-after: avoid;
      }
      pre {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header-info">
    <p><strong>Version:</strong> 1.0.0</p>
    <p><strong>Last Updated:</strong> December 11, 2025</p>
    <p><strong>Base URL:</strong> {{BASE_URL}}/api/v1/subscription</p>
  </div>
  ${content}
</body>
</html>`;

  return fullHTML;
}

// Run the script
generatePDF().catch(console.error);
