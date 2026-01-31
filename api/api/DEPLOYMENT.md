# Zentropy 部署指南

本文檔說明如何部署 Zentropy 的前後端專案。

## 專案結構

```
Zentropy/
├── api/              # 後端 API (Next.js)
├── web/              # 前端 (Next.js)
├── scripts/          # 部署腳本
│   ├── deploy-backend.sh    # 部署 API 到 Cloud Run
│   ├── deploy-web.sh        # 部署前端到 Firebase Hosting
│   └── local-run.sh         # 本地測試環境
└── logs/             # 本地運行日誌
```

## 前置準備

### 1. 環境變數設定

**後端 (api/.env)**:
```env
DATABASE_URL="postgresql://..."
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

**前端 (web/.env.local)**:
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"  # 本地開發
# NEXT_PUBLIC_API_URL="https://your-api.run.app"  # 生產環境
```

### 2. 工具安裝

```bash
# Docker (用於 Cloud Run 部署)
brew install docker

# Firebase CLI (用於 Firebase Hosting)
npm install -g firebase-tools

# Google Cloud CLI (用於 Cloud Run)
brew install google-cloud-sdk
```

## 本地測試

### 同時啟動前後端

```bash
./scripts/local-run.sh
```

這會：
- 在 port 3001 啟動 API Server (背景)
- 在 port 3000 啟動 Web Server (前景)
- 按 Ctrl+C 自動清理所有進程

### 分別測試

**後端**:
```bash
cd api
npm run dev  # port 3001
```

**前端**:
```bash
cd web
npm run dev  # port 3000
```

## 部署到生產環境

### 1. 部署後端到 Cloud Run

```bash
./scripts/deploy-backend.sh
```

這會執行：
1. 安裝依賴
2. 生成 Prisma Client
3. 建置 Next.js
4. 建立 Docker 映像
5. 推送至 GCR
6. 部署至 Cloud Run

**部署配置**:
- Region: asia-east1 (台灣)
- Memory: 512Mi
- CPU: 1
- Min instances: 0 (按需付費)
- Max instances: 10

**環境變數設定** (在 Cloud Console):
```
DATABASE_URL=postgresql://...
GOOGLE_GENERATIVE_AI_API_KEY=...
NODE_ENV=production
```

### 2. 部署前端到 Firebase Hosting

```bash
./scripts/deploy-web.sh
```

這會執行：
1. 安裝依賴
2. 建置 Next.js (靜態導出)
3. 部署至 Firebase Hosting

**注意**:
- 確保 `web/next.config.js` 設定 `output: 'export'`
- 更新 `NEXT_PUBLIC_API_URL` 為生產環境的 API URL

## 測試

### 後端測試

```bash
cd api

# 運行所有測試
npm test

# 監聽模式
npm run test:watch

# 測試 UI
npm run test:ui

# 覆蓋率報告
npm run test:coverage
```

**測試狀態**: 22 個測試，16 個通過 (73%)

### 建置測試

```bash
cd api
npm run build  # 應該 0 錯誤

cd ../web
npm run build  # 應該 0 錯誤
```

## API Endpoints

部署後的 API URL 格式：
```
https://zentropy-api-xxxxx.a.run.app/api/{endpoint}
```

**主要 Endpoints**:
- `GET /api/me` - 獲取當前用戶
- `GET /api/tasks` - 獲取任務列表
- `GET /api/products` - 獲取專案列表
- `GET /api/areas` - 獲取領域列表

查看完整 API 文檔: [api/README.md](api/README.md)

## 監控與維護

### 查看 Cloud Run 日誌

```bash
gcloud run services logs read zentropy-api \
  --region=asia-east1 \
  --project=zentropy-app
```

### 查看 Firebase Hosting 狀態

```bash
firebase hosting:list --project zentropy-app
```

### 本地日誌

本地運行時，日誌存放在：
- API: `logs/api.log`

## 常見問題

### Q: Cloud Run 冷啟動太慢？
A: 設定 `--min-instances 1` 保持一個實例常駐（會增加成本）

### Q: API 連接失敗？
A: 檢查：
1. Cloud Run 環境變數是否正確設定
2. DATABASE_URL 是否可連接
3. Firebase Auth 配置是否正確

### Q: 前端無法呼叫 API？
A: 檢查：
1. `NEXT_PUBLIC_API_URL` 是否設定正確
2. CORS 設定是否正確
3. API 是否允許未認證請求 (`--allow-unauthenticated`)

## 成本估算

**Cloud Run** (按需付費):
- 無流量時: $0 (min-instances=0)
- 中等流量: ~$5-20/月
- 高流量: 依實際使用計費

**Firebase Hosting**:
- 免費額度: 10GB 儲存 + 360MB/天傳輸
- 超過免費額度: $0.026/GB

**Supabase PostgreSQL**:
- 免費方案: 500MB 資料庫
- Pro 方案: $25/月 (8GB)

## 支援

如有問題，請查看：
- [api/README.md](api/README.md) - API 開發文檔
- [api/tests/README.md](api/tests/README.md) - 測試說明
- [CLAUDE.md](CLAUDE.md) - 專案架構文檔
