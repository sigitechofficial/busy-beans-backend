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

const handleForeignKeyErrorDB = (err) => {
  const message = `Foreign key violation: ${err.message}. Please check your data.`;
  return new AppError(message, 400);
};

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

  // B) RENDERED WEBSITE
  console.error("ERROR 💥", err);
  return res.status(err.statusCode).render("error", {
    title: "Something went wrong!",
    msg: err.message,
  });
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

  // B) RENDERED WEBSITE
  // A) Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).render("error", {
      title: "Something went wrong!",
      msg: err.message,
    });
  }
  // B) Programming or other unknown error: don't leak error details
  // 1) Log error
  console.error("ERROR 💥", err);
  // 2) Send generic message
  return res.status(err.statusCode).render("error", {
    title: "Something went wrong!",
    msg: "Please try again later.",
  });
};
module.exports = (err, req, res, next) => {
  // console.log(err.stack);
  if (err.name === "SequelizeConnectionRefusedError") {
    return res.status(503).json({
      status: "fail",
      error: "database not connected -- start server",
    });
  }
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  console.error("ERROR 💥", err);

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    error.message = err.message;

    if (error.name === "SequelizeValidationError") {
      error = handleSequelizeValidationErrorDB(error);
    }
    if (error.code === "ER_DUP_ENTRY") {
      error = handleDuplicateFieldsDB(error);
    }
    if (error.name === "SequelizeForeignKeyConstraintError") {
      error = handleForeignKeyErrorDB(error);
    }
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};
