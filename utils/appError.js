class AppError extends Error {
  constructor(message, statusCode, status = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = status ? status : 'fail';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
