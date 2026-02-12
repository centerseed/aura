/**
 * Zentropy MCP Server
 *
 * Implements the full request processing pipeline (Section 6.4):
 *   Transport → Auth → Rate Limiter → Input Validator →
 *   Content Sanitizer → Scope Checker → Tool Handler →
 *   Output Sanitizer → Audit Logger → Response
 *
 * Tool definitions are immutable after startup (Section 2.5).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ServerConfig } from "./config.js";
import type { AuthContext, OAuthScope } from "./types.js";
import { ALLOWED_SOURCES } from "./types.js";

// Security
import { AuthMiddleware } from "./security/auth-middleware.js";
import { checkToolScope, checkResourceScope } from "./security/scope-checker.js";
import { RateLimiter, RateLimitError } from "./security/rate-limiter.js";
import { validateToolInput } from "./security/input-validator.js";
import { sanitizeToolInput } from "./security/content-sanitizer.js";
import { sanitizeOutput } from "./security/output-sanitizer.js";

// Audit
import { AuditLogger } from "./audit/audit-logger.js";

// Backend
import { BackendApiClient, BackendApiError } from "./backend-client/api-client.js";

// Tools
import { handleCaptureThought } from "./tools/capture-thought.js";
import { handleAppendToKnowledge } from "./tools/append-to-knowledge.js";
import { handleQueryMemory } from "./tools/query-memory.js";

// Resources
import { readKnowledgeAsset } from "./resources/knowledge-assets.js";
import { readRollingSaga } from "./resources/rolling-sagas.js";
import { readUserPreferences } from "./resources/user-preferences.js";

// Prompts
import {
  renderSummarizePrompt,
  SUMMARIZE_FOR_ZENTROPY_NAME,
} from "./prompts/summarize-for-zentropy.js";
import {
  renderGenerateSpecPrompt,
  GENERATE_SPEC_NAME,
} from "./prompts/generate-spec-structure.js";

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: "zentropy-mcp-server",
    version: "0.1.0",
  });

  // Initialize components
  const auth = new AuthMiddleware(config);
  const rateLimiter = new RateLimiter(config);
  const auditLogger = new AuditLogger(config.logLevel);
  const apiClient = new BackendApiClient(config);

  // Periodic cleanup of rate limiter data
  const cleanupInterval = setInterval(() => rateLimiter.cleanup(), 60_000);
  // Allow the process to exit without waiting for the interval
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  /**
   * Get the access token for Backend API calls.
   * In stdio mode, uses the configured token.
   * In HTTP mode, would extract from the request context.
   */
  function getAccessToken(): string {
    return config.accessToken || "";
  }

  /**
   * Authenticate the current request.
   * Returns the auth context for scope checking and audit logging.
   */
  async function authenticateRequest(): Promise<AuthContext> {
    if (config.transport === "stdio") {
      return auth.authenticate();
    }
    // In HTTP mode, the auth header would come from the request
    // For now, use the configured token
    return auth.authenticate(`Bearer ${config.accessToken || ""}`);
  }

  /**
   * Full request pipeline for tool calls.
   * Implements Section 6.4 request processing.
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
      accessToken: string,
    ) => Promise<unknown>,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const startTime = Date.now();
    let authContext: AuthContext | undefined;
    let sanitizationApplied = false;

    try {
      // Step 1: Auth
      authContext = await authenticateRequest();

      // Step 2: Rate Limiting
      rateLimiter.check(authContext.userId, toolName);

      // Step 3: Input Validation (JSON Schema)
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
        getAccessToken(),
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

      // Step 9: Response
      return {
        content: [
          {
            type: "text" as const,
            text: outputJson,
          },
        ],
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
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "rate_limited",
                message: error.message,
                retry_after_seconds: error.retryAfterSeconds,
              }),
            },
          ],
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
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "backend_error",
                message: `Backend returned status ${error.statusCode}`,
              }),
            },
          ],
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
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: status,
              message: errorMessage,
            }),
          },
        ],
      };
    }
  }

  // ─── Register Tools (Section 4) ───────────────────────────────

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
        .enum(ALLOWED_SOURCES)
        .describe("Source of the content"),
      context_hint: z
        .string()
        .max(200)
        .optional()
        .describe("Semantic hint for classification (max 200 chars)"),
    },
    async (input) => {
      return executeToolPipeline(
        "capture_thought",
        input as Record<string, unknown>,
        ["write:inbox"],
        handleCaptureThought,
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
    async (input) => {
      return executeToolPipeline(
        "append_to_knowledge",
        input as Record<string, unknown>,
        ["write:knowledge"],
        handleAppendToKnowledge,
      );
    },
  );

  server.tool(
    "query_memory",
    "查詢記憶 — Perform semantic search across past decisions and data.",
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
    async (input) => {
      return executeToolPipeline(
        "query_memory",
        input as Record<string, unknown>,
        ["read:tasks"],
        handleQueryMemory,
      );
    },
  );

  // ─── Register Resources (Section 3) ──────────────────────────

  // 3.1 Knowledge Assets
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
      const authContext = await authenticateRequest();
      checkResourceScope(authContext, "knowledge");

      const fullUri = uri.href.replace(
        "zentropy://knowledge/",
        "zentropy://",
      );
      const result = await readKnowledgeAsset(
        apiClient,
        getAccessToken(),
        fullUri,
      );

      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(sanitized.data),
          },
        ],
      };
    },
  );

  // 3.2 Rolling Sagas
  server.resource(
    "rolling-saga",
    "zentropy://saga/{product_id}",
    {
      description:
        "Read the Rolling Saga (L1/L2 summaries) for a product. " +
        "Returns Narrative Nodes for quick project context.",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateRequest();
      checkResourceScope(authContext, "saga");

      const result = await readRollingSaga(
        apiClient,
        getAccessToken(),
        uri.href,
      );

      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(sanitized.data),
          },
        ],
      };
    },
  );

  // 3.3 User Preferences
  server.resource(
    "user-preferences",
    "zentropy://profile/bias-vector",
    {
      description:
        "Read the user's classification preferences (Bias Vector) " +
        "and Negative Prompts for external AI to match Zentropy Librarian behavior.",
      mimeType: "application/json",
    },
    async (uri) => {
      const authContext = await authenticateRequest();
      checkResourceScope(authContext, "profile");

      const result = await readUserPreferences(
        apiClient,
        getAccessToken(),
      );

      const sanitized = sanitizeOutput(result, authContext.scopes);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(sanitized.data),
          },
        ],
      };
    },
  );

  // ─── Register Prompts (Section 5) ────────────────────────────

  server.prompt(
    SUMMARIZE_FOR_ZENTROPY_NAME,
    "將對話上下文整理成 Zentropy Rolling Summary 格式 — " +
      "Summarize conversation context into Zentropy-style atomic notes.",
    {
      context: z
        .string()
        .describe(
          "The conversation context or content to summarize into Zentropy format.",
        ),
    },
    async (input) => {
      const message = renderSummarizePrompt(input.context);
      return {
        messages: [
          {
            role: message.role,
            content: message.content,
          },
        ],
      };
    },
  );

  server.prompt(
    GENERATE_SPEC_NAME,
    "生成標準的 Zentropy Specification 文件結構 — " +
      "Generate a standard Zentropy Specification document structure.",
    {
      topic: z
        .string()
        .describe(
          "The topic or feature for which to generate the specification structure.",
        ),
      product_name: z
        .string()
        .optional()
        .describe("The Zentropy product this specification belongs to."),
    },
    async (input) => {
      const message = renderGenerateSpecPrompt(
        input.topic,
        input.product_name,
      );
      return {
        messages: [
          {
            role: message.role,
            content: message.content,
          },
        ],
      };
    },
  );

  return server;
}
