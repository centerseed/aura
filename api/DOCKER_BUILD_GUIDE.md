# Docker 建置指南

## 📋 兩種建置方式

本專案提供兩種 Docker 建置方式，各有不同用途：

### 1️⃣ 本地開發建置（Mac 架構）

**用途**: 本地開發測試

**腳本**: `scripts/local-docker-build.sh`

**特點**:
- ✅ 建置快速（使用本地 Docker）
- ✅ 適合 Mac 本地執行
- ✅ 映像檔較小
- ⚠️ **不能部署到 Cloud Run**（架構不匹配）

**執行方式**:
```bash
cd /path/to/Naruvia
./scripts/local-docker-build.sh
```

**測試執行**:
```bash
docker run -p 3001:3001 zentropy-api-local:latest
```

---

### 2️⃣ Cloud Run 部署建置（amd64 架構）

**用途**: 生產環境部署

**腳本**: `scripts/deploy-backend.sh`

**特點**:
- ✅ 使用 Cloud Build（在 GCP 雲端建置）
- ✅ 自動產生正確的 amd64 架構
- ✅ 無需本地 buildx
- ✅ 避免映像檔過大問題
- ✅ 直接部署到 Cloud Run

**執行方式**:
```bash
cd /path/to/Naruvia
./scripts/deploy-backend.sh
```

**流程**:
1. 上傳原始碼到 Cloud Build
2. 在雲端建置 Docker 映像（amd64）
3. 自動推送到 GCR
4. 部署到 Cloud Run

---

## 🚫 不使用 buildx 的原因

**問題**:
- `docker buildx build --platform linux/amd64` 會產生非常大的映像檔
- 建置時間長
- 本地資源消耗大

**解決方案**:
- 使用 **Cloud Build** 在 GCP 雲端建置
- GCP 伺服器是 amd64 架構，自然產生正確的映像
- 建置速度快，映像檔大小正常

---

## 📊 比較表

| 項目 | 本地建置 | Cloud Build |
|------|---------|------------|
| **用途** | 開發測試 | 生產部署 |
| **架構** | arm64 (Mac) | amd64 (Linux) |
| **建置位置** | 本地 Docker | GCP 雲端 |
| **映像大小** | 正常 | 正常 |
| **建置速度** | 快 | 中等（需上傳） |
| **可部署 Cloud Run** | ❌ 否 | ✅ 是 |
| **腳本** | `local-docker-build.sh` | `deploy-backend.sh` |

---

## 🔧 故障排除

### 本地建置失敗

**錯誤**: `npm run build` 失敗
```bash
# 解決方案：清除快取並重新安裝
rm -rf node_modules .next
npm install
npm run build
```

### Cloud Build 失敗

**錯誤**: `Cloud Build API is not enabled`
```bash
# 啟用 Cloud Build API
gcloud services enable cloudbuild.googleapis.com
```

**錯誤**: `Permission denied`
```bash
# 確認 GCP 專案正確
gcloud config set project zentropy-4f7a5
gcloud auth login
```

---

## 📝 環境變數

部署時需要在 Cloud Run 設定的環境變數：

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=https://...
NODE_ENV=production
```

可在 `deploy-backend.sh` 中通過 `--set-env-vars` 設定。

---

## ✅ 建議工作流程

1. **本地開發**: 直接使用 `npm run dev`
2. **測試 Docker**: 使用 `local-docker-build.sh`
3. **部署生產**: 使用 `deploy-backend.sh`

```bash
# 開發階段
npm run dev

# 測試 Docker 建置
./scripts/local-docker-build.sh
docker run -p 3001:3001 zentropy-api-local:latest

# 部署到生產
./scripts/deploy-backend.sh
```
