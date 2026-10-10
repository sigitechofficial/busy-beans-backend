/**
 * Reporting days are calendar days in the business timezone (MARKETING_REPORT_TIMEZONE,
 * default America/New_York). Timestamps are stored in UTC; these helpers convert a local
 * day ("YYYY-MM-DD") to its UTC [start, end) instants and back, DST-aware, using Intl only.
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function reportTimeZone() {
  const tz = process.env.MARKETING_REPORT_TIMEZONE || "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/New_York";
  }
}

/** Local calendar date of an instant in `tz`, as YYYY-MM-DD. */
function localDateOf(date, tz = reportTimeZone()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Offset (ms) of `tz` from UTC at instant `date` (e.g. -4h for New York in summer). */
function tzOffsetMs(date, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant at which local day `day` (YYYY-MM-DD) starts in `tz`. */
function dayStartUtc(day, tz = reportTimeZone()) {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Two passes settle DST transitions.
  let instant = guess - tzOffsetMs(new Date(guess), tz);
  instant = guess - tzOffsetMs(new Date(instant), tz);
  return new Date(instant);
}

function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Inclusive list of days from..to (YYYY-MM-DD). */
function daysBetween(from, to) {
  const out = [];
  for (let day = from; day <= to && out.length < 3700; day = addDays(day, 1)) out.push(day);
  return out;
}

function isDay(value) {
  return typeof value === "string" && DAY_RE.test(value);
}

/**
 * Report range from query strings. Date-only values are local business days (inclusive);
 * full ISO timestamps are taken as-is. Returns UTC instants: start (inclusive), end (exclusive).
 */
function parseReportRange(from, to, tz = reportTimeZone()) {
  const range = { tz };
  if (from) {
    if (isDay(from)) {
      range.fromDay = from;
      range.start = dayStartUtc(from, tz);
    } else {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        range.start = d;
        range.fromDay = localDateOf(d, tz);
      }
    }
  }
  if (to) {
    if (isDay(to)) {
      range.toDay = to;
      range.end = dayStartUtc(addDays(to, 1), tz);
    } else {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        range.end = d;
        range.toDay = localDateOf(d, tz);
      }
    }
  }
  return range;
}

module.exports = {
  reportTimeZone,
  localDateOf,
  dayStartUtc,
  addDays,
  daysBetween,
  isDay,
  parseReportRange,
};
