from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path.home() / "Desktop" / "VA_AI_Project"
LOADINGS_FILE = PROJECT_ROOT / "outputs" / "pca_loadings.csv"

df = pd.read_csv(LOADINGS_FILE)
df.columns = df.columns.str.strip().str.lower()

# 计算绝对值，方便看“谁影响最大”
df["abs_pc1"] = df["pc1_loading"].abs()
df["abs_pc2"] = df["pc2_loading"].abs()

# PC1 贡献最大的变量
pc1_top = df.sort_values("abs_pc1", ascending=False).copy()

# PC2 贡献最大的变量
pc2_top = df.sort_values("abs_pc2", ascending=False).copy()

print("=== PC1 贡献最大的前8个变量 ===")
print(pc1_top[["variable", "pc1_loading"]].head(8).to_string(index=False))

print("\n=== PC2 贡献最大的前8个变量 ===")
print(pc2_top[["variable", "pc2_loading"]].head(8).to_string(index=False))

print("\n=== PC1 正向贡献最大的前5个变量 ===")
print(df.sort_values("pc1_loading", ascending=False)[["variable", "pc1_loading"]].head(5).to_string(index=False))

print("\n=== PC1 负向贡献最大的前5个变量 ===")
print(df.sort_values("pc1_loading", ascending=True)[["variable", "pc1_loading"]].head(5).to_string(index=False))

print("\n=== PC2 正向贡献最大的前5个变量 ===")
print(df.sort_values("pc2_loading", ascending=False)[["variable", "pc2_loading"]].head(5).to_string(index=False))

print("\n=== PC2 负向贡献最大的前5个变量 ===")
print(df.sort_values("pc2_loading", ascending=True)[["variable", "pc2_loading"]].head(5).to_string(index=False))
