/**
 * Shared query layer for every report endpoint (one set of definitions):
 *   range        presets / custom days in the business timezone (MARKETING_REPORT_TIMEZONE),
 *                UTC [start, end) instants; optional previous period for comparison
 *   attribution  the lead attribution model (operational default) → utils/leadAttributionSql
 *   filters      channel / source / medium / campaign drill filters (validated strings)
 *   csv          RFC 4180 CSV with spreadsheet-formula neutralisation
 * Preview / test exclusion lives in utils/reportFilters.js; lead attribution SQL in
 * utils/leadAttributionSql.js.
 */
const { reportTimeZone, localDateOf, dayStartUtc, addDays, isDay } = require("./businessTime");
const { toSqlUtc } = require("./dateRange");

/**
 * Instants go to raw SQL as UTC strings: Sequelize formats a Date replacement in the Node process's
 * LOCAL timezone, while DATETIME columns hold UTC — on a non-UTC host every window would shift.
 */
const sqlTime = (value) => (value instanceof Date ? toSqlUtc(value) : value);

const PRESETS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "all_time",
  "custom",
];
const DEFAULT_PRESET = "last_30_days";

const monthStart = (day) => `${day.slice(0, 7)}-01`;
function addMonths(day, n) {
  const [y, m] = day.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}
function daysInclusive(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}
/** Monday of the week containing `day`. */
function weekStart(day) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

function presetDays(preset, today) {
  switch (preset) {
    case "today":
      return { fromDay: today, toDay: today };
    case "yesterday":
      return { fromDay: addDays(today, -1), toDay: addDays(today, -1) };
    case "last_7_days":
      return { fromDay: addDays(today, -6), toDay: today };
    case "last_30_days":
      return { fromDay: addDays(today, -29), toDay: today };
    case "this_week":
      return { fromDay: weekStart(today), toDay: today };
    case "last_week":
      return { fromDay: addDays(weekStart(today), -7), toDay: addDays(weekStart(today), -1) };
    case "this_month":
      return { fromDay: monthStart(today), toDay: today };
    case "last_month":
      return { fromDay: addMonths(today, -1), toDay: addDays(monthStart(today), -1) };
    default:
      return null;
  }
}

function toRange(fromDay, toDay, tz, preset) {
  const range = { tz, preset };
  if (fromDay) {
    range.fromDay = fromDay;
    range.start = dayStartUtc(fromDay, tz);
  }
  if (toDay) {
    range.toDay = toDay;
    range.end = dayStartUtc(addDays(toDay, 1), tz);
  }
  return range;
}

/** Period just before `range`: same number of days; month presets use the previous month. */
function previousRange(range) {
  if (!range.fromDay || !range.toDay) return null;
  const { tz } = range;
  if (range.preset === "last_month") {
    const from = addMonths(range.fromDay, -1);
    return toRange(from, addDays(range.fromDay, -1), tz, "previous");
  }
  if (range.preset === "this_month") {
    const from = addMonths(range.fromDay, -1);
    const lastOfPrev = addDays(range.fromDay, -1);
    const to = addDays(from, daysInclusive(range.fromDay, range.toDay) - 1);
    return toRange(from, to < lastOfPrev ? to : lastOfPrev, tz, "previous");
  }
  const n = daysInclusive(range.fromDay, range.toDay);
  return toRange(addDays(range.fromDay, -n), addDays(range.fromDay, -1), tz, "previous");
}

/**
 * Report range from query params: `range` (preset) or `from` / `to` (YYYY-MM-DD, inclusive
 * business days). Without any of them the default preset is used (`null` → all time, which
 * keeps the older endpoints' behaviour). Same shape as businessTime.parseReportRange.
 */
function rangeFromQuery(query = {}, { defaultPreset = DEFAULT_PRESET, now = new Date() } = {}) {
  const tz = reportTimeZone();
  const today = localDateOf(now, tz);
  const from = isDay(query.from) ? query.from : undefined;
  const to = isDay(query.to) ? query.to : undefined;
  let preset = PRESETS.includes(query.range) ? query.range : undefined;
  if (!preset) preset = from || to ? "custom" : defaultPreset || "all_time";
  if (preset === "all_time") return { tz, preset };
  if (preset === "custom") {
    const f = from && to && from > to ? to : from;
    const t = from && to && from > to ? from : to;
    return toRange(f, t, tz, "custom");
  }
  const days = presetDays(preset, today);
  return toRange(days.fromDay, days.toDay, tz, preset);
}

/** `compare=previous` (or 1 / true) → the previous period, else null. */
function compareRangeFromQuery(query, range) {
  const on = ["previous", "1", "true"].includes(String(query.compare || "").toLowerCase());
  return on ? previousRange(range) : null;
}

/** `col >= :start AND col < :end` for a range (empty for all time). */
function rangeSql(range, column, prefix = "") {
  const sql = [];
  const replacements = {};
  if (range?.start) {
    sql.push(`${column} >= :${prefix}start`);
    replacements[`${prefix}start`] = sqlTime(range.start);
  }
  if (range?.end) {
    sql.push(`${column} < :${prefix}end`);
    replacements[`${prefix}end`] = sqlTime(range.end);
  }
  return { sql: sql.length ? sql.join(" AND ") : "1=1", replacements };
}

// ── attribution model ─────────────────────────────────────────────────────────

/** API model → leadAttrExpr touch. Orders only store first / last-non-direct touches. */
const MODELS = {
  operational: { touch: "last", orderTouch: "last", label: "Operational (last non-direct, else session)" },
  first: { touch: "first", orderTouch: "first", label: "First touch" },
  last: { touch: "lastAny", orderTouch: "last", label: "Last touch (Direct included)" },
  last_non_direct: { touch: "lnd", orderTouch: "last", label: "Last non-direct touch" },
  session: { touch: "session", orderTouch: "last", label: "Session touch" },
  conversion: { touch: "conversion", orderTouch: "last", label: "Conversion touch" },
};

/** `attribution` param (legacy `touch=first` still understood). */
function modelFromQuery(query = {}) {
  const raw = String(query.attribution || "").toLowerCase();
  if (MODELS[raw]) return raw;
  return query.touch === "first" ? "first" : "operational";
}

// ── filters ───────────────────────────────────────────────────────────────────

const DIMENSIONS = ["channel", "source", "medium", "campaign", "content", "term"];

function cleanFilter(value, max = 255) {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v && v.length <= max ? v : undefined;
}

/** Drill filters present in the query (only known dimensions). */
function filtersFromQuery(query = {}) {
  const out = {};
  for (const d of DIMENSIONS) {
    const v = cleanFilter(query[d]);
    if (v !== undefined) out[d] = v;
  }
  return out;
}

// ── Phase B: segments, landing-page filter, trend buckets, form keys ─────────

/** Conversion-report segments (session acquisition dimensions + entry landing page). */
const SEGMENTS = ["channel", "source", "medium", "campaign", "landingPage"];

function segmentFromQuery(query = {}) {
  return SEGMENTS.includes(query.segment) ? query.segment : null;
}

/** Landing-page filter (slug) for conversion reports. */
function landingPageFromQuery(query = {}) {
  return cleanFilter(query.landingPage, 200);
}

/**
 * Trend buckets for a range: ≤ 31 days daily, ≤ 180 days weekly (Monday start), else monthly;
 * `granularity` = day | week | month overrides. Boundaries are business-timezone days, so a
 * bucket is [start, end) in UTC. All-time ranges start at `minDay` (first data day).
 */
function trendBuckets(range, { granularity, minDay, today } = {}) {
  const tz = range.tz;
  const fromDay = range.fromDay || minDay;
  const toDay = range.toDay || today;
  if (!fromDay || !toDay || fromDay > toDay) return { granularity: granularity || "day", buckets: [] };
  const days = daysInclusive(fromDay, toDay);
  const g = ["day", "week", "month"].includes(granularity) ? granularity : days <= 31 ? "day" : days <= 180 ? "week" : "month";
  const buckets = [];
  let cursor = g === "week" ? weekStart(fromDay) : g === "month" ? monthStart(fromDay) : fromDay;
  while (cursor <= toDay && buckets.length < 400) {
    const next = g === "day" ? addDays(cursor, 1) : g === "week" ? addDays(cursor, 7) : addMonths(cursor, 1);
    const startDay = cursor < fromDay ? fromDay : cursor;
    const endDay = addDays(next, -1) > toDay ? toDay : addDays(next, -1);
    buckets.push({ key: cursor, label: g === "month" ? cursor.slice(0, 7) : cursor, from: startDay, to: endDay, start: dayStartUtc(startDay, tz), end: dayStartUtc(addDays(endDay, 1), tz) });
    cursor = next;
  }
  return { granularity: g, buckets };
}

/** SQL CASE mapping a timestamp column to its bucket index (NULL outside every bucket). */
function bucketCase(column, buckets, prefix) {
  const replacements = {};
  const parts = buckets.map((b, i) => {
    replacements[`${prefix}s${i}`] = sqlTime(b.start);
    replacements[`${prefix}e${i}`] = sqlTime(b.end);
    return `WHEN ${column} >= :${prefix}s${i} AND ${column} < :${prefix}e${i} THEN ${i}`;
  });
  return { sql: parts.length ? `CASE ${parts.join(" ")} END` : "NULL", replacements };
}

/**
 * Normalised form key (SQL) — lower-case, runs of non-alphanumerics → "_", trimmed — the same
 * rule as the website tracker's form keys, so "sec-hero" (lead) and "sec_hero" (event) match.
 */
function formKeySql(expr) {
  return `COALESCE(NULLIF(TRIM(BOTH '_' FROM REGEXP_REPLACE(LOWER(${expr}), '[^a-z0-9]+', '_')), ''), '(not set)')`;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

/** One CSV cell; values starting with = + - @ are prefixed so spreadsheets don't run them. */
function csvCell(value) {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns, rows) {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.value === "function" ? c.value(r) : r[c.key])).join(","));
  return [head, ...body].join("\r\n");
}

function sendCsv(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(`﻿${csv}`);
}

module.exports = {
  PRESETS,
  DEFAULT_PRESET,
  MODELS,
  DIMENSIONS,
  rangeFromQuery,
  compareRangeFromQuery,
  previousRange,
  rangeSql,
  modelFromQuery,
  filtersFromQuery,
  cleanFilter,
  toCsv,
  sendCsv,
  csvCell,
  SEGMENTS,
  segmentFromQuery,
  landingPageFromQuery,
  trendBuckets,
  bucketCase,
  formKeySql,
  daysInclusive,
  sqlTime,
};
