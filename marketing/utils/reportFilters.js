/**
 * Report filters shared by every analytics query: what counts as REAL traffic.
 *
 * Campaign Builder canvas / preview traffic is classified at ingest (analyticsEvents.service
 * isEditorTraffic: /preview/* or /admin/* paths, or a Campaign Builder session) and stored with
 * page_type = 'preview'; migration 038 marked older rows the same way. It never creates sessions or
 * touchpoints now; the session / touchpoint filters below only exclude rows written before that.
 * Server events (orders, lead_created) have page_type NULL and are real.
 */

const EDITOR_PATH = (column) =>
  `(${column} IS NULL OR (${column} NOT LIKE '/preview/%' AND ${column} <> '/preview' AND ${column} NOT LIKE '/admin/%' AND ${column} <> '/admin'))`;

/** Events: everything except Campaign Builder preview / canvas traffic. */
function realEvents(alias) {
  const a = alias ? `${alias}.` : "";
  return `(${a}page_type IS NULL OR ${a}page_type <> 'preview')`;
}

/** Sessions: excludes sessions started by (legacy) preview traffic. */
function realSessions(alias) {
  const a = alias ? `${alias}.` : "";
  return EDITOR_PATH(`${a}entry_pathname`);
}

/** Touchpoints: excludes (legacy) touchpoints recorded on preview / canvas pages. */
function realTouchpoints(alias) {
  const a = alias ? `${alias}.` : "";
  return EDITOR_PATH(`${a}pathname`);
}

module.exports = { realEvents, realSessions, realTouchpoints };
