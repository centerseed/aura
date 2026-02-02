# Zentropy - 讓一切井然有序

這是一個專為創業者設計的「不失控」營運管理系統。

## 專案結構 (Project Layout)

```
/
├── api/            # Next.js API 後端 (Clean Architecture)
├── web/            # Next.js 前端 (Dashboard)
├── app/            # Flutter 行動應用
├── packages/       # 共用模組
│   └── flutter_dual_cache/  # [Submodule] 雙軌緩存模組
├── docs/           # 系統文件（規格、架構、命名規範）
└── scripts/        # 部署與開發腳本
```

---

## 快速開始 (Quick Start)

### 1. Clone 專案（含 Submodules）

```bash
# 方法一：Clone 時一併拉取 submodules
git clone --recurse-submodules https://github.com/your-repo/naruvia.git

# 方法二：已 clone 後補拉 submodules
git submodule update --init --recursive
```

### 2. 更新 Submodules

```bash
# 更新所有 submodules 到最新版本
git submodule update --remote

# 或進入特定 submodule 更新
cd packages/flutter_dual_cache
git pull origin main
cd ../..
git add packages/flutter_dual_cache
git commit -m "Update flutter_dual_cache submodule"
```

---

## Submodules

| 模組 | 路徑 | 說明 |
|------|------|------|
| flutter_dual_cache | `packages/flutter_dual_cache` | Flutter 雙軌緩存 Repository 模組，實現 Stale-While-Revalidate 策略 |

---

## 開發環境

詳見各子專案的說明文件：
- [API 開發指南](./api/README.md)
- [Web 開發指南](./web/README.md)
- [Flutter App 開發指南](./app/README.md)
- [本地開發指南](./LOCAL_DEVELOPMENT_GUIDE.md)
