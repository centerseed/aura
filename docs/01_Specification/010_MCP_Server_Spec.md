
# Zentropy MCP Server Specification

**版本**: v1.0
**定位**: 外部 AI 存取 Zentropy 資料資產的標準介面 (The Headless Interface)

本文件定義了 Zentropy 如何透過 **Model Context Protocol (MCP)** 向外部世界（如 Claude Desktop, Cursor, IDEs）暴露其核心資產與治理能力。這使得 Zentropy 能夠成為用戶的「外掛大腦」，讓各種 AI Agent 都能讀取並貢獻到用戶的知識體系中。

---

## 1. 核心理念：Reverse Integration (反向整合)

傳統工具強迫用戶進入 App 操作；Zentropy MCP 允許用戶在**任何有 AI 的地方**直接操作 Zentropy。

*   **Read (Context Injection)**: 讓 AI 寫程式/寫文章時，能讀取 Zentropy 裡的規格與知識。
*   **Write (Knowledge Capture)**: 讓 AI 生成的內容（如 Spec, Code Snippet）能一鍵存回 Zentropy 的正確位置。
*   **Govern (Active Trigger)**: 讓外部 AI 也能觸發 Librarian 進行整理。

---

## 2. Resources (資源暴露)

Zentropy 透過 `mcp-server` 暴露以下資源，格式均為 Markdown 或 JSON。

### 2.1 知識庫與資產 (Knowledge Assets)
*   **URI Pattern**: `zentropy://{area}/{product}/{topic}/...`
*   **Examples**:
    *   `zentropy://Work/Naruvia/Specs/Librarian_Engine` (讀取特定文檔)
    *   `zentropy://Work/Naruvia/Tasks/Active` (讀取目前活躍任務)
*   **用途**: 
    *   讓 Cursor/Claude 讀取最新的產品規格 (如 `009_Librarian_Engine_Spec.md`) 作為 Coding Context。
    *   避免 AI 幻覺，確保它基於最新的「Zentropy 真理」工作。

### 2.2 滾動敘事 (Rolling Sagas)
*   **URI Pattern**: `zentropy://saga/{product_id}`
*   **Content**: 返回該 Product 的 L1/L2 級別摘要 (Narrative Nodes)。
*   **用途**: 快速讓外部 AI 了解某個專案的「前情提要」與「演進脈絡」，而不需要讀取幾千條 Raw Tasks。

### 2.3 用戶偏好 (User Preferences)
*   **URI Pattern**: `zentropy://profile/bias-vector`
*   **Content**: 返回用戶的分類偏好與 Negative Prompts。
*   **用途**: 讓外部 AI 也能模仿 Zentropy Librarian 的語氣與判斷標準。

---

## 3. Tools (工具能力)

Zentropy MCP Server 提供以下工具供 AI 調用：

### 3.1 `capture_thought` (捕捉想法/碎料)
將外部的對話、代碼片段或網頁內容，快速丟入 Zentropy 的 Inbox 或特定 Product。

*   **Arguments**:
    *   `content` (string, required): 內容 (Markdown)
    *   `source` (string): 來源 (e.g., "Cursor Conversation")
    *   `context_hint` (string, optional): 語義提示 (如 "這是 Naruvia 的新 Spec")
*   **Behavior**: 
    1.  存入 `INBOX`。
    2.  (Optional) 立即觸發 Brain Dump 進行自動歸類。
    3.  (Scenario) 用戶在 Cursor 說：「把這段對話存成 Zentropy 的 Spec」，AI 調用此工具。

### 3.2 `append_to_knowledge` (寫入知識庫)
將結構化的知識直接寫入指定的 Reference 區域。

*   **Arguments**:
    *   `product_name` (string): 目標產品 (e.g., "Naruvia")
    *   `topic_name` (string): 目標主題 (e.g., "Specs")
    *   `title` (string): 標題
    *   `content` (string): 完整內容
*   **Behavior**: 
    1.  檢查 Product/Topic 是否存在 (若無則報錯或自動創建)。
    2.  創建一個狀態為 `REFERENCE` 的 Task/Note。
    3.  生成 Embeddings 並更新索引。
    4.  (Scenario) 用戶：「這份規格寫好了，存進 Naruvia 的 Specs 裡。」

### 3.3 `query_memory` (查詢記憶)
進行語義搜尋，找回相關的過去決策或資料。

*   **Arguments**:
    *   `query` (string): 自然語言問題
    *   `scope` (string, optional): 限制在特定 Area/Product
*   **Behavior**: 
    1.  執行 Vector Search (包含 User Bias 校正)。
    2.  返回最相關的 Top-K 筆資料 (含 Relevance Score)。

---

## 4. Prompts (預設提示詞模板)

MCP 允許 Server 提供預設 Prompt，讓 Client 端 AI 更聰明。

### 4.1 `summarize-for-zentropy`
*   **Description**: 將當前的對話上下文，整理成符合 Zentropy `Rolling Summary` 格式的精簡摘要。
*   **Template**: 
    "請將以下內容總結為 Zentropy 風格的原子筆記：
    1. 識別核心 Entity (Product)
    2. 提取關鍵決策 (Key Decisions)
    3. 忽略閒聊與冗餘
    4. 使用 Markdown 格式..."

### 4.2 `generate-spec-structure`
*   **Description**: 生成標準的 Zentropy Specification 文件結構。
*   **Template**: (基於 `001_Product_Definition` 等既有 Spec 的結構模板)

---

## 5. 技術實作架構

### 5.1 MCP Server (Node.js/TypeScript)
*   **Framework**: `@modelcontextprotocol/sdk`
*   **Deployment**: 
    *   **Local Mode**: 透過 `stdio` 與本地 Agent (如 Claude Desktop) 通訊。直接連線本地 Postgres 或透過 API 連線 Cloud。
    *   **Remote Mode (SSE)**: 部署在 Cloud Run，透過 SSE (Server-Sent Events) 提供服務。

### 5.2 與 Librarian Engine 的協作
MCP Server 本身不包含複雜邏輯，它是 **Librarian Engine 的介面層**。
*   當調用 `capture_thought` 時，MCP Server 呼叫 Librarian Engine 的 `brain-dump` API。
*   當調用 `query_memory` 時，MCP Server 呼叫 `vector-search` API。

---

## 6. 使用場景範例 (User Journey)

**場景：規格寫入**

1.  **Context**: 用戶在 Cursor 中與 AI 討論並完成了一份 "Librarian Engine Spec"。
2.  **User**: 「這份文件很棒，幫我存進 Zentropy 的 Naruvia 專案，放在 Specs 分類下。」
3.  **Cursor (MCP Client)**: 
    *   解析意圖，選擇工具 `zentropy_append_to_knowledge`。
    *   參數: `{ product_name: "Naruvia", topic_name: "Specs", title: "Librarian Engine Spec", content: "..." }`
4.  **Zentropy MCP Server**: 
    *   接收請求，寫入資料庫 `tasks` 表 (Status=REFERENCE)。
    *   觸發 Librarian 進行 Vector Embedding。
    *   返回: "Successfully saved to Naruvia/Specs."
5.  **User**: 看到確認訊息，安心關閉對話。Zentropy 已成為唯一真理來源 (SSOT)。
