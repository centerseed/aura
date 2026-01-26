# Supabase 設定指南

## 1. 在 Supabase 建立專案

1. 前往 [Supabase Dashboard](https://app.supabase.com)
2. 建立新專案
3. 設定專案名稱：`zentropy`
4. 選擇區域：建議選擇 `Northeast Asia (Tokyo)` 或最接近的區域
5. 設定資料庫密碼（請記住這個密碼）

## 2. 取得連接資訊

在 Supabase Dashboard 中：

### Settings → Database

找到 **Connection String** 區域，你會看到：

#### Connection Pooling (推薦用於 Serverless/Cloud Run)
```
postgresql://postgres.xxxxx:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

#### Direct Connection (用於本地開發)
```
postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

## 3. 啟用 pgvector 擴充套件

在 Supabase Dashboard：

1. 前往 **Database** → **Extensions**
2. 搜尋 `vector`
3. 啟用 `vector` 擴充套件

或使用 SQL Editor：
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 4. 設定環境變數

### 本地開發 (`.env.local`)

```bash
# Supabase Database (Direct Connection)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Supabase API (可選 - 如果要使用 Supabase Auth/Storage)
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### 生產環境 (Cloud Run)

使用 Connection Pooling（更適合 serverless）：

```bash
# Supabase Database (Connection Pooling)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

## 5. 更新 Prisma Schema

Prisma schema 已經配置好，無需修改。確認 `datasource db` 使用環境變數：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## 6. 同步資料庫 Schema

```bash
cd web
npm run db:push
```

這會將 Prisma schema 同步到 Supabase 資料庫。

## 7. 驗證連接

在 Supabase SQL Editor 執行：

```sql
-- 檢查擴充套件
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 檢查資料表
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- 檢查使用者資料表結構
\d users
```

## 8. Supabase vs Firebase Auth

### 目前架構
我們使用 **Firebase Authentication** 處理使用者登入，使用 **Supabase** 作為資料庫。

### 認證流程
1. 使用者透過 Firebase Auth 登入（Google/匿名/名稱）
2. 前端取得 Firebase UID
3. 後端將認證資訊存入 Supabase 資料庫
4. 業務資料（Areas, Products, Tasks）全部存在 Supabase

### 為什麼不使用 Supabase Auth？
- Firebase Auth UI 更成熟，支援更多登入方式
- 可以輕鬆整合 Google Sign-In
- 未來如需遷移到 Supabase Auth 也很簡單

## 9. Cloud Run 環境變數設定

```bash
gcloud run services update zentropy-web \
  --update-env-vars DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  --update-env-vars GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-key" \
  --region asia-east1

gcloud run services update zentropy-backend \
  --update-env-vars DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  --update-env-vars GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-key" \
  --region asia-east1
```

## 10. Supabase 優勢

✅ **免費額度**
- 500 MB 資料庫空間
- 1 GB 檔案儲存
- 2 GB 頻寬/月
- 無限 API 請求

✅ **內建功能**
- PostgreSQL 14+
- pgvector 向量搜尋
- 自動備份
- 即時訂閱（Realtime）
- Row Level Security

✅ **開發體驗**
- SQL Editor
- Table Editor
- 資料庫視覺化
- API 自動生成

## 11. 連接字串格式說明

### Direct Connection
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```
- 適合：本地開發、長時間連接
- 限制：最多 60 個同時連接

### Connection Pooling
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
- 適合：Serverless、Cloud Run、高併發
- 優勢：無連接數限制
- 注意：使用 port 6543（不是 5432）

## 12. 故障排除

### 連接失敗
- 檢查密碼是否正確
- 確認已啟用 pgvector 擴充套件
- 檢查防火牆規則（Supabase 預設允許所有 IP）

### Prisma 錯誤
```bash
# 重新生成 Prisma Client
npm run db:generate

# 重新同步 schema
npm run db:push
```

### 查看連接資訊
Supabase Dashboard → Settings → Database → Connection info

## 13. 遷移現有資料

如果你有現有的本地資料需要遷移：

```bash
# 1. 匯出本地資料
pg_dump -h localhost -U naruvia -d naruvia_db > backup.sql

# 2. 匯入到 Supabase
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < backup.sql
```

## 14. 監控與日誌

Supabase Dashboard 提供：
- 資料庫使用量
- API 請求統計
- 查詢效能分析
- 即時連接數

## 需要的資訊清單

請從 Supabase Dashboard 取得以下資訊：

- [ ] Project Reference (專案 ID)
- [ ] Database Password
- [ ] Connection String (Direct)
- [ ] Connection String (Pooling)
- [ ] Supabase URL（可選）
- [ ] Anon Key（可選）

準備好後，更新 `web/.env.local` 檔案即可！
