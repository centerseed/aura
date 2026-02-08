# Google OAuth 設定指南

本文件說明如何設定 Google OAuth 2.0，用於 Zentropy 的 Calendar 功能。

## 📋 前置需求

- Google Cloud Platform 帳號
- Zentropy Backend 已部署或本地運行

---

## 🔧 設定步驟

### 步驟 1: 創建 Google Cloud Project

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊「Select a project」→「New Project」
3. 輸入專案名稱：`Zentropy` 或自訂名稱
4. 點擊「Create」

### 步驟 2: 啟用 Google Calendar API

1. 在 Google Cloud Console，前往「APIs & Services」→「Library」
2. 搜尋「Google Calendar API」
3. 點擊「Enable」

### 步驟 3: 設定 OAuth Consent Screen

1. 前往「APIs & Services」→「OAuth consent screen」
2. 選擇 User Type：
   - **Internal**（如果只有組織內部使用）
   - **External**（如果要對外開放）
3. 填寫必填欄位：
   - **App name**: Zentropy
   - **User support email**: 你的 Email
   - **Developer contact information**: 你的 Email
4. 點擊「Save and Continue」

5. **Scopes**（設定權限範圍）：
   - 點擊「Add or Remove Scopes」
   - 搜尋並勾選：`https://www.googleapis.com/auth/calendar`
   - 點擊「Update」→「Save and Continue」

6. **Test users**（如果選擇 External）：
   - 點擊「Add Users」
   - 輸入測試用戶的 Email（你自己的 Google 帳號）
   - 點擊「Save and Continue」

### 步驟 4: 創建 OAuth 2.0 Credentials

1. 前往「APIs & Services」→「Credentials」
2. 點擊「Create Credentials」→「OAuth client ID」
3. 選擇 Application type：**Web application**
4. 填寫資訊：
   - **Name**: Zentropy Web
   - **Authorized JavaScript origins**（可選）:
     - `http://localhost:3000` (本地開發)
     - `https://your-domain.com` (生產環境)
   - **Authorized redirect URIs**（重要）:
     - `http://localhost:3002/api/oauth/callback` (本地開發)
     - `https://api.your-domain.com/api/oauth/callback` (生產環境)
5. 點擊「Create」
6. 複製 **Client ID** 和 **Client Secret**

### 步驟 5: 設定環境變數

在 Zentropy Backend 專案中，編輯 `.env` 檔案：

```bash
# Google OAuth (Calendar & Drive)
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="http://localhost:3002/api/oauth/callback"

# 生成一個隨機的 64 字元 Hex 字串作為加密密鑰
OAUTH_ENCRYPTION_KEY="generate-a-random-64-char-hex-string-here"

# Frontend URL (用於 OAuth callback 後的重定向)
NEXT_PUBLIC_FRONTEND_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3002"
```

**生成 OAUTH_ENCRYPTION_KEY**：
```bash
# 在終端機執行（macOS / Linux）
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 步驟 6: 執行資料庫 Migration

```bash
cd api

# 生成 Prisma Client
npm run prisma:generate

# 創建 Migration
npx prisma migrate dev --name add_oauth_token_table

# 執行 Migration
npm run prisma:migrate
```

### 步驟 7: 設定 Frontend 環境變數

在 Zentropy Web 專案中，編輯 `.env.local` 檔案：

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3002

# Firebase Authentication（與 Backend 共用同一個 Firebase Project）
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

**注意**: Frontend 不需要 OAuth Client Secret，所有 OAuth 流程由 Backend 處理。

### 步驟 8: 重啟 Backend 和 Frontend

```bash
# Backend
cd api
npm run dev

# Frontend
cd web
npm run dev
```

---

## ✅ 測試 OAuth 流程

### 方法 1: 使用 Frontend UI（推薦）

1. **前往設定頁面**：
   - 開啟 http://localhost:3000
   - 登入 Zentropy（使用 Google、Email 或訪客模式）
   - 前往 Settings 頁面（右上角頭像 → 設定）

2. **連接 Google Calendar**：
   - 在「連接服務」卡片中找到「Google Calendar」
   - 點擊「連接」按鈕
   - 閱讀授權說明對話框
   - 點擊「連接 Google Calendar」按鈕

3. **完成 Google 授權**：
   - 會開啟 Google OAuth 授權頁面（popup 視窗）
   - 選擇你的 Google 帳號
   - 點擊「允許」授予 Calendar 權限
   - Popup 會自動關閉，Settings 頁面會顯示「已連接」

4. **驗證連接狀態**：
   - 應該看到綠色的「已連接」Badge
   - 顯示授權的 Email 帳號
   - 可以點擊「解除連接」測試撤銷功能

### 方法 2: 使用 API 測試（開發調試）

#### 1. 檢查授權狀態

```bash
curl -X GET "http://localhost:3002/api/oauth/status?provider=google_calendar" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

預期回應（未授權）：
```json
{
  "authorized": false,
  "provider": "google_calendar",
  "authorized_email": null,
  "scopes": [],
  "expires_at": null,
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### 2. 開始 OAuth 授權

在瀏覽器中開啟：
```
http://localhost:3002/api/oauth/authorize?provider=google_calendar
```

（需要先登入 Zentropy 並帶上 Firebase Token）

#### 3. 授權成功後

會重定向回：
```
http://localhost:3000/settings?oauth_success=true&provider=google_calendar
```

#### 4. 再次檢查授權狀態

應該會看到：
```json
{
  "authorized": true,
  "provider": "google_calendar",
  "authorized_email": "user@gmail.com",
  "scopes": ["https://www.googleapis.com/auth/calendar"],
  "expires_at": "2026-02-08T10:30:00Z",
  "auth_url": null
}
```

---

## 🔒 安全性注意事項

### 1. 環境變數保護

**絕對不要將以下資訊 commit 到 Git**：
- ❌ `GOOGLE_OAUTH_CLIENT_SECRET`
- ❌ `OAUTH_ENCRYPTION_KEY`
- ❌ 任何 `.env` 檔案（已被 `.gitignore` 排除）

### 2. Redirect URI 白名單

在 Google Cloud Console 中，只新增信任的 Redirect URI：
- ✅ 本地開發：`http://localhost:3002/api/oauth/callback`
- ✅ 生產環境：`https://api.your-domain.com/api/oauth/callback`
- ❌ 不要使用萬用字元（`*`）

### 3. HTTPS Only（生產環境）

生產環境必須使用 HTTPS：
- ✅ `https://api.your-domain.com`
- ❌ `http://api.your-domain.com`（不安全）

### 4. Token 加密

所有 OAuth Token 都以 AES-256-CBC 加密儲存在資料庫中。

---

## 🐛 常見問題

### Q1: 授權後顯示「redirect_uri_mismatch」錯誤

**原因**: Redirect URI 不在 Google Cloud Console 的白名單中。

**解決方案**：
1. 前往 Google Cloud Console → Credentials
2. 編輯 OAuth 2.0 Client
3. 確認「Authorized redirect URIs」包含你使用的 URI
4. 確保完全一致（包含 http/https、port、path）

### Q2: 無法取得 Refresh Token

**原因**: Google OAuth 只在首次授權時提供 Refresh Token。

**解決方案**：
1. 前往 https://myaccount.google.com/permissions
2. 撤銷 Zentropy 的授權
3. 重新執行 OAuth 流程
4. 或在 OAuth URL 中加上 `prompt=consent` 參數（已內建）

### Q3: Token 過期後無法自動刷新

**原因**: 可能沒有正確儲存 Refresh Token。

**檢查**：
```sql
SELECT refresh_token FROM oauth_tokens
WHERE user_id = 'your-user-id' AND provider = 'GOOGLE_CALENDAR';
```

如果 `refresh_token` 為 NULL，需要重新授權。

---

## 📚 相關文件

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [Zentropy Plan 006](../../docs/02_Plan/006_In-App_Calendar_Booking_Design.md)
