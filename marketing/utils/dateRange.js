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
    replacements.rangeStart = range.start;
  }
  if (range.end) {
    conditions.push(`${column} <= :rangeEnd`);
    replacements.rangeEnd = range.end;
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
    replacements.rangeStart = range.start;
  }
  if (range.end) {
    parts.push(`${column} <= :rangeEnd`);
    replacements.rangeEnd = range.end;
  }
  if (!parts.length) return { sql: "", replacements };
  return {
    sql: `${prefix} ${parts.join(" AND ")}`,
    replacements,
  };
}

module.exports = {
  parseDateRange,
  buildTimestampWhere,
  appendTimestampFilter,
};
