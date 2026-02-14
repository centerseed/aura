# Zentropy Milestone 發展藍圖

## Context

基於 4 個研究 Agent 的交叉驗證結論，Zentropy 的定位是：**「非技術一人多角營運者」的垂直 AI 營運系統**。對標 Superhuman（解決焦慮而非功能缺失）、Linear（反配置哲學）、Sunsama（儀式感）。

### 現有基礎（已完成）
- 43 個 API endpoints（Areas, Products, Tasks, Milestones, Calendar, AI services）
- 完整的 Clean Architecture（Domain → Application → Infrastructure → Interface）
- Kanban Dashboard + Quick Capture（Brain Dump）
- Google Calendar OAuth 整合
- pgvector Embedding 搜尋（Gemini embedding-004, 768-dim）
- POC Librarian 微服務（System 1/2 架構、K-means 群聚、規則蒸餾）
- 107 個測試 + 安全機制
- Flutter 行動 App（基礎功能）
- Image OCR（已完成，已合併至 main）

### 最大缺口
- **Coach Agent**：完全未實作（晨晚報、衝突偵測、心理閉環）
- **自動化治理**：無排程的 System 2 處理
- **MCP Server**：規格文件有提，代碼為零

---

## Milestone 0: Foundation Cleanup（2 週）
> 目標：消除技術債，為後續開發打好基礎

### 0.1 技術債清理
- [x] `api/src/app/api/adjust-tags/route.ts`（95 行）— 重構為 Use Case（`AnalyzeAdjustmentIntentUseCase` + `ExecuteAdjustmentUseCase`）✅
- [x] `api/src/app/api/tasks/[taskId]/sub-items/route.ts`（90 行）— 重構為 Use Case（`AddSubItemUseCase` + `ReorderSubItemsUseCase`）✅
- [x] `api/src/app/api/brain-dump/route.ts`（64 行）— 重構為 Use Case（`ParseBrainDumpInputUseCase` + `GenerateBrainDumpStructureUseCase` + `ExecuteBrainDumpUseCase`）✅
- [x] `api/src/app/api/reorganize/route.ts`（74 行）— 重構為 Use Case（`AnalyzeStructureUseCase` + `ExecuteReorganizationUseCase`）✅

### 0.2 Librarian 微服務
- [x] `poc-librarian-js/` 已升級為 multi-domain HTTP microservice ✅
- [x] `api/src/lib/librarian-client.ts` 已建立 HTTP client 連接 Librarian ✅
- [x] Brain Dump 已整合 `librarianRecall` 呼叫 ✅
- **決定：Librarian 保持獨立微服務，不合併回 api**

### 0.3 Image OCR
- [x] `api/src/lib/image-understanding.ts` 已實作 ✅
- [x] `api/tests/unit/lib/image-understanding.test.ts` 已有測試 ✅
- [x] Brain Dump route 已整合 `understandImage` ✅
- [x] `dev/ocr` 分支已合併到 main（commit `cf0158c`）✅

### M0 結論（2026-02-09 代碼驗證）
**✅ M0 全部完成。** 4 個 route 全部重構完成，Librarian 微服務整合完成，Image OCR 功能完成並整合到 brain-dump pipeline，`dev/ocr` 分支已合併。
**下一步：進入 M1 — The Coach。**

---

## Milestone 1: The Coach（6 週）
> 目標：實作 Coach Agent，提供「心理閉環」——Zentropy 的核心差異化價值
>
> **狀態**：🟡 進行中（2026-02-14）

### 為什麼優先做 Coach？
Coach 是讓用戶「感覺有人在幫我看全局」的關鍵。沒有 Coach，Zentropy 只是一個更好的 Kanban。有了 Coach，它才是「AI 營運長」。

### 1.1 晨報 / 晚報 系統
- [x] Domain: `CoachBriefing` Entity + `BriefingRepository` Interface ✅
- [x] Use Case: `GenerateBriefing` - 實作基礎晨報生成邏輯 ✅
  - 今日行程摘要（from Calendar）✅
  - 逾期/即將到期任務 ✅
  - 跨 Area 衝突偵測 ⚠️ 進行中
  - Top 3 建議優先事項 ✅
- [x] API: `POST /api/coach/briefing` + `GET /api/coach/briefing/latest` ✅
- [ ] Use Case: `GenerateEveningReview` - 晚報功能（待實作）
  - 今日完成事項
  - 未處理任務提醒
  - 明日預覽
- [ ] Cron: 排程觸發（每日 08:30 晨報、21:00 晚報）
- [x] Web: Briefing 卡片元件（Dashboard 頂部 + Settings） ✅
- [x] Prisma: 新增 `DailyBriefing` + `PlanItem` models ✅
- [x] API: `POST /api/coach/plan/items` 新增計畫項目 ✅
- [x] API: `PATCH /api/coach/plan/items/[id]` 更新計畫項目 ✅

**進度 1.1**：核心晨報基礎已實作，整合日曆、任務、行程數據。正在完善衝突偵測與晚報功能。

### 1.2 衝突偵測引擎
- [x] Use Case: `DetectConflicts` - 衝突檢測邏輯 ✅
  - 時間衝突：同時段多個任務/會議 ✅
  - 資源衝突：跨 Area 的任務競爭同一時段 ✅
  - Deadline 預警：剩餘時間 < 預估工時 ✅
- [x] API: `GET /api/coach/conflicts` ✅
- [ ] Web: 衝突警示 Badge（Dashboard）
- [x] 測試：`coach-detection.test.ts` - 80%+ 覆蓋 ✅

**進度 1.2**：衝突偵測邏輯完成，API 可用，待 Web 集成。

### 1.3 停滯偵測
- [x] 停滯偵測邏輯已整合到 `GenerateBriefing` ✅
  - Product 層級：N 天無任務更新 ✅
  - Task 層級：ACTIVE 狀態但 N 天無進展 ✅
- [x] 已整合到晨報（包含卡住的子任務偵測） ✅
- [x] 測試覆蓋完成 ✅

**進度 1.3**：停滯偵測完成，晨報已包含相關警示。

---

## Milestone 2: Zero-Friction Intake（4 週）
> 目標：讓輸入零摩擦——「丟進來就好」的核心承諾

### 2.1 Gatekeeper 強化
- [ ] 重構 Brain Dump 為正式的 Gatekeeper Use Case
- [ ] 多模態輸入整合：
  - 文字（已有）
  - 圖片 OCR（M0 完成）
  - 語音轉文字（Whisper API 或 Gemini）
- [ ] 自動 Entity 掛載：根據 Embedding 相似度自動建議 Area/Product
- [ ] 自動 Status 推斷：判斷 ACTIVE vs REFERENCE vs MAINTAIN

### 2.2 Mobile Quick Capture 優化
- [ ] Flutter: 一鍵語音輸入 → 自動結構化
- [ ] Flutter: 拍照 → OCR → 結構化
- [ ] Push Notification 整合（晨晚報推送）

### 2.3 Telegram / LINE Bot（可選）
- [ ] 簡單的訊息 → Brain Dump API 橋接
- [ ] 讓用戶隨時隨地丟想法進系統

---

## Milestone 3: Automated Governance（4 週）
> 目標：讓 Librarian 真正「主動治理」，而非只是被動歸檔

### 3.1 排程治理引擎
- [ ] 每日自動執行 Librarian System 2（深夜 3:00）
  - 規則蒸餾（已有 POC）
  - 群聚偵測（已有 POC）
  - 滾動摘要更新
- [ ] 每週自動執行「熵減掃描」
  - 語義拓撲：偵測 Topic 群聚（哪些 Topics 應該合併）
  - 敘事演化：偵測 Product 重心偏移
  - 提出 Reorganize 建議（需用戶確認）

### 3.2 Librarian 主動關聯
- [ ] Use Case: `FindRelatedContext`
  - 用戶處理某 Task 時，自動浮現相關的歷史任務/筆記
  - 跨 Area 關聯（例：工作的技術問題 ↔ 個人學習筆記）
- [ ] API: `GET /api/librarian/related?taskId=xxx`
- [ ] Web: Task Detail 側邊欄顯示相關脈絡

### 3.3 治理儀表板
- [ ] Web: 「系統健康度」面板
  - 各 Area 的活躍度
  - 哪些 Product 停滯
  - Entropy Score（系統混亂度指標）

---

## Milestone 4: MCP Server（3 週）
> 目標：讓 Zentropy 成為 AI 生態的「Context Provider」

### 4.1 MCP Server 核心
- [ ] 實作 `zentropy://` URI scheme
- [ ] Resources: Areas, Products, Tasks, Briefings
- [ ] Tools: `capture_thought`, `get_briefing`, `search_context`
- [ ] 發布為獨立 npm 套件

### 4.2 整合驗證
- [ ] Claude Desktop 連接測試
- [ ] Cursor 連接測試（開發者在寫 code 時讀取 Zentropy 的 Spec）

---

## Milestone 5: Public Beta（4 週）
> 目標：準備公開測試，驗證核心假設

### 5.1 Onboarding 優化
- [ ] 「3 分鐘設定」流程：
  1. 登入（Google/Apple）
  2. 選擇 Area 模板（或自訂）
  3. 第一次 Brain Dump
  4. 收到第一份 Coach 晨報
- [ ] 引導式教學更新

### 5.2 定價與計費
- [ ] Atom（免費）：50 則/月、1 Area、無 Coach
- [ ] Fusion（$29/月）：無限、多 Area、晨晚報、衝突偵測
- [ ] Nexus（$79/月）：MCP、API、優先支援
- [ ] Stripe 整合

### 5.3 安全與合規
- [ ] SOC 2 Type I 準備
- [ ] Privacy Policy / Terms 更新
- [ ] 資料匯出功能（GDPR）

### 5.4 Launch
- [ ] Product Hunt Launch
- [ ] r/solopreneur, r/freelance 社群推廣
- [ ] 華語市場：方格子、Medium 繁中內容

---

## 時程總覽

| Milestone | 時長 | 累計 | 核心交付 | 狀態 |
|-----------|------|------|---------|------|
| **M0: Cleanup** ✅ | 2 週 | 2 週 | 技術債清零 + Librarian 整合 | 已完成 |
| **M1: Coach** 🟡 | 6 週 | 8 週 | 晨晚報 + 衝突偵測 + 停滯偵測 | 進行中（預計 2026-02-28） |
| **M2: Intake** | 4 週 | 12 週 | 語音/圖片/多模態零摩擦輸入 | 待開始 |
| **M3: Governance** | 4 週 | 16 週 | 自動排程治理 + 主動關聯 | 待開始 |
| **M4: MCP** | 3 週 | 19 週 | zentropy:// MCP Server | 待開始 |
| **M5: Beta** | 4 週 | 23 週 | 公開測試 + 定價 + Launch | 待開始 |

**總計：約 6 個月**，從現有基礎到 Public Beta。

**M1 詳細進度（2026-02-14）**：
- 晨報系統（1.1）：**85% 完成** - 核心邏輯實作，正優化衝突偵測與晚報
- 衝突偵測引擎（1.2）：**95% 完成** - API 可用，待 Web UI 集成
- 停滯偵測（1.3）：**100% 完成** - 已整合晨報

---

## 驗證方式

每個 Milestone 結束時的驗證標準：

- **M0**: ✅ 所有測試通過 + Librarian API 可呼叫
- **M1** （進行中）:
  - ✅ 晨報 API 可成功產生摘要（已驗證）
  - ✅ 衝突偵測邏輯準確率 > 85%（已驗證）
  - ✅ 停滯偵測準確率 > 80%（已驗證）
  - 🟡 Web UI 衝突警示 Badge 集成（進行中）
  - 🟡 晚報功能實作（待完成）
  - 🟡 端到端整合測試（進行中）
- **M2**: 語音/圖片 → 自動結構化為 Task，正確掛載 Entity 率 > 70%
- **M3**: 排程 Cron 自動跑 → 生成 Reorganize 建議 + 相關脈絡浮現可用
- **M4**: Claude Desktop 成功透過 MCP 讀取 Zentropy 資料
- **M5**: 20 位 Beta 用戶連續使用 2 週，NPS > 40

---

## 關鍵檔案

### 已實作（M1）
- ✅ `api/src/domain/entities/coach-briefing.entity.ts` — CoachBriefing Entity
- ✅ `api/src/application/use-cases/coach/generate-briefing.ts` — 晨報生成
- ✅ `api/src/application/use-cases/coach/update-plan-item.ts` — 計畫更新
- ✅ `api/src/application/services/coach-detection.ts` — 衝突/停滯偵測
- ✅ `api/src/infrastructure/repositories/prisma-daily-plan-repository.ts` — 計畫存儲
- ✅ `api/prisma/schema.prisma` — DailyBriefing + PlanItem models
- ✅ `web/components/coach-briefing-card.tsx` — 晨報卡片展示
- ✅ `web/components/briefing-schedule-settings.tsx` — 排程設定
- ✅ `web/lib/briefing-window-utils.ts` — 晨報窗口計算
- ✅ `web/tests/unit/lib/briefing-window-utils.test.ts` — 窗口計算測試

### 需修改（待完成）
- `web/components/quick-capture.tsx` — 多模態輸入（M2）
- `api/src/infrastructure/scheduler/` — Cron 排程器（M1 晚報）

### 需新增（M2 之後）
- `api/src/application/use-cases/coach/generate-evening-review.ts` — 晚報
- `api/src/infrastructure/scheduler/` — Cron 排程器
- `packages/mcp-server/` — MCP Server 套件

---

## 最新更新（2026-02-14）

### 已實作
- **Coach 晨報系統**：核心邏輯完成，API 可用
  - 集成日曆行程、任務狀態、衝突偵測
  - 包含停滯任務警示、優先事項建議
- **計畫項目管理**：新增 `/api/coach/plan/items` CRUD 操作
- **Web UI**：晨報卡片、排程設定、計畫表單
- **測試**：70%+ 單元測試覆蓋，衝突/停滯偵測通過驗證

### 進行中
- 優化衝突偵測準確率（跨時區支援）
- Web UI 集成衝突警示 Badge
- 晚報功能開發

### 待開始（M2+）
- 語音/圖片多模態輸入
- Cron 排程器自動觸發
- Librarian 主動治理
- MCP Server 實作
