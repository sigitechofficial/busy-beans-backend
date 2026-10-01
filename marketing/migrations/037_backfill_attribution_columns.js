/**
 * Data migration: fills the attribution columns added in 036 for data recorded before them.
 * Additive and idempotent: only rows whose new columns are still empty are touched, nothing
 * existing is changed (the original `attribution` JSON of every lead stays as it was).
 *
 *   1. touchpoints  channel from the stored legacy category
 *   2. sessions     acquisition touch from the session's first touchpoint
 *   3. visitors     first-touch channel/source from the visitor's first touchpoint
 *   4. leads        flat columns + touch JSON derived from the lead's stored attribution JSON
 *                   (attribution_basis = "legacy")
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { getLeadSubmissionModel } = require("../models/leadSubmission");
const { resolveLeadAttribution, leadAttributionColumns } = require("../services/leadAttribution.service");

const CATEGORY_CHANNEL = `CASE LOWER(COALESCE(category, ''))
  WHEN 'paid_search' THEN 'Paid Search'
  WHEN 'paid_social' THEN 'Paid Social'
  WHEN 'organic_search' THEN 'Organic Search'
  WHEN 'social' THEN 'Organic Social'
  WHEN 'email' THEN 'Email'
  WHEN 'referral' THEN 'Referral'
  WHEN 'ai_assistant' THEN 'Referral'
  WHEN 'qr' THEN 'QR'
  WHEN 'affiliate' THEN 'Affiliate'
  WHEN 'partner' THEN 'Partner'
  WHEN 'display' THEN 'Display'
  WHEN 'video' THEN 'Video'
  WHEN 'whatsapp' THEN 'WhatsApp'
  WHEN 'sms' THEN 'SMS'
  WHEN 'offline' THEN 'Offline'
  WHEN 'direct' THEN 'Direct'
  ELSE CASE WHEN COALESCE(NULLIF(source, ''), 'direct') = 'direct' THEN 'Direct' ELSE 'Other' END
END`;

// First touchpoint of each session / visitor (ties: any one of them).
const FIRST_OF = (key) => `
  SELECT t.* FROM marketing_touchpoints t
  JOIN (SELECT ${key}, MIN(timestamp) AS ts FROM marketing_touchpoints GROUP BY ${key}) f
    ON f.${key} = t.${key} AND f.ts = t.timestamp`;

async function up() {
  const db = getMarketingSequelize();

  const [, tpMeta] = await db.query(
    `UPDATE marketing_touchpoints SET channel = ${CATEGORY_CHANNEL} WHERE channel IS NULL`,
  );

  const [, sessionMeta] = await db.query(
    `UPDATE marketing_sessions s
     JOIN (${FIRST_OF("session_id")}) tp ON tp.session_id = s.session_id
     SET s.channel = tp.channel,
         s.source = LEFT(NULLIF(tp.source, ''), 100),
         s.medium = LEFT(NULLIF(tp.medium, ''), 100),
         s.campaign = NULLIF(tp.campaign, ''),
         s.content = NULLIF(tp.content, ''),
         s.term = NULLIF(tp.term, ''),
         s.referrer = NULLIF(tp.referrer, ''),
         s.landing_url = NULLIF(tp.page_url, '')
     WHERE s.channel IS NULL`,
  );

  const [, visitorMeta] = await db.query(
    `UPDATE marketing_visitors v
     JOIN (${FIRST_OF("visitor_id")}) tp ON tp.visitor_id = v.visitor_id
     SET v.first_touch_channel = tp.channel,
         v.first_touch_source = LEFT(COALESCE(NULLIF(tp.source, ''), 'direct'), 100)
     WHERE v.first_touch_channel IS NULL`,
  );

  const LeadSubmission = getLeadSubmissionModel();
  let leads = 0;
  let lastId = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.query(
      `SELECT id FROM lead_submissions WHERE attribution_basis IS NULL AND id > :lastId ORDER BY id LIMIT 200`,
      { replacements: { lastId }, type: QueryTypes.SELECT },
    );
    if (!rows.length) break;
    for (const { id } of rows) {
      lastId = id;
      // eslint-disable-next-line no-await-in-loop
      const lead = await LeadSubmission.findByPk(id);
      if (!lead) continue; // eslint-disable-line no-continue
      const attribution = lead.attribution || {};
      // eslint-disable-next-line no-await-in-loop
      const resolved = await resolveLeadAttribution(
        { attribution, ...attribution },
        { visitorId: null, sessionId: null, pageUrl: lead.pageUrl, now: lead.submittedAt || new Date() },
      );
      const columns = leadAttributionColumns(resolved);
      // The conversion happened at submitted_at, not now.
      if (columns.conversionTouch) columns.conversionTouch.timestamp = new Date(lead.submittedAt).toISOString();
      columns.attributionBasis = "legacy";
      // eslint-disable-next-line no-await-in-loop
      await LeadSubmission.update(columns, { where: { id }, silent: true });
      leads += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[037] touchpoints ${tpMeta?.affectedRows ?? "?"}, sessions ${sessionMeta?.affectedRows ?? "?"}, visitors ${visitorMeta?.affectedRows ?? "?"}, leads ${leads}`,
  );
}

module.exports = { up };
