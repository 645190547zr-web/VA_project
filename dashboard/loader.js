// ── File paths (relative to dashboard/) ──
const FILES = {
  pca:     "data/pca_scores_with_clusters_k4.csv",
  master:  "data/master_data_completed.csv",
  means:   "data/cluster_summary_mean.csv",
  loadings:"data/pca_loadings.csv",
  variance:"data/pca_explained_variance.csv"
};

// These will be filled after loading
let ALLDATA  = [];   // 450 merged rows
let CMEANS   = {};   // cluster mean profiles
let LOADINGS = [];
let VARIANCE = [];

// Numeric columns to convert from string → number
const NUMERIC_COLS = [
  "year","pc1","pc2","cluster",
  "top500_systems_count","top500_rmax_sum_pflops",
  "ai_publications","ai_policy_initiatives_new",
  "gdp_per_capita_usd","rd_gdp","researchers_per_million",
  "internet_users_pct","mobile_cellular_per100",
  "electric_power_kwh_per_capita"
];

const PAR_FEATURES = [
  "gdp_per_capita_usd","rd_gdp","researchers_per_million",
  "internet_users_pct","top500_systems_count",
  "top500_rmax_sum_pflops","ai_publications",
  "ai_policy_initiatives_new","electric_power_kwh_per_capita"
];

async function loadAllData() {
  // 1. Load both CSV files in parallel
  const [pcaRaw, masterRaw, meansRaw, loadingsRaw, varianceRaw] =
    await Promise.all([
      d3.csv(FILES.pca),
      d3.csv(FILES.master),
      d3.csv(FILES.means),
      d3.csv(FILES.loadings),
      d3.csv(FILES.variance)
    ]);

  // 2. Build a lookup from master: key = "country|year"
  const masterMap = new Map();
  masterRaw.forEach(r => {
    const key = r.country.trim() + "|" + (+r.year);
    masterMap.set(key, r);
  });

  // 3. Merge pca + master
  ALLDATA = pcaRaw.map(r => {
    const key = r.country.trim() + "|" + (+r.year);
    const m   = masterMap.get(key) || {};
    const row = {};

    // Text columns
    row.country      = (r.country || "").trim();
    row.region       = (r.region  || m.region || "").trim();
    row.income_group = (r.income_group || m.income_group || "").trim();

    // Numeric columns
    NUMERIC_COLS.forEach(col => {
      const raw = r[col] !== undefined ? r[col] : m[col];
      row[col] = (raw !== undefined && raw !== "") ? +raw : null;
    });

    return row;
  });

  // 4. Build cluster means for parallel coordinates
  const colMin = {}, colMax = {};
  PAR_FEATURES.forEach(f => {
    const vals = meansRaw.map(r => +r[f]).filter(v => isFinite(v));
    colMin[f] = Math.min(...vals);
    colMax[f] = Math.max(...vals);
  });

  const normRows = meansRaw.map(r => {
    const row = { cluster: +r.cluster };
    PAR_FEATURES.forEach(f => {
      const raw  = +r[f];
      const span = colMax[f] - colMin[f];
      row[f + "_raw"]  = raw;
      row[f + "_norm"] = span > 0 ? (raw - colMin[f]) / span : 0.5;
    });
    return row;
  });
  CMEANS = { features: PAR_FEATURES, rows: normRows };

  // 5. Loadings and variance
  LOADINGS = loadingsRaw.map(r => ({
    variable: r.variable,
    pc1: +r.pc1_loading,
    pc2: +r.pc2_loading
  }));

  VARIANCE = varianceRaw.map(r => ({
    pc:   r.pc,
    expl: Math.round(+r.explained_variance_ratio * 1000) / 10,
    cum:  Math.round(+r.cumulative_explained_variance * 1000) / 10
  }));

  console.log(`Loaded ${ALLDATA.length} rows, ${CMEANS.rows.length} cluster means`);
}