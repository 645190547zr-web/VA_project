// ══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════════
const CLUSTER_COLORS = { 0:"#6ea6d4", 1:"#f5974a", 2:"#e06c8a", 3:"#5ab86c" };
const CLUSTER_NAMES  = {
  0:"Cluster 0 · Emerging",
  1:"Cluster 1 · Dominant",
  2:"Cluster 2 · Developing",
  3:"Cluster 3 · Advanced"
};
const REGION_COLORS = {
  "East Asia & Pacific":        "#f5974a",
  "Europe & Central Asia":      "#5ab86c",
  "Latin America & Caribbean":  "#b279a2",
  "Middle East & North Africa": "#9d755d",
  "North America":              "#6ea6d4",
  "South Asia":                 "#e86b5f",
  "Sub-Saharan Africa":         "#ff9da6"
};
const METRIC_LABELS = {
  ai_publications:              "AI Publications (log-scaled)",
  ai_policy_initiatives_new:    "AI Policy Initiatives",
  top500_rmax_sum_pflops:       "TOP500 Rmax (PFLOPS)",
  top500_systems_count:         "TOP500 Systems",
  gdp_per_capita_usd:           "GDP per Capita (USD)",
  rd_gdp:                       "R&D % GDP",
  researchers_per_million:      "Researchers / Million",
  internet_users_pct:           "Internet Users %",
  electric_power_kwh_per_capita:"Power kWh / Capita"
};
const PAR_SHORT = {
  gdp_per_capita_usd:           "GDP/cap",
  rd_gdp:                       "R&D %",
  researchers_per_million:      "Researchers",
  internet_users_pct:           "Internet %",
  top500_systems_count:         "TOP500 N",
  top500_rmax_sum_pflops:       "TOP500 PFLOPS",
  ai_publications:              "AI Pubs",
  ai_policy_initiatives_new:    "AI Policy",
  electric_power_kwh_per_capita:"Power"
};
const STATS_METRICS = [
  "ai_publications", "ai_policy_initiatives_new",
  "top500_rmax_sum_pflops", "rd_gdp",
  "gdp_per_capita_usd", "researchers_per_million", "internet_users_pct"
];
const DEFAULT_TRAJ_COUNTRIES = ["United States","China","Germany","South Korea"];

// ══════════════════════════════════════════════════════════════════
//  APP STATE
// ══════════════════════════════════════════════════════════════════
const STATE = {
  year:     2024,
  metric:   "ai_publications",
  colorBy:  "cluster",
  selected: new Set(),   // countries tracked in trajectory
  brushed:  null         // Set of brushed country names, or null
};

// ══════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════
function getColor(d) {
  return STATE.colorBy === "cluster"
    ? (CLUSTER_COLORS[d.cluster] ?? "#888")
    : (REGION_COLORS[d.region]   ?? "#888");
}
function getYearData() {
  return ALLDATA.filter(r => r.year === STATE.year);
}
function fmt(v, m) {
  if (v == null || isNaN(+v)) return "N/A";
  v = +v;
  if (m === "gdp_per_capita_usd") return "$" + Math.round(v).toLocaleString();
  if (["top500_systems_count","electric_power_kwh_per_capita"].includes(m))
    return Math.round(v).toLocaleString();
  if (m === "top500_rmax_sum_pflops") return v.toFixed(2);
  if (m === "ai_policy_initiatives_new") return Math.round(v).toString();
  return v.toFixed(2);
}
function fmtDelta(v, m) {
  if (v == null) return "N/A";
  return (v > 0 ? "+" : "") + fmt(v, m);
}

// ── Tooltip ──
const ttEl = document.getElementById("tooltip");
function showTT(e, d) {
  const c = getColor(d);
  let h = `<div style="font-weight:600;margin-bottom:5px;color:${c}">${d.country} · ${d.year}</div>`;
  h += `<div class="tt-row"><span>Cluster</span><span style="color:${CLUSTER_COLORS[d.cluster]}">${CLUSTER_NAMES[d.cluster] ?? d.cluster}</span></div>`;
  h += `<div class="tt-row"><span>Region</span><span>${d.region}</span></div>`;
  h += `<div class="tt-row"><span>PC1</span><span>${d.pc1 != null ? d.pc1.toFixed(3) : "N/A"}</span></div>`;
  h += `<div class="tt-row"><span>PC2</span><span>${d.pc2 != null ? d.pc2.toFixed(3) : "N/A"}</span></div>`;
  const m = STATE.metric;
  if (d[m] != null)
    h += `<div class="tt-row"><span>${METRIC_LABELS[m] ?? m}</span><span>${fmt(d[m], m)}</span></div>`;
  ttEl.innerHTML = h;
  ttEl.style.display = "block";
  moveTT(e);
}
function moveTT(e) {
  ttEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 225) + "px";
  ttEl.style.top  = Math.max(e.clientY - 10, 4) + "px";
}
function hideTT() { ttEl.style.display = "none"; }

// ── Selection ──
function toggleCountry(c) {
  STATE.selected.has(c) ? STATE.selected.delete(c) : STATE.selected.add(c);
  updateSelectedList();
  renderAll();
}
function updateSelectedList() {
  document.getElementById("selected-list").textContent =
    STATE.selected.size ? [...STATE.selected].join(", ") : "— none —";
}
function clearBrush() {
  STATE.brushed = null;
  document.getElementById("clear-brush-btn").style.display = "none";
  renderAll();
}

// ── Render all 5 panels ──
function renderAll() {
  renderScatter();
  renderBar();
  renderParallel();
  renderTrajectory();
  renderSummary();
}

// ── Debounce for window resize ──
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ══════════════════════════════════════════════════════════════════
//  PANEL 01 — PCA SCATTER
// ══════════════════════════════════════════════════════════════════
const SM = { t:22, r:16, b:30, l:40 };

function renderScatter() {
  const body = document.getElementById("scatter-body");
  const W = body.clientWidth  || 400;
  const H = body.clientHeight || 300;
  const w = W - SM.l - SM.r;
  const h = H - SM.t - SM.b;
  if (w < 10 || h < 10) return;

  const xSc = d3.scaleLinear()
    .domain([d3.min(ALLDATA, d => d.pc1) - 0.5, d3.max(ALLDATA, d => d.pc1) + 0.5])
    .range([0, w]);
  const ySc = d3.scaleLinear()
    .domain([d3.min(ALLDATA, d => d.pc2) - 0.5, d3.max(ALLDATA, d => d.pc2) + 0.5])
    .range([h, 0]);

  const svg = d3.select("#scatter-svg").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${SM.l},${SM.t})`);

  // 1. 绘制背景线和轴
  g.append("g").attr("class","grid").attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(xSc).ticks(5).tickSize(-h).tickFormat(""));
  g.append("g").attr("class","grid")
    .call(d3.axisLeft(ySc).ticks(5).tickSize(-w).tickFormat(""));
  g.append("line").attr("class","zero-line").attr("x1",0).attr("x2",w).attr("y1",ySc(0)).attr("y2",ySc(0));
  g.append("line").attr("class","zero-line").attr("x1",xSc(0)).attr("x2",xSc(0)).attr("y1",0).attr("y2",h);
  g.append("g").attr("class","axis").attr("transform",`translate(0,${h})`).call(d3.axisBottom(xSc).ticks(5).tickSize(0));
  g.append("g").attr("class","axis").call(d3.axisLeft(ySc).ticks(5).tickSize(0));

  // 2. 定义 Brush (刷选工具)
  const brush = d3.brush()
    .extent([[0,0],[w,h]])
    .on("end", event => {
      if (!event.selection) {
        STATE.brushed = null;
        document.getElementById("clear-brush-btn").style.display = "none";
      } else {
        const [[x0,y0],[x1,y1]] = event.selection;
        const yd = getYearData();
        STATE.brushed = new Set(
          yd.filter(d => {
            const cx = xSc(d.pc1), cy = ySc(d.pc2);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
          }).map(d => d.country)
        );
        document.getElementById("clear-brush-btn").style.display = "inline-block";
      }
      renderAll(); // 刷选结束，全局联动更新
    });

  // 3. 先添加 Brush 层 (放在底层)
  g.append("g").attr("class","brush").call(brush);

  // 4. 绘制 Convex Hull (背景色块)
  const yd = getYearData();
  d3.group(yd, d => d.cluster).forEach((pts, cl) => {
    if (pts.length < 3) return;
    const hull = d3.polygonHull(pts.map(d => [xSc(d.pc1), ySc(d.pc2)]));
    if (!hull) return;
    g.append("path").datum(hull)
      .attr("d", pts => "M" + pts.map(p => p.join(",")).join("L") + "Z")
      .attr("fill", CLUSTER_COLORS[cl]).attr("fill-opacity", 0.07)
      .attr("stroke", CLUSTER_COLORS[cl]).attr("stroke-opacity", 0.22);
  });

  // 5. 绘制圆点 (放在顶层，保证点击生效)
  yd.forEach(d => {
    const dimmed   = STATE.brushed != null && !STATE.brushed.has(d.country);
    const selected = STATE.selected.has(d.country);
    const col = getColor(d);

    g.append("circle")
      .attr("cx", xSc(d.pc1)).attr("cy", ySc(d.pc2))
      .attr("r",  selected ? 8 : 5)
      .attr("fill", col)
      .attr("fill-opacity", dimmed ? 0.1 : 0.85)
      .attr("stroke", selected ? "#fff" : col)
      .attr("stroke-width", selected ? 2 : 0.5)
      .attr("cursor","pointer")
      .on("mouseover", e => showTT(e, d))
      .on("mousemove", moveTT)
      .on("mouseout",  hideTT)
      .on("click", function(e) { 
        e.stopPropagation(); 
        // 关键：点击圆点时，清除之前的刷选区域，保证“点选”逻辑优先
        if(STATE.brushed) { 
            STATE.brushed = null; 
            d3.select(".brush").call(brush.move, null); // 清除视觉上的刷选框
        }
        toggleCountry(d.country); 
      });

    if (selected) {
      g.append("text")
        .attr("x", xSc(d.pc1) + 10).attr("y", ySc(d.pc2) + 3)
        .attr("font-size","9px").attr("fill", col).attr("font-weight","600")
        .text(d.country);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
//  PANEL 02 — RANKING BAR CHART  (bidirectional with scatter)
// ══════════════════════════════════════════════════════════════════
const BM = { t:6, r:20, b:6, l:115 };

function renderBar() {
  const body = document.getElementById("bar-body");
  const W    = body.clientWidth || 300;
  const m    = STATE.metric;
  const yd   = getYearData().filter(d => d[m] != null && isFinite(+d[m]));
  const sorted = [...yd].sort((a, b) => +b[m] - +a[m]);

  const barH   = 16;
  const gap    = 3;
  const totalH = (barH + gap) * sorted.length + BM.t + BM.b + 10;
  const w      = W - BM.l - BM.r;
  const xSc    = d3.scaleLinear()
    .domain([0, (d3.max(sorted, d => +d[m]) || 1) * 1.07])
    .range([0, w]);

  const svg = d3.select("#bar-svg").attr("width", W).attr("height", totalH);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${BM.l},${BM.t})`);

  // Background grid
  g.append("g").attr("class","grid")
    .attr("transform",`translate(0,${totalH - BM.t - BM.b})`)
    .call(d3.axisBottom(xSc).ticks(4).tickSize(-(totalH - BM.t - BM.b)).tickFormat(""));

  sorted.forEach((d, i) => {
    const dimmed   = STATE.brushed != null && !STATE.brushed.has(d.country);
    const selected = STATE.selected.has(d.country);
    const col      = getColor(d);
    const row      = g.append("g").attr("transform", `translate(0,${i * (barH + gap)})`);

    // Rank number
    row.append("text")
      .attr("x", -BM.l + 2).attr("y", barH/2).attr("dominant-baseline","middle")
      .attr("font-size","8px").attr("fill","#42536e")
      .text(`${i + 1}.`);

    // Country name — highlighted when selected
    row.append("text")
      .attr("x", -4).attr("y", barH/2)
      .attr("text-anchor","end").attr("dominant-baseline","middle")
      .attr("font-size","9px")
      .attr("fill",       selected ? col      : "#7486a8")
      .attr("font-weight", selected ? "700"   : "400")
      .text(d.country);

    // Bar
    row.append("rect")
      .attr("height", barH).attr("width", Math.max(1, xSc(+d[m]))).attr("rx", 2)
      .attr("fill",         col)
      .attr("fill-opacity", dimmed ? 0.12 : 0.80)
      .attr("stroke",       selected ? col : "none")
      .attr("stroke-width", 1.5)
      .attr("cursor","pointer")
      .on("mouseover", e => showTT(e, d))
      .on("mousemove", moveTT)
      .on("mouseout",  hideTT)
      .on("click", () => toggleCountry(d.country)); // ← bidirectional link

    // Value label
    row.append("text")
      .attr("x", xSc(+d[m]) + 3).attr("y", barH/2).attr("dominant-baseline","middle")
      .attr("font-size","8px").attr("fill","#42536e")
      .text(fmt(+d[m], m));
  });

  // Panel title
  document.getElementById("bar-title").textContent =
    `Ranking · ${METRIC_LABELS[m] ?? m} · ${STATE.year}`;
}

// ══════════════════════════════════════════════════════════════════
//  PANEL 03 — PARALLEL COORDINATES  (cluster mean profiles)
// ══════════════════════════════════════════════════════════════════
const PM = { t:32, r:14, b:12, l:14 };

function renderParallel() {
  const body = document.getElementById("parallel-body");
  const W = body.clientWidth  || 400;
  const H = body.clientHeight || 220;
  const w = W - PM.l - PM.r;
  const h = H - PM.t - PM.b;
  if (w < 30 || h < 10) return;

  const features = CMEANS.features;
  const xSc = d3.scalePoint().domain(features).range([0, w]).padding(0.06);
  const ySc = d3.scaleLinear().domain([0, 1]).range([h, 0]);

  const svg = d3.select("#parallel-svg").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${PM.l},${PM.t})`);

  // Work out which clusters are "active" based on brush or selection
  const activeClusters = getActiveClusters();

  // Draw dimmed lines first (clusters not in active set)
  CMEANS.rows.forEach(row => {
    const isActive = !activeClusters || activeClusters.has(+row.cluster);
    if (isActive) return; // draw active ones on top later
    const pts = features.map(f => [xSc(f), ySc(row[f + "_norm"])]);
    g.append("path")
      .attr("d", "M" + pts.map(p => p.join(",")).join("L"))
      .attr("fill","none")
      .attr("stroke", CLUSTER_COLORS[row.cluster] ?? "#888")
      .attr("stroke-width", 1)
      .attr("opacity", 0.12);
  });

  // Draw active lines on top
  CMEANS.rows.forEach(row => {
    const isActive = !activeClusters || activeClusters.has(+row.cluster);
    if (!isActive) return;
    const col = CLUSTER_COLORS[row.cluster] ?? "#888";
    const pts = features.map(f => [xSc(f), ySc(row[f + "_norm"])]);

    g.append("path")
      .attr("d", "M" + pts.map(p => p.join(",")).join("L"))
      .attr("fill","none")
      .attr("stroke", col)
      .attr("stroke-width", 2.5)
      .attr("opacity", 0.95)
      .on("mouseover", e => {
        // Tooltip shows raw (not normalised) values
        let html = `<div style="font-weight:600;color:${col};margin-bottom:4px">${CLUSTER_NAMES[row.cluster] ?? "Cluster " + row.cluster}</div>`;
        features.forEach(f => {
          html += `<div class="tt-row"><span>${PAR_SHORT[f] ?? f}</span><span>${row[f+"_raw"] != null ? (+row[f+"_raw"]).toFixed(2) : "N/A"}</span></div>`;
        });
        ttEl.innerHTML = html;
        ttEl.style.display = "block";
        moveTT(e);
      })
      .on("mousemove", moveTT)
      .on("mouseout",  hideTT);

    // Dot at each axis
    features.forEach(f => {
      g.append("circle")
        .attr("cx", xSc(f)).attr("cy", ySc(row[f + "_norm"])).attr("r", 3.5)
        .attr("fill", col).attr("stroke","#192030").attr("stroke-width", 1.2);
    });
  });

  // Vertical axes
  features.forEach(f => {
    const ax = g.append("g").attr("transform", `translate(${xSc(f)},0)`);

    // Axis line
    ax.append("line")
      .attr("y1", 0).attr("y2", h)
      .attr("stroke","#344060").attr("stroke-width", 1);

    // Tick marks (3 ticks: 0, 0.5, 1)
    ax.call(d3.axisLeft(ySc).ticks(3).tickSize(3));
    ax.select(".domain").remove();
    ax.selectAll("text")
      .attr("font-size","6px").attr("fill","#42536e")
      .attr("x", -3).attr("text-anchor","end");

    // Axis label at top
    ax.append("text")
      .attr("y", -9).attr("text-anchor","middle")
      .attr("font-size","7.5px").attr("fill","#7486a8")
      .text(PAR_SHORT[f] ?? f);
  });

  // Legend — bottom right corner
  const legendX = w - 140;
  const legendY = h - 52;
  const leg = g.append("g").attr("transform", `translate(${legendX},${legendY})`);

  leg.append("rect")
    .attr("x",-6).attr("y",-8).attr("width",146).attr("height", CMEANS.rows.length * 13 + 10)
    .attr("fill","rgba(13,17,23,0.7)").attr("rx",4);

  CMEANS.rows.forEach((row, i) => {
    const col = CLUSTER_COLORS[row.cluster] ?? "#888";
    leg.append("line")
      .attr("x1",0).attr("x2",14).attr("y1", i*13).attr("y2", i*13)
      .attr("stroke", col).attr("stroke-width", 2.5);
    leg.append("text")
      .attr("x",18).attr("y", i*13 + 4)
      .attr("font-size","8px").attr("fill","#7486a8")
      .text(CLUSTER_NAMES[row.cluster] ?? "Cluster " + row.cluster);
  });
}

// Returns Set of active cluster IDs based on brush/selection, or null (= all active)
function getActiveClusters() {
  const active = STATE.brushed
    ? [...STATE.brushed]
    : STATE.selected.size ? [...STATE.selected] : null;
  if (!active) return null;
  const yd = getYearData();
  const clusters = new Set(
    active.map(c => yd.find(r => r.country === c)?.cluster)
          .filter(c => c != null)
  );
  return clusters.size ? clusters : null;
}

// ══════════════════════════════════════════════════════════════════
//  PANEL 04 — TEMPORAL TRAJECTORY
// ══════════════════════════════════════════════════════════════════
const TM = { t:20, r:92, b:30, l:40 };
const TRAJ_PALETTE = d3.schemeTableau10;

function renderTrajectory() {
  const body = document.getElementById("trajectory-body");
  const W = body.clientWidth  || 300;
  const H = body.clientHeight || 260;
  const w = W - TM.l - TM.r;
  const h = H - TM.t - TM.b;
  if (w < 20 || h < 20) return;

  const svg = d3.select("#trajectory-svg").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${TM.l},${TM.t})`);

  // Decide which countries to show
  const countries = STATE.selected.size
    ? [...STATE.selected]
    : DEFAULT_TRAJ_COUNTRIES;

  const tracked = countries
    .map(c => ({
      country: c,
      points: ALLDATA.filter(d => d.country === c).sort((a, b) => a.year - b.year)
    }))
    .filter(d => d.points.length > 0);

  if (!tracked.length) {
    g.append("text").attr("x", w/2).attr("y", h/2)
      .attr("text-anchor","middle").attr("font-size","11px").attr("fill","#42536e")
      .text("← click scatter or bars to track countries");
    return;
  }

  const allPts = tracked.flatMap(d => d.points);
  const xSc = d3.scaleLinear()
    .domain([d3.min(allPts, p => p.pc1) - 0.3, d3.max(allPts, p => p.pc1) + 0.3])
    .range([0, w]);
  const ySc = d3.scaleLinear()
    .domain([d3.min(allPts, p => p.pc2) - 0.3, d3.max(allPts, p => p.pc2) + 0.3])
    .range([h, 0]);

  // Grid + axes
  g.append("g").attr("class","grid").attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(xSc).ticks(4).tickSize(-h).tickFormat(""));
  g.append("g").attr("class","grid")
    .call(d3.axisLeft(ySc).ticks(4).tickSize(-w).tickFormat(""));
  g.append("line").attr("class","zero-line")
    .attr("x1",0).attr("x2",w).attr("y1",ySc(0)).attr("y2",ySc(0));
  g.append("line").attr("class","zero-line")
    .attr("x1",xSc(0)).attr("x2",xSc(0)).attr("y1",0).attr("y2",h);
  g.append("g").attr("class","axis").attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(xSc).ticks(4).tickSize(0));
  g.append("g").attr("class","axis")
    .call(d3.axisLeft(ySc).ticks(4).tickSize(0));
  g.append("text").attr("x", w/2).attr("y", h + 26)
    .attr("text-anchor","middle").attr("font-size","9px").attr("fill","#42536e")
    .text("PC1 →");

  // Arrowhead marker for end of trajectory
  svg.append("defs").append("marker")
    .attr("id","traj-arrow").attr("viewBox","0 0 10 10")
    .attr("refX",8).attr("refY",5).attr("markerWidth",5).attr("markerHeight",5)
    .attr("orient","auto")
    .append("path").attr("d","M2 1L8 5L2 9")
    .attr("fill","none").attr("stroke","context-stroke")
    .attr("stroke-width",1.5).attr("stroke-linecap","round");

  tracked.forEach((td, idx) => {
    const col  = TRAJ_PALETTE[idx % TRAJ_PALETTE.length];
    const pts  = td.points;
    const last = pts.length - 1;

    // Line segments — older = more transparent
    for (let i = 1; i <= last; i++) {
      const opacity = 0.15 + 0.85 * (i / last);
      g.append("line")
        .attr("x1", xSc(pts[i-1].pc1)).attr("y1", ySc(pts[i-1].pc2))
        .attr("x2", xSc(pts[i].pc1)).attr("y2", ySc(pts[i].pc2))
        .attr("stroke", col).attr("stroke-width", 1.8).attr("opacity", opacity)
        .attr("marker-end", i === last ? "url(#traj-arrow)" : null);
    }

    // Year dots
    pts.forEach((p, pi) => {
      const isCur  = p.year === STATE.year;
      const isLast = pi === last;
      const isFirst = pi === 0;
      const t = pi / last;

      if (pi % 3 === 0 || isCur || isLast) {
        g.append("circle")
          .attr("cx", xSc(p.pc1)).attr("cy", ySc(p.pc2))
          .attr("r",  isCur ? 6.5 : isLast ? 4.5 : 2.5)
          .attr("fill",   isCur ? "#ffffff" : col)
          .attr("stroke", isCur ? col : "#192030")
          .attr("stroke-width", isCur ? 2 : 1.2)
          .attr("opacity", 0.2 + 0.8 * t)
          .on("mouseover", e => showTT(e, p))
          .on("mousemove", moveTT)
          .on("mouseout",  hideTT);

        // Year label at start and end of each path
        if (isFirst || isLast) {
          g.append("text")
            .attr("x", xSc(p.pc1) + (isLast ?  7 : -2))
            .attr("y", ySc(p.pc2) - 6)
            .attr("text-anchor", isFirst ? "end" : "start")
            .attr("font-size","7px").attr("fill", col).attr("font-weight","700")
            .text(p.year);
        }
      }
    });

    // Country label next to the last point
    g.append("text")
      .attr("x", xSc(pts[last].pc1) + 9)
      .attr("y", ySc(pts[last].pc2) + 3)
      .attr("font-size","9px").attr("fill", col).attr("font-weight","600")
      .text(td.country);
  });

  // Legend (top-right corner)
  const leg = g.append("g").attr("transform", `translate(${w + 4}, 0)`);
  tracked.forEach((td, idx) => {
    const col = TRAJ_PALETTE[idx % TRAJ_PALETTE.length];
    leg.append("line")
      .attr("x1",0).attr("x2",10).attr("y1", idx*14 + 4).attr("y2", idx*14 + 4)
      .attr("stroke", col).attr("stroke-width",2);
    leg.append("text")
      .attr("x",13).attr("y", idx*14 + 7)
      .attr("font-size","8px").attr("fill","#7486a8")
      .text(td.country);
  });
}

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
//  PANEL 05 — SUMMARY STATISTICS
//  This is the MANDATORY interaction-triggered analytics component.
//  It recomputes every time STATE.brushed or STATE.selected changes.
// ══════════════════════════════════════════════════════════════════

// The 5 metrics shown in the table (exactly what the assignment asks for)
const SUMMARY_METRICS = [
  { key: "ai_publications",           label: "AI Publications (log)" },
  { key: "ai_policy_initiatives_new", label: "AI Policy Initiatives" },
  { key: "top500_rmax_sum_pflops",    label: "TOP500 Rmax (PFLOPS)"  },
  { key: "rd_gdp",                    label: "R&D % GDP"             },
  { key: "gdp_per_capita_usd",        label: "GDP per Capita (USD)"  },
];

function renderSummary() {
  // ── 1. Resolve which countries are "active" ──────────────────────
  // Priority: brush > click-selection > all countries
  const yd = getYearData();   // all countries for the current year

  let activeNames = null;
  let selectionMode = "all";  // "brush" | "click" | "all"

  if (STATE.brushed && STATE.brushed.size > 0) {
    activeNames   = [...STATE.brushed];
    selectionMode = "brush";
  } else if (STATE.selected.size > 0) {
    activeNames   = [...STATE.selected];
    selectionMode = "click";
  }

  const selection = activeNames
    ? yd.filter(d => activeNames.includes(d.country))
    : yd;

  // ── 2. Statistics helpers ────────────────────────────────────────
  const mean = arr =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const median = arr => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // ── 3. Compute stats for each metric ────────────────────────────
  const rows = SUMMARY_METRICS.map(({ key, label }) => {
    const selVals    = selection.map(d => d[key]).filter(v => v != null && isFinite(v));
    const globalVals = yd.map(d => d[key]).filter(v => v != null && isFinite(v));
    const selMean    = mean(selVals);
    const globalMean = mean(globalVals);
    return {
      key, label,
      n:          selVals.length,
      mean:       selMean,
      median:     median(selVals),
      min:        selVals.length ? Math.min(...selVals) : null,
      max:        selVals.length ? Math.max(...selVals) : null,
      globalMean,
      delta:      (selMean != null && globalMean != null) ? selMean - globalMean : null,
    };
  });

  // Debug: confirm function is being called
  console.log(`[Panel 05] renderSummary — mode: ${selectionMode}, n: ${selection.length}`);

  // ── 4. Build status banner ───────────────────────────────────────
  let bannerColor, bannerBg, bannerText, instructionText;

  if (selectionMode === "brush") {
    bannerColor   = "#f5974a";
    bannerBg      = "rgba(245,151,74,0.12)";
    bannerText    = `🔲 Brush active — ${selection.length} countr${selection.length !== 1 ? "ies" : "y"} selected: ${activeNames.join(", ")}`;
    instructionText = "Statistics computed for brushed subset only · clear brush to reset";
  } else if (selectionMode === "click") {
    bannerColor   = "#6ea6d4";
    bannerBg      = "rgba(110,166,212,0.12)";
    bannerText    = `◉ Click selection — ${selection.length} countr${selection.length !== 1 ? "ies" : "y"}: ${activeNames.join(", ")}`;
    instructionText = "Statistics computed for clicked countries · click again to deselect";
  } else {
    bannerColor   = "#42536e";
    bannerBg      = "transparent";
    bannerText    = `All ${yd.length} countries · Year ${STATE.year}`;
    instructionText = "→ Brush the scatter plot or click dots/bars to filter the statistics";
  }

  // ── 5. Build the HTML ────────────────────────────────────────────
  const tableHTML = `
    <div style="
      background:${bannerBg};
      border-left: 3px solid ${bannerColor};
      padding: 6px 10px;
      margin-bottom: 8px;
      border-radius: 0 4px 4px 0;
    ">
      <div style="font-size:10px;font-weight:600;color:${bannerColor};margin-bottom:2px">
        ${bannerText}
      </div>
      <div style="font-size:9px;color:#42536e">${instructionText}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead>
        <tr>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px;text-transform:uppercase;letter-spacing:.05em">Metric</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px">n</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px">Mean</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px">Median</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px">Min</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px">Max</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px">Global Mean</th>
          <th style="text-align:right;padding:4px 8px;border-bottom:1px solid #253047;color:#42536e;font-size:9px">Δ vs Global</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          // Delta colour: green = above global mean, red = below
          const deltaColor = r.delta == null ? "#42536e"
            : r.delta > 0 ? "#3fb950"
            : "#f85149";
          const deltaStr = r.delta == null ? "N/A"
            : (r.delta > 0 ? "+" : "") + fmt(r.delta, r.key);

          return `
          <tr style="border-bottom:1px solid rgba(37,48,71,0.4)">
            <td style="padding:4px 8px;color:#cdd9f5;font-size:10px">${r.label}</td>
            <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:10px;color:#cdd9f5">${r.n}</td>
            <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:10px;color:#cdd9f5">${fmt(r.mean,   r.key)}</td>
            <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:10px;color:#cdd9f5">${fmt(r.median, r.key)}</td>
            <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:10px;color:#cdd9f5">${fmt(r.min,    r.key)}</td>
            <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:10px;color:#cdd9f5">${fmt(r.max,    r.key)}</td>
            <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:10px;color:#42536e">${fmt(r.globalMean, r.key)}</td>
            <td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:10px;font-weight:600;color:${deltaColor}">${deltaStr}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  // ── 6. Write to DOM — works even if stats-label doesn't exist ────
  const content = document.getElementById("stats-content");
  if (content) {
    content.innerHTML = tableHTML;

    // Flash animation: briefly highlight the panel to show it updated
    content.style.transition = "background 0.15s";
    content.style.background = "rgba(79,156,249,0.06)";
    setTimeout(() => { content.style.background = "transparent"; }, 300);
  }

  // Also update stats-label if it exists (optional, won't crash if missing)
  const labelEl = document.getElementById("stats-label");
  if (labelEl) labelEl.textContent = bannerText;
}

// ══════════════════════════════════════════════════════════════════
//  CONTROLS — event listeners
// ══════════════════════════════════════════════════════════════════
document.getElementById("year-slider").addEventListener("input", function () {
  STATE.year = +this.value;
  document.getElementById("year-display").textContent = STATE.year;
  // Clear brush when year changes (brushed countries may not exist in new year)
  STATE.brushed = null;
  document.getElementById("clear-brush-btn").style.display = "none";
  renderAll();
});

document.getElementById("metric-select").addEventListener("change", function () {
  STATE.metric = this.value;
  renderBar();
  renderSummary();
});

document.getElementById("color-select").addEventListener("change", function () {
  STATE.colorBy = this.value;
  // Toggle which legend is shown
  document.getElementById("cluster-legend").style.display =
    this.value === "cluster" ? "block" : "none";
  document.getElementById("region-legend").style.display =
    this.value === "region"  ? "block" : "none";
  renderAll();
});

window.addEventListener("resize", debounce(renderAll, 150));

// ══════════════════════════════════════════════════════════════════
//  INIT — load all CSV data, then draw everything
// ══════════════════════════════════════════════════════════════════
loadAllData()
  .then(() => {
    console.log(`Ready: ${ALLDATA.length} rows, ${CMEANS.rows.length} clusters`);
    renderAll();
  })
  .catch(err => {
    console.error("Data load failed:", err);
    document.getElementById("scatter-body").innerHTML =
      `<p style="color:#f85149;padding:20px;font-size:12px">
        ⚠ Could not load data: ${err.message}<br><br>
        Make sure you started the server with:<br>
        <code>python3 -m http.server 8000</code><br>
        inside the <code>dashboard/</code> folder.
      </p>`;
  });
