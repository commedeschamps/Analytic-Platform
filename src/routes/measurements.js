const express = require("express");
const {
  validateMeasurementsQuery,
  validateMetricsQuery,
  validateRangeQuery,
} = require("../middlewares/validateQuery");
const {
  getMeasurements,
  getMetrics,
  getRange,
} = require("../controllers/measurementsController");

const router = express.Router();

router.get("/", validateMeasurementsQuery, getMeasurements);
router.get("/metrics", validateMetricsQuery, getMetrics);
router.get("/range", validateRangeQuery, getRange);

module.exports = router;
