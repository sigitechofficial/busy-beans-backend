function marketingRequestLogger(req, _res, next) {
  // Keep logs concise and avoid leaking full auth tokens.
  const authHeader = req.headers.authorization;
  const authPreview =
    authHeader && authHeader.startsWith("Bearer ") ? "bearer" : undefined; // never any part of the token

  // eslint-disable-next-line no-console
  console.log(
    `[marketing] ${req.method} ${req.originalUrl} ua="${req.headers["user-agent"] || ""}" auth="${authPreview || "none"}"`,
  );
  next();
}

module.exports = { marketingRequestLogger };
