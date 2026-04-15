from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

# ========= 路径 =========
PROJECT_ROOT = Path.home() / "Desktop" / "VA_AI_Project"
INPUT_FILE = PROJECT_ROOT / "outputs" / "pca_scores.csv"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ========= 读取数据 =========
df = pd.read_csv(INPUT_FILE)
df.columns = df.columns.str.strip().str.lower()

# 排序，方便后面检查和筛选
df = df.sort_values(["year", "country"]).reset_index(drop=True)

# ========= 图 1：全部年份 PCA 图，按 region 上色 =========
plt.figure(figsize=(9, 7))

regions = sorted(df["region"].dropna().unique())

for region in regions:
    sub = df[df["region"] == region]
    plt.scatter(sub["pc1"], sub["pc2"], alpha=0.6, label=region)

plt.xlabel("PC1")
plt.ylabel("PC2")
plt.title("PCA Scatter Plot (All Country-Year Observations)")
plt.legend(title="Region", fontsize=8)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "pca_scatter_by_region_all_years.png", dpi=200)
plt.close()

# ========= 图 2：只看 2024 年，按 region 上色 + 标国家名 =========
df_2024 = df[df["year"] == 2024].copy()

plt.figure(figsize=(10, 8))

for region in regions:
    sub = df_2024[df_2024["region"] == region]
    plt.scatter(sub["pc1"], sub["pc2"], alpha=0.8, label=region)

# 给每个国家加标签
for _, row in df_2024.iterrows():
    plt.annotate(
        row["country"],
        (row["pc1"], row["pc2"]),
        fontsize=8,
        xytext=(4, 4),
        textcoords="offset points"
    )

plt.xlabel("PC1")
plt.ylabel("PC2")
plt.title("PCA Scatter Plot (2024 Only)")
plt.legend(title="Region", fontsize=8)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "pca_scatter_by_region_2024_labeled.png", dpi=200)
plt.close()

# ========= 额外输出一个 2024 数据表，后面会用到 =========
df_2024.to_csv(OUTPUT_DIR / "pca_scores_2024.csv", index=False, encoding="utf-8-sig")

print("完成")
print("输出文件：")
print(" -", OUTPUT_DIR / "pca_scatter_by_region_all_years.png")
print(" -", OUTPUT_DIR / "pca_scatter_by_region_2024_labeled.png")
print(" -", OUTPUT_DIR / "pca_scores_2024.csv")
