# ✅ 資料庫遷移完成報告

## 📅 遷移時間
- 日期：2026-01-26

## 🎯 遷移目標
將本地 PostgreSQL 資料庫資料遷移至 Supabase 雲端資料庫

## 📊 遷移結果

### 成功遷移的資料
| 資料表 | 筆數 | 狀態 |
|--------|------|------|
| Users | 25 | ✅ |
| Areas | 49 | ✅ |
| Products | 73 | ✅ |
| Topics | 67 | ✅ |
| Tasks | 93 | ✅ |
| Milestones | 15 | ✅ |
| **總計** | **322** | **✅** |

### 技術細節
- **來源資料庫**：本地 PostgreSQL (localhost:5432)
- **目標資料庫**：Supabase (aws-1-ap-south-1.pooler.supabase.com:5432)
- **遷移方式**：pg_dump + 過濾 INSERT 語句
- **執行語句**：317 條 SQL INSERT 語句
- **事務處理**：使用 BEGIN/COMMIT 確保資料一致性

## 🔧 遷移過程

### 1. 資料匯出
```bash
pg_dump -h localhost -p 5432 -U postgres -d naruvia \
  --data-only --inserts --column-inserts \
  > /tmp/naruvia_data_export.sql
```

### 2. SQL 語句過濾
- 原始檔案：386 行
- 過濾後保留：317 條 INSERT 語句
- 移除了 pg_dump 的 meta-commands（如 `\restrict`）

### 3. 資料匯入
- 使用 Node.js pg client 逐條執行 INSERT 語句
- 採用事務處理確保原子性
- 進度顯示：每 50 條語句顯示一次進度

### 4. 資料驗證
- ✅ 所有資料表筆數正確
- ✅ 外鍵關聯完整
- ✅ 使用者資料正常
- ✅ 可透過 Prisma Client 正常查詢

## 📝 使用的檔案

### 匯出檔案
- [/tmp/naruvia_data_export.sql](/tmp/naruvia_data_export.sql) - SQL 匯出檔案（317 條 INSERT 語句）

### 遷移腳本
- [migrate-to-supabase.js](migrate-to-supabase.js) - 資料遷移腳本
- [verify-migration.js](verify-migration.js) - 資料驗證腳本

## 🔍 驗證結果

### 使用者資料樣本
```
1. test_milestone@naruvia.local (EMAIL)
2. qa_tester_27ca@naruvia.local (EMAIL)
3. cc@naruvia.local (EMAIL)
4. test_gov_30387d@example.com (EMAIL)
5. test_cf1a385a@naruvia.local (EMAIL)
```

### 資料關聯檢查
- 有產品的領域：3 個
  - 測試領域：1 個產品
  - Employee：1 個產品
  - Employee：2 個產品

## ✅ 檢查清單

- [x] 本地資料庫資料完整匯出
- [x] SQL 語句過濾處理
- [x] 資料成功匯入 Supabase
- [x] 資料筆數驗證
- [x] 資料關聯驗證
- [x] Prisma Client 連接測試
- [x] Prisma Studio 可正常查看資料

## 🚀 下一步

### 1. 測試登入功能
```bash
cd web
npm run dev
```
訪問 http://localhost:3000 測試三種登入方式：
- Google SSO
- 匿名訪客
- 名稱登入

### 2. 查看資料庫
- **Supabase Dashboard**：https://supabase.com/dashboard
  - Table Editor：視覺化查看資料
  - SQL Editor：執行 SQL 查詢
- **Prisma Studio**：http://localhost:5556
  - 本地資料庫管理工具

### 3. 部署到生產環境
```bash
# 前端部署
./scripts/deploy-web.sh

# 後端部署
./scripts/deploy-backend.sh

# 完整部署
./scripts/deploy-all.sh
```

## 📋 環境設定

### 已完成的設定
- [x] Supabase 專案建立
- [x] pgvector 擴充套件啟用
- [x] DATABASE_URL 環境變數設定
- [x] Prisma schema 同步
- [x] 資料表建立
- [x] RLS 禁用（因為使用後端 API 控制權限）
- [x] 資料遷移

### 環境變數（web/.env.local）
```env
DATABASE_URL="postgresql://postgres.jeatbzmznavvjkwilsyn:REDACTED_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

GOOGLE_GENERATIVE_AI_API_KEY=REDACTED_GEMINI_API_KEY

NEXT_PUBLIC_FIREBASE_API_KEY=REDACTED_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zentropy-4f7a5.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zentropy-4f7a5
# ... 其他 Firebase 設定
```

## 🔒 安全注意事項

### ✅ 已實施的安全措施
1. **後端 API 控制**：所有資料存取都透過後端 API
2. **Firebase 認證**：使用 Firebase Auth 處理使用者認證
3. **Service Role 連接**：後端使用 Service Role 繞過 RLS
4. **環境變數保護**：DATABASE_URL 只存在於後端，未暴露給前端

### ⚠️ 重要提醒
- 永遠不要將 DATABASE_URL 或 Service Role Key 暴露給前端
- 所有資料存取必須透過後端 API routes
- API routes 必須驗證使用者身份和權限

## 📚 相關文件

- [Supabase RLS 設定指南](docs/07_Setup/002_Supabase_RLS_Guide.md)
- [Supabase 設定完成說明](SUPABASE_SETUP_COMPLETE.md)
- [部署腳本](scripts/)

## 🎊 完成！

資料庫遷移已成功完成！現在你可以：
1. 使用 Supabase 作為生產資料庫
2. 透過 Prisma Studio 管理資料
3. 測試登入功能
4. 部署到 Cloud Run

本地資料庫資料仍保留，未受影響。
