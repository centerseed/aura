# Zentropy 付費服務架構規格文件

**版本**: v0.1（草稿，持續討論中）
**建立日期**: 2026-02-18
**狀態**: 🟡 Draft — 等待決策確認

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
| Area 數量 | 1 個（固定） |
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

---

### 2.2 Fusion — $5.99 USD / 月

**定位**: 移除所有阻力，讓 Zentropy 成為真正的第二大腦

| 功能 | 說明 |
|------|------|
| AI 處理 | 無限制 |
| Area 數量 | 無限制 |
| Coach 晨晚報 | ✅ |
| 衝突偵測與停滯警示 | ✅ |
| 語音輸入 | ✅（M2 推出） |
| 圖片 / OCR 輸入 | ✅ |
| MCP Server | ❌（Nexus 功能） |
| API Token | ❌（Nexus 功能） |

**功能清單**:
- 包含 Atom 全部功能（無限制）
- 多 Area 管理
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

## 3. 付款模型決策（⚠️ 待確認）

### 方案 A: Access Pass（一次性付款）— 現行規劃
> 詳見 `021_Monetization_Plan.md`

- 用戶購買「30 天通行證」（NT$200 或 $5.99 USD）
- 付款為一次性交易（非自動扣款）
- 系統記錄 `subscription_end_at`，到期後回到 Atom
- 到期前 3 天 / 1 天發送提醒通知

**優點**:
- 無需信用卡循環授權
- 台灣個人戶（NewebPay）可操作
- 技術實作簡單

**缺點**:
- 用戶需手動續費（流失風險高）
- 無法做 Annual Plan 優惠

### 方案 B: Auto-renewing Subscription（自動扣款）
- 使用 Stripe 或 Paddle
- 支援月付 / 年付
- Webhook 驅動狀態更新

**優點**:
- 業界標準，用戶體驗佳
- 可做 Annual Plan（降低流失）
- 可做 Proration（按比例計費）

**缺點**:
- Stripe 需公司戶或 MoR（平台費用高）
- 初期設定複雜度高

> 🔴 **決策待定**: 初期 MVP 採用 Access Pass（方案 A），待公司設立後遷移至 Stripe 自動扣款（方案 B）。

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
// Brain Dump 和 Reorganize 共享同一個計數器
// Atom 上限：50 次 / 月
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
3. 選擇方案（月付 30 天 / 年付 365 天）
   ↓
4. POST /api/payment/create → 取得付款表單
   ↓
5. 導向 NewebPay 付款頁（或 Stripe Checkout）
   ↓
6. 付款完成 → Gateway 回呼 /api/payment/callback
   ↓
7. 後端驗證 → 更新 User.planType = FUSION
   ↓
8. 導回 /success，前端即時更新方案狀態
```

### 6.2 Upsell Triggers（觸發點）

| 場景 | 觸發文案 |
|------|---------|
| 第 51 則 Brain Dump | 「你的思緒太豐富了。升級 Fusion，釋放無限潛能。」 |
| 嘗試新增第 2 個 Area | 「Atom 只能專注一個世界。升級 Fusion，開啟多重宇宙管理。」 |
| 嘗試開啟 Coach 晨報 | 「Coach 是 Fusion 專屬功能。升級立即開始你的每日晨報。」 |
| MCP 功能頁 | 「Nexus 解鎖 zentropy:// MCP，讓 AI 工具直接讀取你的任務。」 |

### 6.3 升級立即生效規則

- 付款成功後，功能**立即解鎖**（不等下個月）
- `subscriptionEndAt` = `NOW + 30 天`（或 365 天）
- `aiUsageCount` 不重置（本月剩餘 Atom 用量仍保留，但 Fusion 不受限）

---

## 7. 降級流程（Fusion → Atom）

### 7.1 降級時機

Access Pass 模式下，「降級」= 到期不續費。系統自動在 `subscriptionEndAt` 降回 Atom。

### 7.2 資料保留政策

降級後，資料**不刪除**，但功能受限：

| 資源 | 降級後行為 |
|------|-----------|
| 多個 Area | **只讀**（不可新增，現有資料保留） |
| Coach 晨晚報 | 停止生成（歷史紀錄保留） |
| 衝突偵測 | 停止（歷史紀錄保留） |
| AI 用量 | 回歸 50 則 / 月限制 |

> **原則**: 資料永遠是用戶的，Zentropy 不會在降級時刪除任何用戶資料。

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

| # | 問題 | 選項 | 優先級 |
|---|------|------|--------|
| OQ-1 | 初期使用哪個金流？ | A: NewebPay（一次性）/ B: Stripe（自動扣款） | 🔴 高 |
| OQ-2 | Fusion 定價是否有年付方案？ | A: 只有月付 / B: 月付 + 年付（8 折） | 🟡 中 |
| OQ-3 | 降級後多個 Area 只讀，還是強制合併到 1 個？ | A: 只讀保留 / B: 強制限制（只顯示最舊的 1 個） | 🟡 中 |
| OQ-4 | 免費試用期？ | A: 無試用 / B: 14 天 Fusion 試用 | 🟡 中 |
| OQ-5 | Nexus 何時推出 + 定價？ | 待 M4 MCP 功能完成後決定 | 🟢 低 |
| OQ-6 | AI 用量計數：Brain Dump 和 Reorganize 各別計算還是共用？ | A: 共用 50 次 / B: 分別 Brain Dump 30 次 + Reorg 20 次 | 🟡 中 |

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

## 12. 相關文件

- `011_Pricing_Strategy.md` — 三個方案的功能矩陣與定位
- `021_Monetization_Plan.md` — NewebPay Access Pass 技術實作細節
- `040_Milestone_Development_Roadmap.md` — M5 Beta 時間規劃
- `010_MCP_Server_Spec.md` — Nexus MCP 功能規格
