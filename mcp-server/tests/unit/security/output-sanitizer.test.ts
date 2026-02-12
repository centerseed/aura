import { describe, it, expect } from "vitest";
import {
  redactSecrets,
  filterFields,
  enforceResponseSizeLimit,
  sanitizeOutput,
} from "../../../src/security/output-sanitizer.js";

describe("Output Sanitizer", () => {
  describe("redactSecrets", () => {
    it("should redact Google API keys", () => {
      const result = redactSecrets(
        "Use key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
      );
      expect(result.content).toContain("[REDACTED]");
      expect(result.content).not.toContain("AIzaSy");
      expect(result.redactedCount).toBe(1);
    });

    it("should redact sk- secret keys", () => {
      const result = redactSecrets(
        "Token: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef",
      );
      expect(result.content).toContain("[REDACTED]");
      expect(result.redactedCount).toBe(1);
    });

    it("should redact GitHub PAT tokens", () => {
      const result = redactSecrets(
        "Token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
      );
      expect(result.content).toContain("[REDACTED]");
      expect(result.redactedCount).toBe(1);
    });

    it("should redact database connection strings", () => {
      const result = redactSecrets(
        "postgres://user:secret_password@db.example.com:5432/mydb",
      );
      expect(result.content).toContain("[REDACTED]");
      expect(result.content).not.toContain("secret_password");
    });

    it("should redact private keys", () => {
      const result = redactSecrets(
        "Key: -----BEGIN PRIVATE KEY----- ABCDEF",
      );
      expect(result.content).toContain("[REDACTED]");
    });

    it("should redact AWS access keys", () => {
      const result = redactSecrets("AWS key: AKIAIOSFODNN7EXAMPLE");
      expect(result.content).toContain("[REDACTED]");
    });

    it("should not redact normal content", () => {
      const result = redactSecrets(
        "This is normal project documentation about authentication.",
      );
      expect(result.redactedCount).toBe(0);
      expect(result.content).toBe(
        "This is normal project documentation about authentication.",
      );
    });

    it("should redact multiple secrets in one string", () => {
      const result = redactSecrets(
        "Key1: AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567, " +
          "Key2: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef",
      );
      expect(result.redactedCount).toBe(2);
    });
  });

  describe("filterFields", () => {
    it("should filter to read:tasks allowed fields", () => {
      const data = {
        id: "1",
        title: "Task 1",
        status: "active",
        internal_note: "secret",
        password: "hidden",
      };
      const result = filterFields(data, ["read:tasks"]);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("status");
      expect(result).not.toHaveProperty("internal_note");
      expect(result).not.toHaveProperty("password");
    });

    it("should pass through all fields for write scopes", () => {
      const data = {
        id: "1",
        status: "created",
        internal_field: "value",
      };
      const result = filterFields(data, ["write:inbox"]);
      expect(result).toEqual(data);
    });

    it("should merge fields from multiple scopes", () => {
      const data = {
        id: "1",
        title: "Test",
        bias_vector: {},
        score: 0.95,
      };
      const result = filterFields(data, [
        "read:tasks",
        "read:profile",
      ]);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("bias_vector");
    });
  });

  describe("enforceResponseSizeLimit", () => {
    it("should pass through content under 100KB", () => {
      const content = "x".repeat(1000);
      const result = enforceResponseSizeLimit(content);
      expect(result.truncated).toBe(false);
      expect(result.content).toBe(content);
    });

    it("should truncate content over 100KB", () => {
      const content = "x".repeat(200_000);
      const result = enforceResponseSizeLimit(content);
      expect(result.truncated).toBe(true);
      expect(result.content).toContain("[TRUNCATED");
      expect(
        Buffer.byteLength(result.content, "utf-8"),
      ).toBeLessThanOrEqual(102_500);
    });
  });

  describe("sanitizeOutput (full pipeline)", () => {
    it("should handle string output", () => {
      const result = sanitizeOutput("normal text", ["read:tasks"]);
      expect(result.data).toBe("normal text");
      expect(result.redactedSecrets).toBe(0);
    });

    it("should redact secrets in object values", () => {
      const result = sanitizeOutput(
        {
          id: "1",
          title: "Test",
          content: "Config: AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
        },
        ["read:knowledge"],
      );
      expect(result.redactedSecrets).toBeGreaterThan(0);
      const data = result.data as Record<string, unknown>;
      expect((data.content as string)).toContain("[REDACTED]");
    });
  });
});
