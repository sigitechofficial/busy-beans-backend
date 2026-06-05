function sendData(res, statusCode, data) {
  return res.status(statusCode).json({ data });
}

function sendError(res, statusCode, error, code, details) {
  const payload = { error, code };
  if (details !== undefined) payload.details = details;
  return res.status(statusCode).json(payload);
}

module.exports = {
  sendData,
  sendError,
};
