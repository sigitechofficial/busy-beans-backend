/**
 * Ad spend entered by the marketing team (marketing_ad_spend, migration 042) and its use in reports.
 *
 *   entry       what one campaign on one platform (source, optional medium) cost from period_start to
 *               period_end (inclusive), in USD
 *   allocation  an entry is spread evenly over its days; a report period gets the share of the days
 *               that fall inside it (all time = the whole amount)
 *   channel     derived from the entry's source / medium with the tracker's classifier
 *               (utils/attribution.js), so spend lines up with the channel of visits and leads; no
 *               medium = a paid click (cpc), since spend is paid traffic
 *   metrics     cost per lead = spend ÷ leads · cost per won lead = spend ÷ won leads ·
 *               ROAS = lead revenue ÷ spend · order ROAS = order revenue ÷ spend (the two revenue
 *               kinds are never added, see the Revenue report)
 * Spend has no ad / keyword / landing page / device detail, so a report filtered or grouped by one of
 * those shows no spend.
 */
const { QueryTypes } = require("sequelize");
const { getMarketingSequelize } = require("../db/sequelize.marketing");
const { touchFromLegacy } = require("../utils/attribution");

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 10_000_000;
/** Groupings / filters spend can be matched on (an entry has exactly these fields). */
const SPEND_FIELDS = ["channel", "source", "medium", "campaign"];
const SPEND_GROUPINGS = new Set([...SPEND_FIELDS, "campaignDetail"]);

const select = (sql, replacements) => getMarketingSequelize().query(sql, { replacements, type: QueryTypes.SELECT });
const money = (v) => Math.round(Number(v || 0) * 100) / 100;
const validation = (message) => Object.assign(new Error(message), { code: "VALIDATION_ERROR" });
const lower = (v) => String(v ?? "").trim().toLowerCase();

function dayNumber(day) {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

function cleanText(value, max, field, { required = false } = {}) {
  const v = typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
  if (!v && required) throw validation(`${field} is required.`);
  if (v.length > max) throw validation(`${field} is too long (max ${max}).`);
  return v || null;
}

/** Validated entry from a request body (create, or update with `partial`). */
function cleanEntry(body = {}, { partial = false } = {}) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has("source")) out.source = lower(cleanText(body.source, 100, "Source", { required: true }));
  if (!partial || has("medium")) out.medium = cleanText(body.medium, 100, "Medium") ? lower(body.medium) : null;
  if (!partial || has("campaign")) out.campaign = cleanText(body.campaign, 255, "Campaign", { required: true });
  for (const [key, label] of [["periodStart", "Start date"], ["periodEnd", "End date"]]) {
    if (partial && !has(key)) continue;
    if (!DAY.test(String(body[key] || "")) || Number.isNaN(Date.parse(`${body[key]}T00:00:00Z`))) throw validation(`${label} must be YYYY-MM-DD.`);
    out[key] = body[key];
  }
  if (out.periodStart && out.periodEnd && out.periodEnd < out.periodStart) throw validation("End date is before start date.");
  if (!partial || has("amount")) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) throw validation(`Amount must be between 0 and ${MAX_AMOUNT}.`);
    out.amount = money(n);
  }
  if (!partial || has("notes")) out.notes = cleanText(body.notes, 500, "Notes");
  return out;
}

function present(row) {
  // Spend is paid traffic: without an entered medium, classify as a paid click ("cpc": Paid Social for
  // social networks, Paid Search for search engines) rather than organic.
  const touch = touchFromLegacy({ source: row.source, medium: row.medium || "cpc", campaign: row.campaign }) || {};
  return {
    id: Number(row.id),
    channel: touch.channel || "Unknown",
    source: row.source,
    medium: row.medium || null,
    /** Medium used to match visits / leads when none was entered (the classifier's, e.g. paid_social). */
    matchMedium: row.medium || touch.medium || null,
    campaign: row.campaign,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    amount: money(row.amount),
    currency: row.currency || "USD",
    notes: row.notes || null,
    createdBy: row.createdBy || null,
    updatedAt: row.updatedAt,
  };
}

const COLUMNS = `id, source, medium, campaign, DATE_FORMAT(period_start, '%Y-%m-%d') AS periodStart,
  DATE_FORMAT(period_end, '%Y-%m-%d') AS periodEnd, amount, currency, notes, created_by AS createdBy, updated_at AS updatedAt`;

/** Entries overlapping [fromDay, toDay] (both optional = all), newest period first. */
async function listEntries({ fromDay, toDay } = {}) {
  const where = [];
  const replacements = {};
  if (toDay) { where.push("period_start <= :toDay"); replacements.toDay = toDay; }
  if (fromDay) { where.push("period_end >= :fromDay"); replacements.fromDay = fromDay; }
  const rows = await select(
    `SELECT ${COLUMNS} FROM marketing_ad_spend ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY period_start DESC, campaign, id LIMIT 2000`,
    replacements,
  );
  return rows.map(present);
}

async function getEntry(id) {
  const [row] = await select(`SELECT ${COLUMNS} FROM marketing_ad_spend WHERE id = :id`, { id: Number(id) });
  return row ? present(row) : null;
}

async function createEntry(body, { userId } = {}) {
  const e = cleanEntry(body);
  const db = getMarketingSequelize();
  const [id] = await db.query(
    `INSERT INTO marketing_ad_spend (source, medium, campaign, period_start, period_end, amount, currency, notes, created_by)
     VALUES (:source, :medium, :campaign, :periodStart, :periodEnd, :amount, 'USD', :notes, :createdBy)`,
    { replacements: { ...e, createdBy: userId ? String(userId).slice(0, 64) : null }, type: QueryTypes.INSERT },
  );
  return getEntry(id);
}

async function updateEntry(id, body) {
  const current = await getEntry(id);
  if (!current) return null;
  const e = cleanEntry(body, { partial: true });
  const start = e.periodStart ?? current.periodStart;
  const end = e.periodEnd ?? current.periodEnd;
  if (end < start) throw validation("End date is before start date.");
  const cols = { source: "source", medium: "medium", campaign: "campaign", periodStart: "period_start", periodEnd: "period_end", amount: "amount", notes: "notes" };
  const sets = Object.keys(e).map((k) => `${cols[k]} = :${k}`);
  if (sets.length) {
    await getMarketingSequelize().query(`UPDATE marketing_ad_spend SET ${sets.join(", ")} WHERE id = :id`, { replacements: { ...e, id: Number(id) } });
  }
  return getEntry(id);
}

async function deleteEntry(id) {
  const [res, meta] = await getMarketingSequelize().query("DELETE FROM marketing_ad_spend WHERE id = :id", { replacements: { id: Number(id) } });
  return Number(res?.affectedRows ?? meta?.affectedRows ?? 0) > 0;
}

/** Share of an entry's amount that falls inside the report period (all time = everything). */
function allocated(entry, range) {
  if (!range?.fromDay || !range?.toDay) return entry.amount;
  const s = dayNumber(entry.periodStart);
  const e = dayNumber(entry.periodEnd);
  const from = Math.max(s, dayNumber(range.fromDay));
  const to = Math.min(e, dayNumber(range.toDay));
  if (to < from) return 0;
  return money((entry.amount * (to - from + 1)) / (e - s + 1));
}

/** Spend can be shown when every active filter is one spend has (channel / source / medium / campaign). */
function spendApplies(dimension, filters = {}) {
  if (!SPEND_GROUPINGS.has(dimension)) return false;
  return Object.keys(filters).every((k) => SPEND_FIELDS.includes(k));
}

/**
 * Entries of the period with their allocated spend, filtered like the report (case-insensitive,
 * same rule as the report's GROUP BY buckets).
 */
async function periodSpend(range, filters = {}) {
  const entries = await listEntries({ fromDay: range?.fromDay, toDay: range?.toDay });
  return entries
    .map((e) => ({ ...e, spend: allocated(e, range) }))
    .filter((e) => e.spend > 0)
    .filter((e) => Object.entries(filters).every(([k, v]) => lower(k === "medium" ? e.matchMedium : e[k]) === lower(v)));
}

module.exports = {
  SPEND_FIELDS,
  cleanEntry,
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  allocated,
  spendApplies,
  periodSpend,
};
