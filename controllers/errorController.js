const AppError = require("../utils/appError");
require("dotenv").config();

const handleSequelizeValidationErrorDB = (err) => {
  console.error("ERROR 💥", err);
  const errors = err.errors.map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  console.error("ERROR 💥", err);
  const value = err.fields
    ? Object.values(err.fields).join(", ")
    : "Duplicate entry";
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleForeignKeyErrorDB = () =>
  // The driver message contains table/column names — keep it in the server log only.
  new AppError("This record references data that does not exist (or is still in use).", 400);

/** body-parser errors (malformed JSON, body too large) are client errors, not 500s. */
const handleBodyParserError = (err) =>
  err.type === "entity.too.large"
    ? new AppError("Request body is too large.", 413)
    : new AppError("Malformed request body.", 400);

const handleJWTError = () =>
  new AppError("Invalid token. Please log in again!", 401);

const handleJWTExpiredError = () =>
  new AppError("Your token has expired! Please log in again.", 401);

const isApiRequest = (req) => {
  const url = `${req.originalUrl || req.url || ""}`;
  return url.startsWith("/api") || url.startsWith("/qbo");
};

const sendErrorDev = (err, req, res) => {
  if (isApiRequest(req)) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  // B) Non-API URL (there is no "error" view template): plain text.
  return res.status(err.statusCode).type("text/plain").send(err.stack || err.message);
};

const sendErrorProd = (err, req, res) => {
  // A) API
  if (isApiRequest(req)) {
    // A) Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // B) Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error("ERROR 💥", err);
    // 2) Send generic message
    return res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }

  // B) Non-API URL (there is no "error" view template): plain text, no internals.
  return res
    .status(err.isOperational ? err.statusCode : 500)
    .type("text/plain")
    .send(err.isOperational ? err.message : "Something went wrong. Please try again later.");
};
/**
 * Error details (stack, raw error object) are only sent when API_ERROR_DETAILS=true — set it on
 * a developer machine, never on a shared server. Every other environment, including an unset or
 * unexpected NODE_ENV, gets the production handler (previously such requests got no response).
 */
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.name === "SequelizeConnectionRefusedError") {
    console.error("ERROR 💥", err);
    return res.status(503).json({
      status: "fail",
      message: "Service temporarily unavailable.",
    });
  }
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  console.error("ERROR 💥", err);

  if (process.env.API_ERROR_DETAILS === "true") {
    return sendErrorDev(err, req, res);
  }

  let error = { ...err };
  error.name = err.name;
  error.message = err.message;

  if (error.name === "SequelizeValidationError") {
    error = handleSequelizeValidationErrorDB(error);
  }
  if (error.code === "ER_DUP_ENTRY" || error.name === "SequelizeUniqueConstraintError") {
    error = handleDuplicateFieldsDB(error);
  }
  if (error.name === "SequelizeForeignKeyConstraintError") {
    error = handleForeignKeyErrorDB(error);
  }
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleJWTExpiredError();
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    error = handleBodyParserError(err);
  }

  return sendErrorProd(error, req, res);
};
