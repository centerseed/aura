# Naruvia 部署與開發指南

本指南說明如何在本地開發、測試和部署 Naruvia 系統。

## 目錄

- [本地開發](#本地開發)
- [測試](#測試)
- [部署](#部署)
- [環境變數](#環境變數)
- [架構說明](#架構說明)

---

## 本地開發

### 快速開始

```bash
# 1. 安裝依賴
cd web
npm install

# 2. 設定環境變數
cp .env.example .env.local
# 編輯 .env.local 填入必要的環境變數

# 3. 生成 Prisma Client
npm run db:generate

# 4. 啟動開發伺服器
npm run dev
# 或使用腳本
npm run local:dev
```

開發伺服器將在 http://localhost:3000 啟動。

### 使用本地開發腳本

我們提供了統一的本地開發腳本 `scripts/local-run.sh`:

```bash
# 開發模式 (啟動 Next.js dev server)
./scripts/local-run.sh dev
# 或
npm run local:dev

# 測試模式 (執行所有測試)
./scripts/local-run.sh test
# 或
npm run local:test

# 建置模式 (生產建置)
./scripts/local-run.sh build
# 或
npm run local:build

# 完整測試流程 (test + build)
./scripts/local-run.sh full
# 或
npm run local:full
```

---

## 測試

### 執行測試

```bash
cd web

# 執行所有測試
npm test

# 執行特定類型的測試
npm run test:unit          # 單元測試
npm run test:integration   # 整合測試
npm run test:components    # 組件測試

# Watch 模式
npm run test:watch

# 測試覆蓋率
npm run test:coverage

# UI 介面
npm run test:ui
```

### 測試環境

測試使用 `.env.test` 檔案作為環境變數來源。如果不存在,將回退到 `.env.local`。

確保測試資料庫與開發資料庫分離:

```env
# .env.test
DATABASE_URL="postgresql://..."  # 測試專用資料庫
```

---

## 部署

### 架構概覽

- **前端 (靜態資源)**: Firebase Hosting
- **後端 (API Routes)**: Google Cloud Run (按需付費)
- **資料庫**: PostgreSQL (Neon/Supabase)
- **檔案儲存**: Firebase Storage

### 前端部署 (Firebase Hosting)

#### 部署到 Production

```bash
cd web

# 使用 npm 腳本
npm run deploy:web

# 或直接使用腳本
../scripts/deploy-web-firebase.sh production
```

#### 部署到 Staging

```bash
npm run deploy:web:staging

# 或
../scripts/deploy-web-firebase.sh staging
```

#### 部署流程

1. ✅ 檢查環境依賴 (Node.js, Firebase CLI)
2. ✅ 安裝依賴 (`npm ci`)
3. ✅ 生成 Prisma Client
4. ✅ TypeScript 檢查
5. ✅ 執行測試 (僅 production)
6. ✅ Next.js 建置 (`npm run build`)
7. ✅ 部署到 Firebase Hosting

### 後端部署 (Cloud Run)

#### 部署到 Production

```bash
cd web

# 使用 npm 腳本
npm run deploy:backend

# 或直接使用腳本
../scripts/deploy-backend-cloudrun.sh production
```

#### 部署到 Staging

```bash
npm run deploy:backend:staging

# 或
../scripts/deploy-backend-cloudrun.sh staging
```

#### 部署配置 (按需付費)

- **最小實例數**: 0 (完全按需付費)
- **最大實例數**: 10
- **CPU**: 1 核心
- **記憶體**: 512Mi
- **超時**: 300 秒
- **並發數**: 80

**計費說明**: 當沒有請求時,實例會自動縮減至 0,不產生費用。僅在有請求時才啟動實例並計費。

---

## 環境變數

### 本地開發 (.env.local)

```env
# 資料庫
DATABASE_URL="postgresql://..."

# Firebase Admin (後端)
FIREBASE_ADMIN_PROJECT_ID="..."
FIREBASE_ADMIN_PRIVATE_KEY="..."
FIREBASE_ADMIN_CLIENT_EMAIL="..."

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY="..."

# Next.js 公開變數
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
```

### 生產環境

生產環境的敏感資訊使用 **Google Secret Manager** 管理:

```bash
# 查看現有 secrets
gcloud secrets list --project zentropy-4f7a5

# 建立新 secret
gcloud secrets create SECRET_NAME \
  --replication-policy="automatic" \
  --project zentropy-4f7a5

# 更新 secret 值
echo -n "SECRET_VALUE" | gcloud secrets versions add SECRET_NAME \
  --data-file=- \
  --project zentropy-4f7a5
```

---

## 架構說明

### Clean Architecture 分層

```
web/
├── app/                    # Next.js App Router (Interface Layer)
│   ├── api/               # API Routes
│   └── ...
├── domain/                 # Domain Layer (核心業務邏輯)
│   ├── entities/          # 領域實體
│   ├── value-objects/     # 值物件
│   └── interfaces/        # Repository 介面
├── application/            # Application Layer (Use Cases)
│   └── use-cases/         # 業務用例
├── infrastructure/         # Infrastructure Layer (外部依賴)
│   └── repositories/      # Repository 實作
└── lib/                    # 共用工具
    ├── api-response.ts    # 統一 API 回應
    └── api-format-helpers.ts  # 格式化輔助函數
```

### API 統一格式

#### 成功回應

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-30T...",
    "total": 100
  }
}
```

#### 錯誤回應

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "錯誤訊息",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-30T..."
  }
}
```

---

## 常用命令速查

### 開發

```bash
npm run dev              # 開發伺服器
npm run build            # 生產建置
npm run start            # 啟動生產伺服器
npm run lint             # 代碼檢查
```

### 資料庫

```bash
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送 schema 變更
npm run db:studio        # 開啟 Prisma Studio
```

### 測試

```bash
npm test                 # 執行所有測試
npm run test:watch       # Watch 模式
npm run test:coverage    # 測試覆蓋率
```

### 部署

```bash
npm run deploy:web                # 部署前端 (production)
npm run deploy:web:staging        # 部署前端 (staging)
npm run deploy:backend            # 部署後端 (production)
npm run deploy:backend:staging    # 部署後端 (staging)
```

---

## 故障排除

### 1. Firebase CLI 未安裝

```bash
npm install -g firebase-tools
firebase login
```

### 2. Google Cloud SDK 未安裝

訪問 https://cloud.google.com/sdk/docs/install

### 3. 測試失敗

```bash
# 清除測試快取
rm -rf web/node_modules/.vitest

# 重新安裝依賴
cd web && npm ci
```

### 4. 資料庫連線問題

檢查 `.env.local` 中的 `DATABASE_URL` 是否正確。

### 5. TypeScript 錯誤

```bash
# 重新生成 Prisma Client
npm run db:generate

# 清除 Next.js 快取
rm -rf .next
npm run build
```

---

## 參考資料

- [Next.js 文檔](https://nextjs.org/docs)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Google Cloud Run](https://cloud.google.com/run/docs)
- [Prisma 文檔](https://www.prisma.io/docs)
- [Vitest 文檔](https://vitest.dev/)

---

## 聯絡支援

如有問題,請查看:
- [API 重構指南](web/docs/API_REFACTORING_GUIDE.md)
- [Clean Architecture 說明](web/docs/036_NextJS_Internal_Architecture_Separation.md)
