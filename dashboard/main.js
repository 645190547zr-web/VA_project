const PCA_FILE    = "data/pca_scores_with_clusters_k4.csv";
const MASTER_FILE = "data/master_data_completed.csv";
const CLUSTER_SUMMARY_FILE = "data/cluster_summary_mean.csv";

let pcaData = [];
let masterData = [];
let clusterSummaryData = [];

/* =========================
   CSV PARSER
========================= */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      value = "";

      if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

/* =========================
   DATA LOADER
   - server mode: fetch CSV
   - file mode: use window.APP_DATA fallback
========================= */
async function loadCSV(path, fallbackKey) {
  const isFileMode = window.location.protocol === "file:";

  if (isFileMode) {
    if (window.APP_DATA && window.APP_DATA[fallbackKey]) {
      return parseCSV(window.APP_DATA[fallbackKey]);
    }
    throw new Error(
      `Opened with file:// and no embedded data found for ${fallbackKey}. ` +
      `Either run a local server or provide js/data.js.`
    );
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${path}`);
    }
    const text = await response.text();
    return parseCSV(text);
  } catch (err) {
    if (window.APP_DATA && window.APP_DATA[fallbackKey]) {
      console.warn(`Fetch failed for ${path}, falling back to embedded data.`, err);
      return parseCSV(window.APP_DATA[fallbackKey]);
    }
    throw err;
  }
}

/* =========================
   TYPE CONVERSION
========================= */
function typeConvertPCA(data) {
  return data.map(d => ({
    ...d,
    year: +d.year,
    pc1: +d.pc1,
    pc2: +d.pc2,
    cluster: d.cluster !== "" ? +d.cluster : null
  }));
}

function typeConvertMaster(data) {
  const numericCols = [
    "year",
    "top500_systems_count",
    "top500_rmax_sum_pflops",
    "ai_publications",
    "ai_policy_initiatives_new",
    "gdp_per_capita_usd",
    "rd_gdp",
    "researchers_per_million",
    "it_net_secr",
    "internet_users_pct",
    "fixed_broadband_per100",
    "mobile_cellular_per100",
    "tertiary_enrollment_gross",
    "ict_service_exports_pct",
    "computer_comm_services_pct",
    "hightech_exports_pct_manu",
    "electric_power_kwh_per_capita"
  ];

  return data.map(d => {
    const out = { ...d };
    numericCols.forEach(col => {
      if (out[col] !== undefined && out[col] !== "") out[col] = +out[col];
    });
    return out;
  });
}

function typeConvertClusterSummary(data) {
  const numericCols = [
    "cluster",
    "gdp_per_capita_usd",
    "rd_gdp",
    "researchers_per_million",
    "top500_rmax_sum_pflops",
    "top500_systems_count",
    "ai_publications",
    "ai_policy_initiatives_new",
    "internet_users_pct",
    "fixed_broadband_per100",
    "electric_power_kwh_per_capita"
  ];

  return data.map(d => {
    const out = { ...d };
    numericCols.forEach(col => {
      if (out[col] !== undefined && out[col] !== "") out[col] = +out[col];
    });
    return out;
  });
}

/* =========================
   DATA JOIN
   Add cluster from PCA into master
========================= */
function joinClusterIntoMaster(master, pca) {
  const pcaMap = new Map(
    pca.map(d => [`${d.country}__${d.year}`, d])
  );

  return master.map(d => {
    const key = `${d.country}__${d.year}`;
    const match = pcaMap.get(key);
    return {
      ...d,
      cluster: match ? match.cluster : null,
      pc1: match ? match.pc1 : null,
      pc2: match ? match.pc2 : null
    };
  });
}

/* =========================
   FILTER HELPERS
========================= */
function populateYearSelect() {
  const yearSelect = document.getElementById("yearSelect");
  yearSelect.innerHTML = `<option value="all">All Years</option>`;

  const years = [...new Set(pcaData.map(d => d.year))].sort((a, b) => a - b);
  years.forEach(y => {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    yearSelect.appendChild(option);
  });

  yearSelect.value = "all";
}

function getFilteredPCAData() {
  const yearValue = document.getElementById("yearSelect").value;
  if (yearValue === "all") return pcaData;
  return pcaData.filter(d => d.year === +yearValue);
}

function getFilteredMasterData() {
  const yearValue = document.getElementById("yearSelect").value;
  if (yearValue === "all") return masterData;
  return masterData.filter(d => d.year === +yearValue);
}

/* =========================
   SCATTER VIEW
========================= */
async function renderScatter() {
  const data = getFilteredPCAData();

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 520,
    height: 380,
    data: { values: data },
    params: [
      {
        name: "brush",
        select: { type: "interval" }
      }
    ],
    mark: { type: "point", filled: true, size: 70 },
    encoding: {
      x: { field: "pc1", type: "quantitative", title: "PC1" },
      y: { field: "pc2", type: "quantitative", title: "PC2" },
      color: {
        field: "cluster",
        type: "nominal",
        title: "Cluster"
      },
      opacity: {
        condition: { param: "brush", value: 1 },
        value: 0.25
      },
      tooltip: [
        { field: "country", type: "nominal" },
        { field: "year", type: "quantitative" },
        { field: "region", type: "nominal" },
        { field: "cluster", type: "nominal" },
        { field: "pc1", type: "quantitative" },
        { field: "pc2", type: "quantitative" }
      ]
    }
  };

  return await vegaEmbed("#scatterView", spec, { actions: false });
}

/* =========================
   BAR VIEW
   - aggregate mean by country
   - works for single year and all years
========================= */
async function renderBar(selectedCountries = null) {
  const metric = document.getElementById("metricSelect").value;
  let data = getFilteredMasterData();

  if (selectedCountries && selectedCountries.length > 0) {
    data = data.filter(d => selectedCountries.includes(d.country));
  }

  const labelMap = {
    top500_rmax_sum_pflops: "TOP500 Rmax Sum",
    ai_publications: "AI Publications",
    ai_policy_initiatives_new: "AI Policy Initiatives",
    rd_gdp: "R&D % GDP"
  };

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 520,
    height: 380,
    data: { values: data },
    transform: [
      {
        aggregate: [
          { op: "mean", field: metric, as: "metric_value" },
          { op: "mean", field: "cluster", as: "cluster_mean" }
        ],
        groupby: ["country"]
      }
    ],
    mark: "bar",
    encoding: {
      y: {
        field: "country",
        type: "nominal",
        sort: { field: "metric_value", order: "descending" },
        title: "Country"
      },
      x: {
        field: "metric_value",
        type: "quantitative",
        title: labelMap[metric] || metric
      },
      color: {
        field: "cluster_mean",
        type: "nominal",
        title: "Cluster"
      },
      tooltip: [
        { field: "country", type: "nominal" },
        { field: "metric_value", type: "quantitative", title: labelMap[metric] || metric }
      ]
    }
  };

  await vegaEmbed("#barView", spec, { actions: false });
}

/* =========================
   TRAJECTORY VIEW
========================= */
async function renderTrajectory(selectedCountries = []) {
  let data = pcaData;

  if (selectedCountries.length > 0) {
    data = data.filter(d => selectedCountries.includes(d.country));
  } else {
    data = data.filter(d =>
      ["United States", "China", "Germany", "South Korea", "Singapore"].includes(d.country)
    );
  }

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 520,
    height: 380,
    data: { values: data },
    mark: { type: "line", point: true },
    encoding: {
      x: { field: "pc1", type: "quantitative", title: "PC1" },
      y: { field: "pc2", type: "quantitative", title: "PC2" },
      color: { field: "country", type: "nominal", title: "Country" },
      detail: { field: "country" },
      order: { field: "year", type: "quantitative" },
      tooltip: [
        { field: "country", type: "nominal" },
        { field: "year", type: "quantitative" },
        { field: "pc1", type: "quantitative" },
        { field: "pc2", type: "quantitative" }
      ]
    }
  };

  await vegaEmbed("#trajectoryView", spec, { actions: false });
}

/* =========================
   PARALLEL VIEW
   cluster mean profiles
========================= */
async function renderParallel() {
  if (!clusterSummaryData.length) {
    document.getElementById("parallelView").innerHTML =
      "<p>No cluster summary data loaded.</p>";
    return;
  }

  const features = [
    "gdp_per_capita_usd",
    "rd_gdp",
    "researchers_per_million",
    "top500_rmax_sum_pflops",
    "top500_systems_count",
    "ai_publications",
    "ai_policy_initiatives_new",
    "internet_users_pct",
    "fixed_broadband_per100",
    "electric_power_kwh_per_capita"
  ];

  const longData = [];
  clusterSummaryData.forEach(row => {
    features.forEach(variable => {
      longData.push({
        cluster: row.cluster,
        variable,
        value: row[variable]
      });
    });
  });

  // min-max scaling across clusters for each variable
  const grouped = {};
  features.forEach(v => {
    const vals = longData.filter(d => d.variable === v).map(d => d.value);
    grouped[v] = { min: Math.min(...vals), max: Math.max(...vals) };
  });

  const scaled = longData.map(d => {
    const { min, max } = grouped[d.variable];
    const scaledValue = (max === min) ? 0.5 : (d.value - min) / (max - min);
    return {
      ...d,
      scaledValue
    };
  });

  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 1100,
    height: 320,
    data: { values: scaled },
    mark: { type: "line", point: true },
    encoding: {
      x: {
        field: "variable",
        type: "nominal",
        axis: { labelAngle: -30, title: null }
      },
      y: {
        field: "scaledValue",
        type: "quantitative",
        title: "Scaled Cluster Mean (0–1)"
      },
      color: {
        field: "cluster",
        type: "nominal",
        title: "Cluster"
      },
      detail: { field: "cluster" },
      tooltip: [
        { field: "cluster", type: "nominal" },
        { field: "variable", type: "nominal" },
        { field: "value", type: "quantitative" },
        { field: "scaledValue", type: "quantitative" }
      ]
    }
  };

  await vegaEmbed("#parallelView", spec, { actions: false });
}

/* =========================
   SUMMARY VIEW
========================= */
function computeSummary(selectedCountries = null) {
  let data = getFilteredMasterData();

  if (selectedCountries && selectedCountries.length > 0) {
    data = data.filter(d => selectedCountries.includes(d.country));
  }

  const metrics = [
    "top500_rmax_sum_pflops",
    "ai_publications",
    "ai_policy_initiatives_new",
    "rd_gdp"
  ];

  const global = getFilteredMasterData();

  const summary = metrics.map(m => {
    const vals = data.map(d => d[m]).filter(v => typeof v === "number" && !isNaN(v));
    const globalVals = global.map(d => d[m]).filter(v => typeof v === "number" && !isNaN(v));

    const sorted = [...vals].sort((a, b) => a - b);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const median = sorted.length
      ? (sorted.length % 2
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : null;
    const min = vals.length ? Math.min(...vals) : null;
    const max = vals.length ? Math.max(...vals) : null;

    const gmean = globalVals.length
      ? globalVals.reduce((a, b) => a + b, 0) / globalVals.length
      : null;

    return {
      metric: m,
      count: vals.length,
      mean,
      median,
      min,
      max,
      globalMean: gmean,
      diff: mean !== null && gmean !== null ? mean - gmean : null
    };
  });

  const box = document.getElementById("summaryView");
  box.innerHTML = `
    <p><strong>Selected countries:</strong> ${
      selectedCountries?.length ? selectedCountries.join(", ") : "None (showing all)"
    }</p>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>N</th>
          <th>Mean</th>
          <th>Median</th>
          <th>Min</th>
          <th>Max</th>
          <th>Global Mean</th>
          <th>Diff</th>
        </tr>
      </thead>
      <tbody>
        ${summary.map(s => `
          <tr>
            <td>${s.metric}</td>
            <td>${s.count}</td>
            <td>${s.mean !== null ? s.mean.toFixed(2) : "NA"}</td>
            <td>${s.median !== null ? s.median.toFixed(2) : "NA"}</td>
            <td>${s.min !== null ? s.min.toFixed(2) : "NA"}</td>
            <td>${s.max !== null ? s.max.toFixed(2) : "NA"}</td>
            <td>${s.globalMean !== null ? s.globalMean.toFixed(2) : "NA"}</td>
            <td>${s.diff !== null ? s.diff.toFixed(2) : "NA"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* =========================
   INTERACTION BINDING
========================= */
function bindScatterSelection(embedResult) {
  const view = embedResult.view;

  view.addSignalListener("brush", async (name, value) => {
    if (!value || !value.pc1 || !value.pc2) {
      await renderBar();
      await renderTrajectory();
      computeSummary();
      return;
    }

    const data = getFilteredPCAData();

    const selected = data.filter(d =>
      d.pc1 >= value.pc1[0] &&
      d.pc1 <= value.pc1[1] &&
      d.pc2 >= value.pc2[0] &&
      d.pc2 <= value.pc2[1]
    );

    const selectedCountries = [...new Set(selected.map(d => d.country))];

    await renderBar(selectedCountries);
    await renderTrajectory(selectedCountries);
    computeSummary(selectedCountries);
  });
}

/* =========================
   INIT
========================= */
async function init() {
  try {
    pcaData = typeConvertPCA(await loadCSV(PCA_FILE, "pca_scores_with_clusters_k4.csv"));
    masterData = typeConvertMaster(await loadCSV(MASTER_FILE, "master_data_completed.csv"));
    clusterSummaryData = typeConvertClusterSummary(
      await loadCSV(CLUSTER_SUMMARY_FILE, "cluster_summary_mean.csv").catch(() => [])
    );

    masterData = joinClusterIntoMaster(masterData, pcaData);

    populateYearSelect();

    const scatterResult = await renderScatter();
    await renderBar();
    await renderTrajectory();
    await renderParallel();
    computeSummary();

    document.getElementById("yearSelect").addEventListener("change", async () => {
      const result = await renderScatter();
      await renderBar();
      await renderTrajectory();
      await renderParallel();
      computeSummary();
      bindScatterSelection(result);
    });

    document.getElementById("metricSelect").addEventListener("change", async () => {
      await renderBar();
    });

    bindScatterSelection(scatterResult);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `
      <div style="padding:24px;font-family:Arial,sans-serif;">
        <h2>Dashboard failed to load</h2>
        <pre style="white-space:pre-wrap;">${err.message}</pre>
      </div>
    `;
  }
}

init();