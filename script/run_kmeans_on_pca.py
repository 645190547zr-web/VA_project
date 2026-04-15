from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# ========= 路径 =========
PROJECT_ROOT = Path.home() / "Desktop" / "VA_AI_Project"
INPUT_FILE = PROJECT_ROOT / "outputs" / "pca_scores.csv"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ========= 读取 =========
df = pd.read_csv(INPUT_FILE)
df.columns = df.columns.str.strip().str.lower()

# ========= 聚类输入 =========
X = df[["pc1", "pc2"]].copy()

# ========= 先测试多个 k =========
results = []

for k in [3, 4, 5, 6]:
    model = KMeans(n_clusters=k, random_state=42, n_init=20)
    labels = model.fit_predict(X)

    inertia = model.inertia_
    sil = silhouette_score(X, labels)

    results.append({
        "k": k,
        "inertia": inertia,
        "silhouette_score": sil
    })

results_df = pd.DataFrame(results)
results_df.to_csv(OUTPUT_DIR / "kmeans_model_selection.csv", index=False, encoding="utf-8-sig")

print("=== KMeans model selection ===")
print(results_df.to_string(index=False))

# ========= 这里先默认选 k=4 =========
# 你跑完后如果觉得 k=3 或 k=5 更好，也可以改这里
BEST_K = 4

kmeans = KMeans(n_clusters=BEST_K, random_state=42, n_init=20)
df["cluster"] = kmeans.fit_predict(X)

# 存中心点
centers = pd.DataFrame(kmeans.cluster_centers_, columns=["pc1_center", "pc2_center"])
centers["cluster"] = range(BEST_K)
centers.to_csv(OUTPUT_DIR / "kmeans_cluster_centers.csv", index=False, encoding="utf-8-sig")

# 保存带 cluster 的数据
clustered_file = OUTPUT_DIR / f"pca_scores_with_clusters_k{BEST_K}.csv"
df.to_csv(clustered_file, index=False, encoding="utf-8-sig")

# ========= 图 1：全部年份，按 cluster 上色 =========
plt.figure(figsize=(9, 7))

for c in sorted(df["cluster"].unique()):
    sub = df[df["cluster"] == c]
    plt.scatter(sub["pc1"], sub["pc2"], alpha=0.6, label=f"Cluster {c}")

# 画中心点
plt.scatter(
    centers["pc1_center"],
    centers["pc2_center"],
    s=180,
    marker="X",
    edgecolor="black",
    linewidth=1.0,
    label="Centroids"
)

plt.xlabel("PC1")
plt.ylabel("PC2")
plt.title(f"KMeans Clusters on PCA Space (k={BEST_K})")
plt.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR / f"kmeans_clusters_k{BEST_K}_all_years.png", dpi=200)
plt.close()

# ========= 图 2：只看 2024，按 cluster 上色并标国家名 =========
df_2024 = df[df["year"] == 2024].copy()

plt.figure(figsize=(10, 8))

for c in sorted(df_2024["cluster"].unique()):
    sub = df_2024[df_2024["cluster"] == c]
    plt.scatter(sub["pc1"], sub["pc2"], alpha=0.8, label=f"Cluster {c}")

for _, row in df_2024.iterrows():
    plt.annotate(
        row["country"],
        (row["pc1"], row["pc2"]),
        fontsize=8,
        xytext=(4, 4),
        textcoords="offset points"
    )

plt.scatter(
    centers["pc1_center"],
    centers["pc2_center"],
    s=180,
    marker="X",
    edgecolor="black",
    linewidth=1.0,
    label="Centroids"
)

plt.xlabel("PC1")
plt.ylabel("PC2")
plt.title(f"KMeans Clusters on PCA Space (2024 Only, k={BEST_K})")
plt.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR / f"kmeans_clusters_k{BEST_K}_2024_labeled.png", dpi=200)
plt.close()

print("\n完成")
print("输出文件：")
print(" -", OUTPUT_DIR / "kmeans_model_selection.csv")
print(" -", OUTPUT_DIR / "kmeans_cluster_centers.csv")
print(" -", clustered_file)
print(" -", OUTPUT_DIR / f"kmeans_clusters_k{BEST_K}_all_years.png")
print(" -", OUTPUT_DIR / f"kmeans_clusters_k{BEST_K}_2024_labeled.png")
