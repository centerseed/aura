# Zentropy API

獨立的 API 伺服器，使用 Next.js App Router 建置。

## 專案結構

```
api/
├── src/
│   ├── app/api/              # API Routes (27 endpoints)
│   ├── application/          # Use Cases (33 files)
│   ├── domain/               # Domain Models & Interfaces
│   ├── infrastructure/       # Repositories & External Services
│   └── lib/                  # Shared Libraries
├── prisma/                   # Database Schema
├── package.json
├── tsconfig.json
└── next.config.js
```

## 開發

```bash
# 安裝依賴
npm install

# 生成 Prisma Client
npx prisma generate

# 啟動開發伺服器 (port 3001)
npm run dev

# 建置
npm run build

# 啟動生產伺服器
npm start
```

## API Endpoints

### Areas (4 endpoints)
- `GET /api/areas` - 獲取所有領域
- `POST /api/areas` - 創建領域
- `PUT /api/areas/[id]` - 更新領域
- `DELETE /api/areas/[id]` - 刪除領域

### Products (5 endpoints)
- `GET /api/products` - 獲取所有專案
- `POST /api/products` - 創建專案
- `PUT /api/products/[id]` - 更新專案
- `DELETE /api/products/[id]` - 刪除專案
- `PUT /api/products/reorder` - 重新排序專案

### Tasks (10 endpoints)
- `GET /api/tasks` - 獲取任務列表
- `POST /api/tasks` - 創建任務
- `GET /api/tasks/[taskId]` - 獲取任務詳情
- `PUT /api/tasks/[taskId]` - 更新任務
- `DELETE /api/tasks/[taskId]` - 刪除任務
- `POST /api/tasks/[taskId]/merge-into` - 合併任務
- `GET/POST/PUT/DELETE /api/tasks/[taskId]/references/*` - 管理參考資料
- `GET/POST/PUT/DELETE /api/tasks/[taskId]/sub-items/*` - 管理子項目

### Milestones (2 endpoints)
- `GET /api/milestones` - 獲取里程碑
- `POST /api/milestones` - 創建里程碑

### Users & Auth (3 endpoints)
- `GET /api/me` - 獲取當前用戶
- `GET /api/users/[id]` - 獲取用戶資訊
- `POST /api/auth/signin` - 登入

### AI & Evaluation (3 endpoints)
- `POST /api/suggest-product` - AI 推薦專案名稱
- `GET /api/evaluation/logs` - 獲取評估日誌
- `PUT /api/evaluation/logs` - 更新評估日誌

### Complex AI APIs (3 endpoints - 技術債)
- `POST /api/brain-dump` - AI 任務解析
- `POST /api/adjust-tags` - AI 標籤調整
- `POST /api/reorganize` - AI 重組建議

## 環境變數

複製 `.env.example` 為 `.env` 並設定：

```env
DATABASE_URL="postgresql://..."
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

## 部署

使用提供的部署腳本：

```bash
# 部署到 Cloud Run
../scripts/deploy-backend.sh
```

## 架構特點

- **Clean Architecture**: 4 層架構 (Domain, Application, Infrastructure, Interface)
- **Use Case Pattern**: 33 個獨立的業務用例
- **統一錯誤處理**: catchDomainException + Domain Exceptions
- **統一 API 回應**: ApiResponseBuilder
- **類型安全**: 完整的 TypeScript 支援
- **Prisma ORM**: PostgreSQL 資料庫存取
- **Firebase Auth**: 使用者認證
- **Google Gemini AI**: AI 功能支援
