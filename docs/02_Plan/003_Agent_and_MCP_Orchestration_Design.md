# Agent & MCP Orchestration Design (幕僚與協議協作設計)

本文件定義了 Aura 系統中各 Agent 的通訊機制，以及如何透過 MCP (Model Context Protocol) 存取外部能力（日曆、檔案、NLU 規則）。

## 1. 協作模式設計 (The Hybrid Framework)

AAE 框架支援雙軌協作模式，以平衡「業務穩定性」與「未來靈活性」。

### 1.1 靜態流水線 (Static Pipeline - 優先實作)
*   **定義**: 針對確定性的業務邏輯（如 Aura 的輸入解析流）。
*   **機制**: 使用 `Orchestrator` 強制定義 `Gatekeeper -> Librarian -> Coach` 的執行順序與合約。
*   **優點**: 極度穩定、部署成本低、測試邊界清晰。

### 1.2 動態轉接 (Dynamic Handoff - 架構預留)
*   **定義**: 針對非確定性的探索式任務或跨產品通用調度。
*   **機制**: 利用 Pydantic AI 的 `Agent Delegation` 機制。
*   **優點**: 可應對複雜的邊界問題，支援隨心所欲的 Agent 調度。

### 1.3 共享上下文 (The AuraDeps)
不論是何種模式，均透過 Pydantic AI 的 `Deps` 機制共享以下狀態：
*   **User Session**: 當前用戶權限與會話歷史。
*   **MCP Support**: 集中的 MCP 伺服器連接管理。
*   **Shared Memory**: Agent 間的臨時工作區 (Working Memory)。

---

## 2. MCP (Model Context Protocol) 架構整合

MCP 是 Aura Agent 執行具體動作的「手」。

### 2.1 Backend 作為 MCP Client
Aura 後端將實作 MCP Client 邏輯，與以下伺服器溝通：

| Agent | 所需 MCP Server | 主要 Tool 功能 |
| :--- | :--- | :--- |
| **Gatekeeper** | `NLU_Enforcer_Server` | 執行屬性識別、強制 Schema 對齊。 |
| **Librarian** | `File_Management_Server` | 自動檢索 `Aura_Vault`、建立索引、自動歸檔。 |
| **Coach** | `Productivity_Connect_Server` | 掃描 WBS (Markdown)、讀取 Google Calendar、衝突偵測。 |

### 2.2 接口實作概念 (Clean Architecture)
根據我們的開發標準，MCP 的呼叫應封裝在 `Infrastructure` 層，並透過 `Domain.Interfaces` 暴露給 Agent。

---

## 3. Agent 協調器 (The Orchestrator)

在 `Application/UseCases` 中，我們將實作 `InputOrchestrator`：
1.  **調度 守門人**: 給予 Raw Input，要求回傳 `StructuredInput` (透過 NLU MCP)。
2.  **調度 管理員**: 給予 `StructuredInput`，要求存檔並回傳 `RelevantDocs` (透過 File MCP)。
3.  **調度 教練**: 提供以上所有資訊，要求產出 `/health` 風險與對創辦人的建議回覆。

## 4. 多用戶會話管理 (Multi-Tenant & Session Management)

為了支援多用戶同時使用且確保資料安全，系統實作以下機制：

### 4.1 身份感知 (Identity Awareness)
*   **Session Key**: 每個會話由 `user_id` + `session_id` 組成。
*   **Context Isolation**: `AuraContext` 不再是全域共享，而是由 `SessionStore` 根據請求實體動態加載。

### 4.2 持久化會話 (Session Persistence)
*   由於使用 Cloud Run (Serverless)，記憶體狀態不可靠。
*   **Firestore-backed State**: 所有 Agent 的中間狀態與歷史 Context 會同步存儲在 Firestore 的 `sessions` 集合中。

### 4.3 MCP 權限沙盒
*   所有 MCP 工具調用必須驗證權限。
*   `Librarian` 在執行檔案動作時，MCP Server 會強制校驗路徑（例如：`/aura_vault/{user_id}/...`）。

---

## 5. 多模型適配與 MCP 橋接 (LLM Agnostic MCP)

為了確保系統能在不同 LLM 之間切換，同時發揮 **Gemini 2.0 Flash-Lite** 的極速性能，實作以下抽象層：

### 5.1 LLM 適配器模式 (Adapter Pattern)
*   **Infrastructure 層**: 實作 `BaseLLMAdapter`，統一代碼調用介面。
*   **Gemini 2.0 Flash-Lite (Primary)**: 
    *   利用其極高的 Token 吞吐量與低延遲特性處理高頻的 NLU 與 Orchestration。
    *   原生支援 Function Calling，與 MCP Tool 格式高度契合。
*   **OpenAI / Claude (Secondary)**: 透過適配層將 MCP 工具定義轉換為各家模型特有的 `tools` 宣告格式。

### 5.2 MCP Tool 映射與執行機制
1.  **Registry**: 系統啟動時載入外部 MCP Servers (如 Calendar, File, NLU Enforcer)。
2.  **Schema Converter**: 
    *   將 MCP `tools` 轉換為對應模型的 Function Schema。
    *   針對 Gemini 2.0 Flash-Lite 優化 Tool Description。
3.  **Dispatcher**: 
    *   攔截 LLM 的 `ToolCall` 請求。
    *   轉發至 MCP Server 執行。
    *   將 `ToolResponse` 回填至對話歷史並驅動 LLM 繼續執行。

---

## 6. 異常處理與降級
*   任何 Tool Call 的結果必須經過 Pydantic 校驗。
*   針對不同模型的 Token 限制、速率限制進行統一封裝，支援模型故障時的自動切換 (Failover)。

---

## 7. Governance Integration Strategy (整合新治理邏輯)

本節定義了如何將「滾動式記憶 (Rolling Memory)」與「治理漏斗 (Governance Funnel)」整合進現有的 Agent 協作架構中。

### 7.1 Librarian 的角色升級：從操作員到決策者
*   **Old**: 只是執行 "Save to File" 的 MCP Client。
*   **New**: 維護 `RollingSummary` 狀態，並決定是否發起變更提案 (`Proposal`)。

### 7.2 新增 Memory Tools (Librarian 專用)
Librarian Agent 將配備以下專屬工具 (可由內部 Service 直接提供，或封裝為 MCP)：
1.  `get_area_context(area_id: str)`: 獲取該 Area 的 `RollingSummary` 與 `ActiveProjects` 清單。
2.  `update_rolling_summary(area_id: str, new_summary: str)`: 更新壓縮後的記憶。
3.  `scan_related_archives(embedding: list[float])`: (L0 Funnel) 快速檢索歷史向量（若有啟用）。

### 7.3 變更提案與審核流 (The Proposal Pipeline)
為了落實「高熵保留 (Life) vs 強制熵減 (Work)」的差異治理，寫入操作不再是原子的。

1.  **Librarian Phase**:
    *   Input: `User Input` + `Area Context`
    *   Process: 執行 Chain of Density 壓縮與 Gravity Tracking。
    *   Output: `GovernanceProposal` (包含：建議的標籤、建議合併的 Master Note ID、以及更新後的 Summary)。

2.  **Coach Phase (Approval)**:
    *   Input: `GovernanceProposal`
    *   Logic:
        *   **Work Domain**: 若信心度 > 90%，**Auto-Approve**。
        *   **Life Domain**: 若涉及新標籤建立，標記為 **Pending Review**，等待用戶確認或 Coach 二次判斷。
    *   Action: 只有在 Approved 後，Coach (或 Orchestrator) 才呼叫 `File_Management_Server` 執行實際的寫入。

### 7.4 數據流與狀態同步
*   **Firestore**: 僅存儲 `RollingSummary` 與 `PendingProposals`。
*   **FileSystem (Vault)**: 存儲最終的 Markdown 筆記。
*   **Sync**: 每次 File System 變更後，觸發非同步任務更新 Firestore 中的索引狀態，確保兩者最終一致。
