const { createHttpError } = require("../utils/httpError");

const VALID_FIELDS = new Set(["field1", "field2", "field3"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value, endOfDay = false) {
  if (!DATE_RE.test(value)) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(
    Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
  );
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function parsePositiveInt(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeIsoCode(value) {
  if (value === undefined || value === null || value === "") return null;
  const iso = String(value).trim().toUpperCase();
  return iso.length === 3 ? iso : null;
}

function validateMeasurementsQuery(req, res, next) {
  const { field, start_date, end_date, iso_code, page, limit, sort, format } =
    req.query;

  if (!VALID_FIELDS.has(field)) {
    return next(
      createHttpError(400, "Invalid field parameter.", {
        field,
        allowed: Array.from(VALID_FIELDS),
      })
    );
  }

  let startDate = null;
  let endDate = null;

  if (start_date) {
    startDate = parseDate(start_date, false);
    if (!startDate) {
      return next(
        createHttpError(400, "Invalid start_date. Expected YYYY-MM-DD.", {
          start_date,
        })
      );
    }
  }

  if (end_date) {
    endDate = parseDate(end_date, true);
    if (!endDate) {
      return next(
        createHttpError(400, "Invalid end_date. Expected YYYY-MM-DD.", {
          end_date,
        })
      );
    }
  }

  if (startDate && endDate && startDate > endDate) {
    return next(
      createHttpError(400, "start_date must be before end_date.", {
        start_date,
        end_date,
      })
    );
  }

  const isoCode = normalizeIsoCode(iso_code);
  if (iso_code && !isoCode) {
    return next(
      createHttpError(400, "iso_code must be a 3-letter ISO code.", {
        iso_code,
      })
    );
  }

  let pageValue = parsePositiveInt(page, 1);
  if (!pageValue) {
    return next(
      createHttpError(400, "page must be a positive integer.", { page })
    );
  }

  let limitValue = parsePositiveInt(limit, 500);
  if (!limitValue) {
    return next(
      createHttpError(400, "limit must be a positive integer.", { limit })
    );
  }
  if (limitValue > 2000) {
    limitValue = 2000;
  }

  const sortValue = sort ? String(sort).toLowerCase() : "asc";
  if (!["asc", "desc"].includes(sortValue)) {
    return next(
      createHttpError(400, "sort must be asc or desc.", { sort })
    );
  }

  const formatValue = format === "array" ? "array" : "object";

  req.validated = {
    field,
    startDate,
    endDate,
    isoCode,
    page: pageValue,
    limit: limitValue,
    sort: sortValue,
    format: formatValue,
  };

  return next();
}

function validateMetricsQuery(req, res, next) {
  const { field, start_date, end_date, iso_code } = req.query;

  if (!VALID_FIELDS.has(field)) {
    return next(
      createHttpError(400, "Invalid field parameter.", {
        field,
        allowed: Array.from(VALID_FIELDS),
      })
    );
  }

  let startDate = null;
  let endDate = null;

  if (start_date) {
    startDate = parseDate(start_date, false);
    if (!startDate) {
      return next(
        createHttpError(400, "Invalid start_date. Expected YYYY-MM-DD.", {
          start_date,
        })
      );
    }
  }

  if (end_date) {
    endDate = parseDate(end_date, true);
    if (!endDate) {
      return next(
        createHttpError(400, "Invalid end_date. Expected YYYY-MM-DD.", {
          end_date,
        })
      );
    }
  }

  if (startDate && endDate && startDate > endDate) {
    return next(
      createHttpError(400, "start_date must be before end_date.", {
        start_date,
        end_date,
      })
    );
  }

  const isoCode = normalizeIsoCode(iso_code);
  if (iso_code && !isoCode) {
    return next(
      createHttpError(400, "iso_code must be a 3-letter ISO code.", {
        iso_code,
      })
    );
  }

  req.validated = {
    field,
    startDate,
    endDate,
    isoCode,
  };

  return next();
}

function validateRangeQuery(req, res, next) {
  const { field, iso_code } = req.query;

  if (!VALID_FIELDS.has(field)) {
    return next(
      createHttpError(400, "Invalid field parameter.", {
        field,
        allowed: Array.from(VALID_FIELDS),
      })
    );
  }

  const isoCode = normalizeIsoCode(iso_code);
  if (iso_code && !isoCode) {
    return next(
      createHttpError(400, "iso_code must be a 3-letter ISO code.", {
        iso_code,
      })
    );
  }

  req.validated = {
    field,
    isoCode,
  };

  return next();
}

module.exports = {
  validateMeasurementsQuery,
  validateMetricsQuery,
  validateRangeQuery,
};
