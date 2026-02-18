/**
 * Zentropy MCP Server
 *
 * Implements the full request processing pipeline (Section 6.4):
 *   Auth → Rate Limiter → Input Validator →
 *   Content Sanitizer → Scope Checker → Tool Handler →
 *   Output Sanitizer → Audit Logger → Response
 *
 * Integrated into the Next.js API server as a shared process.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { loadMcpConfig, type McpConfig } from "./config";
import type { AuthContext, OAuthScope } from "./types";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

// Security
import { authenticateMcpRequest } from "./security/auth-middleware";
import { checkToolScope, checkResourceScope } from "./security/scope-checker";
import { RateLimiter, RateLimitError } from "./security/rate-limiter";
import { validateToolInput } from "./security/input-validator";
import { sanitizeToolInput } from "./security/content-sanitizer";
import { sanitizeOutput } from "./security/output-sanitizer";

// Audit
import { AuditLogger } from "./audit/audit-logger";

// Backend
import { BackendApiClient, BackendApiError } from "./backend-client/api-client";

// Tools (legacy — kept for backwards compatibility, marked deprecated)
import { handleCaptureThought } from "./tools/capture-thought";
import { handleAppendToKnowledge } from "./tools/append-to-knowledge";
import { handleQueryMemory } from "./tools/query-memory";

// Tools (v2 — Bridge architecture)
import { handleCapture } from "./tools/capture";
import { handleReportDone } from "./tools/report-done";

// Tools (dev dashboard)
import { handleListTasks } from "./tools/list-tasks";
import { handleCreateTask } from "./tools/create-task";
import { handleUpdateTask } from "./tools/update-task";
import { handleListProducts } from "./tools/list-products";
import { handleGetPlan } from "./tools/get-plan";
import { handleGetReference } from "./tools/get-reference";
import { handleAddReference } from "./tools/add-reference";
import { handleAddSubItem } from "./tools/add-sub-item";
import { handleUpdateSubItem } from "./tools/update-sub-item";

// Resources (legacy)
import { readKnowledgeAsset } from "./resources/knowledge-assets";
import { readRollingSaga } from "./resources/rolling-sagas";
import { readUserPreferences } from "./resources/user-preferences";

// Resources (v2 — Bridge architecture)
import { readContextNow } from "./resources/context-now";
import { readMemoryBias } from "./resources/memory-bias";
import { readAreasHierarchy } from "./resources/areas-hierarchy";
import { readHandoffReady } from "./resources/handoff-ready";

// Prompts
import {
  renderSummarizePrompt,
  SUMMARIZE_FOR_ZENTROPY_NAME,
} from "./prompts/summarize-for-zentropy";
import {
  renderGenerateSpecPrompt,
  GENERATE_SPEC_NAME,
} from "./prompts/generate-spec-structure";

/**
 * Create and configure the MCP server with all tools, resources, and prompts.
 */
export function createMcpServer(configOverride?: Partial<McpConfig>): McpServer {
  const config = { ...loadMcpConfig(), ...configOverride };
  const server = new McpServer({
    name: "zentropy-mcp-server",
    version: "0.1.0",
  });

  const rateLimiter = new RateLimiter(config);
  const auditLogger = new AuditLogger(config.logLevel);
  const apiClient = new BackendApiClient(config.backendUrl);

  // Periodic cleanup of rate limiter data
  const cleanupInterval = setInterval(() => rateLimiter.cleanup(), 60_000);
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  /**
   * Full request pipeline for tool calls.
   */
  async function executeToolPipeline(
    toolName: string,
    rawInput: Record<string, unknown>,
    requiredScopes: OAuthScope[],
    handler: (
      apiClient: BackendApiClient,
      authContext: AuthContext,
      input: Record<string, unknown>,
      sanitized: boolean,
    ) => Promise<unknown>,
    /** Auth info from MCP SDK (extra.authInfo), populated by req.auth in server.ts */
    authInfo?: AuthInfo,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const startTime = Date.now();
    let authContext: AuthContext | undefined;
    let sanitizationApplied = false;

    try {
      // Step 1: Auth — use token from SDK's authInfo (set via req.auth in server.ts)
      console.log(`[mcp-pipeline] tool=${toolName} | authInfo present: ${!!authInfo} | authInfo.token present: ${!!authInfo?.token}`);
      const token = authInfo?.token;
      authContext = await authenticateMcpRequest(
        token ? `Bearer ${token}` : undefined,
      );

      // Step 2: Rate Limiting
      rateLimiter.check(authContext.userId, toolName);

      // Step 3: Input Validation
      const validatedInput = validateToolInput(toolName, rawInput);

      // Step 4: Content Sanitization
      const sanitization = sanitizeToolInput(validatedInput);
      sanitizationApplied = sanitization.sanitized;

      if (sanitization.sanitized) {
        auditLogger.logSecurityEvent({
          userId: authContext.userId,
          clientId: authContext.clientId,
          tool: toolName,
          event: "content_sanitized",
          details: sanitization.detectedPatterns,
        });
      }

      // Step 5: Scope Check
      checkToolScope(authContext, toolName);

      // Step 6: Tool Handler
      const result = await handler(
        apiClient,
        authContext,
        sanitization.sanitizedInput,
        sanitizationApplied,
      );

      // Step 7: Output Sanitization
      const sanitizedOutput = sanitizeOutput(result, authContext.scopes);

      // Step 8: Audit Log
      const outputJson = JSON.stringify(sanitizedOutput.data);
      auditLogger.logToolCall(
        auditLogger.createEntry({
          userId: authContext.userId,
          clientId: authContext.clientId,
          tool: toolName,
          scopeUsed: requiredScopes,
          input: rawInput,
          outputSizeBytes: Buffer.byteLength(outputJson, "utf-8"),
          sanitizationApplied,
          latencyMs: Date.now() - startTime,
          status: "success",
        }),
      );

      return {
        content: [{ type: "text" as const, text: outputJson }],
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof RateLimitError) {
        auditLogger.logToolCall(
          auditLogger.createEntry({
            userId: authContext?.userId || "unknown",
            clientId: authContext?.clientId || "unknown",
            tool: toolName,
            scopeUsed: requiredScopes,
            input: rawInput,
            outputSizeBytes: 0,
            sanitizationApplied,
            latencyMs,
            status: "rate_limited",
          }),
        );
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "rate_limited",
              message: error.message,
              retry_after_seconds: error.retryAfterSeconds,
            }),
          }],
        };
      }

      if (error instanceof BackendApiError) {
        auditLogger.logError({
          userId: authContext?.userId,
          clientId: authContext?.clientId,
          tool: toolName,
          error: `Backend API error: ${error.statusCode} ${error.message}`,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "backend_error",
              status: error.statusCode,
              message: `Backend returned status ${error.statusCode}: ${error.message}`,
            }),
          }],
        };
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      auditLogger.logError({
        userId: authContext?.userId,
        clientId: authContext?.clientId,
        tool: toolName,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      const status =
        errorMessage.includes("Insufficient permissions") ||
        errorMessage.includes("Authorization")
          ? "unauthorized"
          : "error";

      auditLogger.logToolCall(
        auditLogger.createEntry({
          userId: authContext?.userId || "unknown",
          clientId: authContext?.clientId || "unknown",
          tool: toolName,
          scopeUsed: requiredScopes,
          input: rawInput,
          outputSizeBytes: 0,
          sanitizationApplied,
          latencyMs,
          status,
        }),
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: status, message: errorMessage }),
        }],
      };
    }
  }

  // ─── Register Tools (Section 4) ───────────────────────────────
  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "capture_thought",
    "捕捉想法/碎料 — Capture external conversations, code snippets or web content into Zentropy Inbox.",
    {
      content: z
        .string()
        .min(1)
        .max(10_000)
        .describe("要記錄的內容，建議精簡扼要（1-3 句話，100 字以內最佳）。系統會用 AI 分類，過長的內容可能導致處理失敗。"),
      source: z
        .string()
        .describe("Source of the content: Claude Code, Cursor, Claude Desktop, or API"),
      context_hint: z
        .string()
        .max(200)
        .optional()
        .describe("Semantic hint for classification (max 200 chars)"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "capture_thought",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleCaptureThought,
        extra.authInfo,
      );
    },
  );

  server.tool(
    "append_to_knowledge",
    "寫入知識庫 — Write structured knowledge into a specified Reference area.",
    {
      product_name: z
        .string()
        .min(1)
        .max(200)
        .describe("Target product name (validated server-side)"),
      topic_name: z
        .string()
        .min(1)
        .max(200)
        .describe("Target topic name"),
      title: z
        .string()
        .min(1)
        .max(200)
        .describe("Title of the knowledge entry (max 200 chars)"),
      content: z
        .string()
        .min(1)
        .max(50_000)
        .describe("Full content (max 50,000 chars)"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "append_to_knowledge",
        input as Record<string, unknown>,
        ["write:knowledge"],
        handleAppendToKnowledge,
        extra.authInfo,
      );
    },
  );

  server.tool(
    "query_memory",
    "[Deprecated: use 'search'] 查詢記憶 — Perform semantic search across past decisions and data.",
    {
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("Natural language question (max 500 chars)"),
      scope: z
        .string()
        .max(200)
        .optional()
        .describe("Limit search to a specific Area/Product"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "query_memory",
        input as Record<string, unknown>,
        ["read:tasks"],
        handleQueryMemory,
        extra.authInfo,
      );
    },
  );

  // ─── Register v2 Tools (Bridge Architecture) ──────────────────

  // capture — 統一入口，取代 capture_thought
  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "capture",
    "統一入口 — 丟進來就好，AI 自動分類歸檔。支援 thought / execution_plan / result 三種模式。\n\n" +
      "★ Brain Dump 模式（thought，最常用）:\n" +
      "使用 thought 模式（預設）傳入自由格式文字，AI 會自動辨識主任務與子任務。\n" +
      "支援以 '-' 或 '•' 開頭的子項目格式，AI 自動建立 sub-items：\n" +
      "  例：'準備年度報告\\n- 整理財務數據\\n- 撰寫摘要\\n- 設計投影片'\n" +
      "  → AI 自動建立主任務 + 3 個子任務，並自動歸檔到正確的 Product/Topic\n" +
      "  ★ 不需要指定 product_id 或 topic_id，AI 全自動分類\n\n" +
      "與 create_task 的差異:\n" +
      "  capture（本工具）  → 適合 brain dump，AI 自動分類+建立子任務\n" +
      "  create_task        → 適合精準建立，需自行指定 product_id/topic_id\n\n" +
      "模式說明:\n" +
      "- thought (預設): 自由文字 brain dump，AI 自動分類歸檔\n" +
      "- execution_plan: 結構化子任務，需要 parent_id\n" +
      "- result: 執行結果回報，需要 parent_id\n\n" +
      "必填參數:\n" +
      "- content: 要記錄的內容（不可為空白）\n" +
      "- parent_id: execution_plan 和 result 模式必填\n\n" +
      "可選參數:\n" +
      "- source: 來源（如 'mcp', 'web', 'mobile'，預設 'mcp-client'）\n" +
      "- context_hint: 給 AI 的分類提示（如 '關於 Naruvia 專案'），幫助正確歸檔\n\n" +
      "常見錯誤:\n" +
      "- 'content is required' - 缺少 content\n" +
      "- 'mode must be one of: thought, execution_plan, or result' - mode 值不正確\n" +
      "- 'parent_id is required for execution_plan mode' - execution_plan 需要 parent_id",
    {
      content: z
        .string()
        .min(1)
        .max(50_000)
        .describe("要記錄的內容，建議精簡扼要（1-3 句話，100 字以內最佳）。系統會用 AI 分類，過長的內容可能導致處理失敗。支援純文字或 JSON 結構化內容。"),
      source: z
        .string()
        .optional()
        .default("mcp-client")
        .describe("Source: Claude Code, Cursor, Claude Desktop, or API (default: mcp-client)"),
      mode: z
        .enum(["thought", "execution_plan", "result"])
        .optional()
        .describe("Mode: thought (default), execution_plan (structured sub-tasks), result (execution outcome)"),
      parent_id: z
        .string()
        .optional()
        .describe("Parent action ID (required for execution_plan and result modes)"),
      context_hint: z
        .string()
        .max(200)
        .optional()
        .describe("Semantic hint (Area/Product) to help Gatekeeper classify"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "capture",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleCapture,
        extra.authInfo,
      );
    },
  );

  // report_done — 閉環 + 偏差學習
  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "report_done",
    "報告完成 — Coach 計算估時偏差、更新 Episodic Memory、觸發 Librarian 歸檔。\n\n" +
      "必填參數:\n" +
      "- action_id: 完成的任務 ID\n\n" +
      "可選參數:\n" +
      "- actual_duration_minutes: 實際花費時間（分鐘，非負數）\n" +
      "- outcome: 完成狀態（'completed', 'partial', 'blocked', 'cancelled'，預設 'completed'）\n" +
      "- notes: 備註說明\n\n" +
      "常見錯誤:\n" +
      "- 'action_id is required' - 缺少 action_id\n" +
      "- 'actual_duration_minutes must be a non-negative number' - 時間為負數\n" +
      "- 'outcome must be one of: completed, partial, blocked, cancelled' - outcome 值不正確\n" +
      "- 'Task not found' - 任務不存在或無權限",
    {
      action_id: z
        .string()
        .min(1)
        .describe("ID of the completed action"),
      actual_duration_minutes: z
        .number()
        .optional()
        .describe("Actual time spent (minutes)"),
      outcome: z
        .enum(["completed", "partial", "blocked", "cancelled"])
        .optional()
        .describe("Outcome status (default: completed)"),
      notes: z
        .string()
        .max(2000)
        .optional()
        .describe("Completion notes"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "report_done",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleReportDone,
        extra.authInfo,
      );
    },
  );

  // search — 語意搜尋（重命名 query_memory）
  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "search",
    "語意搜尋 — 跨知識庫、決策紀錄、行動項目搜尋相關資訊。(Renamed from query_memory)",
    {
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("Natural language question (max 500 chars)"),
      scope: z
        .string()
        .max(200)
        .optional()
        .describe("Limit search to a specific Area/Product"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "search",
        input as Record<string, unknown>,
        ["read:tasks"],
        handleQueryMemory, // reuse same handler
        extra.authInfo,
      );
    },
  );

  // save_knowledge — 知識寫入（重命名 append_to_knowledge）
  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "save_knowledge",
    "寫入知識庫 — 將結構化知識寫入指定的 Reference 區域。(Renamed from append_to_knowledge)",
    {
      product_name: z
        .string()
        .min(1)
        .max(200)
        .describe("Target product name (validated server-side)"),
      topic_name: z
        .string()
        .min(1)
        .max(200)
        .describe("Target topic name"),
      title: z
        .string()
        .min(1)
        .max(200)
        .describe("Title of the knowledge entry"),
      content: z
        .string()
        .min(1)
        .max(50_000)
        .describe("Full content (max 50,000 chars)"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "save_knowledge",
        input as Record<string, unknown>,
        ["write:knowledge"],
        handleAppendToKnowledge, // reuse same handler
        extra.authInfo,
      );
    },
  );

  // ─── Register Dev Dashboard Tools ──────────────────────────

  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "list_tasks",
    "查看任務清單 — 列出指定狀態的任務（精簡版，適合 Claude Code context）。\n\n" +
      "回傳格式: { tasks: [{ id, title, status, area, product, topic, due_date, sub_items_progress }], total }\n" +
      "area/product/topic 只回傳名稱字串（非完整物件）。sub_items_progress 格式為 '完成數/總數'（如 '2/3'）。\n" +
      "可按 product_id/topic_id 過濾特定專案或主題的任務。",
    {
      status: z
        .enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
        .optional()
        .describe("Filter by task status"),
      product_id: z
        .string()
        .optional()
        .describe("Filter by product ID"),
      topic_id: z
        .string()
        .optional()
        .describe("Filter by topic ID"),
      include_sub_items: z
        .boolean()
        .optional()
        .describe("If true, include full sub_items array with id/content/completed for each task"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "list_tasks",
        input as Record<string, unknown>,
        ["read:tasks"],
        handleListTasks,
        extra.authInfo,
      );
    },
  );

  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "create_task",
    "精準建立任務 — 已知分類時直接指定 product_id/topic_id 建立任務。\n\n" +
      "與 capture 的差異:\n" +
      "  capture（推薦用於 brain dump）→ 自由文字，AI 自動分類+歸檔+建立子任務\n" +
      "  create_task（本工具）         → 精準建立，需自行指定 product_id/topic_id，不走 AI 分析\n\n" +
      "★ 正確的任務寫法（Zentropy 治理規範）:\n" +
      "任務 content 代表一個具體的「行動」，必須讓人看完立刻知道要做什麼。\n" +
      "  ✅ 好的寫法（動詞開頭，具體明確）:\n" +
      "     '整理 Q1 財務報表，準備 2/20 董事會簡報'\n" +
      "     '修復登入頁面在 iOS Safari 上的排版問題'\n" +
      "     '聯絡廠商確認 3 月備貨計畫'\n" +
      "  ❌ 不好的寫法（模糊、無法執行）:\n" +
      "     '財務' / '開會' / '思考一下' / '要處理'\n\n" +
      "★ 字數限制（嚴格執行）:\n" +
      "- content 最多 300 字元（中文約 100-150 字）\n" +
      "- 超過 300 字代表這不是一個任務標題，是一份文件 → 改用 add_reference\n" +
      "- 若任務需要詳細說明，請建立任務後用 add_reference 掛載文件\n\n" +
      "★ 狀態語意（status）:\n" +
      "- INBOX（預設）: 尚未分類，待整理\n" +
      "- ACTIVE: 正在衝刺，有明確截止日 → 強烈建議同時設 due_date\n" +
      "- MAINTAIN: 穩定營運中，異常時才需處理\n" +
      "- REFERENCE: 知識型，無時效性（放方法論、規格文件等）\n\n" +
      "⚠️ 重複防護: 24 小時內若建立相同 content 的任務，系統會拒絕並提示已存在\n\n" +
      "日期參數（YYYY-MM-DD 格式）:\n" +
      "- start_date: 任務開始日期（可選）\n" +
      "- due_date: 任務截止日期（ACTIVE 任務強烈建議填寫）\n\n" +
      "常見錯誤:\n" +
      "- 'content is required' - 缺少 content 參數\n" +
      "- 'content cannot be empty' - content 只包含空白字元\n" +
      "- 'content must not exceed 300 characters' - 內容過長，請使用 add_reference\n" +
      "- '已存在相同標題的任務' - 24 小時內已建立相同 content 的任務\n\n" +
      "回傳格式: { id, title, status, message }",
    {
      content: z
        .string()
        .min(1)
        .max(300)
        .describe("任務內容（嚴格限制 300 字元，務必精簡）"),
      product_id: z
        .string()
        .optional()
        .describe("Target product ID"),
      topic_id: z
        .string()
        .optional()
        .describe("Target topic ID"),
      status: z
        .enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE"])
        .optional()
        .describe("Initial status (default: INBOX)"),
      start_date: z
        .string()
        .optional()
        .describe("Start date in YYYY-MM-DD format"),
      due_date: z
        .string()
        .optional()
        .describe("Due date in YYYY-MM-DD format"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "create_task",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleCreateTask,
        extra.authInfo,
      );
    },
  );

  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "update_task",
    "更新任務 — 修改任務狀態、內容或日期。\n\n" +
      "必填參數:\n" +
      "- task_id: 要更新的任務 ID\n" +
      "- status、content、start_date 或 due_date: 至少需提供其中之一\n\n" +
      "★ 狀態轉換語意（Zentropy 治理規範）:\n" +
      "- INBOX → ACTIVE: 「這件事決定這週要做」，強烈建議同時設 due_date\n" +
      "- ACTIVE → ARCHIVE: 「完成了」，Coach 會計算實際 vs 預估時間做偏差學習\n" +
      "- ACTIVE → MAINTAIN: 「轉為長期維運」，不再有截止日壓力\n" +
      "- 任何狀態 → REFERENCE: 「這變成知識庫文件了」，AI 會自動歸檔\n\n" +
      "使用建議:\n" +
      "- 使用 status 變更任務狀態\n" +
      "- 使用 content 更新任務描述（遵循「動詞開頭」原則）\n" +
      "- 使用 start_date/due_date 設定或調整日期（YYYY-MM-DD 格式）\n" +
      "- 傳入 null 可清除已設定的日期（如 due_date: null）\n\n" +
      "常見錯誤:\n" +
      "- 'task_id is required' - 缺少 task_id 參數\n" +
      "- 'At least one of status, content, start_date, or due_date must be provided' - 全部未提供\n\n" +
      "回傳格式: { id, title, status, message }",
    {
      task_id: z
        .string()
        .min(1)
        .describe("Task ID to update"),
      status: z
        .enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
        .optional()
        .describe("New status"),
      content: z
        .string()
        .max(5000)
        .optional()
        .describe("Updated content"),
      start_date: z
        .string()
        .nullable()
        .optional()
        .describe("Start date in YYYY-MM-DD format. Pass null to clear."),
      due_date: z
        .string()
        .nullable()
        .optional()
        .describe("Due date in YYYY-MM-DD format. Pass null to clear."),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "update_task",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleUpdateTask,
        extra.authInfo,
      );
    },
  );

  server.tool(
    "list_products",
    "查看專案結構 — 列出所有 Area/Product/Topic 結構（精簡版）。\n\n" +
      "回傳格式: { products: [{ id, name, area, status, topics: [{ id, name }] }], total }\n" +
      "area 只回傳名稱字串。用於取得 product_id/topic_id 以供 create_task 使用。",
    {},
    async (input, extra) => {
      return executeToolPipeline(
        "list_products",
        input as Record<string, unknown>,
        ["read:tasks"],
        handleListProducts,
        extra.authInfo,
      );
    },
  );

  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "get_plan",
    "取得今日計畫 — Coach 生成的每日行動計畫（精簡版）。不帶 date 參數時預設為今天。\n\n" +
      "回傳格式: { date, coach_message, items: [{ content, product, estimated_minutes, completed, task_id }], total }",
    {
      date: z
        .string()
        .optional()
        .describe("Date in YYYY-MM-DD format (default: today)"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "get_plan",
        input as Record<string, unknown>,
        ["read:tasks"],
        handleGetPlan,
        extra.authInfo,
      );
    },
  );

  server.tool(
    "get_reference",
    "取得參考資料完整內容 — 根據 reference_id 取得完整的 reference（包含可能很大的 content 欄位）。\n\n" +
      "使用情境：先用 search 工具取得 reference metadata，再用此工具取得需要的完整內容。\n\n" +
      "必填參數:\n" +
      "- reference_id: Reference ID\n" +
      "- product_id 或 task_id: 至少需提供其中之一，用於確定 reference 的來源\n\n" +
      "參數說明:\n" +
      "- 如果 reference 屬於某個 product，使用 product_id\n" +
      "- 如果 reference 屬於某個 task，使用 task_id\n\n" +
      "常見錯誤:\n" +
      "- 'reference_id is required' - 缺少 reference_id 參數\n" +
      "- 'product_id or task_id is required' - 兩者都沒提供\n" +
      "- 'Reference not found' - reference 不存在或無權限存取\n\n" +
      "回傳格式: { content: [{ type: 'text', text: '...' }] }",
    {
      reference_id: z.string().describe("Reference ID"),
      product_id: z.string().optional().describe("Product ID (if reference belongs to a product)"),
      task_id: z.string().optional().describe("Task ID (if reference belongs to a task)"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "get_reference",
        input as Record<string, unknown>,
        ["read:knowledge"],
        handleGetReference,
        extra.authInfo,
      );
    },
  );

  server.tool(
    "add_reference",
    "新增參考資料到專案 — 將文件或連結新增到指定 product 的 references。\n\n" +
      "使用情境：\n" +
      "- 儲存外部連結（type: 'url'）：競品網站、參考文章、設計靈感等\n" +
      "- 儲存文件內容（type: 'note'）：需求文件、設計規格、會議記錄、研究筆記等\n\n" +
      "必填參數:\n" +
      "- product_id: 要新增 reference 的 product ID\n" +
      "- type: 'url'（外部連結）或 'note'（文件內容）\n" +
      "- content: 內容（URL 或文件文字，不可為空白）\n\n" +
      "常見錯誤:\n" +
      "- 'product_id is required' - 缺少 product_id\n" +
      "- 'type must be either url or note' - type 值不正確\n" +
      "- 'content cannot be empty' - content 只包含空白字元\n\n" +
      "回傳格式: { content: [{ type: 'text', text: '...' }] }",
    {
      product_id: z.string().describe("Product ID to add the reference to"),
      type: z.enum(["url", "note"]).describe("Type of reference: 'url' for links, 'note' for documents"),
      content: z.string().describe("Reference content (URL or document text)"),
      title: z.string().optional().describe("Optional title for the reference"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "add_reference",
        input as Record<string, unknown>,
        ["write:knowledge"],
        handleAddReference,
        extra.authInfo,
      );
    },
  );

  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "add_sub_item",
    "新增子任務 — 為指定任務新增子項目（checklist item）。\n\n" +
      "★ 正確的子任務寫法（Zentropy 治理規範）:\n" +
      "子任務是主任務的執行步驟，每一項應該是「今天可以完成」的最小行動。\n" +
      "  ✅ 好的寫法（具體可執行，完成後可打勾）:\n" +
      "     '下載 1 月份銀行對帳單'\n" +
      "     '寫 PR description 並 assign reviewer'\n" +
      "     '發 Email 給廠商，附上 PO 單'\n" +
      "  ❌ 不好的寫法（太模糊，無法判斷完成標準）:\n" +
      "     '處理' / '確認' / '弄好'\n\n" +
      "★ 字數限制:\n" +
      "- content 最多 500 字元\n" +
      "- 子任務不是備忘錄，超過 2-3 句就代表應該拆成多個子任務，或用 add_reference 掛載\n\n" +
      "★ 使用時機:\n" +
      "- brain dump 格式（含 '-' 子項）建議用 capture 工具，AI 自動批次建立\n" +
      "- 已知 task_id 時才用 add_sub_item 手動逐一新增\n\n" +
      "必填參數:\n" +
      "- task_id: 任務 ID\n" +
      "- content: 子任務內容（1-500 字元）\n\n" +
      "回傳格式: { subItem: { id, content, completed, order }, meta: { total, completed, completionRate }, message }",
    {
      task_id: z.string().min(1).describe("Task ID to add the sub-item to"),
      content: z.string().min(1).max(500).describe("Sub-item content (max 500 chars)"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "add_sub_item",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleAddSubItem,
        extra.authInfo,
      );
    },
  );

  // @ts-expect-error — McpServer.tool() deep generic inference with Zod 3.25
  server.tool(
    "update_sub_item",
    "更新子任務 — 標記子項目完成或修改其內容。\n\n" +
      "必填參數:\n" +
      "- task_id: 任務 ID\n" +
      "- sub_item_id: 子任務 ID（可用 list_tasks with include_sub_items: true 取得）\n" +
      "- completed 或 content: 至少需提供其中之一\n\n" +
      "回傳格式: { subItem: { id, content, completed }, meta: { total, completed, completionRate }, message }",
    {
      task_id: z.string().min(1).describe("Task ID"),
      sub_item_id: z.string().min(1).describe("Sub-item ID to update"),
      completed: z.boolean().optional().describe("Mark sub-item as completed or not"),
      content: z.string().min(1).max(500).optional().describe("Updated content (max 500 chars)"),
    },
    async (input, extra) => {
      return executeToolPipeline(
        "update_sub_item",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleUpdateSubItem,
        extra.authInfo,
      );
    },
  );

  // ─── Register Resources (Section 3) ──────────────────────────

  server.resource(
    "knowledge-asset",
    "zentropy://knowledge/{area}/{product}/{topic}",
    {
      description:
        "Read knowledge assets from the Zentropy vault. " +
        "URI format: zentropy://knowledge/{area}/{product}/{topic}",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateMcpRequest();
      checkResourceScope(authContext, "knowledge");

      const fullUri = uri.href.replace(
        "zentropy://knowledge/",
        "zentropy://",
      );
      const result = await readKnowledgeAsset(apiClient, authContext.userId, fullUri);
      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sanitized.data),
        }],
      };
    },
  );

  server.resource(
    "rolling-saga",
    "zentropy://saga/{product_id}",
    {
      description:
        "Read the Rolling Saga (L1/L2 summaries) for a product.",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateMcpRequest();
      checkResourceScope(authContext, "saga");

      const result = await readRollingSaga(apiClient, authContext.userId, uri.href);
      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sanitized.data),
        }],
      };
    },
  );

  server.resource(
    "user-preferences",
    "zentropy://profile/bias-vector",
    {
      description:
        "Read the user's classification preferences (Bias Vector).",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateMcpRequest();
      checkResourceScope(authContext, "profile");

      const result = await readUserPreferences(apiClient, authContext.userId);
      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sanitized.data),
        }],
      };
    },
  );

  // ─── Register v2 Resources (Bridge Architecture) ─────────────

  // handoff/ready ★ 核心 Resource
  server.resource(
    "handoff-ready",
    "zentropy://handoff/ready",
    {
      description:
        "★ 核心 Resource — 準備好被執行的意圖交接包。" +
        "包含完整 context_package: why + 相關決策 + 知識連結 + 偏差校正 + 驗收標準。",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateMcpRequest();
      checkResourceScope(authContext, "tasks");

      const result = await readHandoffReady(authContext.userId);
      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sanitized.data),
        }],
      };
    },
  );

  // context/now — 全局狀態感知
  server.resource(
    "context-now",
    "zentropy://context/now",
    {
      description:
        "Coach 生成的全局狀態感知 — open loops, overdue, conflicts, stalled items, estimation bias.",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateMcpRequest();
      checkResourceScope(authContext, "tasks");

      const result = await readContextNow(authContext.userId);
      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sanitized.data),
        }],
      };
    },
  );

  // memory/bias — 個人估時偏差
  server.resource(
    "memory-bias",
    "zentropy://memory/bias",
    {
      description:
        "個人估時偏差數據 — overall ratio + per-area breakdown + insight.",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateMcpRequest();
      checkResourceScope(authContext, "profile");

      const result = await readMemoryBias(authContext.userId);
      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sanitized.data),
        }],
      };
    },
  );

  // areas — 用戶領域結構
  server.resource(
    "areas-hierarchy",
    "zentropy://areas",
    {
      description:
        "用戶的角色/資產/主題階層結構 — Area → Product → Topic with active action counts.",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateMcpRequest();
      checkResourceScope(authContext, "tasks");

      const result = await readAreasHierarchy(authContext.userId);
      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(sanitized.data),
        }],
      };
    },
  );

  // ─── Register Prompts (Section 5) ────────────────────────────

  server.prompt(
    SUMMARIZE_FOR_ZENTROPY_NAME,
    "將對話上下文整理成 Zentropy Rolling Summary 格式",
    {
      context: z
        .string()
        .describe("The conversation context or content to summarize."),
    },
    async (input) => {
      const message = renderSummarizePrompt(input.context);
      return {
        messages: [{ role: message.role, content: message.content }],
      };
    },
  );

  server.prompt(
    GENERATE_SPEC_NAME,
    "生成標準的 Zentropy Specification 文件結構",
    {
      topic: z
        .string()
        .describe("The topic or feature for the specification."),
      product_name: z
        .string()
        .optional()
        .describe("The Zentropy product this specification belongs to."),
    },
    async (input) => {
      const message = renderGenerateSpecPrompt(input.topic, input.product_name);
      return {
        messages: [{ role: message.role, content: message.content }],
      };
    },
  );

  return server;
}
