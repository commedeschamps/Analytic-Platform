# Analytical Platform (Node.js + Express + MongoDB)

Analytical platform for time-series energy data using the Our World in Data (OWID) Energy dataset. Imports CSV into MongoDB and exposes REST APIs for time-series queries and metrics. Includes a lightweight frontend with Chart.js.

## Features
- MongoDB time-series storage (collection: `measurements`)
- REST API for data, metrics, and available year range
- Year-based filters (avoids partial-year artifacts)
- Validation, pagination, and consistent JSON errors
- Simple frontend (filters, charts, metrics)

## Tech stack
- Node.js + Express
- MongoDB + Mongoose
- Chart.js (via CDN)

## Project structure
```
.
├─ public/                # Frontend
├─ scripts/               # CSV import
├─ src/                   # Backend
│  ├─ controllers/
│  ├─ middlewares/
│  ├─ models/
│  ├─ routes/
│  └─ utils/
├─ .env.example
├─ package.json
└─ README.md
```

## Requirements
- Node.js 18+
- MongoDB (local or Atlas)

## Setup
```bash
npm install
cp .env.example .env
```

Set `MONGO_URI` in `.env`.

## Import dataset
```bash
npm run import:energy
```

Import rules:
- Only ISO-3 countries (`iso_code` length = 3)
- Skip rows where all `field1/field2/field3` are missing or not numbers
- Empty strings → `null`
- Batch insert (size 1000) with `insertMany`
- Indexes: `timestamp` and `{ iso_code: 1, timestamp: 1 }`

## Run server
```bash
npm run dev
# or
npm start
```

Open the frontend at `http://localhost:3000`.

## API
Base URL: `http://localhost:3000`

### 1) Fetch time-series data
`GET /api/measurements`

Required:
- `field=field1|field2|field3`

Optional:
- `start_date=YYYY-MM-DD`
- `end_date=YYYY-MM-DD`
- `iso_code=KAZ` (ISO-3)
- `page=1`
- `limit=500` (max 2000)
- `sort=asc|desc`
- `format=array` (default response is a wrapper with pagination)

Example:
```bash
curl "http://localhost:3000/api/measurements?field=field1&iso_code=KAZ&start_date=2000-01-01&end_date=2020-12-31&page=1&limit=500&sort=asc"
```

Default response:
```json
{
  "page": 1,
  "limit": 500,
  "total": 1234,
  "totalPages": 3,
  "data": [
    { "timestamp": "2020-01-01T00:00:00.000Z", "field1": 123.4 }
  ]
}
```

With `format=array`:
```bash
curl "http://localhost:3000/api/measurements?field=field1&iso_code=KAZ&start_date=2000-01-01&end_date=2020-12-31&format=array"
```

If no data matches, the API returns `404`:
```json
{
  "error": "NotFound",
  "message": "No data found for the specified range."
}
```

### 2) Fetch metrics
`GET /api/measurements/metrics`

Example:
```bash
curl "http://localhost:3000/api/measurements/metrics?field=field2&iso_code=KAZ&start_date=2000-01-01&end_date=2020-12-31"
```

Response:
```json
{
  "count": 123,
  "avg": 22.8,
  "min": 22.5,
  "max": 23.1,
  "stdDev": 0.3
}
```

### 3) Fetch available year range
`GET /api/measurements/range`

Example:
```bash
curl "http://localhost:3000/api/measurements/range?field=field1&iso_code=KAZ"
```

Response:
```json
{
  "minDate": "1990-01-01T00:00:00.000Z",
  "maxDate": "2024-01-01T00:00:00.000Z"
}
```

## Field mapping
- `field1` → `electricity_demand_per_capita`
- `field2` → `carbon_intensity_elec`
- `field3` → `energy_per_capita`

## Notes
- Data is yearly; timestamps are stored as `new Date(Date.UTC(year, 0, 1))`.
- UI uses **year selectors** to avoid partial-year filtering.
- Metrics use MongoDB aggregation with `$stdDevPop`.

## Error format
All errors return JSON:
```json
{
  "error": "BadRequest",
  "message": "Invalid field parameter.",
  "details": { "field": "field9" }
}
```
