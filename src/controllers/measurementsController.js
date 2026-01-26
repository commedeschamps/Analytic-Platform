const Measurement = require("../models/Measurement");
const { createHttpError } = require("../utils/httpError");

async function getMeasurements(req, res, next) {
  try {
    const { field, startDate, endDate, isoCode, page, limit, sort, format } =
      req.validated;

    const filter = {};
    if (isoCode) {
      filter.iso_code = isoCode;
    }
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = startDate;
      if (endDate) filter.timestamp.$lte = endDate;
    }

    const projection = { _id: 0, timestamp: 1, [field]: 1 };
    const sortOrder = sort === "desc" ? -1 : 1;

    const dataQuery = Measurement.find(filter)
      .select(projection)
      .sort({ timestamp: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    if (format === "array") {
      const data = await dataQuery;
      if (!data.length) {
        return next(
          createHttpError(404, "No data found for the specified range.", {
            field,
            iso_code: isoCode || null,
          })
        );
      }
      return res.json(data);
    }

    const [data, total] = await Promise.all([
      dataQuery,
      Measurement.countDocuments(filter),
    ]);

    if (total === 0) {
      return next(
        createHttpError(404, "No data found for the specified range.", {
          field,
          iso_code: isoCode || null,
        })
      );
    }

    const totalPages = Math.ceil(total / limit);

    return res.json({
      page,
      limit,
      total,
      totalPages,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMetrics(req, res, next) {
  try {
    const { field, startDate, endDate, isoCode } = req.validated;

    const match = {};
    if (isoCode) {
      match.iso_code = isoCode;
    }
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = startDate;
      if (endDate) match.timestamp.$lte = endDate;
    }

    match[field] = { $type: "number" };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avg: { $avg: `$${field}` },
          min: { $min: `$${field}` },
          max: { $max: `$${field}` },
          stdDev: { $stdDevPop: `$${field}` },
        },
      },
      { $project: { _id: 0 } },
    ];

    const [result] = await Measurement.aggregate(pipeline);

    if (!result || result.count === 0) {
      return next(
        createHttpError(404, "No data found for the specified range.", {
          field,
          iso_code: isoCode || null,
        })
      );
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getRange(req, res, next) {
  try {
    const { field, isoCode } = req.validated;

    const match = {};
    if (isoCode) {
      match.iso_code = isoCode;
    }
    match[field] = { $type: "number" };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          minDate: { $min: "$timestamp" },
          maxDate: { $max: "$timestamp" },
        },
      },
      { $project: { _id: 0, minDate: 1, maxDate: 1 } },
    ];

    const [result] = await Measurement.aggregate(pipeline);

    if (!result || !result.minDate || !result.maxDate) {
      return next(
        createHttpError(404, "No data found for the specified range.", {
          field,
          iso_code: isoCode || null,
        })
      );
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMeasurements, getMetrics, getRange };
