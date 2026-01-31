# Zentropy - 讓一切井然有序

為創業者設計的「不失控」營運管理系統，採用雙軸管理模型 (Status × Entity) 與三個協作 AI Agents。

## 🎯 專案狀態

**最新更新**: API 分離重構完成 (2026-01-31)

- ✅ API 專案已分離至獨立 `api/` 目錄
- ✅ Clean Architecture 重構完成 (27 endpoints, 33 Use Cases)
- ✅ 統一 API 回應格式
- ✅ 測試框架已建立 (Vitest)
- ✅ 部署腳本已就緒

## 📁 專案結構

```
Zentropy/
├── api/              # 🔥 後端 API (Next.js + Clean Architecture)
│   ├── src/
│   │   ├── app/api/          # 27 個 API routes
│   │   ├── application/      # 33 個 Use Cases
│   │   ├── domain/           # Domain models
│   │   ├── infrastructure/   # Repositories
│   │   └── lib/              # 共享函式庫
│   ├── tests/                # Vitest 測試 (22 tests)
│   ├── prisma/               # Database schema
│   └── README.md             # API 文檔
│
├── web/              # 前端 (Next.js)
│   ├── app/                  # App Router
│   ├── components/           # React 元件
│   └── lib/                  # 工具函式
│
├── scripts/          # 部署腳本
│   ├── deploy-backend.sh     # 部署 API 到 Cloud Run
│   ├── deploy-web.sh         # 部署前端到 Firebase
│   └── local-run.sh          # 本地測試環境
│
├── docs/             # 專案文檔 (Spec-Driven Development)
│   ├── 00_Constitution/      # 憲法級規範
│   ├── 01_Specification/     # 規格文件
│   ├── 02_Plan/              # 實作計畫
│   ├── 03_Tasks/             # 任務清單
│   └── 06_Standards/         # 開發標準
│
├── CLAUDE.md         # AI 開發指南
└── DEPLOYMENT.md     # 📋 部署指南
```

## 🚀 快速開始

### 本地開發

```bash
# 1. 複製環境變數
cp api/.env.example api/.env
cp web/.env.example web/.env.local

# 2. 安裝依賴
cd api && npm install
cd ../web && npm install

# 3. 生成 Prisma Client
cd api && npx prisma generate

# 4. 啟動開發環境（前後端同時啟動）
./scripts/local-run.sh
```

訪問：
- 前端: http://localhost:3000
- API: http://localhost:3001/api

### 分別測試

```bash
# 後端
cd api
npm run dev      # port 3001
npm test         # 運行測試

# 前端
cd web
npm run dev      # port 3000
```

## 🏗️ 架構特點

### 後端 API (Clean Architecture)

```
Domain Layer (核心)
  ↓
Application Layer (Use Cases)
  ↓
Infrastructure Layer (Repositories)
  ↓
Interface Layer (API Routes)
```

**核心優勢**：
- ✅ 業務邏輯與框架解耦
- ✅ 可測試性高 (33 Use Cases 可獨立測試)
- ✅ 統一錯誤處理 (Domain Exceptions)
- ✅ 統一 API 格式 (ApiResponseBuilder)
- ✅ 類型安全 (完整 TypeScript)

### API Endpoints (27 個)

| 模組 | Endpoints | 狀態 |
|------|-----------|------|
| Areas | 4 | ✅ Clean Arch |
| Products | 5 | ✅ Clean Arch |
| Tasks | 10 | ✅ Clean Arch |
| Milestones | 4 | ✅ Clean Arch |
| Users & Auth | 3 | ✅ Clean Arch |
| AI & Library | 4 | ✅ Clean Arch |

詳見: [api/README.md](api/README.md)

## 🧪 測試

```bash
cd api

# 運行所有測試
npm test

# 監聽模式
npm run test:watch

# UI 介面
npm run test:ui

# 覆蓋率報告
npm run test:coverage
```

**測試狀態**: 22 tests, 16 passed (73%)

詳見: [api/tests/README.md](api/tests/README.md)

## 📦 部署

### 部署後端到 Cloud Run

```bash
./scripts/deploy-backend.sh
```

### 部署前端到 Firebase Hosting

```bash
./scripts/deploy-web.sh
```

詳見: [DEPLOYMENT.md](DEPLOYMENT.md)

## 💻 技術棧

**後端**:
- Next.js 16 (App Router, API-only mode)
- TypeScript 5
- Prisma ORM (PostgreSQL)
- Firebase Admin SDK (Auth)
- Google Gemini AI
- Vitest (Testing)

**前端**:
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS
- Radix UI
- Firebase (Auth)

**部署**:
- Google Cloud Run (後端)
- Firebase Hosting (前端)
- Supabase (PostgreSQL)

## 📚 文檔

- [CLAUDE.md](CLAUDE.md) - AI 開發指南與專案架構
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南
- [api/README.md](api/README.md) - API 開發文檔
- [api/tests/README.md](api/tests/README.md) - 測試說明
- [docs/](docs/) - Spec-Driven Development 文檔

## 🎓 開發原則

### Spec-Driven Development (SDD)

**嚴格遵循的開發流程**：

1. **Constitution** - 最高法律
2. **Specification** - 定義「做什麼」
3. **Plan** - 定義「怎麼做」
4. **Tasks** - 可執行的任務
5. **Implementation** - 實作
6. **ADR** - 決策記錄

### Clean Architecture

- Domain Layer: 純業務邏輯
- Application Layer: Use Cases
- Infrastructure Layer: 外部依賴
- Interface Layer: API Routes

## 🔧 開發命令

```bash
# 後端開發
cd api
npm run dev              # 啟動開發伺服器
npm test                 # 運行測試
npm run build            # 建置
npx prisma generate      # 生成 Prisma Client
npx prisma migrate dev   # 資料庫遷移

# 前端開發
cd web
npm run dev              # 啟動開發伺服器
npm run build            # 建置

# 部署
./scripts/deploy-backend.sh   # 部署後端
./scripts/deploy-web.sh       # 部署前端
./scripts/local-run.sh        # 本地測試環境
```

## 📊 專案統計

- **API Endpoints**: 27 個
- **Use Cases**: 33 個
- **Tests**: 22 個 (73% pass rate)
- **TypeScript Errors**: 0
- **架構層級**: 4 層 (Clean Architecture)

## 🤝 貢獻

本專案遵循 Spec-Driven Development，所有更改必須：

1. 先更新 Specification
2. 撰寫 Plan
3. 拆分 Task
4. 實作並測試
5. 記錄 ADR

## 📝 授權

Private Project

---

**Built with** ❤️ **using Claude Code & Clean Architecture**
