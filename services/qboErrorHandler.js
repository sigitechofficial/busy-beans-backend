// qboErrorHandler.js (or anywhere in your utils)
function handleQboError({ err, context = "[QBO]" }) {
  const message = err && err.message ? err.message : String(err);

  console.error(`❌ ${context}:`, message);

  // --- Deep QBO error dump ---
  if (err && err.response) {
    console.error("🔍 QBO STATUS:", err.response.status);
    console.error(
      "🔍 QBO HEADERS:",
      JSON.stringify(err.response.headers, null, 2)
    );
    console.error("🔍 QBO BODY:", JSON.stringify(err.response.data, null, 2));
  } else if (err && err.request) {
    console.error("🕸 No response received from QBO");
    console.error(err.request);
  } else {
    console.error("⚠️ Request Setup/Error:", message);
  }

  console.error("🔻 STACK TRACE:");
  console.error(err && err.stack ? err.stack : "No stack available");
  return false;
}

module.exports = { handleQboError };
// or export default handleQboError; if you're using ESM
