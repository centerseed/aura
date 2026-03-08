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
    "Retrieves semantic search results across knowledge and actions. [Deprecated: use 'search'] Use only for backward compatibility. Returns matching knowledge entries.",
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
    "Capture and auto-classify any content into Zentropy. Use this to brain dump tasks, notes, or execution results. Supports thought/execution_plan/result modes. Returns action ID.",
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
    "Updates a task as completed and triggers Coach debrief. Use this after finishing any action to close the loop. Pass action_id; optionally include duration and outcome. Returns updated task.",
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
        .describe("Outcome: completed=success, partial=incomplete, blocked=stuck, cancelled=abandoned (default: completed)"),
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
    "List tasks filtered by status/product/topic. Use this to review what's active, pending, or done. Returns {tasks:[{id,title,status,area,product,topic,due_date}],total}.",
    {
      status: z
        .enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
        .optional()
        .describe("Filter by status: INBOX=unclassified, ACTIVE=in-sprint, MAINTAIN=ongoing, REFERENCE=knowledge, ARCHIVE=done"),
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
      include_narrative: z
        .boolean()
        .optional()
        .describe("If true, include narrative (task description/notes) in results"),
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
    "Create a task with known product_id/topic_id. The 'content' field is the task title shown in the UI — start with a verb, max 300 chars (e.g. 'Fix login bug', 'Write spec for payment'). Returns {id,title,status,message}.",
    {
      content: z
        .string()
        .min(1)
        .max(300)
        .describe("任務標題（即 UI 顯示的 title），須以動詞開頭，最多 300 字元"),
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
        .describe("Initial status: INBOX=unclassified, ACTIVE=in-sprint, MAINTAIN=ongoing, REFERENCE=knowledge (default: INBOX)"),
      start_date: z
        .string()
        .optional()
        .describe("Start date in YYYY-MM-DD format"),
      due_date: z
        .string()
        .optional()
        .describe("Due date in YYYY-MM-DD format"),
      narrative: z
        .string()
        .max(500)
        .optional()
        .describe("任務說明欄位：背景、細節、結論（對應 UI 的「說明」欄位，最多 500 字元）"),
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
    "Update task status, content, or dates. Use this to change status or reschedule. Requires task_id plus at least one of: status/content/start_date/due_date. Returns {id,title,status,message}.",
    {
      task_id: z
        .string()
        .min(1)
        .describe("Task ID to update"),
      status: z
        .enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"])
        .optional()
        .describe("New status: INBOX=unclassified, ACTIVE=in-sprint, MAINTAIN=ongoing, REFERENCE=knowledge, ARCHIVE=done"),
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
      narrative: z
        .string()
        .max(500)
        .nullable()
        .optional()
        .describe("更新說明欄位（最多 500 字元）。傳 null 清空。"),
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
    "Fetch full reference content by reference_id. Use this after 'search' returns a reference ID to read its full text. Requires reference_id plus product_id or task_id. Returns {content}.",
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
    "Add a URL or document to a product's reference library. Use this to save external links (type='url') or notes (type='note'). Requires product_id, type, and content. Returns reference ID.",
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
    "Add a sub-task (checklist item) to a task. Use this to break a task into concrete actionable steps. Content must be ≤500 chars and start with a verb. Returns {subItem,meta,message}.",
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
    "Update a sub-task: mark as done or edit content. Use this to check off checklist items or fix descriptions. Requires task_id, sub_item_id, plus completed or content. Returns {subItem,meta}.",
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
