const DEFAULT_ERROR_NAMES = {
  400: "BadRequest",
  404: "NotFound",
  500: "InternalServerError",
};

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.errorName = DEFAULT_ERROR_NAMES[status] || "Error";
  if (details) {
    error.details = details;
  }
  return error;
}

module.exports = { createHttpError };
