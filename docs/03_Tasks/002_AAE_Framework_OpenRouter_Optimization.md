# Task 002: Zentropy Agent Engine (ZAE) 核心框架與多 LLM 適配

## 狀態 (Status)
*   **階段**: Milestone 2 (Framework Evolution)
*   **優先級**: 最高 (Critical)
*   **執行者**: Antigravity
*   **狀態**: 進行中 (In Progress) - 已完成 [002-1] ~ [002-6]

## 任務描述 (Description)
建立一個可重用、跨產品、**多 LLM 適配**的 **Zentropy Agent Engine (ZAE)** 框架。
本任務的核心是建立基於 **Pydantic AI** 的 Agent 基礎架構，透過 `ILLMAdapter` 介面支援多個 LLM 提供商（Gemini、OpenAI、Claude、Mistral 等）。
**開發權重**：優先實作 **「靜態流水線 (Static Pipeline)」** 以確保 Zentropy 核心業務的絕對穩定性，同時在架構層預留動態轉接的擴充性。
**核心策略**：透過 **OpenRouter** 作為統一 Gateway，實現「價格套利」與「模型備援」。
**首選實作**：以 **Google Gemini 2.0 Flash Lite** 為主力，搭配 **DeepSeek V3 (via Fireworks US)** 處理複雜邏輯，**Llama 3.1** 處理簡單分類。

## 查核清單 (Checklist)

### 1. AAE 通用領域模型 (基於 Pydantic AI)
- [x] [002-1] 建立 `pydantic-ai` 基礎運行環境（安裝與配置）。✅
- [x] [002-2] 定義 `ZentropyDeps`：封裝多用戶 Session 與 MCP 管理員。✅
- [x] [002-3] 定義 `ILLMAdapter` 介面：適配 Pydantic AI 的 `Model` 接口（支援 Gemini/OpenAI/Claude 等多廠商）。✅

### 2. 多 LLM 適配層實作 (Infrastructure)
- [x] [002-4] 實作通用 LLM Adapter 架構與首個參考實作：✅
    - **已完成實作**：`GeminiAdapter` 支援多種 Gemini 模型（含 Gemini 2.5 Flash-Lite）
    - **核心能力**：
        - ✅ 支援 **Parallel Tool Calling**：基於 Pydantic AI 1.44.0 的 GoogleModel
        - ✅ 支援 **Streaming Response**：透過 `supports_streaming` property 確認
        - ✅ 統一錯誤處理與降級機制：透過 Domain Exception 封裝
    - **擴展目標**：實作 `OpenRouterAdapter`，支援動態路由。
    - **模型清單 (Tiered Routing)**：
        - **Tier 1 (Routine)**: `meta-llama/llama-3.1-8b-instruct` ($0.02/M) - 簡單分類。
        - **Tier 2 (Narrative)**: `google/gemini-2.0-flash-lite` ($0.075/M) - 長文本摘要。
        - **Tier 3 (Reasoning)**: `deepseek/deepseek-chat` ($0.28/M) - 複雜結構化。
    - **重要規範 (Data Sovereignty)**:
        - 所有 DeepSeek/Qwen 請求**必須**透過 US-based providers (如 Fireworks, Together) 路由，嚴禁直連中國官方 API。
        - 需在 OpenRouter 請求中指定 `provider: { order: ["Fireworks", "Together"] }`。
    - **擴展性**：透過 `LLMAdapterFactory` 預留 `OpenAIAdapter`、`ClaudeAdapter`、`MistralAdapter` 等接口
    - **已驗證模型**：
        - `gemini-2.5-flash-lite` (穩定版 - 最低延遲、最低成本)
        - `gemini-2.5-flash-lite-preview-09-2025` (預覽版)
        - `gemini-2.0-flash-exp` (實驗版)
        - `gemini-1.5-pro` (高能力版)
- [x] [002-5] 實作 **通用 Context Token Management**：✅
    - ✅ **ContextWindow**: 封裝不同 LLM 的 context window 配置（Gemini 1M/2M, GPT-4 128K, Claude 200K）
    - ✅ **ITokenCounter**: 統一 token 計數介面
    - ✅ **GeminiTokenCounter**: 使用 Google Generative AI API 精確計數
    - ✅ **ContextManager**: 智能壓縮 conversation_history 服務
        - 滑動窗口壓縮策略 (Sliding Window)
        - 保留系統訊息 (System Message Preservation)
        - Token 使用統計與監控
        - 自動檢測容量與壓縮觸發
    - **Phase 2 預留**: Summarize 策略、Hierarchical 策略

### 3. MCP 通用客戶端 (Infrastructure)
- [x] [002-6] 實作 `AAE_MCP_Manager`：✅
    - ✅ **MCPServerConfig**: 支援三種傳輸類型（STDIO、SSE、Streamable HTTP）
    - ✅ **IMCPServerManager**: 統一的 MCP 伺服器管理介面
    - ✅ **AAEMCPManager**: 完整實作，支援：
        - ✅ 動態註冊/註銷 MCP 伺服器
        - ✅ 列出工具與資源
        - ✅ 工具呼叫轉發
        - ✅ 伺服器生命週期管理
    - ✅ **MCPServerFactory**: 便利工廠用於快速配置（Python、Filesystem 預設實作）
    - ✅ **整合測試**: 完整工作流測試、多伺服器管理、禁用伺服器檢驗
    - **Phase 2 預留**: Automated Schema Bridge（多廠商 Tool Schema 轉換）
- [ ] [002-7] 實作 **User-Sandbox Security**：在框架層強制執行 MCP 工具的權限路徑（如檔案存取路徑限制）。

### 4. 框架複用性驗證 (TDD & Demo)
- [ ] [002-8] **(TDD)** 撰寫跨模型測試：
    - 確保同一套 Agent 定義可在 **Gemini / OpenAI / Mock 模型**間無縫切換。
    - 驗證不同 LLM 的工具調用結果一致性。
    - 測試 Token 管理在不同模型上的正確性。
- [ ] [002-9] 建立第一個 AAE Agent 實例 (Gatekeeper Demo)：
    - 驗證「輸入 -> 工具喚起 -> 結構化回傳」的一體化流程。
    - **多模型演示**：展示同一 Gatekeeper Agent 在 Gemini 和 OpenAI 上的運行效果。

---

## 備註
*   **框架定位**：「一次編寫，多處使用，OpenRouter 統一接入」。
*   **首選模型**：以 **Google Gemini 2.0 Flash Lite** 為主力，搭配 **DeepSeek V3 (via Fireworks US)** 處理複雜推理。
*   **成本策略**：利用 OpenRouter 的價格優勢，將簡單任務卸載給 **Llama 3.1**，複雜任務交給 **DeepSeek V3**，長文本交給 **Gemini**。
*   **Pydantic AI 優勢**：框架原生支援多個 LLM 提供商，降低遷移成本。
*   所有的狀態持久化 (Firestore) 將與 Session Manager 深度結合。
