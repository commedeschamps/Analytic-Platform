function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err.status) ? err.status : 500;
  const errorName =
    err.errorName ||
    (status === 400
      ? "BadRequest"
      : status === 404
        ? "NotFound"
        : "InternalServerError");

  const payload = {
    error: errorName,
    message: err.message || "Internal Server Error",
  };

  if (err.details) {
    payload.details = err.details;
  }

  res.status(status).json(payload);
}

module.exports = errorHandler;
