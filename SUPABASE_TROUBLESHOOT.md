# Supabase 連接問題排查

## 🔍 當前問題
無法解析主機名稱：`db.jeatbzmznavvjkwilsyn.supabase.co`

## ✅ 請確認以下步驟

### 1. 確認 Supabase 專案狀態
前往 [Supabase Dashboard](https://app.supabase.com)
- 專案是否顯示為 **Active** 狀態？
- 專案是否完成建立？（通常需要 2-5 分鐘）

### 2. 重新複製正確的連接字串

在 Supabase Dashboard：

```
專案首頁 → Project Settings (左下角齒輪圖標)
→ Database (左側選單)
→ Connection string 區塊
```

#### 請選擇並複製以下其中一種：

**選項 A：URI (推薦 - 用於本地開發)**
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
⚠️ **注意**: 這裡使用 `postgres.[PROJECT-REF]` 格式（中間有點），不是 `db.[PROJECT-REF]`

**選項 B：Session mode**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### 3. 常見的連接字串格式

Supabase 提供幾種不同的連接模式：

| 模式 | 主機名稱格式 | Port | 用途 |
|------|------------|------|------|
| **Transaction mode** (推薦) | `aws-0-[region].pooler.supabase.com` | 6543 | Serverless/Cloud Run |
| **Session mode** | `db.[project-ref].supabase.co` | 5432 | 長時間連接 |
| **Direct connection** | `db.[project-ref].supabase.co` | 5432 | 本地開發 |

### 4. 檢查專案區域

不同區域的連接字串可能不同：

- **Southeast Asia (Singapore)**: `aws-0-ap-southeast-1.pooler.supabase.com`
- **Northeast Asia (Tokyo)**: `aws-0-ap-northeast-1.pooler.supabase.com`
- **East Asia (Seoul)**: `aws-0-ap-northeast-2.pooler.supabase.com`
- **US East**: `aws-0-us-east-1.pooler.supabase.com`

### 5. 密碼格式

確認密碼中是否包含特殊字元，如果有需要 URL encode：
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `&` → `%26`

你的密碼 `REDACTED_DB_PASSWORD` 看起來沒有特殊字元，應該可以直接使用。

## 🎯 建議的測試步驟

### 步驟 1: 確認連接字串
在 Supabase Dashboard → Settings → Database，找到 **Connection string** 區塊，**完整複製** URI 或 Session mode 的連接字串。

### 步驟 2: 測試連接
如果你有 `psql` 工具，可以直接測試：
```bash
psql "postgresql://postgres:REDACTED_DB_PASSWORD@[正確的主機名稱]:5432/postgres"
```

### 步驟 3: 更新環境變數
確認後，更新 `.env.local`：
```bash
DATABASE_URL="[從 Supabase 複製的完整連接字串]"
```

### 步驟 4: 同步資料庫
```bash
npx prisma db push
```

## 🔧 可能的解決方案

### 方案 A: 使用 Transaction Mode (推薦)
```env
DATABASE_URL="postgresql://postgres.jeatbzmznavvjkwilsyn:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```
⚠️ 注意格式：`postgres.jeatbzmznavvjkwilsyn` (不是 `postgres:password@db.xxx`)

### 方案 B: 等待專案完全啟動
Supabase 專案建立可能需要幾分鐘時間。請稍等 5-10 分鐘後再試。

### 方案 C: 檢查 Supabase 儀表板
1. 確認專案狀態為 **Healthy**
2. 確認 **Database** 標籤可以正常開啟
3. 確認可以看到 **Table Editor**

## 📝 請提供給我的資訊

為了幫你解決問題，請確認：

1. **Supabase Dashboard 中顯示的完整連接字串是什麼？**
   - Settings → Database → Connection string
   - 複製 **URI** 或 **Session mode** 的完整字串

2. **專案區域是哪裡？**
   - Project Settings 中會顯示區域（例如：Singapore, Tokyo）

3. **專案狀態是否為 Active？**
   - 首頁是否顯示綠色的 "Healthy" 狀態

4. **是否可以在 Supabase SQL Editor 中執行查詢？**
   - 測試執行：`SELECT version();`

提供這些資訊後，我可以幫你正確設定連接！
