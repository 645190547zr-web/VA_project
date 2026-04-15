from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

# ========= 路径 =========
PROJECT_ROOT = Path.home() / "Desktop" / "VA_AI_Project"
INPUT_FILE = PROJECT_ROOT / "outputs" / "master_data_completed.csv"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ========= 读取 =========
df = pd.read_csv(INPUT_FILE)
df.columns = df.columns.str.strip().str.lower()

# ========= 选择 PCA 输入列 =========
features = [
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
    "electric_power_kwh_per_capita",
    "top500_systems_count",
    "top500_rmax_sum_pflops",
    "ai_publications",
    "ai_policy_initiatives_new",
]

# ========= 复制一份 =========
X = df[features].copy()

# ========= 对高度偏态变量做 log1p =========
# 这一步不是必须，但对你这种跨国数据很有帮助
log_cols = [
    "gdp_per_capita_usd",
    "it_net_secr",
    "electric_power_kwh_per_capita",
    "top500_systems_count",
    "top500_rmax_sum_pflops",
    "ai_publications",
    "ai_policy_initiatives_new",
]

for col in log_cols:
    if col in X.columns:
        X[col] = np.log1p(X[col])

# ========= 标准化 =========
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ========= 先跑完整 PCA，看解释方差 =========
pca_full = PCA()
X_pca_full = pca_full.fit_transform(X_scaled)

explained = pca_full.explained_variance_ratio_
cum_explained = explained.cumsum()

evr_df = pd.DataFrame({
    "pc": [f"PC{i+1}" for i in range(len(explained))],
    "explained_variance_ratio": explained,
    "cumulative_explained_variance": cum_explained
})

evr_df.to_csv(OUTPUT_DIR / "pca_explained_variance.csv", index=False, encoding="utf-8-sig")

# ========= 画 scree plot =========
plt.figure(figsize=(8, 5))
plt.plot(range(1, len(explained)+1), explained, marker="o")
plt.xlabel("Principal Component")
plt.ylabel("Explained Variance Ratio")
plt.title("Scree Plot")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "pca_scree_plot.png", dpi=200)
plt.close()

# ========= 正式保留前 2 个主成分 =========
pca_2 = PCA(n_components=2)
scores = pca_2.fit_transform(X_scaled)

scores_df = df[["country", "year", "region", "income_group"]].copy()
scores_df["pc1"] = scores[:, 0]
scores_df["pc2"] = scores[:, 1]
scores_df.to_csv(OUTPUT_DIR / "pca_scores.csv", index=False, encoding="utf-8-sig")

# ========= 输出 loadings =========
loadings_df = pd.DataFrame(
    pca_2.components_.T,
    index=features,
    columns=["pc1_loading", "pc2_loading"]
).reset_index().rename(columns={"index": "variable"})

loadings_df.to_csv(OUTPUT_DIR / "pca_loadings.csv", index=False, encoding="utf-8-sig")

# ========= 画 PCA 散点图 =========
plt.figure(figsize=(8, 6))
plt.scatter(scores_df["pc1"], scores_df["pc2"], alpha=0.7)
plt.xlabel("PC1")
plt.ylabel("PC2")
plt.title("PCA Scatter Plot")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "pca_scatter.png", dpi=200)
plt.close()

# ========= 打印结果 =========
print("完成")
print("输入文件：", INPUT_FILE)
print("PCA 变量数：", len(features))
print("\n前10个主成分解释方差：")
print(evr_df.head(10).to_string(index=False))

print("\n前2个主成分累计解释方差：", round(cum_explained[1], 4))
print("\n输出文件：")
print(" -", OUTPUT_DIR / "pca_explained_variance.csv")
print(" -", OUTPUT_DIR / "pca_scores.csv")
print(" -", OUTPUT_DIR / "pca_loadings.csv")
print(" -", OUTPUT_DIR / "pca_scree_plot.png")
print(" -", OUTPUT_DIR / "pca_scatter.png")
