# Zentropy 付費服務架構規格文件

**版本**: v0.2（決策更新）
**建立日期**: 2026-02-18
**最後更新**: 2026-02-18
**狀態**: 🟢 Active — 核心決策已確認，部分細節 TBD

---

## 1. 背景與目標

Zentropy 採用 Freemium 模式，提供三個方案：Atom（免費）、Fusion（付費）、Nexus（即將推出）。本文件定義付費服務的完整架構，包含：

- 三個方案的功能邊界（Feature Gate）
- 付款流程設計
- 升級 / 降級流程
- 資料庫結構
- API 授權機制
- 前端 UX 設計原則

---

## 2. 方案定義（Plan Tiers）

### 2.1 Atom — 免費永久

**定位**: 讓用戶養成使用習慣，感受到核心價值

| 限制 | 數量 |
|------|------|
| AI 處理（Brain Dump + Reorganize） | 50 則 / 月 |
| Area 數量 | **無限制** |
| Coach 功能（晨晚報、衝突偵測） | ❌ 不開放 |
| 語音 / 圖片輸入 | ❌（規劃中） |
| MCP Server | ❌ |
| API Token | ❌ |

**功能清單**:
- 基礎任務管理（Inbox / Active / Maintain / Reference / Archive）
- Milestone 追蹤
- 向量語義搜尋（基礎）
- Brain Dump（50 則限制）
- AI 整理（50 則內）
- 無限 Area 管理

---

### 2.2 Fusion — $5.99 USD / 月（或年付 $57.99 USD，約 8 折）

**定位**: 移除所有阻力，讓 Zentropy 成為真正的第二大腦

> **14 天免費試用**：首次升級 Fusion 享 14 天試用，無需信用卡（IAP 平台規則依 App Store / Google Play 為準）。試用結束後若不取消，自動轉為付費訂閱。

| 功能 | 說明 |
|------|------|
| AI 處理 | 無限制 |
| Area 數量 | 無限制（同 Atom，非差異功能） |
| Coach 晨晚報 | ✅ |
| 衝突偵測與停滯警示 | ✅ |
| 語音輸入 | ✅（M2 推出） |
| 圖片 / OCR 輸入 | ✅ |
| MCP Server | ❌（Nexus 功能） |
| API Token | ❌（Nexus 功能） |

**功能清單**:
- 包含 Atom 全部功能，AI 處理無限制
- Coach Agent（晨報 08:30 / 晚報 21:00）
- 衝突偵測引擎
- 停滯任務警示
- 語音 / 圖片多模態輸入

---

### 2.3 Nexus — 即將推出（價格 TBD）

**定位**: Zentropy 成為整個 AI 生態系的中樞

| 功能 | 說明 |
|------|------|
| Fusion 全部功能 | ✅ |
| MCP Server（zentropy://） | ✅ |
| API Token | ✅ |
| 優先客戶支援 | ✅ |

> Nexus 方案的技術規格另見 `010_MCP_Server_Spec.md`

---

## 3. 付款模型（✅ 已決策）

### 3.1 付款架構（✅ 已決策：Web Only）

| 平台 | 付款方式 | 說明 |
|------|---------|------|
| **Web（Next.js）** | **Stripe** 自動扣款 | 月付 $5.99 / 年付 $57.99，Webhook 驅動狀態更新 |
| **App（iOS / Android）** | **不實作**（本期） | App 端付費延後，以 Web 為主 |

> App 端 IAP 實作另立計畫，本文件僅涵蓋 Web 端 Stripe 架構。詳見 `041_Stripe_Payment_Architecture_Plan.md`。

### 3.2 Stripe（Web）

- 自動扣款訂閱（Auto-renewing Subscription）
- 支援月付 / 年付
- Webhook 事件：`checkout.session.completed`、`invoice.payment_succeeded`、`customer.subscription.deleted`
- 降級觸發：`customer.subscription.deleted` 或 `invoice.payment_failed`（重試 3 次後）

### 3.3 IAP（App）

- iOS：StoreKit 2 / RevenueCat
- Android：Google Play Billing
- 建議使用 **RevenueCat** 統一管理跨平台訂閱狀態，並透過 Webhook 回呼更新後端
- 試用期：依 App Store / Google Play 的 introductory offer 機制實作 14 天試用

### 3.4 訂閱週期

| 週期 | 價格（Web / Stripe） | 說明 |
|------|-------------------|----|
| 月付 | $5.99 USD / 月 | 隨時取消 |
| 年付 | $57.99 USD / 年（≈ $4.83 / 月） | 約 8 折，一次扣款 |

> App 定價另行設定，可能與 Web 不同。

---

## 4. 資料庫結構

### 4.1 User 表擴充

```prisma
model User {
  // ... 現有欄位

  // 方案資訊
  planType           PlanType  @default(ATOM) @map("plan_type")
  subscriptionStatus SubStatus @default(INACTIVE) @map("subscription_status")
  subscriptionEndAt  DateTime? @map("subscription_end_at")

  // 本月用量計數（每月 1 日 Cron 重置）
  aiUsageCount       Int       @default(0) @map("ai_usage_count")
  aiUsageResetAt     DateTime  @default(now()) @map("ai_usage_reset_at")

  orders             Order[]
  @@map("users")
}

enum PlanType {
  ATOM
  FUSION
  NEXUS
}

enum SubStatus {
  ACTIVE     // 付費中，有效期內
  INACTIVE   // 免費方案 / 已到期
  CANCELLED  // 已取消（Access Pass 模式下較少用）
}
```

### 4.2 Order 表（付款紀錄）

```prisma
model Order {
  id              String      @id @default(uuid()) @db.Uuid
  userId          String      @map("user_id") @db.Uuid

  // 方案資訊
  planType        PlanType    @map("plan_type")
  durationDays    Int         @map("duration_days") // 30 / 365

  // 金流資訊（NewebPay 或 Stripe）
  gateway         PayGateway  // NEWEBPAY | STRIPE
  gatewayOrderNo  String      @unique @map("gateway_order_no")
  amount          Int         // 以最小貨幣單位（TWD: 分, USD: cents）
  currency        String      @default("TWD")

  // 狀態
  status          OrderStatus @default(PENDING)
  paidAt          DateTime?   @map("paid_at")

  // 原始 Gateway 回應（審計用）
  gatewayResponse Json?       @map("gateway_response") @db.JsonB

  user            User        @relation(fields: [userId], references: [id])
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")

  @@map("orders")
}

enum PayGateway {
  NEWEBPAY
  STRIPE
}

enum OrderStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}
```

---

## 5. Feature Gate 機制

### 5.1 設計原則

Feature Gate 必須在 **API 層** 執行，而非只在前端隱藏。前端隱藏只是 UX，API 層才是實際安全防線。

### 5.2 Entitlement Service

```typescript
// api/src/application/services/entitlement-service.ts

interface IEntitlementService {
  // 取得用戶目前方案
  getUserPlan(userId: string): Promise<PlanType>

  // 檢查功能是否開放
  canUseFeature(userId: string, feature: Feature): Promise<boolean>

  // 檢查 AI 用量並遞增
  checkAndIncrementAiUsage(userId: string): Promise<{
    allowed: boolean
    currentCount: number
    limit: number | 'unlimited'
  }>
}

enum Feature {
  MULTIPLE_AREAS      // Fusion+
  COACH_BRIEFING      // Fusion+
  CONFLICT_DETECTION  // Fusion+
  VOICE_INPUT         // Fusion+
  IMAGE_INPUT         // Fusion+
  MCP_SERVER          // Nexus
  API_TOKEN           // Nexus
}
```

### 5.3 AI 用量追蹤

```typescript
// Brain Dump 和 Reorganize 共享同一個計數器（✅ 已決策：共用 50 次）
// Atom 上限：50 次 / 月（Brain Dump + Reorganize 合計）
// Fusion+：無限制

async function checkAiUsage(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } })

  if (user.planType === 'ATOM') {
    if (user.aiUsageCount >= 50) {
      throw new QuotaExceededError('AI 處理次數已達上限（50 次/月）')
    }
    await db.user.update({
      where: { id: userId },
      data: { aiUsageCount: { increment: 1 } }
    })
  }
  // FUSION / NEXUS：直接通過，不計數
}
```

### 5.4 每月重置 Cron

```
// 每月 1 日 00:05 UTC 重置所有用戶的 aiUsageCount
// 同時檢查 subscriptionEndAt，到期的降回 ATOM
0 5 1 * * -> resetMonthlyUsage()
```

---

## 6. 升級流程（Atom → Fusion）

### 6.1 用戶旅程

```
1. 觸發升級意圖（Upsell Trigger）
   ↓
2. 進入 /pricing 或 /upgrade 頁面
   ↓
3. 選擇方案（月付 / 年付）+ 14 天免費試用說明
   ↓
4. Web → Stripe Checkout / App → IAP 購買流程
   ↓
5. 付款完成 → Stripe Webhook / RevenueCat Webhook
   ↓
6. 後端驗證 → 更新 User.planType = FUSION、trialEndAt / subscriptionEndAt
   ↓
7. 導回 /success，前端即時更新方案狀態
```

### 6.2 Upsell Triggers（觸發點）

| 場景 | 觸發文案 |
|------|---------|
| 第 51 則 Brain Dump | 「你的思緒太豐富了。升級 Fusion，釋放無限 AI 處理潛能。」 |
| 嘗試開啟 Coach 晨報 | 「Coach 是 Fusion 專屬功能。升級立即開始你的每日晨報。」 |
| MCP 功能頁 | 「Nexus 解鎖 zentropy:// MCP，讓 AI 工具直接讀取你的任務。」 |

### 6.3 升級立即生效規則

- 付款成功後，功能**立即解鎖**（不等下個月）
- `subscriptionEndAt` = `NOW + 30 天`（或 365 天）
- `aiUsageCount` 不重置（本月剩餘 Atom 用量仍保留，但 Fusion 不受限）

---

## 7. 降級流程（Fusion → Atom）

### 7.1 降級時機

- **Stripe**：`customer.subscription.deleted` 事件觸發（取消後在到期日降級）
- **IAP**：RevenueCat entitlement 到期後觸發
- **試用結束未付款**：`trialEndAt` 時間點系統 Cron 自動降回 Atom

### 7.2 資料保留政策（✅ 已決策：降級後只讀）

降級後，資料**不刪除**，Fusion 專屬功能停用：

| 資源 | 降級後行為 |
|------|-----------|
| Area | 全數保留，可正常存取（Area 數量無限制，Atom / Fusion 相同） |
| Coach 晨晚報 | 停止生成（歷史紀錄保留，可讀） |
| 衝突偵測 | 停止（歷史紀錄保留） |
| AI 用量 | 回歸 50 則 / 月限制（Brain Dump + Reorganize 共用） |

> **原則**: 資料永遠是用戶的，Zentropy 不會在降級時刪除任何用戶資料。只讀狀態在重新訂閱後立即解除。

### 7.3 降級通知

- `subscriptionEndAt - 7 天`：Email 提醒「你的 Fusion 方案將在 7 天後到期」
- `subscriptionEndAt - 1 天`：Email 提醒「明日到期，立即續費」
- `subscriptionEndAt`：系統 Cron 自動執行降級，Email 通知「已回到 Atom 方案」

---

## 8. API 端點設計

### 8.1 方案查詢

```
GET /api/subscription/status
→ { planType, subscriptionEndAt, aiUsageCount, aiUsageLimit }
```

### 8.2 付款建立

```
POST /api/payment/create
Body: { planId: 'fusion_monthly' | 'fusion_yearly' }
→ { formHtml } (NewebPay) 或 { checkoutUrl } (Stripe)
```

### 8.3 付款回呼（Server-to-Server）

```
POST /api/payment/callback/newebpay
→ 驗證簽章 → 更新 Order + User 方案
```

### 8.4 Feature Gate 中介層

```typescript
// 在受保護的 route 加上 middleware
// 例如：Coach Briefing API 必須是 Fusion+
export async function POST(req: Request) {
  const userId = await getAuthUser(req)
  await requirePlan(userId, 'FUSION') // 不符合則拋 402 Payment Required
  // ...業務邏輯
}
```

---

## 9. 前端 UX 設計原則

### 9.1 功能鎖定顯示

- 鎖定功能用「🔒」icon 或淡化效果呈現，而非直接隱藏
- 點擊鎖定功能時，顯示 Upgrade Modal，說明升級後能獲得什麼
- 避免用「你沒有權限」等負面語氣，改用「解鎖更多」的正向語氣

### 9.2 AI 用量顯示（Atom 用戶）

- Dashboard 右上角或設定頁顯示「本月 AI 用量：18 / 50」
- 接近上限（≥ 40）時顯示橘色警示
- 到達上限時顯示紅色 + Upsell Banner

### 9.3 方案設定頁

- `/settings/subscription` 顯示：
  - 目前方案 + 到期日
  - 本月用量
  - 升級按鈕 / 方案比較

---

## 10. 待決策事項（Open Questions）

| # | 問題 | 決策 | 狀態 |
|---|------|------|------|
| OQ-1 | 初期使用哪個金流？ | **Web: Stripe / App: IAP（RevenueCat）** | ✅ 已決策 |
| OQ-2 | Fusion 定價是否有年付方案？ | **有年付，$57.99 USD / 年（約 8 折）** | ✅ 已決策 |
| OQ-3 | 降級後多個 Area 只讀，還是強制合併到 1 個？ | **只讀保留（不刪除、不合併）** | ✅ 已決策 |
| OQ-4 | 免費試用期？ | **14 天 Fusion 試用** | ✅ 已決策 |
| OQ-5 | Nexus 何時推出 + 定價？ | 待 M4 MCP 功能完成後決定 | 🟢 低優先 |
| OQ-6 | AI 用量計數：Brain Dump 和 Reorganize 各別計算還是共用？ | **共用 50 次 / 月** | ✅ 已決策 |
| OQ-7 | App 定價是否與 Web 相同？ | IAP 手續費較高，App 月付可能 $6.99（TBD） | 🟡 待定 |
| OQ-8 | 升降級費用如何 Prorate？ | 見第 13 節討論 | 🟡 待定 |

---

## 11. 實作里程碑（與 Roadmap 對齊）

> 詳細時間規劃見 `040_Milestone_Development_Roadmap.md` M5: Beta

### Phase 1: 基礎 Feature Gate（無需付款）
- [ ] `EntitlementService` 實作
- [ ] User 表增加 `plan_type`、`ai_usage_count` 欄位
- [ ] Brain Dump / Reorganize 加上用量檢查
- [ ] Coach API 加上 Fusion+ 限制
- [ ] 前端：Atom 用量顯示條

### Phase 2: Access Pass 付款
- [ ] `Order` 表實作
- [ ] NewebPay 整合（`NewebPayService`）
- [ ] `/api/payment/create` + `/api/payment/callback`
- [ ] 升級流程 UX（Upgrade Modal + 成功頁）
- [ ] 降級通知 Email（到期前 7 / 1 天）

### Phase 3: 自動化管理
- [ ] Cron：每月重置 `aiUsageCount`
- [ ] Cron：到期自動降級 + Email 通知
- [ ] `/settings/subscription` 頁面

---

## 13. 升降級費用計算（Proration）

### 13.1 Web / Stripe

Stripe 內建 Proration 機制，依剩餘天數自動計算差額：

**月付升年付（中途升級）**
- Stripe 計算剩餘月付價值，抵扣年付費用
- 例：月付用了 10 天（剩 20 天），升年付時 Stripe 自動按比例折抵

**年付降月付（中途降級）**
- Stripe 預設行為：當前週期結束後才生效（不立即退款）
- 建議設定：`proration_behavior: 'none'`，年付到期自動轉月付
- 用戶不會拿到退款，但也不會被額外扣款

**取消訂閱（Fusion → Atom）**
- 取消後仍可使用至當前週期結束（`cancel_at_period_end: true`）
- 到期日系統自動降級，無退款

### 13.2 App / IAP

IAP 的退款 / Proration 由 App Store / Google Play 全權處理，後端無法干預：

- **iOS**：用戶在 App Store 管理訂閱，平台處理退款申請
- **Android**：Google Play 有「退款視窗」（購買後 48 小時內可退）
- RevenueCat 負責同步最新的 entitlement 狀態到後端

### 13.3 跨平台切換（Web 訂閱 → 改用 App，或反之）

這是個複雜問題，建議初期不支援「跨平台遷移訂閱」：

- Web 訂閱（Stripe）與 App 訂閱（IAP）是獨立的
- 用戶若同時訂閱兩個平台，**系統取最晚到期的那個**作為有效 Fusion 狀態
- 未來可考慮：Web 訂閱用戶登入 App 時顯示「你的 Web 訂閱已涵蓋 App 使用」

### 13.4 後端判斷邏輯摘要

```typescript
// User 表新增欄位
model User {
  // Stripe
  stripeCustomerId    String?  @map("stripe_customer_id")
  stripeSubEndAt      DateTime? @map("stripe_sub_end_at")

  // IAP (via RevenueCat)
  rcAppUserId         String?  @map("rc_app_user_id")
  iapSubEndAt         DateTime? @map("iap_sub_end_at")

  // Trial
  trialStartAt        DateTime? @map("trial_start_at")
  trialEndAt          DateTime? @map("trial_end_at")
}

// 判斷用戶是否為 Fusion
function isFusionActive(user: User): boolean {
  const now = new Date()
  const stripActive = user.stripeSubEndAt && user.stripeSubEndAt > now
  const iapActive = user.iapSubEndAt && user.iapSubEndAt > now
  const inTrial = user.trialEndAt && user.trialEndAt > now
  return !!(stripActive || iapActive || inTrial)
}
```

---

## 12. 相關文件

- `011_Pricing_Strategy.md` — 三個方案的功能矩陣與定位
- `021_Monetization_Plan.md` — NewebPay Access Pass 技術實作細節
- `040_Milestone_Development_Roadmap.md` — M5 Beta 時間規劃
- `010_MCP_Server_Spec.md` — Nexus MCP 功能規格
