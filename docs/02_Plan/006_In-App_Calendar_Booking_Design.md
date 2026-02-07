# Zentropy 內建 Calendar Booking 功能設計

**適用平台**：Flutter App + Next.js Web（跨平台統一體驗）

## 1. 核心價值主張 (Value Proposition)

### 1.1 問題定義

**痛點**：在處理營運任務時，頻繁需要安排會議或設定提醒，但現有流程需要「上下文切換」：

```
Zentropy (處理任務) → Google Calendar (查空檔) → 創建會議 → 回到 Zentropy
   ↑                                                           ↓
   └─────────────────── 認知負擔 + 時間浪費 ───────────────────┘
```

### 1.2 解決方案

**在 Zentropy 內直接完成 Calendar 操作**，提供「快速通道」（App + Web 雙平台）：

| 功能 | 使用者價值 | 平台支援 |
|------|----------|---------|
| **即時空檔查看** | 不用切換到 Calendar 查看可用時間 | ✅ App + ✅ Web |
| **快速建立會議** | 一鍵創建 Event + 自動生成 Meet 連結 | ✅ App + ✅ Web |
| **靈活提醒方式** | 可選 Google Calendar 提醒或 App 本地通知 | ✅ App + ⚠️ Web（只支援 Calendar 提醒） |
| **與任務關聯** | 會議可連結到具體的 Zentropy Task | ✅ App + ✅ Web |

---

## 2. 功能規格 (Feature Specifications)

### 2.1 功能一：即時空檔查看 (Free/Busy Query)

#### 使用場景
```
用戶在處理「Backend System」任務
→ 點擊「安排會議」
→ 系統顯示：
   ✅ 週三 14:00-15:00 可用
   ✅ 週三 16:00-17:00 可用
   ❌ 週四 10:00-11:00 已有會議（團隊週會）
```

#### UI 設計

```
┌─────────────────────────────────────────────────────────┐
│  安排會議 - 選擇時間                                      │
├─────────────────────────────────────────────────────────┤
│  📅 本週空檔                                             │
│                                                         │
│  週三 2/12                                              │
│  ✅ 14:00-15:00  (1 小時)                               │
│  ✅ 16:00-17:30  (1.5 小時)                             │
│                                                         │
│  週四 2/13                                              │
│  ❌ 10:00-11:00  [已佔用] 團隊週會                       │
│  ✅ 14:00-16:00  (2 小時)                               │
│                                                         │
│  週五 2/14                                              │
│  ✅ 09:00-12:00  (3 小時)                               │
│  ✅ 14:00-17:00  (3 小時)                               │
├─────────────────────────────────────────────────────────┤
│  [選擇其他日期]  [取消]                                  │
└─────────────────────────────────────────────────────────┘
```

#### 技術實作要點

**Backend API**: `POST /api/calendar/free-busy`

**輸入**：使用者 ID、查詢時間範圍（如本週）

**處理流程**：
1. 獲取使用者的 Google OAuth Token
2. 呼叫 Google Calendar API `freebusy.query()` 查詢佔用時段
3. 計算可用時段（考慮工作時間 09:00-18:00）
4. 返回 available_slots（可用）和 busy_slots（已佔用）

**輸出**：
- 可用時段列表（日期、開始時間、結束時間、時長）
- 已佔用時段列表（包含會議標題，方便使用者辨識）

**平台支援**：✅ App + ✅ Web（共用同一 API）

---

### 2.2 功能二：快速建立會議 (Quick Event Creation)

#### 使用場景
```
用戶選擇「週三 14:00-15:00」
→ 輸入會議標題「客戶需求討論」
→ 選擇：
   • 自動生成 Google Meet 連結 ✅
   • 關聯到任務「Backend System - 需求分析」✅
→ 點擊「創建會議」
→ 完成！（自動回到任務視圖）
```

#### UI 設計

```
┌─────────────────────────────────────────────────────────┐
│  創建會議                                                │
├─────────────────────────────────────────────────────────┤
│  📅 時間：週三 2/12  14:00-15:00                         │
│                                                         │
│  📝 會議標題：                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 客戶需求討論                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  🔗 會議連結：                                           │
│  ☑️ 自動生成 Google Meet 連結                            │
│                                                         │
│  🔗 關聯任務（可選）：                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Backend System - 需求分析        [選擇任務]     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📧 邀請參與者（可選）：                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ client@example.com                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📝 備註（可選）：                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 討論新功能的技術規格                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [取消]                            [創建會議 →]         │
└─────────────────────────────────────────────────────────┘
```

#### 技術實作要點

**Backend API**: `POST /api/calendar/create-event`

**輸入**：
- 會議標題、時間（開始/結束）、時區
- 參與者 Email 列表（可選）
- 會議備註（可選）
- 是否自動生成 Google Meet 連結
- 關聯的 Zentropy Task ID（可選）

**處理流程**：
1. 獲取使用者的 Google OAuth Token
2. 呼叫 Google Calendar API `events.insert()` 創建會議
3. 設定 `conferenceDataVersion: 1` 啟用 Google Meet 自動生成
4. 從 API 回應中提取 Meet 連結
5. 在 Zentropy 資料庫儲存 Task-Event 關聯

**輸出**：
- Calendar Event ID
- Calendar Event 連結（可直接在 Google Calendar 開啟）
- Google Meet 連結（可直接加入會議）
- 創建時間

**關聯儲存**：
- 在 Event Description 中儲存 `[Zentropy Task: task-id]`
- 在 Zentropy 資料庫中儲存 Task → Event 的關聯
- 方便雙向查詢（從 Task 查 Event，或從 Event 查 Task）

**平台支援**：✅ App + ✅ Web（共用同一 API）

---

### 2.3 功能三：靈活提醒設定 (Flexible Reminder Options)

#### 使用場景
```
用戶設定任務「準備客戶簡報」的提醒
→ 選擇提醒方式：
   • Google Calendar 提醒（跨設備同步，出現在所有 Calendar 介面）
   • App 本地通知（只在手機，不污染 Calendar）
→ 選擇提醒時間：
   • 前一天 20:00
   • 當天早上 08:00
   • 自訂時間
```

#### UI 設計

```
┌─────────────────────────────────────────────────────────┐
│  設定提醒 - 準備客戶簡報                                  │
├─────────────────────────────────────────────────────────┤
│  📋 任務到期日：2026-02-15 (週五)                        │
│                                                         │
│  🔔 提醒方式：                                           │
│  ○ Google Calendar 提醒                                 │
│     └─ 跨設備同步，出現在所有 Calendar 介面              │
│  ● App 本地通知                                         │
│     └─ 只在手機提醒，不會在 Calendar 顯示                │
│                                                         │
│  ⏰ 提醒時間：                                           │
│  ☑️ 前一天 20:00  (2026-02-14 20:00)                    │
│  ☑️ 當天早上 08:00  (2026-02-15 08:00)                  │
│  ☐ 自訂時間                                             │
│     └─ [選擇日期時間]                                   │
│                                                         │
│  📝 提醒訊息（可選）：                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 記得帶筆電和簡報檔案                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [取消]                            [設定提醒 →]         │
└─────────────────────────────────────────────────────────┘
```

#### 兩種提醒方式的差異

| 特性 | Google Calendar 提醒 | App 本地通知 |
|------|---------------------|-------------|
| **跨設備同步** | ✅ 是（手機、電腦、網頁都會收到） | ❌ 否（只在手機） |
| **Calendar 顯示** | ✅ 會出現在 Google Calendar 介面 | ❌ 不會污染 Calendar |
| **提醒方式** | Calendar 原生通知 | App Push Notification |
| **適用場景** | 重要會議、Milestone | 個人任務、日常提醒 |
| **需要網路** | ✅ 是 | ❌ 否（離線也可以） |

#### 技術實作要點

**方式一：Google Calendar 提醒（App + Web 都支援）**

**Backend API**: `POST /api/reminders/create-calendar-reminder`

**處理流程**：
1. 在 Google Calendar 創建「提醒事件」（15 分鐘短事件）
2. 設定為「transparent」（不佔用時間，顯示為空閒）
3. 使用特殊顏色標記（淺灰色）與正常會議區分
4. Event Summary 格式：`🔔 提醒：{任務標題}`
5. 在 Description 中儲存 Zentropy Task ID

**優點**：
- ✅ 跨設備同步（手機、電腦、網頁都會收到）
- ✅ Web 端也能使用
- ✅ 與其他 Calendar 事件一起顯示

**方式二：App 本地通知（只有 App 支援）**

**技術棧**：
- Flutter: `flutter_local_notifications`
- iOS: Local Notification Framework
- Android: AlarmManager + Notification

**處理流程**：
1. 在 App 本地排程通知（不透過 Backend）
2. 儲存到本地資料庫（SQLite / Hive）
3. 到時間時系統自動觸發通知

**優點**：
- ✅ 不污染 Google Calendar
- ✅ 離線也能運作
- ✅ 更私密（不會同步到其他設備）

**限制**：
- ❌ Web 端無法使用（瀏覽器限制）
- ❌ 不跨設備同步

**平台支援總結**：

| 功能 | App | Web | 說明 |
|------|-----|-----|------|
| Google Calendar 提醒 | ✅ | ✅ | 推薦用於重要提醒 |
| App 本地通知 | ✅ | ❌ | Web 端只提供 Calendar 提醒選項 |

---

### 2.4 功能四：任務關聯會議 (Task-Event Linkage)

#### 使用場景
```
用戶查看任務「Backend System - 需求分析」
→ 看到關聯的會議：
   📅 週三 14:00-15:00  客戶需求討論
   🔗 Google Meet: https://meet.google.com/abc-defg-hij
→ 點擊可直接加入會議
```

#### Task Detail 顯示

```
┌─────────────────────────────────────────────────────────┐
│  Backend System - 需求分析                               │
├─────────────────────────────────────────────────────────┤
│  📋 狀態：Active                                         │
│  📅 到期日：2026-02-20                                   │
│  🏷️  產品：Backend System                                │
│                                                         │
│  ──────────────────────────────────────────────────     │
│                                                         │
│  🔗 關聯會議（1）                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📅 週三 2/12  14:00-15:00                        │   │
│  │ 客戶需求討論                                     │   │
│  │                                                 │   │
│  │ 🔗 [加入 Google Meet]                           │   │
│  │ 📧 參與者：client@example.com                   │   │
│  │                                                 │   │
│  │ [查看 Calendar] [編輯會議]                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ 安排新會議]                                          │
└─────────────────────────────────────────────────────────┘
```

#### 資料結構設計

**新增 Table：CalendarEvent**
- 儲存與 Zentropy Task 關聯的會議資訊
- 欄位：
  - `calendarEventId`: Google Calendar Event ID
  - `taskId`: 關聯的 Zentropy Task（可選）
  - `summary`, `description`: 會議標題與備註
  - `startDateTime`, `endDateTime`: 會議時間
  - `meetLink`: Google Meet 連結
  - `eventLink`: Google Calendar 事件連結

**新增 Table：ReminderConfig**
- 儲存提醒設定（支援 Calendar 提醒 + 本地通知）
- 欄位：
  - `taskId` 或 `calendarEventId`: 關聯的對象
  - `remindAt`: 提醒時間
  - `message`: 提醒訊息
  - `type`: 'CALENDAR' 或 'LOCAL_NOTIFICATION'
  - `notificationId`: App 本地通知 ID（僅 LOCAL 類型有值）

**關聯關係**：
- Task → CalendarEvent: 一對多（一個任務可以有多場相關會議）
- Task → ReminderConfig: 一對多（一個任務可以有多個提醒）
- CalendarEvent → ReminderConfig: 一對多（一場會議可以有多個提醒）

---

## 3. OAuth 授權架構 (OAuth Authorization Architecture)

### 3.1 核心設計原則：登入與授權分離

**關鍵概念**：
```
登入身份（Authentication）≠ 功能授權（Authorization）

【錯誤觀念】：
Apple ID 登入 → 只能用 Apple 功能 ❌

【正確觀念】：
Apple ID 登入 → 仍可授權 Google Calendar ✅
```

**設計優勢**：
- ✅ 登入方式不限制功能使用
- ✅ 支援多帳號（登入帳號 ≠ Calendar 帳號）
- ✅ 按需授權，減少初次登入摩擦

---

### 3.2 多登入方式下的授權流程

#### Scenario 1: Google Sign-In 登入

```
步驟 1: 使用者用 Google 登入 Zentropy
  → 系統請求：email, profile（基本權限）

步驟 2: 使用者首次使用「安排會議」功能
  → 系統檢測：尚未授權 Calendar 權限
  → 提示：「需要額外的 Calendar 權限」
  → 使用者授權
  → 完成！
```

**優點**：同一個 Google 帳號，但權限分階段請求

#### Scenario 2: Apple ID 登入

```
步驟 1: 使用者用 Apple ID 登入 Zentropy
  → 系統只需要 Apple ID（身份驗證）

步驟 2: 使用者首次使用「安排會議」功能
  → 系統檢測：尚未連接 Google Calendar
  → 顯示說明彈窗：「需要連接 Google Calendar」
  → 開啟獨立的 Google OAuth 流程
  → 使用者選擇 Google 帳號並授權
  → Token 儲存到資料庫
  → 完成！
```

**優點**：Apple ID 和 Google Calendar 可以是不同帳號

#### Scenario 3: Email/Password 登入

```
同 Scenario 2，首次使用 Calendar 功能時開啟 Google OAuth
```

---

### 3.3 資料庫設計

#### User Table（身份驗證）
```
User
├─ id (Primary Key)
├─ auth_provider: 'google' | 'apple' | 'email'
├─ email
├─ display_name
└─ created_at
```

#### OAuthToken Table（功能授權）
```
OAuthToken
├─ id (Primary Key)
├─ user_id (Foreign Key → User)
├─ provider: 'google_calendar' | 'google_drive' | ...
├─ access_token (加密儲存)
├─ refresh_token (加密儲存)
├─ expires_at
├─ scopes: ['calendar']
├─ authorized_email (授權的 Google 帳號)
└─ created_at / updated_at
```

**關鍵設計**：
- ✅ User 可以用 Apple ID 登入
- ✅ 同時在 OAuthToken 表儲存 Google Calendar Token
- ✅ 兩者完全獨立
- ✅ 支援多個 OAuth Provider（未來可擴展 Google Drive、Zoom 等）

---

### 3.4 OAuth 流程設計

#### 首次使用 Calendar 功能

```
User 點擊「安排會議」
    ↓
【檢查 OAuth Token】
    ↓
┌────────────────────────┐
│ 是否已有 Calendar Token? │
└───────┬────────────────┘
        │
   ┌────┴────┐
  有          沒有
   │          │
   ▼          ▼
直接使用   顯示授權說明彈窗
           │
           ▼
      ┌──────────────────┐
      │「Calendar 功能需要│
      │ 連接 Google」     │
      │                  │
      │ [連接] [稍後]    │
      └────────┬─────────┘
               ▼
      開啟 Google OAuth
      (只請求 Calendar)
               ↓
      使用者選擇 Google 帳號
               ↓
      Token 儲存到資料庫
               ↓
      回到「安排會議」流程
```

#### Backend API 設計

**檢查授權狀態**：
```
Endpoint: GET /api/oauth/status?provider=google_calendar

Response:
{
  "authorized": false,
  "provider": "google_calendar",
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "scopes_required": ["calendar"]
}
```

**OAuth Callback**：
```
Endpoint: GET /api/oauth/callback?code=xxx&state=yyy&provider=google_calendar

處理流程：
1. 驗證 state（防止 CSRF 攻擊）
2. 用 code 換取 access_token & refresh_token
3. 儲存到 OAuthToken 表（user_id + provider）
4. 重定向回 Zentropy (App: deep link / Web: redirect URL)
```

**Token 自動刷新**：
```
處理流程：
- Access Token 有效期 1 小時
- Backend 在 API 呼叫前檢查過期時間
- 如果即將過期，自動用 Refresh Token 更新
- 使用者無感知
```

---

### 3.5 使用者介面設計

#### 授權說明彈窗（首次使用）

```
┌─────────────────────────────────────────────────────────┐
│  🗓️ 連接 Google Calendar                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Calendar 功能需要連接你的 Google Calendar，用於：      │
│                                                         │
│  ✓ 查看可用時間（不用切換到 Calendar）                   │
│  ✓ 創建會議並自動生成 Google Meet 連結                   │
│  ✓ 設定會議提醒                                          │
│                                                         │
│  ℹ️  提示：                                              │
│  • 即使你使用 Apple ID 登入，仍可連接 Google Calendar    │
│  • 可以連接不同的 Google 帳號                            │
│                                                         │
│  🔒 隱私保護：                                           │
│  • 只讀取/寫入 Calendar 事件                             │
│  • 不會存取其他 Google 服務                              │
│  • 隨時可在設定中解除連接                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [稍後再說]                      [連接 Google Calendar] │
└─────────────────────────────────────────────────────────┘
```

**平台支援**：✅ App + ✅ Web

#### 設定頁面（授權管理）

```
┌─────────────────────────────────────────────────────────┐
│  設定 > 連接服務                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📱 登入方式                                             │
│  ├─ Apple ID (user@privaterelay.appleid.com)           │
│  └─ 已登入                                              │
│                                                         │
│  ──────────────────────────────────────────────────     │
│                                                         │
│  🔗 連接的服務                                           │
│                                                         │
│  📅 Google Calendar                                     │
│  ├─ 狀態：✅ 已連接                                     │
│  ├─ 帳號：work@gmail.com                                │
│  ├─ 權限：查看/編輯 Calendar 事件                        │
│  ├─ 授權時間：2026-02-07                                │
│  └─ [重新授權] [解除連接]                                │
│                                                         │
│  💾 Google Drive（未來功能）                             │
│  ├─ 狀態：❌ 未連接                                     │
│  ├─ 說明：用於儲存會議記錄與檔案                         │
│  └─ [連接]                                              │
│                                                         │
│  📹 Zoom（未來功能）                                     │
│  ├─ 狀態：❌ 未連接                                     │
│  └─ [連接]                                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**功能**：
- ✅ 查看所有已連接的服務
- ✅ 重新授權（Token 過期時）
- ✅ 解除連接（撤銷授權）
- ✅ 顯示授權的 Google 帳號（可能與登入帳號不同）

**平台支援**：✅ App + ✅ Web

---

### 3.6 Token 管理策略

#### 自動刷新機制

| 情況 | 處理方式 |
|------|---------|
| **Token 即將過期** | Backend 自動用 Refresh Token 更新 Access Token |
| **Refresh Token 有效** | 無縫刷新，使用者無感知 |
| **Refresh Token 失效** | 提示使用者「授權已過期，請重新連接」 |
| **使用者撤銷授權** | 下次使用時提示重新授權 |

#### 錯誤處理

```
Calendar API 呼叫失敗
    ↓
【判斷錯誤類型】
    ↓
┌──────────────────────────────────────┐
│ 401 Unauthorized (Token 失效)        │
│ → 嘗試自動刷新 Token                 │
│ → 如果刷新失敗 → 提示重新授權        │
├──────────────────────────────────────┤
│ 403 Forbidden (使用者撤銷權限)       │
│ → 提示：「Calendar 授權已撤銷」      │
│ → 提供「重新授權」按鈕               │
├──────────────────────────────────────┤
│ 429 Rate Limit (API 限流)            │
│ → 提示：「請求過於頻繁，請稍後再試」 │
└──────────────────────────────────────┘
```

---

### 3.7 安全性考量

#### OAuth 安全實踐

| 安全措施 | 實作方式 |
|---------|---------|
| **CSRF 防護** | 使用 `state` 參數（隨機 UUID），Callback 時驗證 |
| **Token 加密** | Access Token 和 Refresh Token 加密後儲存 |
| **HTTPS Only** | 所有 OAuth 流程強制 HTTPS |
| **Scope 最小化** | 只請求必要的 `calendar` scope |
| **Token 過期管理** | 定期清理過期的 Token |

#### 隱私合規（GDPR / 個資法）

**使用者權利**：
- ✅ 明確告知授權用途（彈窗說明）
- ✅ 提供「解除連接」功能（設定頁面）
- ✅ 刪除帳號時一併刪除 OAuth Token
- ✅ 允許使用者匯出已授權的服務清單

**資料最小化**：
- ✅ 只儲存必要的 Token 和 Email
- ✅ 不儲存 Calendar 事件內容（即時讀取）
- ✅ Token 儲存時加密

---

### 3.8 多登入方式總結

| 登入方式 | Calendar 授權方式 | 技術實作 | 平台支援 |
|---------|-----------------|---------|---------|
| **Google Sign-In** | 首次使用時額外請求 Calendar 權限 | 同帳號，分階段授權 | ✅ App + ✅ Web |
| **Apple ID** | 首次使用時開啟獨立 Google OAuth | 獨立 OAuth 流程 | ✅ App + ✅ Web |
| **Email/Password** | 首次使用時開啟獨立 Google OAuth | 獨立 OAuth 流程 | ✅ App + ✅ Web |

**核心優勢**：
- ✅ 所有登入方式都能使用 Calendar 功能
- ✅ 登入帳號和 Calendar 帳號可以不同
- ✅ 按需授權，不強制連接
- ✅ 統一的授權體驗（App + Web）

---

## 4. 系統架構 (Technical Architecture)

### 4.1 整體架構圖

```
┌───────────────────────────────────────────────────────────────────┐
│  Frontend (Flutter App / Next.js Web) ← 跨平台統一體驗            │
├───────────────────────────────────────────────────────────────────┤
│  • 即時空檔查看介面（響應式設計）                                  │
│  • 快速建立會議表單                                                │
│  • 提醒設定介面（App: Calendar + Local / Web: 只 Calendar）      │
│  • 任務-會議關聯顯示                                               │
└───────────────────┬───────────────────────────────────────────────┘
                    ▼ (RESTful API / GraphQL)
┌───────────────────────────────────────────────────────────────────┐
│  Backend API (統一 API Layer)                                      │
├───────────────────────────────────────────────────────────────────┤
│  Service 1: CalendarFreeBusyService                                │
│  Service 2: CalendarEventService                                   │
│  Service 3: ReminderService                                        │
│  Service 4: TaskEventLinkageService                                │
└───────────────────┬───────────────────────────────────────────────┘
                    ▼ (Google Calendar API)
┌───────────────────────────────────────────────────────────────────┐
│  Google Calendar API                                               │
│  • freebusy.query(), events.insert(), conferenceData               │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 資料流設計

#### 流程 1: 查詢空檔 → 創建會議

```
User Action: 點擊「安排會議」
    ↓
Frontend: 呼叫 /api/calendar/free-busy
    ↓
Backend:
  1. 獲取 User OAuth Token
  2. 呼叫 Google Calendar API freebusy.query()
  3. 解析 busy 時段
  4. 計算 available 時段（考慮工作時間 09:00-18:00）
    ↓
Frontend: 顯示可用時段列表
    ↓
User: 選擇時段 + 輸入會議資訊
    ↓
Frontend: 呼叫 /api/calendar/create-event
    ↓
Backend:
  1. 呼叫 Google Calendar API events.insert()
  2. 設定 conferenceDataVersion: 1（啟用 Google Meet）
  3. 獲取 event.hangoutLink（Meet 連結）
  4. 儲存 Task-Event 關聯到 Prisma
    ↓
Frontend: 顯示成功訊息 + Meet 連結
```

---

## 5. UI/UX 設計 (User Experience)

### 4.1 入口點設計

#### 入口 1: 任務詳情頁
```
┌─────────────────────────────────────────────────────────┐
│  Backend System - 需求分析                               │
│  ...                                                    │
│  [編輯]  [歸檔]  [+ 安排會議]  [設定提醒]               │
└─────────────────────────────────────────────────────────┘
```

#### 入口 2: 快速操作選單（長按任務）
```
┌─────────────────────────────────────────────────────────┐
│  快速操作                                                │
│  • 編輯任務                                              │
│  • 設定提醒                                              │
│  • 安排會議 ← 新增                                       │
│  • 移至 Archive                                          │
└─────────────────────────────────────────────────────────┘
```

#### 入口 3: Dashboard 快捷按鈕
```
┌─────────────────────────────────────────────────────────┐
│  今日概況                                                │
│  📋 3 個任務到期                                         │
│  📅 4 小時會議                                           │
│  [+ 快速安排會議]                                        │
└─────────────────────────────────────────────────────────┘
```

### 4.2 互動流程設計

#### 完整流程：從任務到會議

```
Step 1: 任務詳情頁
  User 點擊「安排會議」
    ↓
Step 2: 選擇時間（自動載入空檔）
  顯示「本週空檔」
  User 選擇「週三 14:00-15:00」
    ↓
Step 3: 填寫會議資訊
  • 會議標題（必填）
  • 自動生成 Meet 連結 ✅（預設勾選）
  • 邀請參與者（可選）
  • 備註（可選）
  User 點擊「創建會議」
    ↓
Step 4: 創建成功
  顯示 Toast：
  「✅ 會議已創建
   🔗 Google Meet: [複製連結]
   📅 已同步至 Google Calendar」
    ↓
Step 5: 自動返回任務詳情
  顯示關聯的會議卡片
```

### 4.3 錯誤處理與 Edge Cases

| 情況 | 錯誤處理 |
|------|---------|
| **OAuth Token 過期** | 自動嘗試 Refresh Token；失敗則提示重新授權 |
| **選擇的時段已被佔用** | 提示：「此時段已被佔用，請重新選擇」+ 自動刷新空檔列表 |
| **Google Calendar API 限流** | 顯示：「Calendar 同步中，請稍後再試」 |
| **無網路連線** | 提示：「需要網路連線才能創建會議」；本地通知不受影響 |
| **Meet 連結生成失敗** | 仍創建 Event，但提示：「Meet 連結生成失敗，請手動添加」 |

---

## 6. 實作階段規劃 (Implementation Phases)

### Phase 0: OAuth 授權基礎建設（前置作業）
**時程**：1 週
**優先級**：🔴 最高（所有功能的基礎）

**Backend 任務**：
- [ ] 實作 OAuthToken 資料表
- [ ] 實作 `/api/oauth/status` API（檢查授權狀態）
- [ ] 實作 `/api/oauth/callback` API（處理 OAuth 回調）
- [ ] 實作 Token 自動刷新機制
- [ ] 實作 Token 加密儲存

**Frontend 任務**：
- [ ] 授權說明彈窗 UI（App + Web）
- [ ] Google OAuth 流程整合（App: google_sign_in / Web: OAuth 2.0）
- [ ] 設定頁面「連接服務」功能

**測試**：
- [ ] 測試 Google/Apple/Email 登入後的 OAuth 流程
- [ ] 測試 Token 刷新機制
- [ ] 測試「解除連接」功能

---


### Phase 1: 即時空檔查看（MVP）
**時程**：2 週
**平台**：✅ App + ✅ Web

**Backend 任務**：
- [ ] 實作 `/api/calendar/free-busy` API
- [ ] Google Calendar API `freebusy.query()` 整合
- [ ] 空檔計算邏輯（工作時間 09:00-18:00）
- [ ] 時區處理

**Frontend 任務**：
- [ ] 「選擇時間」介面（響應式設計）
- [ ] 週視圖顯示可用/佔用時段
- [ ] 載入狀態與錯誤處理

### Phase 2: 快速建立會議
**時程**：2 週
**平台**：✅ App + ✅ Web

**Backend 任務**：
- [ ] 實作 `/api/calendar/create-event` API
- [ ] Google Meet 自動生成（`conferenceData`）
- [ ] Task-Event 關聯儲存
- [ ] 參與者 Email 驗證

**Frontend 任務**：
- [ ] 會議建立表單（標題、時間、參與者）
- [ ] Meet 連結顯示與複製功能
- [ ] 任務詳情頁顯示關聯會議

### Phase 3: 靈活提醒設定
**時程**：2 週
**平台**：✅ App（完整）+ ⚠️ Web（只 Calendar 提醒）

**Backend 任務**：
- [ ] 實作 ReminderService（Calendar 提醒）
- [ ] 提醒事件創建邏輯

**App 任務**：
- [ ] 提醒設定 UI（Calendar vs Local 選項）
- [ ] 本地通知排程（iOS + Android）
- [ ] 通知權限請求流程

**Web 任務**：
- [ ] 提醒設定 UI（只 Calendar 選項）
- [ ] 說明：「Web 版只支援 Calendar 提醒」

### Phase 4: 進階功能（Optional）
**時程**：2 週

- [ ] 會議範本（1-on-1、團隊週會等）
- [ ] AI 智慧時間建議
- [ ] Zoom 整合（可選）

---

## 7. 測試策略 (Testing Strategy)

### 6.1 單元測試重點

**CalendarFreeBusyService**：
- 測試空檔時間計算邏輯
- 測試工作時間邊界（09:00-18:00）
- 測試時區處理

**CalendarEventService**：
- 測試 Google Meet 連結生成
- 測試 Task-Event 關聯儲存
- 測試參與者 Email 格式驗證

**ReminderService**：
- 測試 Calendar 提醒創建
- 測試本地通知排程（僅 App）
- 測試提醒時間計算

### 6.2 整合測試重點

**E2E 測試流程**：
1. 查詢空檔時間 → 創建會議 → 驗證 Meet 連結
2. 創建會議 → 關聯到 Task → 查詢 Task 顯示會議資訊
3. 設定提醒 → 驗證 Calendar Event 創建 / 本地通知排程

**跨平台測試**：
- ✅ App（iOS + Android）：完整功能測試
- ✅ Web（Chrome + Safari）：Calendar 功能測試（排除本地通知）
- ✅ 響應式設計測試（手機/平板/桌面）

### 6.3 關鍵測試案例

| 測試項目 | 預期結果 |
|---------|---------|
| 創建帶 Meet 連結的會議 | 回應包含 `meet.google.com` 連結 |
| Task-Event 關聯 | 在 Task 詳情頁顯示會議卡片 |
| Calendar 提醒創建 | Google Calendar 顯示提醒事件 |
| 本地通知（僅 App） | 到時間時觸發系統通知 |
| OAuth Token 過期 | 自動 Refresh 或提示重新授權 |
| 時段已佔用 | 提示錯誤並刷新空檔列表 |

---

## 8. 隱私與權限 (Privacy & Permissions)

### 7.1 OAuth Scope 最小化

**請求權限**：
- `https://www.googleapis.com/auth/calendar` - 完整 Calendar 權限（需創建/編輯事件）

**向使用者說明**（App + Web 統一文案）：
```
Zentropy 需要存取你的 Google Calendar 來：
 ✓ 查看可用時間
 ✓ 創建會議並自動生成 Google Meet 連結
 ✓ 設定會議提醒
```

**隱私承諾**：
- ✅ 只讀取/寫入必要的 Calendar 事件
- ✅ 不會讀取其他 Google 服務的資料
- ✅ Token 加密儲存，不會分享給第三方

### 7.2 資料保留策略

| 資料類型 | 儲存位置 | 保留期限 | 說明 |
|---------|---------|---------|------|
| **Calendar Event ID** | Firestore | 永久 | 用於 Task-Event 關聯 |
| **Meet 連結** | Firestore | 永久 | 方便快速加入會議 |
| **Free/Busy 查詢結果** | ❌ 不儲存 | N/A | 即時查詢，不快取 |
| **本地通知設定** | Local Storage | 永久 | 用戶刪除任務時一併清除 |

---

## 9. 成功指標 (Success Metrics)

| 指標 | 目標 | 測量方式 |
|------|------|----------|
| **減少上下文切換** | 使用者在安排會議時不離開 Zentropy 的比例 > 80% | 事件追蹤 |
| **會議創建成功率** | > 95% | API 成功率監控 |
| **Meet 連結生成成功率** | > 90% | Google Calendar API 回應監控 |
| **提醒送達率** | > 99% | 本地通知 + Calendar 提醒追蹤 |
| **用戶滿意度** | NPS > 8 | 用戶問卷 |

---

## 10. 未來擴展方向 (Future Enhancements)

### 9.1 多平台會議整合

| 平台 | 整合方式 | 價值 |
|------|---------|------|
| **Zoom** | Zoom API | 自動生成 Zoom Meeting 連結 |
| **Microsoft Teams** | Graph API | 支援 Microsoft 365 用戶 |
| **Webex** | Webex API | 企業級會議整合 |

### 9.2 AI 智慧排程

- **最佳時間建議**：AI 分析團隊成員的空檔，建議最佳會議時間
- **會議準備提醒**：根據會議類型，提醒需要準備的資料
- **會議效率分析**：追蹤會議時數，建議優化空間

### 9.3 會議記錄整合

- **自動會議記錄**：整合 Google Meet 錄影
- **會議摘要**：AI 生成會議重點摘要
- **行動項目追蹤**：將會議中的 Action Items 自動轉為 Zentropy Tasks

---

## 11. 參考資料 (References)

- [Google Calendar API - Events](https://developers.google.com/calendar/api/v3/reference/events)
- [Google Calendar API - FreeBusy](https://developers.google.com/calendar/api/v3/reference/freebusy)
- [Google Meet Conference Data](https://developers.google.com/calendar/api/guides/create-events#conferencing)
- [Flutter Local Notifications](https://pub.dev/packages/flutter_local_notifications)
- [Zentropy Calendar Integration Strategy](./005_Google_Calendar_Integration_Strategy.md)

---

## 12. 決策記錄 (Decision Log)

| 日期 | 決策 | 理由 |
|------|------|------|
| 2026-02-07 | 在 Zentropy 內建 Calendar Booking 功能 | 減少上下文切換，提升 UX |
| 2026-02-07 | 支援 Google Calendar 提醒 + App 本地通知兩種方式 | 給用戶靈活選擇（跨設備 vs 隱私） |
| 2026-02-07 | 自動生成 Google Meet 連結 | 簡化會議創建流程 |
| 2026-02-07 | Task-Event 關聯儲存在 Prisma | 方便查詢與管理 |
| 2026-02-07 | Free/Busy 查詢結果不快取 | 確保資料即時性，降低隱私風險 |
| 2026-02-07 | **採用「登入與授權分離」架構** | 支援多種登入方式（Google/Apple/Email）都能使用 Calendar 功能 |
| 2026-02-07 | **按需授權 Google Calendar**（首次使用時才請求） | 減少初次登入摩擦，不強制連接 |
| 2026-02-07 | **OAuthToken 獨立表儲存**（與 User 表分離） | 支援多個 OAuth Provider（未來可擴展 Drive、Zoom） |
| 2026-02-07 | **Apple ID 使用者可連接不同的 Google 帳號** | 登入帳號和功能授權帳號解耦 |
