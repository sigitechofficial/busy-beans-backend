/**
 * DATETIME columns hold UTC (Sequelize model writes use +00:00), but a Date passed as a raw
 * query replacement is formatted in the Node process's local timezone. Pass this instead.
 */
function toSqlUtc(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseDateRange(from, to) {
  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) range.start = start;
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) range.end = end;
  }
  return range;
}

function buildTimestampWhere(range, column = "timestamp") {
  const conditions = [];
  const replacements = {};
  if (range.start) {
    conditions.push(`${column} >= :rangeStart`);
    replacements.rangeStart = toSqlUtc(range.start);
  }
  if (range.end) {
    conditions.push(`${column} <= :rangeEnd`);
    replacements.rangeEnd = toSqlUtc(range.end);
  }
  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    replacements,
  };
}

function appendTimestampFilter(range, column = "timestamp", prefix = "AND") {
  const parts = [];
  const replacements = {};
  if (range.start) {
    parts.push(`${column} >= :rangeStart`);
    replacements.rangeStart = toSqlUtc(range.start);
  }
  if (range.end) {
    parts.push(`${column} <= :rangeEnd`);
    replacements.rangeEnd = toSqlUtc(range.end);
  }
  if (!parts.length) return { sql: "", replacements };
  return {
    sql: `${prefix} ${parts.join(" AND ")}`,
    replacements,
  };
}

module.exports = {
  toSqlUtc,
  parseDateRange,
  buildTimestampWhere,
  appendTimestampFilter,
};
