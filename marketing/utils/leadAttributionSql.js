/**
 * Lead attribution in reports: ONE definition, so no two reports credit a lead differently.
 *
 *   touch "last"     Last Non-Direct Source (default): the lead's own source columns = last
 *                    non-direct touch, else the converting visit's source.
 *   touch "first"    First Touch Source.
 *   touch "session"  Session Source: how the converting visit itself started.
 *   touch "lastAny"  Last Touch Source, Direct included.
 *   touch "lnd"      Last Non-Direct touch only (NULL → default when the visitor never had one).
 *   touch "conversion" Conversion touch (the converting visit + page).
 *
 * The operational lead source ("last", the lead's own columns) is derived when the lead is stored
 * (last non-direct ?? session); it never overwrites the individual models, which stay in their
 * own columns / JSON (first_touch, last_touch, last_non_direct_touch, session_touch,
 * conversion_touch).
 *
 * Columns come from migration 036 (037 backfilled older leads); the attribution JSON fallback
 * only covers rows written by an older API version during a deploy.
 */
const FIELDS = ["source", "medium", "campaign", "channel", "content", "term"];

/** Older reports: an unattributed lead counts as Direct. */
const DEFAULTS = { source: "direct", medium: "none", campaign: "(not set)", channel: "Direct", content: "(not set)", term: "(not set)" };
/** Reports API (utils/reportQuery): unknown values get explicit buckets, never "Direct". */
const UNKNOWN_DEFAULTS = { source: "(not set)", medium: "(not set)", campaign: "(not set)", channel: "Unknown", content: "(not set)", term: "(not set)" };

const json = (alias, column, key) => `NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${alias}.${column}, '$.${key}')), '')`;
const col = (alias, column) => `NULLIF(${alias}.${column}, '')`;
/** Fields with their own flat column per model (the rest live only in the touch JSON). */
const FLAT = new Set(["source", "medium", "channel"]);

const LEGACY = {
  source: (a) => [json(a, "attribution", "source"), json(a, "attribution", "utmSource")],
  medium: (a) => [json(a, "attribution", "medium"), json(a, "attribution", "utmMedium"), json(a, "attribution", "lastTouchMedium")],
  campaign: (a) => [json(a, "attribution", "campaign"), json(a, "attribution", "utmCampaign"), json(a, "attribution", "lastTouchCampaign")],
  channel: (a) => [json(a, "attribution", "channel")],
  content: (a) => [json(a, "attribution", "utmContent")],
  term: (a) => [json(a, "attribution", "utmTerm")],
};
const LEGACY_FIRST = {
  source: (a) => [json(a, "attribution", "firstTouchSource")],
  medium: (a) => [json(a, "attribution", "firstTouchMedium")],
  campaign: (a) => [json(a, "attribution", "firstTouchCampaign")],
  channel: () => [],
  content: () => [],
  term: () => [],
};

/** Flat column when the model has one for this field, else the model's touch JSON. */
const modelCol = (a, prefix, jsonColumn, field) => (FLAT.has(field) ? col(a, `${prefix}_${field}`) : json(a, jsonColumn, field));

function columnsFor(touch, field, a) {
  switch (touch) {
    case "first":
      return [modelCol(a, "first_touch", "first_touch", field), ...LEGACY_FIRST[field](a)];
    case "session":
      return [json(a, "session_touch", field)];
    case "lastAny":
      return [modelCol(a, "last_touch", "last_touch", field)];
    case "lnd":
      return [modelCol(a, "lnd", "last_non_direct_touch", field)];
    case "conversion":
      return [json(a, "conversion_touch", field)];
    default:
      return [col(a, field), ...LEGACY[field](a)];
  }
}

/**
 * SQL expression for a lead's source / medium / campaign / channel / content / term under a
 * touch model.
 * @param {"source"|"medium"|"campaign"|"channel"|"content"|"term"} field
 * @param {{ touch?: string, alias?: string, unknown?: boolean }} [options] unknown: explicit
 *   "(not set)" / "Unknown" buckets instead of the older Direct default.
 */
function leadAttrExpr(field, { touch = "last", alias = "l", unknown = false } = {}) {
  if (!FIELDS.includes(field)) throw new Error(`Unknown lead attribution field: ${field}`);
  const model = ["first", "session", "lastAny", "lnd", "conversion"].includes(touch) ? touch : "last";
  const fallback = (unknown ? UNKNOWN_DEFAULTS : DEFAULTS)[field];
  return `COALESCE(${[...columnsFor(model, field, alias), `'${fallback}'`].join(", ")})`;
}

module.exports = { leadAttrExpr, FIELDS, UNKNOWN_DEFAULTS };
