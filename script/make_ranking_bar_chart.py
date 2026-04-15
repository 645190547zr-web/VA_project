from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

# ========= 路径 =========
PROJECT_ROOT = Path.home() / "Desktop" / "VA_AI_Project"
MASTER_FILE = PROJECT_ROOT / "outputs" / "master_data_completed.csv"
CLUSTER_FILE = PROJECT_ROOT / "outputs" / "pca_scores_with_clusters_k4.csv"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ========= 你可以改这两个参数 =========
YEAR = 2024
METRIC = "ai_policy_initiatives_new"
COLOR_BY = "cluster"   # 可选: "cluster" 或 "region"

# ========= 指标显示名称 =========
METRIC_LABELS = {
    "top500_rmax_sum_pflops": "TOP500 Rmax Sum (PFLOPS)",
    "top500_systems_count": "TOP500 Systems Count",
    "ai_publications": "AI Publications",
    "ai_policy_initiatives_new": "New AI Policy Initiatives",
    "rd_gdp": "R&D Expenditure (% GDP)",
    "researchers_per_million": "Researchers per Million",
    "gdp_per_capita_usd": "GDP per Capita (USD)",
    "internet_users_pct": "Internet Users (%)",
    "fixed_broadband_per100": "Fixed Broadband per 100",
    "mobile_cellular_per100": "Mobile Cellular per 100",
}

# ========= 读取 =========
master = pd.read_csv(MASTER_FILE)
clustered = pd.read_csv(CLUSTER_FILE)

master.columns = master.columns.str.strip().str.lower()
clustered.columns = clustered.columns.str.strip().str.lower()

# ========= 合并 cluster =========
df = master.merge(
    clustered[["country", "year", "cluster", "pc1", "pc2"]],
    on=["country", "year"],
    how="left"
)

# ========= 检查指标 =========
if METRIC not in df.columns:
    raise ValueError(f"你选的指标 {METRIC} 不在表里。")

# ========= 只保留某一年 =========
df_year = df[df["year"] == YEAR].copy()

# 去掉缺失
df_year = df_year[df_year[METRIC].notna()].copy()

# 排序
df_year = df_year.sort_values(METRIC, ascending=False).reset_index(drop=True)

# 保存排序表
rank_file = OUTPUT_DIR / f"ranking_{METRIC}_{YEAR}.csv"
df_year.to_csv(rank_file, index=False, encoding="utf-8-sig")

# ========= 颜色 =========
if COLOR_BY == "cluster":
    palette = {
        0: "#4C78A8",
        1: "#F58518",
        2: "#54A24B",
        3: "#E45756",
        4: "#72B7B2",
        5: "#B279A2",
    }
    colors = [palette.get(c, "#999999") for c in df_year["cluster"]]
    legend_items = sorted(df_year["cluster"].dropna().unique())
elif COLOR_BY == "region":
    region_palette = {
        "East Asia & Pacific": "#4C78A8",
        "Europe & Central Asia": "#F58518",
        "Latin America & Caribbean": "#54A24B",
        "Middle East & North Africa": "#E45756",
        "North America": "#B279A2",
        "South Asia": "#9D755D",
        "Sub-Saharan Africa": "#FF9DA6",
    }
    colors = [region_palette.get(r, "#999999") for r in df_year["region"]]
    legend_items = sorted(df_year["region"].dropna().unique())
else:
    raise ValueError("COLOR_BY 只能是 'cluster' 或 'region'")

# ========= 画图 =========
plt.figure(figsize=(10, 9))
plt.barh(df_year["country"], df_year[METRIC], color=colors)
plt.gca().invert_yaxis()

xlabel = METRIC_LABELS.get(METRIC, METRIC)
title = f"Ranking of Countries by {xlabel} ({YEAR})"

plt.xlabel(xlabel)
plt.ylabel("Country")
plt.title(title)
plt.tight_layout()

png_file = OUTPUT_DIR / f"ranking_{METRIC}_{YEAR}_{COLOR_BY}.png"
plt.savefig(png_file, dpi=200)
plt.close()

print("完成")
print("年份：", YEAR)
print("指标：", METRIC)
print("颜色：", COLOR_BY)
print("\n输出文件：")
print(" -", rank_file)
print(" -", png_file)

print("\n前10名：")
print(df_year[["country", METRIC, "cluster", "region"]].head(10).to_string(index=False))
