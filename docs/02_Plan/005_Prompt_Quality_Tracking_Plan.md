
# Prompt Quality Assurance & Evaluation Plan

本計畫定義了 Naruvia 系統中 LLM Prompt（特別是記憶壓縮與治理邏輯）的品質追蹤、評估與迭代機制。目標是建立一套 **"LLM-Ops"** 閉環，確保隨著時間推移與資料量增長，AI 的治理能力依然精確可靠。

## 1. 評估哲學：AI-Assisted Evaluation

鑑於人工審查的高成本，我們採用 **"Judge Agent" (裁判代理)** 模式。
使用一個獨立的、高能力模型（如 Gemini 1.5 Pro with Temperature 0），針對 Librarian 產出的摘要與分類結果進行評分。

## 2. 關鍵監控指標 (Key Metrics)

| 指標 (Metric) | 定義 (Definition) | 理想範圍 | 評估方式 |
| :--- | :--- | :--- | :--- |
| **Recall Rate (關鍵回憶率)** | 摘要是否保留了 Input 中的關鍵實體 (Entity) 與決策 (Decision) | > 95% | Judge Agent 比對 Input 與 Summary 中的 Named Entities 集合重疊率。 |
| **Logic Consistency (邏輯一致性)** | 摘要中的因果關係是否與 Input 矛盾 | 100% | Judge Agent 檢查 `[UPDATE]` 與 `[DEPRECATE]` 標記是否在 Input 中有證據支持。 |
| **Compression Ratio (壓縮比)** | `Token(Input) / Token(Summary)` | 5x ~ 20x | 程式自動計算。過低浪費 Token，過高導致失真。 |
| **Hallucination Rate (幻覺率)** | 摘要中出現了 Input 未提及的 "新資訊" | 0% | Judge Agent 掃描 Summary 中無法溯源的專有名詞。 |

## 3. 實作計畫 (Implementation Strategy)

### 3.1 建立 "Evaluation Dataset" (Golden Set)
*   **來源**：從真實使用的 User Input 中，挑選具代表性的 50 筆案例（包含矛盾需求、技術變更、模糊描述）。
*   **標註**：人工撰寫這些案例的「標準摘要 (Ground Truth)」。
*   **用途**：每次 Prompt 修改後，必須先跑過這 50 筆 Golden Set，確保分數未退步 (Regression Test)。

### 3.2 開發 "Daily Health Check" (每日健檢)
*   **機制**：Librarian 每天晚上執行治理時，隨機抽取 5% 的處理結果，丟給 Judge Agent 進行 "Post-mortem Analysis"。
*   **流程**：
    1.  Librarian: "Input: [Log A, Log B] -> Summary: [Summary V2]"
    2.  Judge: "請問 Summary V2 是否準確反映了 Log A 與 Log B？有無遺漏？"
    3.  Report: 若 Judge 評分 < 8/10，發送 Alert 給開發者，並將該案例標記為 "Bad Case"。

### 3.3 Dashboard 可視化
*   在 Coach Dashboard 的後台，增加一個 "System Health" 頁面。
*   顯示每週的平均 Recall Rate 與壓縮效率趨勢圖。

## 4. 迭代週期 (Iteration Loop)

1.  **Collect**: 收集 Daily Health Check 中的 "Bad Cases"。
2.  **Analyze**: 分析是 Prompt 指令不清，還是 Context Window 不足。
3.  **Refine**: 修改 System Prompt (例如增強對該類 Bad Case 的防禦)。
4.  **Verify**: 用 Golden Set 進行回歸測試。
5.  **Deploy**: 更新 Librarian Service。

## 5. 具體 Task List

- [ ] **Task 2.1**: 建立 `backend/tests/evaluation/` 目錄，存放 Golden Set 數據。
- [ ] **Task 2.2**: 開發 `judge_agent.py`，封裝評分邏輯 (Recall, Consistency Check)。
- [ ] **Task 2.3**: 整合至 CI/CD 流程，每次 Git Push 修改 Prompt 時自動執行 Prompt Test。
- [ ] **Task 2.4**: 實作每日隨機抽樣健檢 Cron Job。

