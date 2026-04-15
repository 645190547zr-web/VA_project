
from pathlib import Path
import pandas as pd

# ========= 路径 =========
PROJECT_ROOT = Path.home() / "Desktop" / "VA_AI_Project"
MASTER_FILE = PROJECT_ROOT / "outputs" / "master_data_completed.csv"
CLUSTER_FILE = PROJECT_ROOT / "outputs" / "pca_scores_with_clusters_k4.csv"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ========= 读取 =========
master = pd.read_csv(MASTER_FILE)
clustered = pd.read_csv(CLUSTER_FILE)

master.columns = master.columns.str.strip().str.lower()
clustered.columns = clustered.columns.str.strip().str.lower()

# ========= 合并 =========
df = master.merge(
    clustered[["country", "year", "cluster", "pc1", "pc2"]],
    on=["country", "year"],
    how="left"
)

# ========= 选一组关键变量做 cluster summary =========
summary_vars = [
    "gdp_per_capita_usd",
    "rd_gdp",
    "researchers_per_million",
    "it_net_secr",
    "internet_users_pct",
    "fixed_broadband_per100",
    "mobile_cellular_per100",
    "top500_systems_count",
    "top500_rmax_sum_pflops",
    "ai_publications",
    "ai_policy_initiatives_new",
    "electric_power_kwh_per_capita",
]

summary_vars = [c for c in summary_vars if c in df.columns]

# ========= cluster size =========
cluster_size = df.groupby("cluster").size().reset_index(name="n_observations")
cluster_size.to_csv(OUTPUT_DIR / "cluster_size.csv", index=False, encoding="utf-8-sig")

# ========= 均值 summary =========
cluster_mean = df.groupby("cluster")[summary_vars].mean().reset_index()
cluster_mean.to_csv(OUTPUT_DIR / "cluster_summary_mean.csv", index=False, encoding="utf-8-sig")

# ========= 中位数 summary =========
cluster_median = df.groupby("cluster")[summary_vars].median().reset_index()
cluster_median.to_csv(OUTPUT_DIR / "cluster_summary_median.csv", index=False, encoding="utf-8-sig")

# ========= 只看 2024 年，每个 cluster 有哪些国家 =========
df_2024 = df[df["year"] == 2024].copy()
members_2024 = df_2024[["country", "region", "cluster", "pc1", "pc2"]].sort_values(["cluster", "country"])
members_2024.to_csv(OUTPUT_DIR / "cluster_members_2024.csv", index=False, encoding="utf-8-sig")

# ========= 打印 =========
print("完成")
print("输出文件：")
print(" -", OUTPUT_DIR / "cluster_size.csv")
print(" -", OUTPUT_DIR / "cluster_summary_mean.csv")
print(" -", OUTPUT_DIR / "cluster_summary_median.csv")
print(" -", OUTPUT_DIR / "cluster_members_2024.csv")

print("\n=== Cluster size ===")
print(cluster_size.to_string(index=False))

print("\n=== Cluster mean summary（前几列） ===")
print(cluster_mean.head().to_string(index=False))
