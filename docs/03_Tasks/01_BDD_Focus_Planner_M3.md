# BDD: Project 優先度與焦點偏差追蹤 (Project Priority & Focus Bias Tracking)

## 背景描述
目前 Zentropy 的優先度設定在 `milestones` (1-10分) 會造成用戶嚴重的決策疲勞，且違背 Zentropy「低治理摩擦」的第一性原理。
同時，以「精準估時」(Time) 為核心的 Planner 策略被證明在真實場景中不可行 (Garbage In, Garbage Out)。
因此，我們將戰略支點（Planner 核心）從「時間管理」Pivot 到「焦點與決策管理」，透過在 L2 (Project) 層級設定優先度，並以用戶的「實際消除任務之軌跡」為對比，創造「AI 教練看穿用戶焦點偏差」的魔法時刻 (Magic Moment)。

## 功能變更摘要
1. **Schema 變更**:
   - `products` 表新增 `priority` 欄位: enum(`P0`, `P1`, `P2`, `P3`)，預設 `P1`。
   - `products` 表新增 `sort_order` 欄位: integer，用於同優先度內的排序。
   - `milestones` 表移除 `priority` 欄位 (原本為 1-10分)。
2. **UI 變更**:
   - (Web/Flutter) 在 Product Header 或卡片提供 Priority Picker (4 級制 + 顏色標示)。
   - 任務排序底層邏輯改為基於所屬 Project 的優先度 (`P0` 優先)。
3. **焦點偏差追蹤面板**:
   - 第一階段：視覺化呈現用戶「聲稱的重點(P0)」與「實際完成的 Task 歸屬」之間的落差。
   - 第二階段：Coach 介入提示（發送至 Morning Briefing 或獨立面板通知）。

---

## 1. Schema 變更 (Database Migration)

### Scenario: 移除 milestones.priority 並新增 products.priority
**Given** 現有的資料庫包含了 `milestones.priority` 欄位 (Integer 1-10) 且 `products` 無優先度欄位
**When** 執行資料庫遷移腳本時
**Then** 系統應刪除 `milestones.priority` 欄位
**And** 系統應在 `products` 表中新增 `priority` 欄位 (enum, 允許值: `'P0'`, `'P1'`, `'P2'`, `'P3'`)，預設值為 `'P1'`
**And** 系統應在 `products` 表中新增 `sort_order` 欄位 (integer)，預設依據 created_at 給予初始順序值
**And** 既有的 Products 全部自動賦予預設值 `'P1'`

---

## 2. API 變更

### Scenario: 更新 Product 的優先度
**Given** 用戶已經登入並擁有合法的 Product ID
**When** 用戶發送 PUT/PATCH 請求至 `/api/products/{product_id}` ，Payload 包含 `priority` (e.g. `'P0'`) 與 `sort_order`
**Then** 後端應驗證 `priority` 為合法的 Enum 值 (`'P0'`, `'P1'`, `'P2'`, `'P3'`)
**And** 將新狀態更新至資料庫中並更新 `updated_at`
**And** 回傳 HTTP 200 與更新後的 Product Json

---

## 3. Web & Flutter UI

### Scenario: Product 優先級標籤及選擇
**Given** 用戶在 Dashboard 或 Product Detail 頁面查看 Product 卡片/標題
**When** Product 被渲染出來時
**Then** UI 應基於 `priority` 顯示對應顏色的標籤：
  - P0 (核心): 橘紅 (Orange Red)
  - P1 (重要): 藍 (Blue)
  - P2 (維護): 灰藍 (Grey Blue)
  - P3 (待機): 灰 (Grey)
**When** 用戶點擊該標籤時
**Then** 應展開一個下拉選單 (Priority Picker) 讓用戶不用打字、單鍵選擇（0摩擦）
**And** 選擇後立刻呼叫 API 更新，不需手動按儲存

### Scenario: 排序邏輯調整
**Given** 用戶正在查看 Todo List 或是 Kanban 的某個 Drawer (例如 `Active`)
**When** 清單載入時
**Then** 最底層的排序邏輯 (ORDER BY) 應優先使用 Project.Priority
**And** 順序應為: `P0` -> `P1` -> `P2` -> `P3`
**And** 在相同優先級內，再依據 `Product.sort_order` 或 `Task.updated_at` (由新到舊) 進行次級排序

---

## 4. 焦點偏差追蹤 (Focus Bias Tracking)

### Scenario: 焦點數據收集與計算
**Given** 系統有持續運行並紀錄 Task 從 `ACTIVE` 變更為 `ARCHIVE` (即完成) 的時間與紀錄
**When** 系統產生「焦點偏差報告」時 (或用戶打開 Dashboard 的 Focus 面板時)
**Then** 系統應計算過去 7 天/14 天內，用戶「已完成 (ARCHIVE) 任務數量」的分佈
**And** 該分佈應以 Product 為群組，並對齊其當前的 Priority
**And** 若計算出：過去一週內超過 70% 的已完成任務屬於 `P2` 或 `P3` 的專案，但存在停滯超過 5 天以上的 `P0` 專案
**Then** 系統應標記出一個「焦點偏移 (Focus Drift)」事件

### Scenario: Coach 介入 (Magic Moment)
**Given** 系統偵測到上述的「焦點偏移」事件
**When** 用戶閱讀 Morning Briefing 或查看 AI 治理面板時
**Then** Coach 應提出類似以下的質詢建議（不強制更改任何東西）：
> 「我注意到你將『專案A』設為 P0，但在過去一週內，你劃掉的 15 個任務全部屬於 P2 的『專案B』。我們是不是該把『專案B』升級為 P0，承認你現在的重心其實在這裡？」
**And** 提供一個 One-click 按鈕讓用戶可以：
  - "將專案 B 設為 P0"
  - "沒事，我今天會推進專案 A"

