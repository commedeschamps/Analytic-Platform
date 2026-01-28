const fieldSelect = document.getElementById("field");
const isoInput = document.getElementById("isoCode");
const startYearSelect = document.getElementById("startYear");
const endYearSelect = document.getElementById("endYear");
const chartTypeSelect = document.getElementById("chartType");
const form = document.getElementById("controlsForm");
const statusText = document.getElementById("status");
const errorBox = document.getElementById("error");
const seriesMeta = document.getElementById("seriesMeta");
const isoDataList = document.getElementById("isoCodes");
const isoList = document.getElementById("isoList");

const metricCount = document.getElementById("metric-count");
const metricAvg = document.getElementById("metric-avg");
const metricMin = document.getElementById("metric-min");
const metricMax = document.getElementById("metric-max");
const metricStdDev = document.getElementById("metric-stdDev");

const loadButton = document.getElementById("loadButton");
const chartCanvas = document.getElementById("chart");

const fieldLabels = {
  field1: "Electricity demand per capita",
  field2: "Carbon intensity of electricity",
  field3: "Energy per capita",
};

let chart;
let isoInputTimer;

async function loadIsoCodes() {
  if (!isoDataList || !isoList) return;
  try {
    const response = await fetch("/iso-codes.json", { cache: "force-cache" });
    if (!response.ok) return;
    const codes = await response.json();
    if (!Array.isArray(codes)) return;

    isoDataList.innerHTML = "";
    isoList.innerHTML = "";

    const dataFragment = document.createDocumentFragment();
    const listFragment = document.createDocumentFragment();

    codes.forEach((code) => {
      if (!code) return;
      const option = document.createElement("option");
      option.value = code;
      option.textContent = code;
      dataFragment.appendChild(option);

      const chip = document.createElement("span");
      chip.className = "iso-chip";
      const strong = document.createElement("strong");
      strong.textContent = code;
      chip.appendChild(strong);
      listFragment.appendChild(chip);
    });

    isoDataList.appendChild(dataFragment);
    isoList.appendChild(listFragment);
  } catch (error) {
    console.warn("Failed to load ISO codes:", error);
  }
}

Chart.defaults.font.family = '"Sora", sans-serif';
Chart.defaults.color = "#3b3b3b";

function toYearValue(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

function parseYear(value) {
  if (!value) return null;
  const year = Number.parseInt(value, 10);
  return Number.isFinite(year) ? year : null;
}

function setStatus(message) {
  statusText.textContent = message;
}

function setYearSelectsDisabled(disabled) {
  startYearSelect.disabled = disabled;
  endYearSelect.disabled = disabled;
}

function clearYearSelects() {
  startYearSelect.innerHTML = "";
  endYearSelect.innerHTML = "";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("visible");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.remove("visible");
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function updateMetrics(metrics) {
  metricCount.textContent = formatNumber(metrics.count);
  metricAvg.textContent = formatNumber(metrics.avg);
  metricMin.textContent = formatNumber(metrics.min);
  metricMax.textContent = formatNumber(metrics.max);
  metricStdDev.textContent = formatNumber(metrics.stdDev);
}

function updateSeriesMeta(field, isoCode, startYear, endYear) {
  const parts = [];
  parts.push(fieldLabels[field] || field);
  if (isoCode) parts.push(`ISO ${isoCode}`);
  if (startYear || endYear) {
    parts.push(`${startYear || "…"} → ${endYear || "…"}`);
  }
  seriesMeta.textContent = parts.join(" · ");
}

function buildMeasurementsUrl() {
  const params = new URLSearchParams();
  const field = fieldSelect.value;
  const isoCode = isoInput.value.trim().toUpperCase();
  const startYear = startYearSelect.value;
  const endYear = endYearSelect.value;

  params.set("field", field);
  if (isoCode) params.set("iso_code", isoCode);
  if (startYear) params.set("start_date", `${startYear}-01-01`);
  if (endYear) params.set("end_date", `${endYear}-12-31`);
  params.set("limit", "2000");
  params.set("sort", "asc");
  params.set("format", "array");

  return {
    url: `/api/measurements?${params.toString()}`,
    field,
    isoCode,
    startYear,
    endYear,
  };
}

function buildMetricsUrl(field, isoCode, startYear, endYear) {
  const params = new URLSearchParams();
  params.set("field", field);
  if (isoCode) params.set("iso_code", isoCode);
  if (startYear) params.set("start_date", `${startYear}-01-01`);
  if (endYear) params.set("end_date", `${endYear}-12-31`);
  return `/api/measurements/metrics?${params.toString()}`;
}

function buildRangeUrl(field, isoCode) {
  const params = new URLSearchParams();
  params.set("field", field);
  if (isoCode) params.set("iso_code", isoCode);
  return `/api/measurements/range?${params.toString()}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message =
      payload?.message || `Request failed (${response.status}).`;
    const requestError = new Error(message);
    requestError.status = response.status;
    requestError.payload = payload;
    throw requestError;
  }
  return payload;
}

async function updateDateRange() {
  const field = fieldSelect.value;
  const isoCode = isoInput.value.trim().toUpperCase();

  if (isoCode && isoCode.length !== 3) {
    setYearSelectsDisabled(true);
    setStatus("Enter a 3-letter ISO code to load years.");
    return;
  }

  setYearSelectsDisabled(true);

  try {
    const range = await fetchJson(buildRangeUrl(field, isoCode));
    const minYear = toYearValue(range.minDate);
    const maxYear = toYearValue(range.maxDate);

    if (!minYear || !maxYear) {
      clearYearSelects();
      setStatus("No available years for this selection.");
      return;
    }

    const prevStart = parseYear(startYearSelect.value);
    const prevEnd = parseYear(endYearSelect.value);

    clearYearSelects();

    for (let year = minYear; year <= maxYear; year += 1) {
      const startOption = document.createElement("option");
      startOption.value = String(year);
      startOption.textContent = String(year);
      startYearSelect.appendChild(startOption);

      const endOption = document.createElement("option");
      endOption.value = String(year);
      endOption.textContent = String(year);
      endYearSelect.appendChild(endOption);
    }

    const startYear =
      prevStart && prevStart >= minYear && prevStart <= maxYear
        ? prevStart
        : minYear;
    const endYear =
      prevEnd && prevEnd >= minYear && prevEnd <= maxYear ? prevEnd : maxYear;

    startYearSelect.value = String(startYear);
    endYearSelect.value = String(endYear);

    if (parseYear(startYearSelect.value) > parseYear(endYearSelect.value)) {
      endYearSelect.value = startYearSelect.value;
    }

    setYearSelectsDisabled(false);
    setStatus(`Available years: ${minYear}–${maxYear}.`);
  } catch (error) {
    if (error.status === 404) {
      clearYearSelects();
      setYearSelectsDisabled(true);
      setStatus("No data for the selected ISO.");
      return;
    }
    showError(error.message);
    setStatus("Failed to load available years.");
  }
}

function handleIsoInput() {
  if (isoInputTimer) {
    clearTimeout(isoInputTimer);
  }
  isoInputTimer = setTimeout(() => {
    const isoCode = isoInput.value.trim().toUpperCase();
    if (!isoCode || isoCode.length === 3) {
      updateDateRange();
    } else {
      setYearSelectsDisabled(true);
      setStatus("Enter a 3-letter ISO code to load years.");
    }
  }, 300);
}

function renderChart(type, labels, values, label) {
  const data = {
    labels,
    datasets: [
      {
        label,
        data: values,
        borderColor: "#0f766e",
        backgroundColor:
          type === "bar" ? "rgba(15, 118, 110, 0.6)" : "rgba(15, 118, 110, 0.2)",
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: "#0f766e",
        spanGaps: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { ticks: { maxRotation: 0 } },
      y: { beginAtZero: false },
    },
  };

  if (chart) {
    chart.destroy();
  }
  chart = new Chart(chartCanvas, { type, data, options });
}

function syncYearRange(changed) {
  const start = parseYear(startYearSelect.value);
  const end = parseYear(endYearSelect.value);
  if (!start || !end) return;
  if (start > end) {
    if (changed === "start") {
      endYearSelect.value = startYearSelect.value;
    } else {
      startYearSelect.value = endYearSelect.value;
    }
  }
}

async function loadData(event) {
  event.preventDefault();
  clearError();
  loadButton.disabled = true;
  loadButton.classList.add("loading");
  loadButton.setAttribute("aria-busy", "true");
  setStatus("Loading data...");

  const { url, field, isoCode, startYear, endYear } =
    buildMeasurementsUrl();

  try {
    updateSeriesMeta(field, isoCode, startYear, endYear);
    const [series, metrics] = await Promise.all([
      fetchJson(url),
      fetchJson(buildMetricsUrl(field, isoCode, startYear, endYear)),
    ]);

    if (!Array.isArray(series) || series.length === 0) {
      renderChart(chartTypeSelect.value, [], [], fieldLabels[field]);
      updateMetrics(metrics);
      setStatus("No data for the selected filters.");
      return;
    }

    const labels = series.map((item) =>
      new Date(item.timestamp).getUTCFullYear()
    );
    const values = series.map((item) => item[field] ?? null);

    renderChart(chartTypeSelect.value, labels, values, fieldLabels[field]);
    updateMetrics(metrics);
    setStatus(`Loaded ${series.length} points.`);
  } catch (error) {
    if (error.status === 404) {
      renderChart(chartTypeSelect.value, [], [], fieldLabels[field]);
      updateMetrics({
        count: 0,
        avg: null,
        min: null,
        max: null,
        stdDev: null,
      });
      setStatus("No data for the selected filters.");
    } else {
      showError(error.message);
      setStatus("Failed to load data.");
    }
  } finally {
    loadButton.disabled = false;
    loadButton.classList.remove("loading");
    loadButton.setAttribute("aria-busy", "false");
  }
}

form.addEventListener("submit", loadData);
fieldSelect.addEventListener("change", updateDateRange);
isoInput.addEventListener("change", updateDateRange);
isoInput.addEventListener("blur", updateDateRange);
isoInput.addEventListener("input", handleIsoInput);
startYearSelect.addEventListener("change", () => syncYearRange("start"));
endYearSelect.addEventListener("change", () => syncYearRange("end"));

loadIsoCodes();
updateDateRange().finally(() => setStatus("Ready."));
