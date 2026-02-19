/**
 * Parses various date formats into a Date object.
 * Supports: ISO (2026-02-12T13:20:30.000Z), YYYY-MM-DD, DD/MM/YYYY, or Date object.
 */
function parseToDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const str = String(input).trim();
  if (!str) return null;

  // ISO or YYYY-MM-DD (with optional time)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or D/M/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch.map(Number);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: let Date parse it
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

exports.emailDateFormate = (dateInput, timeString) => {
  let date = parseToDate(dateInput);
  if (!date) return "";

  // Legacy: if timeString provided (e.g. "13:20"), set time on the date
  if (timeString != null && String(timeString).trim()) {
    const [h, m, s] = String(timeString).trim().split(/[:\s]/).map(Number);
    if (!isNaN(h)) date.setHours(h, m || 0, s || 0, 0);
  }

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const month = months[date.getMonth()];
  const dayOfMonth = date.getDate();
  const year = date.getFullYear();

  return `${month} ${dayOfMonth}, ${year}`;
};
