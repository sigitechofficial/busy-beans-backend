/**
 * Shared professional coffee-branded layout pieces for daily EOD digests.
 * Email-safe: tables + inline styles only.
 */

const COLORS = {
  pageBg: "#F7F3EE",
  cardBg: "#FFFFFF",
  espresso: "#2C1810",
  coffee: "#6F4E37",
  roast: "#8F5D46",
  muted: "#7A6A5A",
  divider: "#E8DFD6",
  amount: "#3D2914",
  creamSoft: "#FBF8F4",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "0";
}

function metricCard(label, count, amount, extraLineHtml = "") {
  return `
    <td width="50%" valign="top" style="padding: 6px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.divider}; border-radius:8px; background-color:${COLORS.cardBg};">
        <tr>
          <td style="padding:16px 14px;">
            <div style="font-family:'Chivo',Arial,sans-serif; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:${COLORS.muted}; font-weight:600;">
              ${escapeHtml(label)}
            </div>
            <div style="font-family:'Chivo',Arial,sans-serif; font-size:22px; font-weight:700; color:${COLORS.espresso}; padding-top:8px; line-height:1.2;">
              ${formatCount(count)}
            </div>
            <div style="font-family:'Chivo',Arial,sans-serif; font-size:15px; font-weight:600; color:${COLORS.amount}; padding-top:4px;">
              ${formatMoney(amount)}
            </div>
            ${extraLineHtml}
          </td>
        </tr>
      </table>
    </td>
  `;
}

function sectionTitle(title) {
  return `
    <tr>
      <td style="padding: 28px 40px 10px 40px; font-family:'Chivo',Arial,sans-serif; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; font-weight:700; color:${COLORS.coffee};">
        ${escapeHtml(title)}
      </td>
    </tr>
  `;
}

function metricsRow(leftCardHtml, rightCardHtml) {
  return `
    <tr>
      <td style="padding: 0 34px 8px 34px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${leftCardHtml}
            ${rightCardHtml || `<td width="50%" style="padding:6px;"></td>`}
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function singleFullWidthMetric(label, count, amount, noteHtml = "") {
  return `
    <tr>
      <td style="padding: 0 34px 8px 34px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.divider}; border-radius:8px; background-color:${COLORS.cardBg};">
          <tr>
            <td style="padding:16px 18px;">
              <div style="font-family:'Chivo',Arial,sans-serif; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:${COLORS.muted}; font-weight:600;">
                ${escapeHtml(label)}
              </div>
              <div style="font-family:'Chivo',Arial,sans-serif; font-size:22px; font-weight:700; color:${COLORS.espresso}; padding-top:8px;">
                ${formatCount(count)}
                <span style="font-size:15px; font-weight:600; color:${COLORS.amount}; padding-left:10px;">${formatMoney(amount)}</span>
              </div>
              ${noteHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function shellOpen({ title, displayDate, timezone, introHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Chivo:wght@400;600;700&display=swap" rel="stylesheet" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0; padding:12px 0; font-family:Arial,sans-serif; background-color:${COLORS.pageBg};">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; max-width:600px;">
`;
}

function headerBlock(headerHtml) {
  return `
      <tr>
        <td align="center" style="padding: 20px 0 8px 0;">
          ${headerHtml}
        </td>
      </tr>
  `;
}

function titleBlock({ title, displayDate, timezone }) {
  return `
      <tr>
        <td style="padding: 18px 40px 0 40px; font-family:'Chivo',Arial,sans-serif; font-size:22px; font-weight:700; color:${COLORS.espresso}; letter-spacing:-0.01em;">
          ${escapeHtml(title)}
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 40px 0 40px;">
          <table width="64" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="height:3px; background-color:${COLORS.roast}; font-size:0; line-height:0;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 40px 0 40px; font-family:'Chivo',Arial,sans-serif; font-size:14px; color:${COLORS.muted};">
          ${escapeHtml(displayDate)}
          <span style="color:${COLORS.divider}; padding:0 8px;">·</span>
          ${escapeHtml(timezone)}
        </td>
      </tr>
  `;
}

function introBlock(html) {
  return `
      <tr>
        <td style="padding: 18px 40px 4px 40px; font-family:'Chivo',Arial,sans-serif; font-size:15px; line-height:1.55; color:${COLORS.espresso};">
          ${html}
        </td>
      </tr>
  `;
}

function footnoteBlock(lines) {
  const body = lines.map((l) => escapeHtml(l)).join("<br />");
  return `
      <tr>
        <td style="padding: 28px 40px 8px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.creamSoft}; border-left:3px solid ${COLORS.roast};">
            <tr>
              <td style="padding:14px 16px; font-family:'Chivo',Arial,sans-serif; font-size:12px; line-height:1.55; color:${COLORS.muted};">
                ${body}
              </td>
            </tr>
          </table>
        </td>
      </tr>
  `;
}

function shellClose(footerHtml) {
  return `
      ${footerHtml}
    </table>
  </body>
</html>`;
}

module.exports = {
  COLORS,
  escapeHtml,
  formatMoney,
  formatCount,
  metricCard,
  sectionTitle,
  metricsRow,
  singleFullWidthMetric,
  shellOpen,
  headerBlock,
  titleBlock,
  introBlock,
  footnoteBlock,
  shellClose,
};
