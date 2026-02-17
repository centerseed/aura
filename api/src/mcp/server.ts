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
      authContext = authenticateMcpRequest(
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
              message: `Backend returned status ${error.statusCode}`,
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
        .describe("Content to capture (max 10,000 chars)"),
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
    "統一入口 — 丟進來就好。支援 thought / execution_plan / result 三種模式。Gatekeeper 自動分類，Librarian 自動歸檔。",
    {
      content: z
        .string()
        .min(1)
        .max(50_000)
        .describe("Content (free text or JSON structured content, max 50,000 chars)"),
      source: z
        .string()
        .describe("Source: Claude Code, Cursor, Claude Desktop, or API"),
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
    "報告完成 — Coach 計算估時偏差、更新 Episodic Memory、觸發 Librarian 歸檔。",
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
      const authContext = authenticateMcpRequest();
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
      const authContext = authenticateMcpRequest();
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
      const authContext = authenticateMcpRequest();
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
      const authContext = authenticateMcpRequest();
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
      const authContext = authenticateMcpRequest();
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
      const authContext = authenticateMcpRequest();
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
      const authContext = authenticateMcpRequest();
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
