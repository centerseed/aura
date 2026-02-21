ㄌㄧㄥ# Stripe 付費服務架構計畫（Web Only）

**版本**: v1.0
**建立日期**: 2026-02-18
**狀態**: 🟡 Planning
**對應規格**: `docs/01_Specification/014_Paid_Service_Architecture_Spec.md`
**對應 Roadmap**: `040_Milestone_Development_Roadmap.md` M5.2

---

## 1. 範圍與目標

本計畫定義 Zentropy Web 端（Next.js）使用 **Stripe** 實作付費服務的完整架構與分階段實作路徑。

**不在本次範圍內**：
- App 端（IAP）— 未來另立計畫
- Nexus 方案付款 — 待 MCP 功能完成後
- 退款流程的客服工具

**目標**：

1. 用戶可從 Web 升級 Atom → Fusion（月付 / 年付）
2. 到期自動降級，超出限制資源進入只讀
3. 14 天免費試用（新用戶一次）
4. Feature Gate 防止 API 層的越權存取

---

## 2. 系統架構概觀

```
用戶瀏覽器
    │
    ├─ /pricing 頁面
    │    └─ 選擇方案 → POST /api/payment/create-checkout
    │
    ├─ Stripe Hosted Checkout（跳轉至 Stripe 頁面付款）
    │    └─ 付款完成 → 導回 /payment/success?session_id=xxx
    │
    └─ 設定頁 /settings/subscription
         └─ 查看方案、到期日、管理訂閱（Stripe Customer Portal）

後端（Next.js API Routes）
    │
    ├─ /api/payment/create-checkout   → 建立 Stripe Checkout Session
    ├─ /api/payment/portal            → 建立 Stripe Customer Portal Session
    ├─ /api/payment/webhook           → 接收 Stripe Webhook 事件
    └─ /api/subscription/status       → 查詢目前方案狀態

Stripe（第三方）
    │
    ├─ Checkout Session（付款頁）
    ├─ Customer Portal（用戶自助管理）
    ├─ Subscription（自動扣款訂閱）
    └─ Webhook → 回呼後端（事件驅動狀態更新）

資料庫（PostgreSQL / Prisma）
    │
    ├─ User 表：planType, stripeCustomerId, stripeSubEndAt, trialEndAt
    └─ Order 表：付款紀錄（審計用）

EntitlementService（核心業務邏輯）
    │
    ├─ isFusionActive(user) → 判斷用戶是否具備 Fusion 權限
    ├─ checkAiUsage(userId) → AI 用量檢查（Atom 50 次限制）
    └─ requirePlan(userId, plan) → API Feature Gate middleware
```

---

## 3. Stripe 產品設定

### 3.1 Product & Price 設定（Stripe Dashboard）

| 項目 | 設定值 |
|------|--------|
| Product 名稱 | Zentropy Fusion |
| Price 1 | $5.99 USD / month（月付，recurring） |
| Price 2 | $57.99 USD / year（年付，recurring） |
| Trial period | 14 天（在 Checkout Session 建立時設定） |
| Billing cycle anchor | 付款日起算 |

> Price ID 由 Stripe 生成，存入環境變數：
> `STRIPE_PRICE_MONTHLY=price_xxx`
> `STRIPE_PRICE_YEARLY=price_xxx`

### 3.2 Webhook 事件訂閱

| 事件 | 後端處理動作 |
|------|------------|
| `checkout.session.completed` | 建立 Order 紀錄，若是試用開始則記錄 trialEndAt |
| `customer.subscription.updated` | 更新 stripeSubEndAt（方案變更、試用轉正式） |
| `customer.subscription.deleted` | 設 stripeSubEndAt = now，觸發降級流程 |
| `invoice.payment_succeeded` | 更新 stripeSubEndAt（每次扣款成功） |
| `invoice.payment_failed` | 記錄失敗，第 3 次失敗後降級（Stripe Smart Retries 處理） |

---

## 4. 資料庫結構變更

### 4.1 User 表新增欄位

```
planType            PlanType  (ATOM | FUSION | NEXUS)  預設 ATOM
stripeCustomerId    String?   Stripe Customer ID
stripeSubId         String?   Stripe Subscription ID（用於 Portal 跳轉）
stripeSubEndAt      DateTime? 當前訂閱到期時間（月付 / 年付）
trialStartAt        DateTime? 試用開始時間
trialEndAt          DateTime? 試用到期時間（NULL 表示未使用過試用）
aiUsageCount        Int       本月 AI 用量（每月 1 日重置）
aiUsageResetAt      DateTime  上次重置時間
```

### 4.2 Order 表（新建）

用於審計，不作為方案判斷依據（方案狀態以 User 表為準）：

```
id              UUID
userId          UUID → User
stripeSessionId String  Stripe Checkout Session ID
planType        PlanType
billingPeriod   String  (monthly | yearly)
amount          Int     （USD cents）
currency        String  (usd)
status          OrderStatus  (PENDING | PAID | FAILED | REFUNDED)
paidAt          DateTime?
createdAt       DateTime
updatedAt       DateTime
```

### 4.3 PlanType Enum 變更

現有 enum 不變，新增 `TRIAL` 狀態作為虛擬狀態（不存 DB，由 `trialEndAt` 推導）：

```
ATOM     免費方案
FUSION   付費方案（含試用中 + 正式付款）
NEXUS    進階方案（預留）
```

---

## 5. EntitlementService 設計

EntitlementService 是付費功能的核心防線，所有業務邏輯集中於此，不分散到各個 route。

### 5.1 方案判斷邏輯

```
isFusionActive(user):
  now = current time
  stripe 有效 = stripeSubEndAt > now
  試用有效   = trialEndAt > now（且 trialStartAt 不為 null）
  return stripe 有效 OR 試用有效
```

### 5.2 Feature Gate（功能保護）

受保護功能列表：

| Feature Key | 最低方案 | 說明 |
|-------------|---------|------|
| `COACH_BRIEFING` | FUSION | Coach 晨晚報生成 |
| `CONFLICT_DETECTION` | FUSION | 衝突偵測 |
| `VOICE_INPUT` | FUSION | 語音輸入（M2） |
| `IMAGE_INPUT` | FUSION | 圖片 OCR 輸入 |
| `MCP_SERVER` | NEXUS | MCP Server 存取 |
| `API_TOKEN` | NEXUS | API Token 功能 |

> Area 數量 Atom / Fusion 均無限制，不列入 Feature Gate。

Feature Gate 在 **API route 層**執行，前端顯示鎖定狀態僅為 UX 輔助，不能作為安全防線。

### 5.3 AI 用量計數（Atom 限制）

- Brain Dump + Reorganize **共用** 50 次 / 月計數器
- FUSION / NEXUS 用戶跳過計數，直接放行
- 超出限制回傳 HTTP 402，附 `quotaExceeded: true` 讓前端顯示 Upsell

### 5.4 只讀模式執行點

降級發生時（Webhook 觸發或 Cron 觸發），系統**不刪除資料**，而是在讀寫操作時判斷：

- 讀取：永遠允許
- Area 操作：降級後仍可完整存取（Area 不受方案限制）
- Fusion 功能呼叫（Coach、衝突偵測等）：返回 HTTP 402，附 `planRequired: 'FUSION'`

---

## 6. 試用期設計

### 6.1 試用資格

- 新用戶首次升級時可選擇 14 天試用
- 試用期間功能與 Fusion 完全相同
- 試用結束後**不自動扣款**——Stripe 的 trial 設定為結束時提示用戶輸入信用卡
  - 作法：`trial_period_days: 14`，`payment_method_collection: 'if_required'`
  - 試用結束時若無有效付款方式，訂閱自動取消，降回 Atom

### 6.2 試用判斷

- `trialEndAt` 存 DB，配合 `isFusionActive()` 判斷
- 試用中的 Stripe Subscription status = `trialing`
- Webhook `customer.subscription.updated`（trial → active）= 試用轉正式付款
- Webhook `customer.subscription.deleted`（試用結束未付款）= 降回 Atom

---

## 7. 付款流程（詳細步驟）

### 7.1 首次訂閱 / 開始試用

```
1. 用戶點擊「開始 14 天試用」或「立即升級」
2. 前端 POST /api/payment/create-checkout
   Body: { priceId, trialEnabled: boolean }
3. 後端：
   a. 確認用戶尚未使用過試用（trialStartAt IS NULL）
   b. 建立或取得 Stripe Customer（stripeCustomerId）
   c. 建立 Checkout Session（含 trial_period_days）
   d. 回傳 checkoutUrl
4. 前端導向 Stripe Checkout 頁面
5. 用戶完成操作 → Stripe 導回 /payment/success?session_id=xxx
6. 後端 Webhook 收到 checkout.session.completed：
   a. 建立 Order 紀錄（status: PAID）
   b. 若是試用：記錄 trialStartAt / trialEndAt
   c. 更新 User.stripeSubId / stripeCustomerId
7. /payment/success 頁面向 /api/subscription/status 確認方案已更新，顯示成功畫面
```

### 7.2 自動續費（每月 / 每年）

```
Stripe 自動扣款 → invoice.payment_succeeded
後端 Webhook：更新 User.stripeSubEndAt = 下個週期結束日
無需用戶介入
```

### 7.3 用戶主動取消

```
1. 用戶進入 /settings/subscription 點擊「管理訂閱」
2. 後端建立 Stripe Customer Portal Session → 回傳 portalUrl
3. 前端導向 Customer Portal（Stripe 托管頁面）
4. 用戶在 Portal 取消訂閱
5. Stripe Webhook customer.subscription.deleted：
   cancel_at_period_end = true 時，週期結束才觸發
   後端記錄預計降級時間，到期時執行降級
```

### 7.4 付款失敗處理

```
Stripe 自動重試（Smart Retries，最多 3 次）
每次失敗 → invoice.payment_failed → 後端記錄 / 寄通知 Email
3 次失敗後 → customer.subscription.deleted → 後端執行降級
```

---

## 8. 降級流程

### 8.1 觸發點

| 觸發事件 | 來源 |
|---------|------|
| 訂閱到期不續費（cancel_at_period_end） | Stripe Webhook |
| 付款持續失敗（3 次重試後） | Stripe Webhook |
| 試用結束未輸入付款方式 | Stripe Webhook |
| 每日 Cron 補查（確保 Webhook 漏接時補救） | 後端 Cron |

### 8.2 降級執行步驟

```
1. 接收降級觸發（Webhook 或 Cron）
2. 確認 User.planType 目前為 FUSION
3. 將 User.planType 設回 ATOM
4. 清除 stripeSubEndAt（或設為 now）
5. 不刪除任何用戶資料
6. 寄送降級通知 Email
7. 前端下次請求時，Feature Gate 返回 403 / 402，顯示只讀狀態
```

### 8.3 降級通知排程

| 時機 | 通知內容 |
|------|---------|
| 到期前 7 天 | Email：「你的 Fusion 方案將在 7 天後到期」 |
| 到期前 1 天 | Email：「明日到期，立即續費保留所有功能」 |
| 降級當日 | Email：「已回到 Atom 方案，資料完整保留，隨時可重新升級」 |

---

## 9. API 端點清單

| Method | Path | 說明 | 需要認證 |
|--------|------|------|---------|
| GET | /api/subscription/status | 查詢目前方案、用量、到期日 | ✅ |
| POST | /api/payment/create-checkout | 建立 Stripe Checkout Session | ✅ |
| POST | /api/payment/portal | 建立 Stripe Customer Portal Session | ✅ |
| POST | /api/payment/webhook | Stripe Webhook 接收（驗簽名） | ❌（Stripe 呼叫） |

---

## 10. 前端頁面清單

| 路徑 | 說明 |
|------|------|
| `/pricing` | 定價頁（公開），含試用說明 |
| `/payment/success` | 付款 / 試用成功確認頁 |
| `/payment/cancel` | 用戶在 Stripe Checkout 取消後的返回頁 |
| `/settings/subscription` | 訂閱管理（查看方案、用量、管理按鈕） |

### 前端顯示原則

- Atom 用戶：Dashboard 顯示「AI 用量：18 / 50」進度條
- 超過 40 次：橘色警示 + Upsell Banner
- 超過 50 次：紅色 + 強制 Upgrade Modal
- 鎖定功能：顯示「🔒 Fusion 功能」，點擊開啟 Upgrade Modal
- 降級後 Area 正常可用，無限制（Area 不是方案差異點）

---

## 11. App Store / Google Play 合規策略

### 11.1 付款模式合規性

Web 端 Stripe 付款 + App 端帳號狀態同步，是業界標準做法（Notion、Linear、Figma 均採用此模式）。

**合規依據**：App 本身不銷售任何東西，不引導用戶付費，功能差異來自帳號等級（Account-based access），不是 App 內購。

### 11.2 App 行為準則

| 準則 | 說明 |
|------|------|
| App 不顯示任何付費 / 升級 UI | 不放升級按鈕、不提 Fusion/Atom 方案名稱 |
| App 可放官網連結 | 文案用「了解更多」或「官方網站」，不提付費 |
| 功能不可用時不解釋原因 | 直接隱藏或 disable，不顯示任何文字說明 |
| 試用期在 App 生效 | Web 開始試用後，App 自動反映 Fusion 功能，完全合規 |
| 試用結束後 App 縮回 Atom | 帳號等級改變，App 如實呈現，無違規 |

### 11.3 功能限制的 UI 處理原則（⚠️ 高風險區）

Apple 審查員對「功能受限說明」非常敏感。任何暗示「付費可解鎖」的文案都可能導致被拒。

**安全做法：功能直接不顯示（最保守）**

Atom 帳號看不到 Coach 入口，就像那個功能不存在一樣。沒有鎖頭圖示，沒有說明文字，就是沒有那個 UI。

**次安全做法：顯示但 disable，不加任何說明**

按鈕或選項存在但呈灰色不可點擊，沒有 tooltip，沒有說明，用戶若點擊完全無反應或靜默忽略。

**危險做法（絕對避免）**

```
❌ 「升級至 Fusion 以使用 Coach 功能」
❌ 「🔒 此功能需要訂閱」
❌ 「你的帳號目前無法使用此功能，了解更多 →」
❌ 任何帶有連結的說明文字（即使連結是官網首頁）
❌ 鎖頭圖示（🔒）搭配任何文字
```

**建議做法（按功能類型）**

| 功能 | App 處理方式 |
|------|------------|
| Coach 晨晚報 | Atom 帳號：入口完全不出現 |
| 衝突偵測 | Atom 帳號：入口完全不出現 |
| Brain Dump 達 50 則上限 | 輸入框 disable，顯示「本月輸入已達上限」（不說怎麼解除） |
| AI 整理達 50 則上限 | 按鈕 disable，顯示「本月 AI 處理已達上限」（同上） |

### 11.3 Fusion 功能的 App / Web 分工

| 功能 | Web | App |
|------|-----|-----|
| Brain Dump（50 則 Atom 限制） | ✅ | ✅ |
| Area 管理（無限制，Atom / Fusion 相同） | ✅ | ✅ |
| Coach 晨晚報 | ✅ | 唯讀（查看歷史） |
| 衝突偵測 | ✅ | 唯讀（查看結果） |
| 訂閱管理 | ✅（Stripe Portal） | ❌（不做） |

---

## 13. 安全性注意事項

- Stripe Webhook 必須驗證 `Stripe-Signature` header（使用 Webhook Secret）
- `stripeCustomerId` 只在後端使用，不暴露給前端
- Feature Gate 必須在 API route 層執行，不能只靠前端隱藏
- 試用資格檢查必須在後端（防止用戶重複建立試用）

---

## 14. 實作階段規劃

### Phase 1：Feature Gate（無需 Stripe）— 建立防線

**目標**：在接入 Stripe 之前，先把所有功能保護機制建立好。

- [ ] 資料庫 Migration：User 表新增付費相關欄位
- [ ] 資料庫 Migration：新建 Order 表
- [ ] 實作 `EntitlementService`（isFusionActive, checkAiUsage, requirePlan）
- [ ] 在 Brain Dump / Reorganize API 加入用量檢查（Atom 50 次）
- [ ] 在 Coach Briefing API 加入 Fusion+ 限制
- [ ] 在 Coach / 衝突偵測 API 加入 Fusion+ 限制（Area 不限）
- [ ] 前端：Atom 用量顯示條（Dashboard）
- [ ] 前端：功能鎖定顯示（🔒 icon + Upgrade Modal 框架）
- [ ] 單元測試：EntitlementService 所有路徑

### Phase 2：Stripe 整合（付款核心）

**目標**：接通 Stripe，讓用戶可以真正升級。

- [ ] Stripe 帳號設定：建立 Product / Price（月付 + 年付）
- [ ] 環境變數設定：STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY
- [ ] 實作 `/api/payment/create-checkout`（含試用期邏輯）
- [ ] 實作 `/api/payment/portal`（Customer Portal）
- [ ] 實作 `/api/payment/webhook`（Webhook 驗簽 + 事件處理）
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed
- [ ] 實作 `/api/subscription/status`
- [ ] 前端：`/pricing` 頁面接上真實 checkout 流程
- [ ] 前端：`/payment/success` 頁面
- [ ] 前端：`/settings/subscription` 頁面（含 Portal 按鈕）
- [ ] 整合測試：完整付款流程（使用 Stripe Test Mode）

### Phase 3：自動化管理

**目標**：確保系統可以無人值守地處理訂閱週期。

- [ ] Cron Job：每月 1 日重置 aiUsageCount
- [ ] Cron Job：每日補查（確認 stripeSubEndAt 已過期的用戶降級）
- [ ] 降級通知 Email（到期前 7 天 / 1 天 / 降級當日）
- [ ] 監控：Stripe Webhook 失敗率警報
- [ ] 文件：Stripe Dashboard 操作手冊（退款流程、查看訂閱等）

---

## 15. 相關文件

- `014_Paid_Service_Architecture_Spec.md` — 方案定義、決策紀錄
- `040_Milestone_Development_Roadmap.md` — M5.2 Beta 時間規劃
- `010_MCP_Server_Spec.md` — Nexus 方案 MCP 功能（未來）
