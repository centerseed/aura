import { describe, it, expect } from "vitest";
import { validateToolInput } from "../../../src/security/input-validator.js";

describe("Input Validator", () => {
  describe("capture_thought", () => {
    it("should accept valid input", () => {
      const result = validateToolInput("capture_thought", {
        content: "This is a test thought",
        source: "Claude Code",
      });
      expect(result).toEqual({
        content: "This is a test thought",
        source: "Claude Code",
      });
    });

    it("should accept valid input with optional context_hint", () => {
      const result = validateToolInput("capture_thought", {
        content: "A thought",
        source: "Cursor",
        context_hint: "Related to project X",
      });
      expect(result.context_hint).toBe("Related to project X");
    });

    it("should reject empty content", () => {
      expect(() =>
        validateToolInput("capture_thought", {
          content: "",
          source: "Claude Code",
        }),
      ).toThrow();
    });

    it("should reject content exceeding 10,000 chars", () => {
      expect(() =>
        validateToolInput("capture_thought", {
          content: "x".repeat(10_001),
          source: "Claude Code",
        }),
      ).toThrow("10,000");
    });

    it("should reject invalid source", () => {
      expect(() =>
        validateToolInput("capture_thought", {
          content: "test",
          source: "InvalidSource",
        }),
      ).toThrow("Source must be one of");
    });

    it("should accept all valid sources", () => {
      for (const source of [
        "Claude Code",
        "Cursor",
        "Claude Desktop",
        "API",
      ]) {
        const result = validateToolInput("capture_thought", {
          content: "test",
          source,
        });
        expect(result.source).toBe(source);
      }
    });

    it("should reject context_hint exceeding 200 chars", () => {
      expect(() =>
        validateToolInput("capture_thought", {
          content: "test",
          source: "Claude Code",
          context_hint: "x".repeat(201),
        }),
      ).toThrow("200");
    });
  });

  describe("append_to_knowledge", () => {
    it("should accept valid input", () => {
      const result = validateToolInput("append_to_knowledge", {
        product_name: "Naruvia",
        topic_name: "Architecture",
        title: "Clean Arch Decision",
        content: "We decided to use Clean Architecture",
      });
      expect(result.product_name).toBe("Naruvia");
    });

    it("should reject empty product_name", () => {
      expect(() =>
        validateToolInput("append_to_knowledge", {
          product_name: "",
          topic_name: "Topic",
          title: "Title",
          content: "Content",
        }),
      ).toThrow();
    });

    it("should reject content exceeding 50,000 chars", () => {
      expect(() =>
        validateToolInput("append_to_knowledge", {
          product_name: "P",
          topic_name: "T",
          title: "Title",
          content: "x".repeat(50_001),
        }),
      ).toThrow("50,000");
    });
  });

  describe("query_memory", () => {
    it("should accept valid input", () => {
      const result = validateToolInput("query_memory", {
        query: "What was decided about the auth system?",
      });
      expect(result.query).toBe(
        "What was decided about the auth system?",
      );
    });

    it("should accept optional scope", () => {
      const result = validateToolInput("query_memory", {
        query: "test query",
        scope: "Naruvia",
      });
      expect(result.scope).toBe("Naruvia");
    });

    it("should reject empty query", () => {
      expect(() =>
        validateToolInput("query_memory", { query: "" }),
      ).toThrow();
    });

    it("should reject query exceeding 500 chars", () => {
      expect(() =>
        validateToolInput("query_memory", {
          query: "x".repeat(501),
        }),
      ).toThrow("500");
    });
  });

  describe("unknown tool", () => {
    it("should reject unknown tool names", () => {
      expect(() =>
        validateToolInput("unknown_tool", { foo: "bar" }),
      ).toThrow("Unknown tool");
    });
  });
});
