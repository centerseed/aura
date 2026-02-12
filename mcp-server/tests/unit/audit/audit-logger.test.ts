import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditLogger, hashContent } from "../../../src/audit/audit-logger.js";

describe("Audit Logger", () => {
  let logger: AuditLogger;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new AuditLogger("debug");
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  describe("hashContent", () => {
    it("should produce a sha256 hash for strings", () => {
      const hash = hashContent("test content");
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("should produce consistent hashes", () => {
      const hash1 = hashContent("test");
      const hash2 = hashContent("test");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different content", () => {
      const hash1 = hashContent("test1");
      const hash2 = hashContent("test2");
      expect(hash1).not.toBe(hash2);
    });

    it("should hash objects via JSON.stringify", () => {
      const hash = hashContent({ key: "value" });
      expect(hash).toMatch(/^sha256:/);
    });
  });

  describe("createEntry", () => {
    it("should create a well-formed audit entry", () => {
      const entry = logger.createEntry({
        userId: "user-1",
        clientId: "client-1",
        tool: "capture_thought",
        scopeUsed: ["write:inbox"],
        input: { content: "test" },
        outputSizeBytes: 150,
        sanitizationApplied: false,
        latencyMs: 42,
        status: "success",
      });

      expect(entry.user_id).toBe("user-1");
      expect(entry.client_id).toBe("client-1");
      expect(entry.tool).toBe("capture_thought");
      expect(entry.scope_used).toEqual(["write:inbox"]);
      expect(entry.input_hash).toMatch(/^sha256:/);
      expect(entry.output_size_bytes).toBe(150);
      expect(entry.sanitization_applied).toBe(false);
      expect(entry.latency_ms).toBe(42);
      expect(entry.status).toBe("success");
      expect(entry.timestamp).toBeTruthy();
    });
  });

  describe("logToolCall", () => {
    it("should write structured JSON to stderr", () => {
      const entry = logger.createEntry({
        userId: "user-1",
        clientId: "client-1",
        tool: "query_memory",
        scopeUsed: ["read:tasks"],
        input: "test query",
        outputSizeBytes: 1024,
        sanitizationApplied: false,
        latencyMs: 100,
        status: "success",
      });

      logger.logToolCall(entry);

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("info");
      expect(parsed.type).toBe("mcp_audit");
      expect(parsed.tool).toBe("query_memory");
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security events at warn level", () => {
      logger.logSecurityEvent({
        userId: "user-1",
        clientId: "client-1",
        tool: "capture_thought",
        event: "content_sanitized",
        details: ["content:SYSTEM_DELIMITER"],
      });

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("warn");
      expect(parsed.type).toBe("mcp_security");
    });
  });

  describe("log level filtering", () => {
    it("should not log debug messages when level is info", () => {
      const infoLogger = new AuditLogger("info");
      const spy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      infoLogger.logDebug("test debug message");

      expect(spy).not.toHaveBeenCalled();
    });

    it("should log error messages when level is error", () => {
      const errorLogger = new AuditLogger("error");
      const spy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      errorLogger.logError({ error: "test error" });

      expect(spy).toHaveBeenCalled();
    });
  });
});
