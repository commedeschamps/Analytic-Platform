const mongoose = require("mongoose");

const measurementSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true, index: true },
    field1: { type: Number, default: null },
    field2: { type: Number, default: null },
    field3: { type: Number, default: null },
    country: { type: String, default: null },
    iso_code: { type: String, default: null },
  },
  { collection: "measurements" }
);

measurementSchema.index({ iso_code: 1, timestamp: 1 });

module.exports = mongoose.model("Measurement", measurementSchema);
