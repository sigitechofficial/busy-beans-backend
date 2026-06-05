const { sendMailPromise } = require("../../helper/transpoter");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const { getLandingPageModel } = require("../models/landingPage");

function parseLandingPageIdFromUrl(pageUrl) {
  const normalized = String(pageUrl || "");
  const slugMatch = normalized.match(/\/lp\/([a-z0-9-]+)/i);
  if (!slugMatch?.[1]) return null;
  return slugMatch[1].toLowerCase();
}

function buildLeadEmailHtml(fields, pageUrl, submittedAt) {
  const rows = Object.entries(fields || {})
    .map(([key, value]) => `<tr><td><strong>${key}</strong></td><td>${String(value)}</td></tr>`)
    .join("");
  return `
    <h3>New Landing Page Lead</h3>
    <p><strong>Page URL:</strong> ${pageUrl}</p>
    <p><strong>Submitted At:</strong> ${submittedAt.toISOString()}</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function resolveLandingPageIdBySlugFromUrl(pageUrl) {
  const slug = parseLandingPageIdFromUrl(pageUrl);
  if (!slug) return null;
  const LandingPage = getLandingPageModel();
  const page = await LandingPage.findOne({ where: { slug } });
  return page?.id || null;
}

async function submitLead(payload, requestMeta = {}) {
  const fields = payload?.fields || {};
  const pageUrl = String(payload?.pageUrl || "").trim();
  const testMode = Boolean(payload?.testMode);
  const submittedAt = payload?.submittedAt ? new Date(payload.submittedAt) : new Date();

  if (!pageUrl) {
    const error = new Error("pageUrl is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    const error = new Error("fields must be an object.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (!fields.email && !fields.phone) {
    const error = new Error("Provide at least one contact field (email or phone).");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (testMode) {
    return { ok: true, stored: false };
  }

  const landingPageId = await resolveLandingPageIdBySlugFromUrl(pageUrl);
  const LeadSubmission = getLeadSubmissionModel();
  await LeadSubmission.create({
    landingPageId,
    pageUrl,
    fields,
    testMode: false,
    submittedAt,
    ipAddress: requestMeta.ipAddress || null,
    userAgent: requestMeta.userAgent || null,
  });

  const to = process.env.LEAD_NOTIFICATION_TO || process.env.LEAD_NOTIFICATION_FROM;
  const from = process.env.LEAD_NOTIFICATION_FROM;
  if (to && from) {
    const html = buildLeadEmailHtml(fields, pageUrl, submittedAt);
    await sendMailPromise({
      to,
      from,
      subject: "New Landing Page Lead",
      html,
      text: `New lead received for ${pageUrl}`,
    });
  }

  return { ok: true, stored: true };
}

module.exports = {
  submitLead,
};
