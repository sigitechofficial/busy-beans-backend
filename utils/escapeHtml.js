/** HTML-escape text that is placed into email templates (names, notes and other visitor input). */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Copy of an object with every string value escaped (one level; other values unchanged). */
function escapeStrings(data = {}) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) out[key] = typeof value === "string" ? escapeHtml(value) : value;
  return out;
}

module.exports = { escapeHtml, escapeStrings };
