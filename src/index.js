const path = require("path");
const express = require("express");

require("dotenv").config();

const { connectDB, disconnectDB } = require("./db");
const measurementsRouter = require("./routes/measurements");
const errorHandler = require("./middlewares/errorHandler");
const { createHttpError } = require("./utils/httpError");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use("/api/measurements", measurementsRouter);
app.use(express.static(path.join(__dirname, "..", "public")));

app.use((req, res, next) => {
  next(
    createHttpError(404, "Route not found.", { path: req.originalUrl })
  );
});

app.use(errorHandler);

async function startServer() {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("MongoDB connected.");
    const server = app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log("Shutting down server...");
      server.close();
      await disconnectDB();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error.message || error);
    process.exit(1);
  }
}

startServer();
