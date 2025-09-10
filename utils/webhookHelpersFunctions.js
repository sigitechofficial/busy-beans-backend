function parseOrderString(orderStr) {
  if (!orderStr || orderStr.trim() === '') {
    return [];
  }

  return orderStr
    .split(',') // split by comma
    .map((s) => s.replace('#', '').trim()) // remove "#" and spaces
    .filter(Boolean) // remove any accidental empty strings
    .map(Number); // convert to numbers
}
module.exports = { parseOrderString };
