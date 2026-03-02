# Zentropy Milestone 發展藍圖 V2

**版本**: 2.0
**日期**: 2026-03-02
**基於**: 競爭策略研究報告（Zentropy_vs_OpenClaw_Strategy_Report.md）+ M0-M4 實際完成狀態

---

## 背景與修正說明

V1 路線圖（040）在策略研究報告完成之前撰寫，缺少策略核心功能的執行計劃。本 V2 針對以下缺口進行修正：

1. **插入 M3.5**：Episodic Memory（偏差追蹤），策略報告的 Phase 1 Wedge Feature，是讓 Coach 真正成為「教練」而非「提醒器」的關鍵
2. **插入 M3 的用戶治理功能**：Project 優先度管理（純用戶治理，AI 不介入）
3. **Beta 前必須有差異化**：M5 Beta 若沒有 M3.5，上線的是更好的 Kanban，而不是 AI 營運教練

---

## 現況快照（2026-03-02）

| Milestone | 狀態 | 備註 |
|---|---|---|
| M0: Foundation Cleanup | ✅ 完成 | 技術債清零、Librarian 整合 |
| M1: The Coach | ✅ 完成 | 晨晚報、衝突偵測、停滯偵測 |
| M2: Zero-Friction Intake | ✅ 完成 | 語音/OCR/多模態零摩擦輸入 |
| M3: On-Demand Governance | 🔴 待開始 | |
| M4: MCP Server | ⚠️ 核心完成 | 缺整合驗證（Claude Desktop + Cursor） |
| M5: Public Beta | 🔴 待開始 | |

### 最大缺口（策略 vs 現況）

策略報告定義的三大差異化武器，目前**一個都未實作**：

| 武器 | 說明 | 狀態 |
|---|---|---|
| 個人規劃記憶（Episodic Memory） | 用越久估時越準，最高護城河 | ❌ 未實作 |
| 偏差追蹤儀表板 | 「你低估設計任務 2.1 倍」，病毒傳播潛力 | ❌ 未實作 |
| Reference Class Forecasting | Coach 根據歷史給估時建議 | ❌ 未實作 |
| L3 Refine（思考夥伴） | 真正的市場空白 | ❌ 未實作 |

---

## 路線圖總覽

```
M3           M3.5          M4補完       M5           M6           M7
Governance → Episodic   → MCP驗證  → Public    → Thought   → Growth
(4週)        Memory(4週)   (2週)       Beta(5週)   Partner(6週) (持續)
```

---

## Milestone 3: On-Demand Governance（4 週）

> **目標**：讓 Librarian 真正「主動治理」，建立按需觸發的治理基礎設施；同時加入**用戶主動治理 Project 優先度**的功能

### 3.0 設計決策

採用「按需觸發」而非 Cron 排程：頁面/App 載入時自動呼叫治理 API，背景非同步執行，不 blocking 用戶操作。理由：避免 Cloud Run 冷啟動、Vercel Cron 維護成本，且用戶體感上「開啟即即時」。

---

### 3.1 Project 優先度治理（純用戶治理，AI 不介入）

**設計理念**：Project（Product）的重要性是高度個人化的判斷，涉及用戶的生涯選擇、當下處境與價值觀取捨。這不是 AI 從幾句描述文字就能推斷的事。Zentropy 提供清晰的介面讓用戶**顯式宣告**優先度，而不是猜測。

#### 功能設計

**優先度模型**：4 級制（不用數字，避免過度思考）

| 等級 | 標籤 | 顏色 | 語意 |
|---|---|---|---|
| P0 | 核心 | 橘紅 | 當前最重要，所有精力優先保障 |
| P1 | 重要 | 藍 | 積極推進中，保持穩定節奏 |
| P2 | 維護 | 灰藍 | 維持現狀，不主動推進 |
| P3 | 待機 | 灰 | 暫時擱置，不需要關注 |

> **不提供「重要性 1-10 分」**：太多選項反而造成決策疲勞，違背零摩擦原則。

**操作路徑**：
- Web：Product Header 旁加入優先度標籤，點擊展開下拉選單
- Flutter：Product Card 長按，滑出 Priority Picker
- Kanban 排序：依 P0 → P1 → P2 → P3 分組顯示（同組內按更新時間排）
- 允許拖曳調整同等級 Product 內部順序（手動排序儲存在 `sort_order` 欄位）

**Coach 整合**（讀取，不寫入）：
- 晨報按優先度排列任務建議（P0 Project 的任務優先出現）
- 衝突偵測時，P0 Project 的時間衝突警示層級更高
- 停滯偵測時，P0 Project 若 5 天無進展會特別標示（P2/P3 則靜默）

**AI 不做什麼**（明確邊界）：
- AI 不自動設定優先度
- AI 不根據任務數量或 deadline 推斷重要性
- AI 不建議「你應該把 X 升為 P0」

#### Schema 變更

```
products 表新增：
- priority: enum('P0', 'P1', 'P2', 'P3')，預設 P1
- sort_order: integer，同 priority 內的排序
```

---

### 3.2 按需治理觸發

- `GET /api/librarian/reflect-if-needed`：App/Web 載入時呼叫，後端判斷是否觸發 Cold Path 蒸餾（距上次 > N 小時 且 有 ≥5 筆未處理修正）
- `GET /api/governance/structure-hints`：Dashboard 載入時，輕量掃描結構並回傳待確認的重組建議

---

### 3.3 Librarian 主動關聯

- `FindRelatedContextUseCase`：用戶查看 Task 時，embedding 搜尋跨 Area 相關歷史任務/筆記
- `GET /api/librarian/related?taskId=xxx`
- Web + Flutter：Task Detail 側邊欄顯示「相關脈絡」區塊

---

### 3.4 治理健康度儀表板

- 各 Area 活躍度視覺化
- Entropy Score（基於 Topic 分散度、命名一致性計算）
- 待確認的重組建議列表
- P0 Projects 的進展追蹤（停滯警示）

---

### M3 驗收標準

- [ ] Project 優先度可在 Web + Flutter 設定，排序即時生效
- [ ] 晨報按優先度排列，P0 Project 的任務排在前面
- [ ] 打開 Dashboard，治理掃描在背景自動執行（不 blocking）
- [ ] Task Detail 顯示相關歷史任務（Embedding 搜尋）
- [ ] 治理健康度面板可訪問

---

## Milestone 3.5: Episodic Memory（4 週）⭐

> **目標**：建立個人規劃記憶系統——讓 Coach 從「你的助理」升級為「了解你規劃模式的教練」
>
> **策略地位**：這是整份策略報告的 Wedge Feature。「你低估設計任務 2.1 倍」是市場上無任何競品能說出的一句話。

### 為什麼現在做

- 技術門檻低（主要是 Schema + 數據收集）
- 病毒傳播潛力最高（用戶截圖分享自己的偏差報告）
- 數據越早開始收集越好——Episodic Memory 需要歷史數據，拖越晚護城河越薄

---

### 3.5.1 估時資料收集

**核心原則**：低摩擦收集，不強制填寫。

**收集時機**：
- Brain Dump 建立任務時：Gatekeeper 在結果預覽中附上「預計多久完成？」（選填，提供快速選項：30min / 2h / 半天 / 1天 / 3天+）
- 任務設定 Due Date 時：自動建議填寫工時估計
- Task 開始執行時（狀態改為 ACTIVE）：「這個任務你打算今天完成，還是需要幾天？」

**完成時自動計算**：
- `actual_duration` = Task 從 ACTIVE 到 ARCHIVE 的時間跨度（扣掉週末，可調整）
- 若用戶設有開始時間，以開始時間計算；否則以最後一次更新 ACTIVE 的時間計算

**Schema 變更**：

```
tasks 表新增：
- estimated_duration_hours: float（nullable）
- actual_duration_hours: float（nullable，完成時自動計算）
- started_at: timestamp（狀態轉 ACTIVE 時記錄）
- complexity: enum('XS', 'S', 'M', 'L', 'XL')（可選，輔助分類）

task_planning_records 表（新增）：
- id, task_id, user_id
- estimated_hours, actual_hours
- task_category（從 Topic 推斷）
- bias_ratio = actual / estimated
- created_at
```

---

### 3.5.2 個人偏差儀表板

> **設計目標**：用戶看到後的第一反應是「天啊這麼準」或「原來我這麼不準」——兩種反應都驅動分享。

**展示內容**（至少有 5 筆數據後才顯示）：

```
📊 你的規劃準確度報告

整體準確度：65%（過去 30 天 / 18 筆任務）

按類別分析：
┌─────────────────┬──────────────┬──────────────────┐
│ 任務類別        │ 你的習慣傾向  │ 建議調整         │
├─────────────────┼──────────────┼──────────────────┤
│ 設計 / 創意     │ 低估 2.1 倍  │ 下次 × 2        │
│ 開發 / 實作     │ 準確 ±15%   │ 維持現狀         │
│ 溝通 / 會議     │ 低估 1.3 倍  │ 多加 30%         │
│ 行政 / 雜事     │ 高估 1.4 倍  │ 放心縮短         │
└─────────────────┴──────────────┴──────────────────┘

連續最準的一次：Flutter 登入 UI（估 3 天，實際 3.2 天）✨
最大低估：API 整合優化（估 2 天，實際 9 天）
```

**隱私設計**：報告純屬個人，不對其他用戶可見，不用於 Zentropy 的任何統計。

---

### 3.5.3 Coach 整合 Reference Class Forecasting

**觸發時機**：用戶在 Brain Dump 或手動新增任務時填入估時

**Coach 回應範例**：

```
你估了「3 天」來完成這個設計任務。

根據你的歷史數據（12 次設計任務）：
- 平均實際耗時：6.3 天
- 最短：2 天 / 最長：14 天
- 你在設計任務上平均低估 2.1 倍

建議預留：6 天（你的 P50 歷史值）
若有外部依賴或全新設計方向，建議 8 天（P75 值）
```

**Coach 不做什麼**：
- 不強制修改用戶的估時
- 不插入任何排程（僅提供資訊，用戶自己決定）
- 建議呈現後，用戶確認或調整，無論何種選擇都不再追問

**學習閉環**：
- 任務完成後，系統靜默更新偏差因子
- 3 個月後重新計算，若準確度顯著改善，Coach 在晨報中提及：「你的設計估時準確度從 50% 提升到 78%，棒！」

---

### 3.5.4 用戶控制

- 偏差儀表板：用戶可選擇「不追蹤」（完全關閉，資料不收集）
- 估時建議：可在設定中關閉（不影響其他功能）
- 資料清除：可從儀表板一鍵清除所有歷史估時記錄

---

### M3.5 驗收標準

- [ ] 建立任務時，可填寫預計工時（有快速選項，不強制）
- [ ] 任務完成後，實際耗時自動計算並記錄
- [ ] 至少有 5 筆數據後，個人偏差儀表板可顯示
- [ ] Coach 在新增有估時的任務時，主動呈現 Reference Class 建議
- [ ] 用戶可在設定中關閉估時追蹤

---

## Milestone 4 補完: MCP 整合驗證（2 週）

> **目標**：補完 M4 的最後一哩路——讓開發者能真正用上 MCP Server

M4 核心已完成（14 tools + 6 resources + 安全架構），剩下的是驗證與文件。

### 4.1 Claude Desktop 連接驗證

- 撰寫 `docs/setup/claude-desktop-mcp.md`（安裝步驟、config.json 範例）
- 實測：Claude Desktop 透過 MCP 呼叫 `list_tasks`、`capture`、`get_plan`
- 截圖存入文件作為驗收證明

### 4.2 Cursor 連接驗證

- 撰寫 `docs/setup/cursor-mcp.md`
- 實測：Cursor AI 讀取 `zentropy://knowledge/{area}/{product}/{topic}`（讀取 Spec 文件作為 coding context）
- 截圖存入文件

### 4.3 MCP npm 套件（暫緩）

npm 套件拆出複雜度高、短期收益有限，**延後至 M7 Growth 階段**，屆時有開發者社群需求再做。

---

### M4 補完驗收標準

- [ ] Claude Desktop 連線截圖 + 步驟文件（可公開分享）
- [ ] Cursor 連線截圖 + 步驟文件

---

## Milestone 5: Public Beta（5 週）

> **目標**：在有差異化功能（M3.5 Episodic Memory）的基礎上，驗證核心假設並測試付費意願

### 重要前提

M5 Beta 必須在 M3.5 完成後才啟動。沒有偏差追蹤功能的 Beta 等於在推銷一個更好的 Kanban，無法驗證「AI 營運教練」的核心假設。

---

### 5.1 用戶驗證（M3.5 開始時同步啟動）

> **不是等功能完成才找用戶，而是邊建邊測。**

**招募標準**：
- 同時扮演 3 個以上角色（工作 + 副業 + 個人，或多個客戶）
- 手上有 5 個以上「在跑的事務」
- 目前沒有讓他滿意的管理工具

**深度訪談（5 位，在 M3.5 完成前）**：
- 目前如何管理跨角色的任務？
- 最近一次「漏掉一件事」是什麼情境？
- 對於「AI 替你排優先度」的感受？（預設：大多數人不信任 AI 的判斷，這驗證了我們的設計決策）

**2 週試用（M5 啟動後）**：
- 10-20 位用戶完整試用
- 每日使用日誌（可選）
- 第 7 天 + 第 14 天各一次 NPS 問卷

**核心驗證問題**：
- 「Zentropy 有沒有讓你少了那種『怕漏掉什麼』的焦慮？」
- 「偏差追蹤報告對你有沒有實質幫助？」
- 「如果明天 Zentropy 消失，你會怎樣？」

---

### 5.2 付費意願驗證（不是正式收費）

在 Beta 期間測試，而非 Beta 結束後才思考：

**WTP Survey（Willingness to Pay）**：
- 開放 Beta 的第 7 天，詢問：「如果 Zentropy 在一個月後開始收費，你願意付多少？」
- 選項：$0 / $5 / $10 / $15 / $20（美元月費）
- 目標：> 30% 用戶願意付 $10+

**Early Bird 機制**（非正式）：
- 對願意付費的 Beta 用戶，提供 6 個月 Early Bird 優惠（折扣不公開）
- 不上線 Stripe，用 Typeform + 人工處理確認

---

### 5.3 安全與合規

- Privacy Policy（正式版，涵蓋 Episodic Memory 資料收集說明）
- Terms of Service
- 資料匯出功能（GDPR 合規）
- OWASP Top 10 確認

---

### 5.4 Launch

- Product Hunt Launch（有偏差追蹤截圖作為核心宣傳素材）
- r/solopreneur、r/freelance 社群
- 方格子/Medium 繁中內容（「為什麼你總是低估任務時間——AI 幫你找到原因」）

---

### M5 驗收標準

- [ ] 5 位深度訪談完成，洞察記錄在 docs
- [ ] 20 位 Beta 用戶連續使用 2 週
- [ ] Day 14 NPS > 40
- [ ] > 30% 用戶在 WTP Survey 選擇 $10+
- [ ] Privacy Policy + ToS 上線

---

## Milestone 6: Thought Partner（L3 Refine）（6 週）

> **目標**：實作策略報告的武器三——從「執行系統」升級為「思考夥伴」，進入競品無法複製的護城河地帶

### 設計原則

**目前所有任務管理工具（包括 OpenClaw）都只做 Execution**：你說什麼，它做什麼。Zentropy 的 Coach 要做的是：在你說「我要 2 週上線」之前，先問你幾個問題。

但這條原則有一個邊界：**Coach 提供資訊和問題，不提供答案**。它呈現取捨，用戶做決定。

---

### 6.1 想法具體化（Idea → Action Path）

**觸發方式**：Brain Dump 輸入的內容被判定為「模糊想法」而非具體任務時，Coach 主動介入

**範例流程**：

```
用戶輸入：「想做一個幫設計師管案子的 SaaS」

Coach：
這是個值得探索的方向！在建立任何任務之前，讓我問幾個問題：

1. 你說的「管案子」，目前設計師最痛的環節是哪一個？
   （報價追蹤 / 客戶溝通 / 版本管理 / 收款...）

2. 你打算自己做，還是這是某個客戶的需求？

3. 你希望 3 個月後，這件事到什麼程度算成功？

[用戶回答後]

Coach 根據回答，生成：
- 具體下一步行動（3 個）
- 關鍵假設（需要先驗證的事）
- 建議掛到哪個 Area / Product
```

---

### 6.2 假設挑戰（Assumption Challenge）

**觸發方式**：任務描述含有時間承諾或強烈假設時

**範例**：

```
用戶：「兩週內上線這個功能」

Coach（有了 M3.5 的歷史數據）：

讓我補充一些脈絡：

📊 數據面（來自你的歷史）：
- 你過去 5 次功能上線平均花 3.5 週
- 你在有外部依賴的任務上平均多加 40% 時間
- 這個任務依賴 [X API]，上次類似整合花了 9 天

🤔 值得確認的事：
1. 「兩週」是硬性的嗎？（客戶承諾 / 自我設定）
2. 可以縮小範圍，先上線核心功能嗎？
3. 延誤的代價是什麼？

我沒有建議——這些是值得想清楚的取捨。
```

---

### 6.3 信任校準介面

用戶可設定每個 Coach 功能的自主程度：

```
Coach 行為設定：
- 估時建議：顯示（我自己決定要不要調整）
- 假設挑戰：有時（只在我有時間承諾的任務上觸發）
- 想法具體化：總是（每次模糊輸入都引導）
- 衝突警示：顯示（我自己決定怎麼處理）
```

---

### M6 驗收標準

- [ ] Brain Dump 模糊想法觸發想法具體化流程，生成可執行下一步
- [ ] 有時間承諾的任務觸發假設挑戰（使用 M3.5 的歷史數據）
- [ ] 信任校準設定可在 Settings 頁調整
- [ ] 用戶訪談中至少 3 位表示「Coach 幫我想到我沒想到的事」

---

## Milestone 7: Growth & Scale（持續）

> **目標**：驗證付費模式、開拓 Growth Channel、準備規模化

### 7.1 Stripe 正式計費

- 依 Beta WTP 調整定價
- Atom（Free）/ Fusion（付費）/ Nexus（Premium）三層上線
- Stripe Billing 整合（月費 + 年費）

### 7.2 Growth Channels

- Telegram / LINE Bot（訊息轉發進 Inbox，降低手機使用門檻）
- Gmail Add-on（郵件轉任務）
- 偏差報告分享功能（截圖分享 → 病毒傳播）

### 7.3 團隊協作（Nexus Tier）

- Product 層級的協作者邀請
- OWNER / EDITOR / VIEWER 權限分級
- AI 重組權限只有 OWNER 可觸發

### 7.4 MCP npm 套件

- 從 API Server 拆出，發布為獨立 npm 套件
- 開發者文件完整化

---

## 時程總覽

| Milestone | 時長 | 核心交付 | 關鍵 KPI |
|---|---|---|---|
| **M3: Governance** | 4 週 | Project 優先度 + 按需治理 + 主動關聯 | 優先度 UI 可用；治理背景執行 |
| **M3.5: Episodic Memory** ⭐ | 4 週 | 偏差追蹤 + Reference Class Forecasting | 5 用戶看到個人準確度報告 |
| **M4 補完** | 2 週 | Claude Desktop + Cursor 連線驗證 | 連線截圖 + 步驟文件 |
| **M5: Public Beta** | 5 週 | 20 用戶、NPS > 40、WTP > 30% | NPS + WTP Survey |
| **M6: Thought Partner** | 6 週 | L3 Refine：想法具體化 + 假設挑戰 | 3 位用戶主動引用 Coach 的問題 |
| **M7: Growth** | 持續 | Stripe 計費 + Bot + 協作 | MRR |

**預計總時程（M3 開始到 M5 Beta 啟動）**：約 15 週（3.5 個月）

---

## 設計決策記錄

### DDR-001：Project 優先度不用 AI 推斷

**決定**：Project 優先度由用戶顯式設定，AI 只讀取不寫入。

**理由**：Project（Product）的重要性涉及用戶的人生選擇、當下處境、個人價值觀，這不是 AI 從任務描述或 deadline 就能推斷的。強行推斷會侵犯用戶的主體性，且推斷錯誤的代價極高（「你說我的副業比本業重要？」）。設計原則：**提供清晰的治理介面，比提供錯誤的 AI 判斷更有價值。**

**邊界**：Coach 可在晨報中提示「你的 P0 Project X 已停滯 7 天，是否需要關注？」——這是基於行為數據的觀察，不是優先度判斷。

### DDR-002：Episodic Memory 在 Beta 前完成

**決定**：M3.5 插入 M4 之前，不可跳過直接進入 Beta。

**理由**：若 Beta 沒有偏差追蹤功能，無法驗證「AI 營運教練」的核心假設。NPS > 40 的目標在沒有差異化功能時無法達到。數據收集越早開始越好，因為 Episodic Memory 需要歷史數據才有意義。

### DDR-003：用戶驗證與 M3.5 並行，不是之後

**決定**：在 M3.5 開發期間同步進行 5 位用戶深度訪談，不等功能完成。

**理由**：訪談目的是驗證假設和找到用戶的真實語言，不需要功能完成才能進行。等功能完成才找用戶，會讓訪談流於展示而非探索。

---

*本文件取代 040_Milestone_Development_Roadmap.md 成為最新的執行路線圖。*
*040 文件保留作歷史記錄，不再更新。*
