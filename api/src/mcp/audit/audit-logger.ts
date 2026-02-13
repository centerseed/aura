/**
 * Audit Logger (Section 2.8)
 *
 * Records all MCP operations with structured metadata.
 * Content is NEVER logged directly — only hashes (SHA-256).
 */

import { createHash } from "node:crypto";
import type { AuditEntry, OAuthScope } from "../types";
import type { LogLevel } from "../config";

export class AuditLogger {
  private readonly logLevel: LogLevel;

  constructor(logLevel: LogLevel = "info") {
    this.logLevel = logLevel;
  }

  logToolCall(entry: AuditEntry): void {
    if (this.shouldLog("info")) {
      const logLine = JSON.stringify({
        level: "info",
        type: "mcp_audit",
        ...entry,
      });
      process.stderr.write(logLine + "\n");
    }
  }

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

export function hashContent(content: unknown): string {
  const str =
    typeof content === "string" ? content : JSON.stringify(content);
  return (
    "sha256:" +
    createHash("sha256").update(str).digest("hex")
  );
}
