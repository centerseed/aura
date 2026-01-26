# Zentropy 部署指南

## 前置需求

### 1. 安裝工具
```bash
# Google Cloud SDK
brew install --cask google-cloud-sdk

# Firebase CLI
npm install -g firebase-tools
```

### 2. 登入認證
```bash
# 登入 Google Cloud
gcloud auth login

# 設定專案
gcloud config set project zentropy-4f7a5

# 登入 Firebase
firebase login
```

### 3. 啟用 Google Cloud APIs
```bash
# 啟用 Cloud Run API
gcloud services enable run.googleapis.com

# 啟用 Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# 啟用 Container Registry API
gcloud services enable containerregistry.googleapis.com

# 啟用 Cloud SQL Admin API（如需使用 Cloud SQL）
gcloud services enable sqladmin.googleapis.com
```

## 部署流程

### 方案一：完整部署（前端 + 後端）

```bash
# 一鍵部署前端和後端到 Cloud Run
./scripts/deploy-all.sh
```

### 方案二：分別部署

#### 部署後端 (FastAPI)
```bash
./scripts/deploy-backend.sh
```

#### 部署前端 (Next.js)
```bash
./scripts/deploy-web.sh
```

## 環境變數設定

### 前端 (Cloud Run)

部署後需要設定環境變數：

```bash
gcloud run services update zentropy-web \
  --update-env-vars DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" \
  --update-env-vars GOOGLE_GENERATIVE_AI_API_KEY="your-api-key" \
  --region asia-east1
```

### 後端 (Cloud Run)

```bash
gcloud run services update zentropy-backend \
  --update-env-vars DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" \
  --update-env-vars GOOGLE_GENERATIVE_AI_API_KEY="your-api-key" \
  --region asia-east1
```

## 資料庫選項

### 選項一：使用 Cloud SQL (推薦生產環境)

1. 建立 Cloud SQL 實例：
```bash
gcloud sql instances create zentropy-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-east1
```

2. 建立資料庫：
```bash
gcloud sql databases create naruvia_db \
  --instance=zentropy-db
```

3. 設定使用者：
```bash
gcloud sql users set-password postgres \
  --instance=zentropy-db \
  --password=YOUR_PASSWORD
```

4. 啟用 pgvector 擴充套件：
```bash
gcloud sql connect zentropy-db --user=postgres
# 然後執行：CREATE EXTENSION vector;
```

5. 允許 Cloud Run 連接：
```bash
gcloud run services update zentropy-web \
  --add-cloudsql-instances zentropy-4f7a5:asia-east1:zentropy-db \
  --region asia-east1

gcloud run services update zentropy-backend \
  --add-cloudsql-instances zentropy-4f7a5:asia-east1:zentropy-db \
  --region asia-east1
```

### 選項二：使用外部資料庫

如果使用外部資料庫（如 Railway、Supabase），直接設定 DATABASE_URL 環境變數即可。

## Firebase Hosting（未來可選）

目前前端部署在 Cloud Run，如果未來想使用 Firebase Hosting 作為靜態檔案 CDN：

```bash
cd web
firebase init hosting
firebase deploy --only hosting
```

## 監控與管理

### 查看服務狀態
```bash
# 列出所有 Cloud Run 服務
gcloud run services list --platform managed --region asia-east1

# 查看前端服務詳情
gcloud run services describe zentropy-web --platform managed --region asia-east1

# 查看後端服務詳情
gcloud run services describe zentropy-backend --platform managed --region asia-east1
```

### 查看日誌
```bash
# 前端日誌
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zentropy-web" --limit 50

# 後端日誌
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zentropy-backend" --limit 50
```

### 設定自訂網域
```bash
# 映射自訂網域
gcloud run domain-mappings create --service zentropy-web --domain your-domain.com --region asia-east1
```

## 成本估算

- **Cloud Run**: 免費額度每月 200 萬次請求
- **Cloud Build**: 免費額度每天 120 分鐘建置時間
- **Container Registry**: 儲存費用約 $0.026/GB/月
- **Cloud SQL (db-f1-micro)**: 約 $7-10/月

## 故障排除

### 建置失敗
```bash
# 檢查建置日誌
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

### 服務無法啟動
```bash
# 查看錯誤日誌
gcloud run services logs read zentropy-web --limit 100
```

### 資料庫連接問題
- 確認 DATABASE_URL 格式正確
- 確認 Cloud SQL 連接已設定（如使用 Cloud SQL）
- 確認防火牆規則允許連接

## 回滾

```bash
# 查看版本歷史
gcloud run revisions list --service zentropy-web --region asia-east1

# 回滾到特定版本
gcloud run services update-traffic zentropy-web \
  --to-revisions REVISION_NAME=100 \
  --region asia-east1
```

## 安全性建議

1. **永遠不要**將 `.env.local` 提交到 Git
2. 使用 Secret Manager 儲存敏感資訊：
```bash
# 建立 secret
echo -n "your-api-key" | gcloud secrets create gemini-api-key --data-file=-

# 授權 Cloud Run 存取
gcloud run services update zentropy-web \
  --update-secrets=GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest
```
3. 定期更新依賴套件：`npm audit fix`
4. 啟用 HTTPS（Cloud Run 預設啟用）
5. 設定適當的 CORS 政策

## 持續整合/部署 (CI/CD)

考慮使用 GitHub Actions 或 Cloud Build Triggers 自動化部署流程。
