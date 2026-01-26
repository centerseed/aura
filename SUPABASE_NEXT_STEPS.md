# Supabase 連接問題解決步驟

## 🔍 問題診斷

根據截圖，你的 Supabase 專案顯示 **"Not IPv4 compatible"**，這表示 Direct connection 不支援 IPv4 網路。

錯誤訊息 "Tenant or user not found" 表示專案 reference 或區域可能不匹配。

## ✅ 請按照以下步驟操作

### 步驟 1: 點擊 "Pooler settings"

在截圖中的 **"Pooler settings"** 按鈕，點擊後應該會顯示：
- Session Pooler 連接字串
- Transaction Pooler 連接字串

### 步驟 2: 複製 Session Pooler 連接字串

Session Pooler 的格式應該類似：

```
postgresql://postgres:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

**重要**：
- 主機名稱應該是 `aws-0-[region].pooler.supabase.com`
- 端口是 `5432`（Session mode）
- **不是** `db.jeatbzmznavvjkwilsyn.supabase.co`

### 步驟 3: 確認專案區域

在 Supabase Dashboard 的 Project Settings 中確認你的專案區域：

| 區域名稱 | 區域代碼 | Pooler 主機名稱 |
|---------|---------|----------------|
| Southeast Asia (Singapore) | ap-southeast-1 | aws-0-ap-southeast-1.pooler.supabase.com |
| Northeast Asia (Tokyo) | ap-northeast-1 | aws-0-ap-northeast-1.pooler.supabase.com |
| Northeast Asia (Seoul) | ap-northeast-2 | aws-0-ap-northeast-2.pooler.supabase.com |
| US East (N. Virginia) | us-east-1 | aws-0-us-east-1.pooler.supabase.com |

### 步驟 4: 提供完整的 Pooler 連接字串

請從 "Pooler settings" 中複製**完整的 Session Pooler 連接字串**，包括：
- 主機名稱
- 端口
- 所有參數

應該類似這樣：
```
postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

## 📸 需要的資訊

請提供以下資訊截圖或文字：

1. **點擊 "Pooler settings" 後顯示的連接字串**
2. **專案區域**（在 Project Settings → General 中）
3. **專案 Reference ID**（通常在 URL 中：`supabase.com/project/xxxxx`）

## 🔧 替代方案：使用 IPv4 Add-on

如果你需要使用 Direct connection，可以：
1. 點擊截圖中的 "IPv4 add-on" 按鈕
2. 購買 IPv4 支援（可能需要付費）

但使用 **Session Pooler** 是免費且推薦的方案。

## 📝 提供資訊後我會

一旦你提供正確的 Pooler 連接字串，我會：
1. 更新 `.env.local`
2. 測試連接
3. 同步 Prisma schema
4. 啟用 pgvector 擴充套件（如需要）
5. 驗證一切正常運作

## 💡 快速測試

如果你能在 Supabase SQL Editor 中執行以下查詢，表示資料庫是正常的：

```sql
SELECT version();
```

這樣我們就知道問題只是連接字串格式的問題。
