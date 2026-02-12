import { describe, it, expect } from "vitest";
import {
  checkToolScope,
  checkResourceScope,
  ScopeError,
} from "../../../src/security/scope-checker.js";
import type { AuthContext } from "../../../src/types.js";

function makeAuth(scopes: AuthContext["scopes"]): AuthContext {
  return {
    userId: "test-user",
    clientId: "test-client",
    scopes,
    tokenExpiry: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe("Scope Checker", () => {
  describe("checkToolScope", () => {
    it("should allow capture_thought with write:inbox scope", () => {
      expect(() =>
        checkToolScope(makeAuth(["write:inbox"]), "capture_thought"),
      ).not.toThrow();
    });

    it("should deny capture_thought without write:inbox scope", () => {
      expect(() =>
        checkToolScope(makeAuth(["read:tasks"]), "capture_thought"),
      ).toThrow(ScopeError);
    });

    it("should allow append_to_knowledge with write:knowledge scope", () => {
      expect(() =>
        checkToolScope(
          makeAuth(["write:knowledge"]),
          "append_to_knowledge",
        ),
      ).not.toThrow();
    });

    it("should allow query_memory with read:tasks scope", () => {
      expect(() =>
        checkToolScope(makeAuth(["read:tasks"]), "query_memory"),
      ).not.toThrow();
    });

    it("should allow query_memory with read:knowledge scope", () => {
      expect(() =>
        checkToolScope(
          makeAuth(["read:knowledge"]),
          "query_memory",
        ),
      ).not.toThrow();
    });

    it("should deny query_memory without either read scope", () => {
      expect(() =>
        checkToolScope(makeAuth(["write:inbox"]), "query_memory"),
      ).toThrow(ScopeError);
    });

    it("should deny unknown tools", () => {
      expect(() =>
        checkToolScope(
          makeAuth(["read:tasks", "write:inbox"]),
          "unknown_tool",
        ),
      ).toThrow(ScopeError);
    });
  });

  describe("checkResourceScope", () => {
    it("should allow knowledge resource with read:knowledge scope", () => {
      expect(() =>
        checkResourceScope(
          makeAuth(["read:knowledge"]),
          "knowledge",
        ),
      ).not.toThrow();
    });

    it("should allow saga resource with read:knowledge scope", () => {
      expect(() =>
        checkResourceScope(
          makeAuth(["read:knowledge"]),
          "saga",
        ),
      ).not.toThrow();
    });

    it("should allow profile resource with read:profile scope", () => {
      expect(() =>
        checkResourceScope(
          makeAuth(["read:profile"]),
          "profile",
        ),
      ).not.toThrow();
    });

    it("should deny profile resource without read:profile scope", () => {
      expect(() =>
        checkResourceScope(
          makeAuth(["read:tasks"]),
          "profile",
        ),
      ).toThrow(ScopeError);
    });
  });
});
