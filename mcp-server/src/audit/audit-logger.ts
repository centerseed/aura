/**
 * Audit Logger (Section 2.8)
 *
 * Records all MCP operations with structured metadata.
 * Content is NEVER logged directly — only hashes (SHA-256) are stored
 * to protect user privacy.
 */

import { createHash } from "node:crypto";
import type { AuditEntry, OAuthScope } from "../types.js";
import type { LogLevel } from "../config.js";

export class AuditLogger {
  private readonly logLevel: LogLevel;

  constructor(logLevel: LogLevel = "info") {
    this.logLevel = logLevel;
  }

  /**
   * Log a tool invocation with full audit metadata.
   */
  logToolCall(entry: AuditEntry): void {
    if (this.shouldLog("info")) {
      // Write structured log to stderr (stdout is reserved for MCP stdio transport)
      const logLine = JSON.stringify({
        level: "info",
        type: "mcp_audit",
        ...entry,
      });
      process.stderr.write(logLine + "\n");
    }
  }

  /**
   * Log a security event (e.g. sanitization, injection detection).
   */
  logSecurityEvent(params: {
    userId: string;
    clientId: string;
    tool: string;
    event: string;
    details: string[];
  }): void {
    if (this.shouldLog("warn")) {
      const logLine = JSON.stringify({
        level: "warn",
        type: "mcp_security",
        timestamp: new Date().toISOString(),
        user_id: params.userId,
        client_id: params.clientId,
        tool: params.tool,
        event: params.event,
        details: params.details,
      });
      process.stderr.write(logLine + "\n");
    }
  }

  /**
   * Log an error event.
   */
  logError(params: {
    userId?: string;
    clientId?: string;
    tool?: string;
    error: string;
    stack?: string;
  }): void {
    if (this.shouldLog("error")) {
      const logLine = JSON.stringify({
        level: "error",
        type: "mcp_error",
        timestamp: new Date().toISOString(),
        ...params,
      });
      process.stderr.write(logLine + "\n");
    }
  }

  /**
   * Log a debug message.
   */
  logDebug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      const logLine = JSON.stringify({
        level: "debug",
        type: "mcp_debug",
        timestamp: new Date().toISOString(),
        message,
        ...data,
      });
      process.stderr.write(logLine + "\n");
    }
  }

  /**
   * Create an AuditEntry from request parameters.
   * Hashes input content for privacy (Section 2.8).
   */
  createEntry(params: {
    userId: string;
    clientId: string;
    tool: string;
    scopeUsed: OAuthScope[];
    input: unknown;
    outputSizeBytes: number;
    sanitizationApplied: boolean;
    latencyMs: number;
    status: AuditEntry["status"];
  }): AuditEntry {
    return {
      timestamp: new Date().toISOString(),
      user_id: params.userId,
      client_id: params.clientId,
      tool: params.tool,
      scope_used: params.scopeUsed,
      input_hash: hashContent(params.input),
      output_size_bytes: params.outputSizeBytes,
      sanitization_applied: params.sanitizationApplied,
      latency_ms: params.latencyMs,
      status: params.status,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }
}

/**
 * Create a SHA-256 hash of content for audit purposes.
 * Never logs the actual content.
 */
export function hashContent(content: unknown): string {
  const str =
    typeof content === "string" ? content : JSON.stringify(content);
  return (
    "sha256:" +
    createHash("sha256").update(str).digest("hex")
  );
}
