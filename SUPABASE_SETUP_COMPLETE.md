# ✅ Supabase 設定完成！

## 🎉 已完成項目

### 1. 資料庫連接
- ✅ 使用 Session Pooler (IPv4 compatible)
- ✅ 區域：ap-south-1 (Mumbai, India)
- ✅ 端口：5432 (Session mode - 支援 Prisma)
- ✅ 連接測試成功

### 2. PostgreSQL 擴充套件
- ✅ pgvector 0.8.0 已啟用
- ✅ 支援向量搜尋功能

### 3. 資料庫 Schema
- ✅ 8 個資料表已建立：
  - `users` - 使用者認證與設定
  - `areas` - 領域
  - `products` - 專案/產品
  - `topics` - 主題
  - `tasks` - 任務
  - `milestones` - 里程碑
  - `governance_proposals` - 治理提案
  - `alembic_version` - 資料庫版本

### 4. Prisma 設定
- ✅ Prisma Client 已生成
- ✅ Schema 同步完成

## 📋 環境變數設定

### 本地開發 (.env.local)
```env
DATABASE_URL="postgresql://postgres.jeatbzmznavvjkwilsyn:REDACTED_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
```

### 生產環境 (Cloud Run)
```bash
gcloud run services update zentropy-web \
  --update-env-vars DATABASE_URL="postgresql://postgres.jeatbzmznavvjkwilsyn:REDACTED_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" \
  --region asia-east1
```

## 🚀 現在可以做什麼

### 1. 測試登入功能
```bash
cd web
npm run dev
```

訪問 http://localhost:3000 測試三種登入方式：
- ✅ Google SSO
- ✅ 匿名訪客模式
- ✅ 名稱登入

### 2. 查看資料庫
在 Supabase Dashboard：
- **Table Editor** - 視覺化編輯資料
- **SQL Editor** - 執行 SQL 查詢
- **Database** - 監控連接與效能

### 3. 部署到 Cloud Run
```bash
# 前端部署
./scripts/deploy-web.sh

# 後端部署
./scripts/deploy-backend.sh

# 完整部署
./scripts/deploy-all.sh
```

## ⚙️ 重要設定說明

### Session Pooler vs Transaction Pooler

| 模式 | Port | 用途 | Prisma 支援 |
|------|------|------|------------|
| **Session** | 5432 | Prisma migrations, 長時間連接 | ✅ 完整支援 |
| **Transaction** | 6543 | Serverless, 短連接 | ⚠️ 部分限制 |

**我們使用 Session Pooler (port 5432)**，因為：
- ✅ 完整支援 Prisma 的所有功能
- ✅ 支援 `prisma db push` 和 migrations
- ✅ 沒有 prepared statement 限制
- ✅ 仍然是 IPv4 compatible

### Supabase 免費額度
- ✅ 500 MB 資料庫儲存
- ✅ 1 GB 檔案儲存
- ✅ 2 GB 頻寬/月
- ✅ 無限 API 請求
- ✅ 每月 500,000 次 Realtime 訊息

## 🔧 常用指令

### 資料庫操作
```bash
# 同步 schema
npm run db:push

# 生成 Prisma Client
npm run db:generate

# 開啟 Prisma Studio
npm run db:studio
```

### 開發
```bash
# 啟動開發伺服器
npm run dev

# 建置
npm run build

# 執行測試
npm test
```

## 📊 Supabase Dashboard 快速連結

1. **Project Settings** → Database
   - 查看連接字串
   - 監控連接數
   - 設定 Connection Pooling

2. **Table Editor**
   - 視覺化編輯資料表
   - 新增/刪除資料

3. **SQL Editor**
   - 執行自訂查詢
   - 查看查詢歷史

4. **Database** → Extensions
   - 管理 PostgreSQL 擴充套件
   - pgvector 已啟用

## 🐛 故障排除

### 連接失敗
```bash
# 測試連接
node test-final-connection.js
```

### Schema 不同步
```bash
cd web
npx prisma db push --force-reset  # 警告：會清空資料！
```

### Prisma Client 過期
```bash
npm run db:generate
```

## 📝 下一步建議

1. **測試登入流程**
   - Google SSO
   - 匿名登入
   - 名稱登入

2. **建立測試資料**
   - 使用 Prisma Studio
   - 或透過 SQL Editor

3. **設定 Row Level Security (RLS)**
   - 在 Supabase Dashboard 設定
   - 保護使用者資料

4. **部署到生產環境**
   - 設定 Cloud Run 環境變數
   - 測試生產連接

## ✅ 檢查清單

- [x] Supabase 專案建立
- [x] pgvector 擴充套件啟用
- [x] 環境變數設定
- [x] Prisma schema 同步
- [x] 資料表建立
- [ ] 測試登入功能
- [ ] 建立測試資料
- [ ] 部署到 Cloud Run

---

🎊 **恭喜！Supabase 設定完成，現在可以開始開發了！**
