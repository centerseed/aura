# AI 時間維度智能推斷系統

**Goal**: 讓用戶輸入碎片化訊息時，AI 自動推斷任務的完成時間，無需手動標記，並在 Dashboard 優先顯示最近要完成的事情。

**Core**: 基於多層級 Milestone 上下文 + Task 語意分析，實現智能時間推斷與優先級排序。

---

## 1. 核心概念

### 問題陳述
- 用戶輸入碎片化訊息（如「完成 OAuth 登入」）時，不想手動標記時間
- 現有 Drawer 狀態（INBOX/ACTIVE/MAINTAIN）只能表達關注程度，無法處理時間維度
- 不同層級的實體（Area/Product/Topic）可能都有不同的時間點需求（如「專案 3 月上線」vs「功能下週完成」）

### 解決方案
**多層級 Milestone + AI 時間推斷引擎**
- 允許在 Area/Product/Topic 任何層級設定 Milestone（里程碑）
- AI 根據 Milestone 上下文自動推斷 Task 的 due_date
- Dashboard 提供時間視圖，優先顯示最近要完成的任務

---

## 2. 架構設計

### 2.1 資料模型

#### Milestone Table（多態設計）
- 可掛載於任何實體：Area、Product、Topic
- **一個實體可以設定多個 Milestone**，支援階段性里程碑管理
- 欄位：
  - `name`: 里程碑名稱（如「MVP Release」）
  - `target_date`: 目標日期
  - `status`: PLANNED / IN_PROGRESS / COMPLETED / DELAYED / CANCELLED
  - `entity_type`: 掛載的實體類型（AREA / PRODUCT / TOPIC）
  - `entity_id`: 對應實體的 ID（一對多關係）
  - `priority`: 優先級權重（1-10，用於衝突解決）
  - `description`: 里程碑詳細描述（選填）

**範例：同一個 Product 的多個階段性里程碑**
```
Product: "Zentropy 用戶認證系統" (product_id: prod_auth_001)
  ├── Milestone 1: "技術方案評估完成" (2026-02-15, COMPLETED)
  ├── Milestone 2: "OAuth 整合開發完成" (2026-03-01, IN_PROGRESS)
  ├── Milestone 3: "安全性審查通過" (2026-03-15, PLANNED)
  └── Milestone 4: "正式上線" (2026-04-01, PLANNED)
```

#### Task 擴充欄位
- `due_date`: AI 推斷或手動設定的截止日期
- `inferred_from_milestone`: 記錄推斷來源的 milestone ID
- `time_confidence`: AI 推斷信心分數（0-1）
- `ai_analysis`: JSON，內含 `time_reasoning` 欄位記錄推斷理由

### 2.2 AI 時間推斷引擎

#### 推斷流程（整合至 /api/brain-dump）
1. 用戶輸入碎片化訊息
2. AI 識別並分類 tasks（現有功能）
3. **新增：時間推斷階段**
   - 載入該 Product/Topic 的所有相關 Milestones（未來 90 天內）
   - 分析 Task 語意與所有 Milestones 的關聯性
   - **處理多里程碑關聯**：一個 Task 可能同時影響多個 Milestone（如「完成 OAuth」影響「MVP Release」與「安全審查」）
   - 推斷 due_date、urgency_level、confidence（優先選擇最近且最相關的 Milestone）
4. 持久化到資料庫

#### 分階段推斷策略

**階段 A：強關聯（直接語意匹配）**
- Task 名稱包含 Milestone 關鍵字
- 例如：Task「完成 OAuth」+ Milestone「完成用戶認證模塊」
- 規則：設定 due_date 為該里程碑 target_date 前 3-7 天
- Confidence: 0.8-1.0

**階段 B：中關聯（同 Product/Topic 下的時間順序）**
- Task 屬於某個 Product，該 Product 有 Milestone
- 根據 Task 性質（設計 < 開發 < 測試 < 部署）分配時間
- 預留 20% 緩衝時間
- Confidence: 0.5-0.8

**階段 C：弱關聯（通用推斷）**
- 沒有明確 Milestone，根據 Drawer 狀態推斷
  - ACTIVE → 7 天內
  - INBOX → 14 天內
  - MAINTAIN → 30 天內
  - REFERENCE → 不設定 due_date
- Confidence: 0.2-0.5

#### AI Prompt 設計要點
- **上下文載入**：
  - 用戶現有 Milestones（含目標日期、距今天數）
  - 現有 Tasks 分佈
  - 今天日期
- **推斷指示**：
  - 考慮語意關聯、依賴順序、緩衝時間
  - 避免時間衝突（同一天太多任務則自動分散）
- **輸出格式**：
  - `inferred_due_date`: 推斷日期
  - `related_milestone_id`: 關聯的 Milestone
  - `reasoning`: 推斷理由（繁體中文）
  - `confidence`: 信心分數
  - `urgency_level`: CRITICAL / HIGH / MEDIUM / LOW

---

## 3. UI 設計

### 3.1 Dashboard 視圖切換
- **🌳 結構視圖（Structure View）**：現有的樹狀 Area → Product → Topic 結構
- **⏰ 時間視圖（Timeline View）**：按 relative time 分組顯示（Overdue/Today/This Week...）
- **📊 甘特圖視圖（Gantt View）**：視覺化 Milestone 與 Task 的時間軸關係

### 3.2 甘特圖視圖（Gantt View）
- **時間軸佈局**：以週為單位顯示時間跨度
- **視覺元素**：
  - Milestone：使用菱形圖示（🔹/🟣）表示，Hover 顯示詳細資訊
  - Task：使用圓點色塊表示，顏色對應 Drawer 狀態
  - 今日線：紅色垂直線標示當前時間
- **互動**：支援展開/折疊 Area 查看子層級 Product 進度

### 3.3 時間視圖佈局
分區顯示：
- **🔴 已逾期**（Overdue）
- **⏰ 今天**（Today）
- **📅 本週**（This Week）
- **📆 下週**（Next Week）
- **🗓️ 稍後**（Later）
- **⚪ 無截止日期**（No Due Date）

### 3.3 Task Card 時間資訊顯示
- 時間標籤：顯示相對時間（「逾期」、「今天」、「明天」、「X 天後」、「X 週後」）
- AI 信心標記：Confidence < 0.6 時顯示警告圖示（⚠），並提示手動確認
- Milestone 關聯提示：顯示「🎯 關聯：MVP Release (2026-03-01)」

### 3.4 Milestone 管理 UI
- **多里程碑管理**：為同一個實體（Area/Product/Topic）新增/編輯多個 Milestone
- **時間軸顯示**：以時間順序展示該實體的所有 Milestones
- **Milestone 列表**：顯示每個 Milestone 的關聯 Task 數量與完成進度
- **快速新增**：在 Milestone 列表底部提供「+ 新增里程碑」按鈕
- **刪除/完成**：支援標記 Milestone 為 COMPLETED 或刪除
- 自動調整提醒：當 Milestone 下任務太多時，系統提示調整時間或重新分配

---

## 4. 漸進式學習與修正

### 4.1 用戶修正記錄
當用戶手動修改 AI 推斷的 due_date 時，記錄修正資訊：
- 原始推斷日期
- 用戶修正後日期
- 修正時間戳
- 儲存於 `ai_analysis` JSON 中

未來可用於：
- 分析 AI 常見偏差（如低估測試時間）
- 調整 Prompt 或推斷邏輯

### 4.2 時間衝突處理
- AI 推斷時檢查「已有多少 tasks due 在同一天」
- 自動分散：5 個 tasks due 同一天 → 分配到前後數天

---

## 5. 實作優先級

### Phase 1: 資料模型 + 基礎推斷（2-3 天） [COMPLETED]
- 創建 Milestone table（Migration）
- Task 加入 due_date, inferred_from_milestone, time_confidence 欄位
- 實作階段 C 推斷（弱關聯，基於 Drawer 狀態）

### Phase 2: AI 推斷引擎強化（3-4 天） [COMPLETED]
- 載入 Milestone 上下文到 brain-dump Prompt
- 實作階段 A, B 推斷邏輯（語意匹配、時間順序）
- 添加推斷理由到 UI 顯示（對話氣泡格式）

### Phase 3: Timeline View（2-3 天） [COMPLETED]
- Dashboard 視圖切換功能（Structure / Timeline）
- 按時間分組顯示（今天/本週/下週）
- Task Card 顯示時間標籤與信心標記

### Phase 4: Milestone 管理 UI（2 天） [COMPLETED]
- 創建/編輯 Milestone 的 UI
- Milestone 列表與關聯 Task 顯示
- Milestone 進度追蹤（完成率、剩餘天數）

### Phase 5: 優化與學習（持續）
- 用戶修正資料記錄
- Prompt 調整與優化（基於修正模式）
- 時間衝突自動分散邏輯優化

---

## 6. 關鍵技術挑戰與解法

### 挑戰 1: AI 推斷不準確
**解法**：
- 顯示信心分數，低於 0.6 時顯示警告圖示
- 用戶可輕鬆手動調整（點擊日期直接修改）
- 記錄修正資料供未來優化

### 挑戰 2: Context 太長（所有 Milestones）
**解法**：
- 只載入「相關」的 Milestones（同 Product/Topic）
- 只載入「未來 90 天」內的 Milestones
- Prompt 長度限制與 truncate 機制

### 挑戰 3: 時間衝突
**解法**：
- AI 推斷時檢查「同一天已有多少 tasks」
- 自動分散到前後數天（例如：5 個 tasks → 分配到 5 天）

---

## 7. 成功標準

✅ 用戶輸入碎片化訊息，80% 的 tasks 能自動推斷出合理的 due_date
✅ Dashboard Timeline View 能正確顯示「今天/本週」的優先任務
✅ 用戶可輕鬆手動調整 AI 推斷的時間
✅ Milestone 與 Task 的關聯清晰可見
✅ 信心分數低的推斷有明確提示，不造成困惑

---

## 8. 與現有系統整合

- **brain-dump API**：新增時間推斷階段，輸出包含 `due_date` 與 `time_confidence`
- **reorganize API**：重新整理時也重新評估時間分配
- **Dashboard**：新增視圖切換（Structure / Timeline）
- **Quick Capture**：處理結果顯示中添加時間資訊（「已排程至 X 日」）

---

*此計畫遵循 Zentropy 的 Spec-Driven Development 原則，先實作核心推斷引擎，後續根據用戶反饋逐步完善 UI 與學習機制。*
