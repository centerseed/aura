# Naruvia 部署腳本指南

本目錄包含 Naruvia 專案的部署與開發腳本。

## 🏗️ 架構概覽

Naruvia 採用**前後端分離架構**:

```
┌─────────────────────────────────────────────────────┐
│                    生產環境                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  Web Frontend    │ ───▶ │  API Backend     │   │
│  │                  │      │                  │   │
│  │  Firebase        │      │  Cloud Run       │   │
│  │  Hosting         │      │  (按需付費)       │   │
│  │  (靜態 CDN)      │      │                  │   │
│  └──────────────────┘      └──────────────────┘   │
│           │                         │              │
│           └─────────────┬───────────┘              │
│                         ▼                          │
│                  ┌──────────────┐                  │
│                  │   Supabase   │                  │
│                  │  PostgreSQL  │                  │
│                  └──────────────┘                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    本地開發                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  Web Frontend    │ ───▶ │  API Backend     │   │
│  │                  │      │                  │   │
│  │  localhost:3000  │      │  localhost:3001  │   │
│  │  (Next.js dev)   │      │  (Next.js dev)   │   │
│  └──────────────────┘      └──────────────────┘   │
│           │                         │              │
│           └─────────────┬───────────┘              │
│                         ▼                          │
│                  ┌──────────────┐                  │
│                  │   Supabase   │                  │
│                  │  PostgreSQL  │                  │
│                  │   (遠端)      │                  │
│                  └──────────────┘                  │
└─────────────────────────────────────────────────────┘
```

---

## 📂 專案結構

```
Naruvia/
├── api/                    # 後端 API (Next.js API Routes)
│   ├── src/
│   ├── package.json
│   ├── .env.local          # 本地開發環境變數
│   └── Dockerfile          # Cloud Run 部署用
│
├── web/                    # 前端 Web (Next.js)
│   ├── app/
│   ├── package.json
│   ├── .env.local          # 本地開發環境變數
│   ├── .env.production     # 生產環境變數
│   ├── firebase.json       # Firebase Hosting 配置
│   └── next.config.ts      # output: 'export' (靜態導出)
│
└── scripts/                # 部署與開發腳本
    ├── dev-local.sh        # 🟢 本地開發
    ├── deploy-api.sh       # 🔵 部署 API
    ├── deploy-web.sh       # 🔵 部署 Web
    └── deploy-all.sh       # 🔵 統一部署
```

---

## 🚀 快速開始

### 本地開發

**啟動完整環境 (Web + API)**:
```bash
./scripts/dev-local.sh
```

**只啟動 Web**:
```bash
./scripts/dev-local.sh web
```

**只啟動 API**:
```bash
./scripts/dev-local.sh api
```

啟動後:
- Web: http://localhost:3000
- API: http://localhost:3001

---

## 📦 部署到生產環境

### 前置準備

1. **安裝必要工具**:
   ```bash
   # Google Cloud SDK
   brew install google-cloud-sdk

   # Firebase CLI
   npm install -g firebase-tools
   ```

2. **登入 GCP 與 Firebase**:
   ```bash
   gcloud auth login
   firebase login
   ```

3. **設定 GCP 專案**:
   ```bash
   gcloud config set project zentropy-4f7a5
   ```

4. **配置環境變數**:

   **API 環境變數** (使用 Secret Manager):
   ```bash
   # 建立 Secrets
   echo -n "your-database-url" | gcloud secrets create database-url --data-file=-
   echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-
   cat firebase-admin-key.json | gcloud secrets create firebase-admin-key --data-file=-
   ```

   **Web 環境變數** (`web/.env.production`):
   ```bash
   # 取得 API URL (部署 API 後執行)
   gcloud run services describe naruvia-api \
     --region asia-east1 \
     --project zentropy-4f7a5 \
     --format 'value(status.url)'

   # 更新 web/.env.production
   NEXT_PUBLIC_API_URL=https://naruvia-api-xxxxxxxxxx-de.a.run.app
   ```

---

### 部署選項

#### 選項 1: 統一部署 (推薦)

一次性部署 API 和 Web:

```bash
./scripts/deploy-all.sh production
```

流程:
1. 部署 API 到 Cloud Run
2. 取得 API URL
3. 提示更新 `web/.env.production`
4. 部署 Web 到 Firebase Hosting

---

#### 選項 2: 分別部署

**只部署 API**:
```bash
./scripts/deploy-api.sh production
```

**只部署 Web**:
```bash
./scripts/deploy-web.sh production
```

---

#### 選項 3: Staging 環境

```bash
./scripts/deploy-all.sh staging
```

---

## 🌍 環境變數配置

### Local 開發環境

**`api/.env.local`**:
```env
# Database - Supabase (遠端)
DATABASE_URL="postgresql://..."

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=...

# Firebase Admin SDK
FIREBASE_ADMIN_KEY=...
```

**`web/.env.local`**:
```env
# API 連接
NEXT_PUBLIC_API_URL=http://localhost:3001

# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
...
```

---

### Production 生產環境

**API (Cloud Run)**:
- 使用 GCP Secret Manager 管理敏感資訊
- 透過 `--update-secrets` 注入環境變數

**Web (Firebase Hosting)**:
```env
# web/.env.production
NEXT_PUBLIC_API_URL=https://naruvia-api-xxx.run.app
NEXT_PUBLIC_FIREBASE_API_KEY=...
...
```

---

## 🧪 部署後驗證

### 測試 API

```bash
# 取得 API URL
API_URL=$(gcloud run services describe naruvia-api \
  --region asia-east1 \
  --project zentropy-4f7a5 \
  --format 'value(status.url)')

# 測試 Health Check
curl $API_URL/api/me
```

### 測試 Web

```bash
# 開啟瀏覽器
open https://zentropy-4f7a5.web.app
```

---

## 📊 監控與管理

### Cloud Run (API)

```bash
# 查看服務列表
gcloud run services list --region asia-east1

# 查看服務詳情
gcloud run services describe naruvia-api \
  --region asia-east1 \
  --project zentropy-4f7a5

# 查看日誌
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=naruvia-api" \
  --limit 50 \
  --format json
```

### Firebase Hosting (Web)

```bash
# 查看部署歷史
firebase hosting:channel:list --project zentropy-4f7a5

# 查看當前部署
firebase hosting:channel:open production --project zentropy-4f7a5
```

---

## 💰 成本估算

### API (Cloud Run)
- **配置**: 512Mi 記憶體, 1 CPU
- **最小實例數**: 0 (按需付費)
- **最大實例數**: 10
- **費用**: 僅在有請求時收費，閒置時 $0

### Web (Firebase Hosting)
- **配置**: 靜態 CDN
- **免費額度**:
  - 10 GB 儲存
  - 360 MB/天 傳輸
  - 自訂網域免費
- **費用**: 超出免費額度後才收費

### Database (Supabase)
- **配置**: PostgreSQL (免費方案)
- **限制**: 500 MB 儲存

---

## 🔧 疑難排解

### 問題 1: API 部署失敗

```bash
# 檢查 Docker 建置日誌
gcloud builds list --limit 5

# 檢查最新建置
gcloud builds log $(gcloud builds list --limit 1 --format 'value(id)')
```

### 問題 2: Web 建置失敗

```bash
# 確認 next.config.ts 設定
grep "output:" web/next.config.ts

# 應該顯示: output: 'export',

# 手動測試建置
cd web
npm run build

# 檢查 out/ 目錄
ls -la out/
```

### 問題 3: API URL 未更新

```bash
# 檢查 Web 環境變數
grep "NEXT_PUBLIC_API_URL" web/.env.production

# 重新部署 Web
./scripts/deploy-web.sh production
```

---

## 📝 開發流程

### 新功能開發

1. **本地開發**:
   ```bash
   ./scripts/dev-local.sh
   ```

2. **測試**:
   ```bash
   cd api && npm run test
   cd web && npm run test
   ```

3. **提交代碼**:
   ```bash
   git add .
   git commit -m "feat: 新功能描述"
   git push
   ```

4. **部署到 Staging**:
   ```bash
   ./scripts/deploy-all.sh staging
   ```

5. **驗證無誤後部署到 Production**:
   ```bash
   ./scripts/deploy-all.sh production
   ```

---

## 🗂️ 舊腳本歸檔

舊的部署腳本已移至 `scripts/archive/`:
- `deploy-backend.sh`
- `deploy-backend-cloudrun.sh`
- `deploy-web-firebase.sh`
- `local-run.sh`
- `local-docker-build.sh`
- `dev_start.sh`

如需參考舊流程，可查看 archive 目錄。

---

## 📞 支援

如有問題，請聯繫開發團隊或參考:
- [Google Cloud Run 文件](https://cloud.google.com/run/docs)
- [Firebase Hosting 文件](https://firebase.google.com/docs/hosting)
- [Next.js Static Export 文件](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
