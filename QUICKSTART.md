# Zentropy 快速開始指南

## 🎯 完成的功能

✅ **多重登入方式**
- Google SSO 登入
- 匿名訪客模式
- 名稱登入（開發用）

✅ **資料庫支援**
- PostgreSQL with pgvector
- Prisma ORM
- 多重認證欄位

✅ **部署準備**
- Cloud Run 部署腳本
- Docker 配置
- Firebase Authentication 整合

## 🚀 本地開發

### 1. 啟動資料庫
```bash
docker-compose up -d
```

### 2. 同步資料庫 Schema
```bash
cd web
npm run db:push
```

### 3. 啟動前端
```bash
cd web
npm run dev
```

前端將在 http://localhost:3000 啟動

### 4. 啟動後端（可選）
```bash
cd backend
uvicorn app.interface.api.main:app --reload --host 0.0.0.0 --port 8000
```

後端將在 http://localhost:8000 啟動

## 🌐 部署到 Google Cloud

### 前置作業（只需執行一次）

1. **安裝 Google Cloud SDK**
```bash
brew install --cask google-cloud-sdk
```

2. **登入並設定專案**
```bash
gcloud auth login
gcloud config set project zentropy-4f7a5
```

3. **啟用必要的 APIs**
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 部署指令

#### 方案一：一鍵部署（推薦）
```bash
./scripts/deploy-all.sh
```

#### 方案二：分別部署

**部署前端**
```bash
./scripts/deploy-web.sh
# 或
cd web && npm run deploy:web
```

**部署後端**
```bash
./scripts/deploy-backend.sh
# 或
cd web && npm run deploy:backend
```

## ⚙️ 部署後設定

### 設定環境變數

**前端 Cloud Run 環境變數**
```bash
gcloud run services update zentropy-web \
  --update-env-vars DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" \
  --update-env-vars GOOGLE_GENERATIVE_AI_API_KEY="your-api-key" \
  --region asia-east1
```

**後端 Cloud Run 環境變數**
```bash
gcloud run services update zentropy-backend \
  --update-env-vars DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" \
  --update-env-vars GOOGLE_GENERATIVE_AI_API_KEY="your-api-key" \
  --region asia-east1
```

### 資料庫選項

**選項一：Cloud SQL（生產環境推薦）**

詳細步驟請參考 [README_DEPLOYMENT.md](README_DEPLOYMENT.md#資料庫選項)

**選項二：外部資料庫**

使用 Railway、Supabase 或其他服務，直接設定 DATABASE_URL 即可。

## 📋 環境變數清單

### 必要變數
- `DATABASE_URL` - PostgreSQL 連接字串
- `GOOGLE_GENERATIVE_AI_API_KEY` - Gemini API 金鑰

### Firebase 變數（已設定）
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 🔍 常用指令

### 開發
```bash
npm run dev              # 啟動開發伺服器
npm run build            # 建置生產版本
npm run lint             # 程式碼檢查
```

### 資料庫
```bash
npm run db:push          # 同步 schema 到資料庫
npm run db:generate      # 生成 Prisma Client
npm run db:studio        # 開啟 Prisma Studio
```

### 部署
```bash
npm run deploy:web       # 部署前端
npm run deploy:backend   # 部署後端
npm run deploy:all       # 部署全部
```

### 監控
```bash
# 查看 Cloud Run 服務
gcloud run services list --region asia-east1

# 查看日誌
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zentropy-web" --limit 50
```

## 🐛 故障排除

### 資料庫連接失敗
- 確認 Docker 容器正在運行：`docker ps`
- 確認環境變數正確：檢查 `.env.local`
- 重啟資料庫：`docker-compose restart db`

### 建置失敗
- 清除 cache：`rm -rf .next node_modules`
- 重新安裝：`npm install`
- 重新生成 Prisma Client：`npm run db:generate`

### 部署失敗
- 檢查 gcloud 登入狀態：`gcloud auth list`
- 檢查專案設定：`gcloud config get-value project`
- 查看建置日誌：`gcloud builds list`

## 📚 更多資訊

- [完整部署指南](README_DEPLOYMENT.md)
- [專案架構說明](docs/README.md)
- [API 文件](backend/docs/api.md)

## 🆘 需要協助？

1. 檢查 [故障排除](#故障排除) 章節
2. 查看日誌尋找錯誤訊息
3. 參考 [README_DEPLOYMENT.md](README_DEPLOYMENT.md) 的詳細說明
