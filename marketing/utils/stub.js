/**
 * Placeholder handlers until feature implementation (Phase 1+).
 */
function notImplemented(_req, res) {
  res.status(501).json({
    error: "Not implemented yet",
    code: "NOT_IMPLEMENTED",
  });
}

module.exports = { notImplemented };
