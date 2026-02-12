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

// Tools
import { handleCaptureThought } from "./tools/capture-thought";
import { handleAppendToKnowledge } from "./tools/append-to-knowledge";
import { handleQueryMemory } from "./tools/query-memory";

// Resources
import { readKnowledgeAsset } from "./resources/knowledge-assets";
import { readRollingSaga } from "./resources/rolling-sagas";
import { readUserPreferences } from "./resources/user-preferences";

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
      accessToken: string,
    ) => Promise<unknown>,
    /** The raw access token from the MCP client, passed through to API routes */
    accessToken?: string,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    const startTime = Date.now();
    let authContext: AuthContext | undefined;
    let sanitizationApplied = false;

    try {
      // Step 1: Auth (use the token passed through or create dev context)
      authContext = authenticateMcpRequest(
        accessToken ? `Bearer ${accessToken}` : undefined,
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
        accessToken || "",
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
      const result = await readKnowledgeAsset(apiClient, "", fullUri);
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

      const result = await readRollingSaga(apiClient, "", uri.href);
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

      const result = await readUserPreferences(apiClient, "");
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
