
const fs = require("fs");
const path = require("path");
const https = require("https");
const csv = require("csv-parser");

const { connectDB, disconnectDB } = require("../src/db");
const Measurement = require("../src/models/Measurement");

require("dotenv").config();

const CSV_URL = "https://owid-public.owid.io/data/energy/owid-energy-data.csv";
const DEFAULT_CSV_PATH = path.resolve(__dirname, "..", "owid-energy-data.csv");
const BATCH_SIZE = 1000;

function toNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toStringValue(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

function toYearDate(value) {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, 0, 1));
}

function isIso3(value) {
  return typeof value === "string" && value.length === 3;
}

function downloadCsv(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        if (redirects >= 5) {
          response.resume();
          reject(new Error("Too many redirects while downloading CSV."));
          return;
        }
        response.resume();
        downloadCsv(response.headers.location, destination, redirects + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(
          new Error(
            `Failed to download CSV: ${response.statusCode} ${response.statusMessage}`
          )
        );
        return;
      }

      const fileStream = fs.createWriteStream(destination);
      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close(resolve);
      });

      fileStream.on("error", (err) => {
        fs.unlink(destination, () => reject(err));
      });
    });

    request.on("error", reject);
  });
}

async function ensureCsvFile(filePath, shouldDownload) {
  if (fs.existsSync(filePath)) return;
  if (!shouldDownload) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  console.log(`CSV not found. Downloading from ${CSV_URL}...`);
  await downloadCsv(CSV_URL, filePath);
  console.log(`CSV downloaded to ${filePath}`);
}

async function insertBatch(batch, counters) {
  if (!batch.length) return;
  try {
    const insertedDocs = await Measurement.insertMany(batch, { ordered: true });
    counters.inserted += insertedDocs.length;
  } catch (error) {
    console.error("Insert batch failed:", error.message || error);
    throw error;
  } finally {
    batch.length = 0;
  }
}

async function importCsv(csvPath) {
  let readCount = 0;
  let skippedCount = 0;
  const counters = { inserted: 0 };
  const batch = [];

  const stream = fs.createReadStream(csvPath).pipe(csv());

  for await (const row of stream) {
    readCount += 1;

    const isoCode = row.iso_code;
    if (!isIso3(isoCode)) {
      skippedCount += 1;
      continue;
    }

    const timestamp = toYearDate(row.year);
    if (!timestamp) {
      skippedCount += 1;
      continue;
    }

    const field1 = toNumber(row.electricity_demand_per_capita);
    const field2 = toNumber(row.carbon_intensity_elec);
    const field3 = toNumber(row.energy_per_capita);

    if (field1 === null && field2 === null && field3 === null) {
      skippedCount += 1;
      continue;
    }

    batch.push({
      timestamp,
      field1,
      field2,
      field3,
      country: toStringValue(row.country),
      iso_code: toStringValue(isoCode),
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch, counters);
      console.log(
        `Progress: read ${readCount}, inserted ${counters.inserted}, skipped ${skippedCount}`
      );
    }
  }

  if (batch.length) {
    await insertBatch(batch, counters);
  }

  console.log(
    `Done. Read ${readCount}, inserted ${counters.inserted}, skipped ${skippedCount}`
  );
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is not set in .env");
  }

  const cliPath = process.argv[2];
  const csvPath = cliPath
    ? path.resolve(process.cwd(), cliPath)
    : DEFAULT_CSV_PATH;

  await ensureCsvFile(csvPath, !cliPath);

  try {
    await connectDB(mongoUri);
    await Measurement.createIndexes();
    console.log("MongoDB connected. Indexes ensured.");
    await importCsv(csvPath);
  } finally {
    await disconnectDB();
    console.log("MongoDB connection closed.");
  }
}

main().catch((error) => {
  console.error("Import failed:", error.message || error);
  process.exitCode = 1;
});
