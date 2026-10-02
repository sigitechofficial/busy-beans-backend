/**
 * One lead pipeline for every enquiry: the admin panel's Leads Dashboard (Kanban, table `leads`) is
 * where sales works; the Campaign Builder lead (marketing `lead_submissions`) carries the source /
 * campaign / journey. The two are linked by the lead's event id (leads.marketingEventId =
 * lead_submissions.event_id; same email within 15 minutes when an older website sent no id).
 *
 *   website contact / tasting / machine-enquiry form → get_in_touches row + lead   (createFromGetInTouch)
 *   website machine form                             → lead                       (leadController.createPublicLead)
 *   product quote / landing page forms               → lead, from the Campaign Builder lead (linkOrCreateFromMarketing)
 *   stage / won amount changes on the Kanban         → Campaign Builder status + revenue (syncToMarketing),
 *                                                      so Analytics revenue and ROAS follow the sales pipeline
 *   status / revenue changes in the Campaign Builder → Kanban stage + won amount (syncFromMarketing)
 */
const { Op, QueryTypes } = require("sequelize");
const { Lead } = require("../models");
const { createLeadLog } = require("./leadLogger");

/** Website form id → enquiry type shown on the Kanban. */
const ENQUIRY_BY_FORM = {
  contact_page: "contact",
  hero_tasting_request: "tasting",
  machine_enquiry: "machine_enquiry",
  machine_contact: "machine",
  product_quote: "product_quote",
  campaign_tracking: "contact",
};
const ENQUIRY_TYPES = ["machine", "contact", "tasting", "machine_enquiry", "product_quote", "landing_page", "meta", "manual"];
/** Kanban stage → Campaign Builder conversion status (reports: qualified rate, won, lead revenue). */
const STAGE_TO_MARKETING = {
  "New Enquiry": "new",
  Contacted: "contacted",
  Nurture: "contacted",
  Quoted: "qualified",
  "Demo/Scheduled": "qualified",
  Negotiation: "qualified",
  WON: "won",
  LOST: "lost",
};
const EVENT_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const LINK_WINDOW_MS = 15 * 60 * 1000;

const str = (v, max = 255) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const cleanEventId = (v) => (typeof v === "string" && EVENT_ID.test(v) ? v : null);
const enquiryTypeOf = (formId, pageType) => ENQUIRY_BY_FORM[formId] || (pageType === "landing_page" ? "landing_page" : null);

function marketingDb() {
  // Lazy: the marketing module is optional in some scripts.
  // eslint-disable-next-line global-require
  return require("../marketing/db/sequelize.marketing").getMarketingSequelize();
}

/** A website contact / tasting / machine-enquiry submission (already stored in get_in_touches) as a lead. */
async function createFromGetInTouch(record, { formId, marketingEventId } = {}) {
  const notes = [
    record.teamSize ? `Team size: ${record.teamSize}` : null,
    record.preferredDate ? `Preferred date: ${record.preferredDate}` : null,
    record.notes || null,
  ].filter(Boolean).join("\n");
  const eid = cleanEventId(marketingEventId);
  // The Campaign Builder copy arrived first and already created the lead: complete that one.
  const existing = eid ? await Lead.findOne({ where: { marketingEventId: eid, getInTouchId: null } }) : null;
  if (existing) {
    await existing.update({ getInTouchId: record.id, enquiryType: enquiryTypeOf(formId) || existing.enquiryType, notes: existing.notes || notes || null });
    return existing;
  }
  const lead = await Lead.create({
    contactName: str(record.name) || "Website visitor",
    contactEmail: str(record.email),
    contactPhone: str(record.phone, 20),
    company: str(record.company) || str(record.name) || "Website enquiry",
    leadSource: "Website",
    status: "New Enquiry",
    enquiryType: enquiryTypeOf(formId) || "contact",
    getInTouchId: record.id,
    marketingEventId: eid,
    notes: notes || null,
  });
  await createLeadLog({ leadId: lead.id, action: "created", details: "Website enquiry received", user: undefined, type: "status" }).catch(() => {});
  return lead;
}

/**
 * Campaign Builder lead stored (real, not test): link it to the lead the website form already
 * created, or create the Kanban lead (product quote / landing page forms, or a form whose admin-panel
 * call did not happen).
 */
async function linkOrCreateFromMarketing({ eventId, fields = {}, formId, pageType, pageSlug, pageUrl }) {
  const eid = cleanEventId(eventId);
  if (eid) {
    const linked = await Lead.findOne({ where: { marketingEventId: eid }, attributes: ["id"] });
    if (linked) return { leadId: linked.id, action: "linked" };
  }
  const email = str(fields.email || fields.Email || fields.contactEmail);
  if (email) {
    const recent = await Lead.findOne({
      where: { contactEmail: email, marketingEventId: null, createdAt: { [Op.gte]: new Date(Date.now() - LINK_WINDOW_MS) } },
      order: [["createdAt", "DESC"]],
    });
    if (recent) {
      if (eid) await recent.update({ marketingEventId: eid });
      return { leadId: recent.id, action: "linked" };
    }
  }
  const name = str(fields.name || fields.fullName || [fields.firstName, fields.lastName].filter(Boolean).join(" ")) || "Website visitor";
  const notes = [
    fields.productName ? `Product: ${fields.productName}` : null,
    fields.quantity ? `Quantity: ${fields.quantity}` : null,
    pageType === "landing_page" && pageSlug ? `Landing page: ${pageSlug}` : null,
    str(fields.notes || fields.message, 5000),
    pageUrl ? `Page: ${String(pageUrl).slice(0, 500)}` : null,
  ].filter(Boolean).join("\n");
  const lead = await Lead.create({
    contactName: name,
    contactEmail: email,
    contactPhone: str(fields.phone || fields.Phone, 20),
    company: str(fields.company || fields.companyName) || name,
    leadSource: "Website",
    status: "New Enquiry",
    enquiryType: enquiryTypeOf(formId, pageType) || "contact",
    marketingEventId: eid,
    notes: notes || null,
  });
  await createLeadLog({ leadId: lead.id, action: "created", details: "Website enquiry received", user: undefined, type: "status" }).catch(() => {});
  return { leadId: lead.id, action: "created" };
}

/** Kanban stage / won amount → the linked Campaign Builder lead (status, revenue, converted at). */
async function syncToMarketing(lead) {
  const eid = cleanEventId(lead?.marketingEventId);
  const status = STAGE_TO_MARKETING[lead?.status];
  if (!eid || !status) return false;
  const amount = lead.wonAmount !== null && lead.wonAmount !== undefined ? Number(lead.wonAmount) : null;
  try {
    await marketingDb().query(
      `UPDATE lead_submissions
          SET conversion_status = :status,
              revenue = CASE WHEN :status = 'won' AND :amount IS NOT NULL THEN :amount ELSE revenue END,
              converted_at = CASE WHEN :status = 'won' THEN COALESCE(converted_at, NOW()) ELSE NULL END
        WHERE event_id = :eid AND test_mode = 0`,
      { replacements: { status, amount, eid } },
    );
    return true;
  } catch (error) {
    console.error("lead sync to Campaign Builder failed:", error.message);
    return false;
  }
}

/** Campaign Builder status → Kanban stage, used only when the current stage does not already match. */
const MARKETING_TO_STAGE = { new: "New Enquiry", contacted: "Contacted", qualified: "Quoted", won: "WON", lost: "LOST" };

/**
 * Status / revenue changed in the Campaign Builder → the linked Kanban lead. The stage moves only
 * when it maps to a different status (a lead in Negotiation stays there when marked "qualified").
 */
async function syncFromMarketing({ eventId, status, revenue }) {
  const eid = cleanEventId(eventId);
  if (!eid || !MARKETING_TO_STAGE[status]) return false;
  const lead = await Lead.findOne({ where: { marketingEventId: eid } });
  if (!lead) return false;
  const updates = {};
  if (STAGE_TO_MARKETING[lead.status] !== status) updates.status = MARKETING_TO_STAGE[status];
  if (status === "won") {
    const amount = revenue === null || revenue === undefined ? null : Number(revenue);
    if (amount !== null && Number(lead.wonAmount) !== amount) updates.wonAmount = amount;
    if (!lead.wonAt) updates.wonAt = new Date();
  }
  if (!Object.keys(updates).length) return false;
  const oldStatus = lead.status;
  await lead.update(updates);
  if (updates.status) {
    await createLeadLog({
      leadId: lead.id,
      action: "status_changed",
      details: `Campaign Builder changed status from "${oldStatus}" to "${updates.status}"`,
      user: undefined,
      type: "status",
    }).catch(() => {});
  }
  return true;
}

/** Source / campaign of each lead from its Campaign Builder lead (operational attribution). */
async function attachMarketingSource(leads) {
  const plain = leads.map((l) => (typeof l.toJSON === "function" ? l.toJSON() : { ...l }));
  const ids = [...new Set(plain.map((l) => cleanEventId(l.marketingEventId)).filter(Boolean))];
  if (!ids.length) return plain;
  let rows = [];
  try {
    rows = await marketingDb().query(
      `SELECT event_id AS eventId, channel, source, medium, campaign, content, term, form_id AS formId,
              landing_page_slug AS landingPageSlug, id AS marketingLeadId
         FROM lead_submissions WHERE event_id IN (:ids)`,
      { replacements: { ids }, type: QueryTypes.SELECT },
    );
  } catch (error) {
    console.error("lead source lookup failed:", error.message);
    return plain;
  }
  const byId = new Map(rows.map((r) => [r.eventId, r]));
  return plain.map((l) => {
    const r = byId.get(l.marketingEventId);
    return r
      ? { ...l, marketingSource: { channel: r.channel, source: r.source, medium: r.medium, campaign: r.campaign, content: r.content, term: r.term, formId: r.formId, landingPageSlug: r.landingPageSlug, marketingLeadId: `sub_${r.marketingLeadId}` } }
      : l;
  });
}

module.exports = {
  ENQUIRY_TYPES,
  ENQUIRY_BY_FORM,
  STAGE_TO_MARKETING,
  cleanEventId,
  enquiryTypeOf,
  createFromGetInTouch,
  linkOrCreateFromMarketing,
  syncToMarketing,
  syncFromMarketing,
  attachMarketingSource,
};
