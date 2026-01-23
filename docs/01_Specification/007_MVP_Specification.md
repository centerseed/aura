
# Naruvia Web POC Specification (Streamlit)

本文件定義了一個快速驗證用的 Web POC。目的不是生產環境，而是為了直觀展示 Naruvia 的核心治理能力 (Entropy Reduction)。

## 1. 技術選型 (Technology Stack)
*   **Web Framework**: Streamlit (Python) - 快速構建互動式 UI。
*   **Backend Logic**: 直接呼叫 `LibrarianService` (Python Class)。
*   **Persistence**: SQLite (local.db) + SQLModel - 輕量級，免 Docker，但邏輯與未來 Postgres 相容。
*   **LLM**: Gemini 1.5 Pro via Google AI SDK.

## 2. 功能模組 (Modules)

### 2.1 頁面一：本體論設定 (Context Setup)
*   **功能**: 讓用戶定義初始的「腦內地圖」。
*   **UI**:
    *   `L1 Areas`: 可新增/刪除 (預設 Life, Work)。
    *   `L2 Products`: 在每個 Area 下新增 Products (如 Naruvia, Health)。
    *   **狀態顯示**: 清單式呈現目前的 Ontology 結構。

### 2.2 頁面二：快速輸入 (Rapid Ingest)
*   **功能**: 模擬用戶隨性的碎念輸入。
*   **UI**:
    *   多行文字框 (Text Area)。
    *   日期選擇器 (Optional, e.g., "Natural Language Date" 或 DatePicker)。
    *   **[Submit]** 按鈕。
    *   下方顯示 "Pending Inbox" (尚未整理的輸入)。

### 2.3 頁面三：治理控制台 (The Governance Room)
*   **功能**: 展示 AI 治理的過程與結果。在此見證「熵減」。
*   **UI**:
    *   **Left Panel (Input)**: 顯示目前 Inbox 中的所有 Raw Texts。
    *   **Action**: 一顆顯眼的 **[🪄 執行熵減 (Run Librarian)]** 按鈕。
    *   **Right Panel (Output)**:
        *   顯示 AI 的思考過程 (Thinking Process / Chain of Density)。
        *   顯示轉換後的 Structued Tasks。
        *   允許用戶手動微調結果 (Edit)。
        *   **[Confirm & Commit]** 按鈕 (寫入正式資料庫)。

### 2.4 頁面四：最終看板 (The Sorted View)
*   **功能**: 展示整理後的井然有序。
*   **UI**:
    *   **Kanban View**: 依據 `Status Drawer` (Active, Maintain, Inbox) 分欄顯示。
    *   **Group by**: 支援切換視角 (依 Area 分組 / 依 Product 分組)。
    *   **Tags**: 每個 Task 卡片上清楚顯示 L1/L2/L3 標籤。

## 3. 資料結構 (Lite Schema)

為了 POC 快速迭代，我們使用 SQLModel 定義輕量 Schema (SQLite):
*   `Area`: id, name
*   `Product`: id, area_id, name
*   `RawInput`: id, content, created_at, processed (bool)
*   `Task`: id, product_id, topic (str), content, status, due_date

## 4. 目標體驗 (Target Experience)
1.  用戶先設定好 "Work > Naruvia"。
2.  亂打一句 "明天要把 Naruvia 架構圖畫好，還有記得買牛奶"。
3.  按一下整理。
4.  系統自動拆成兩條：
    *   Task A: "繪製架構圖" -> `Work` > `Naruvia` > `Docs` (Active)
    *   Task B: "買牛奶" -> `Life` > `Chore` > `Shopping` (Active)
5.  用戶感受到：「哇，它真的懂我。」
