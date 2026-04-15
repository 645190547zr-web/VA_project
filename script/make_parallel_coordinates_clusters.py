from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

# ========= 路径 =========
PROJECT_ROOT = Path.home() / "Desktop" / "VA_AI_Project"
MASTER_FILE = PROJECT_ROOT / "outputs" / "master_data_completed.csv"
CLUSTER_FILE = PROJECT_ROOT / "outputs" / "pca_scores_with_clusters_k4.csv"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ========= 变量 =========
FEATURES = [
    "gdp_per_capita_usd",
    "rd_gdp",
    "researchers_per_million",
    "top500_rmax_sum_pflops",
    "top500_systems_count",
    "ai_publications",
    "ai_policy_initiatives_new",
    "internet_users_pct",
    "fixed_broadband_per100",
    "electric_power_kwh_per_capita",
]

# ========= 读取 =========
master = pd.read_csv(MASTER_FILE)
clustered = pd.read_csv(CLUSTER_FILE)

master.columns = master.columns.str.strip().str.lower()
clustered.columns = clustered.columns.str.strip().str.lower()

# ========= 合并 cluster =========
df = master.merge(
    clustered[["country", "year", "cluster"]],
    on=["country", "year"],
    how="left"
)

# 只保留实际存在的变量
FEATURES = [c for c in FEATURES if c in df.columns]

# ========= 每个 cluster 求均值 =========
cluster_mean = df.groupby("cluster")[FEATURES].mean().reset_index()

# 保存原始均值表
raw_output = OUTPUT_DIR / "parallel_clusters_raw_mean.csv"
cluster_mean.to_csv(raw_output, index=False, encoding="utf-8-sig")

# ========= 对均值表做 0-1 标准化 =========
plot_df = cluster_mean.copy()

for col in FEATURES:
    min_val = plot_df[col].min()
    max_val = plot_df[col].max()

    if pd.isna(min_val) or pd.isna(max_val) or min_val == max_val:
        plot_df[col] = 0.5
    else:
        plot_df[col] = (plot_df[col] - min_val) / (max_val - min_val)

# 保存标准化表
scaled_output = OUTPUT_DIR / "parallel_clusters_scaled_mean.csv"
plot_df.to_csv(scaled_output, index=False, encoding="utf-8-sig")

# ========= 画平行坐标图 =========
plt.figure(figsize=(14, 7))

x = list(range(len(FEATURES)))
palette = {
    0: "#4C78A8",
    1: "#F58518",
    2: "#54A24B",
    3: "#E45756",
}

for _, row in plot_df.iterrows():
    y = [row[col] for col in FEATURES]
    cluster_id = int(row["cluster"])
    plt.plot(
        x,
        y,
        marker="o",
        linewidth=2.5,
        alpha=0.9,
        label=f"Cluster {cluster_id}",
        color=palette.get(cluster_id, "#999999")
    )

plt.xticks(x, FEATURES, rotation=35, ha="right")
plt.ylim(0, 1)
plt.ylabel("Scaled Cluster Mean (0–1)")
plt.title("Parallel Coordinates of Cluster Mean Profiles")
plt.legend()
plt.tight_layout()

png_output = OUTPUT_DIR / "parallel_clusters_mean.png"
plt.savefig(png_output, dpi=200)
plt.close()

print("完成")
print("输出文件：")
print(" -", raw_output)
print(" -", scaled_output)
print(" -", png_output)

print("\n原始 cluster 均值：")
print(cluster_mean.to_string(index=False))
