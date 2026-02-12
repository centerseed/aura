import { describe, it, expect, beforeEach } from "vitest";
import {
  RateLimiter,
  RateLimitError,
} from "../../../src/security/rate-limiter.js";
import type { ServerConfig } from "../../../src/config.js";

function makeConfig(overrides?: Partial<ServerConfig["rateLimits"]>): ServerConfig {
  return {
    transport: "stdio",
    port: 3100,
    backendUrl: "http://localhost:3002",
    accessToken: "test",
    oauth: { issuer: "", clientId: "", audience: "" },
    logLevel: "error",
    rateLimits: {
      globalPerMinute: 1000,
      perUserPerMinute: 100,
      perUserWritePerMinute: 20,
      perUserQueryPerMinute: 30,
      ...overrides,
    },
  };
}

describe("Rate Limiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(makeConfig());
  });

  it("should allow requests within limits", () => {
    expect(() =>
      limiter.check("user1", "capture_thought"),
    ).not.toThrow();
  });

  it("should enforce per-user limit", () => {
    const config = makeConfig({ perUserPerMinute: 3 });
    limiter = new RateLimiter(config);

    limiter.check("user1", "query_memory");
    limiter.check("user1", "query_memory");
    limiter.check("user1", "query_memory");

    expect(() => limiter.check("user1", "query_memory")).toThrow(
      RateLimitError,
    );
  });

  it("should enforce per-user write limit", () => {
    const config = makeConfig({ perUserWritePerMinute: 2 });
    limiter = new RateLimiter(config);

    limiter.check("user1", "capture_thought");
    limiter.check("user1", "capture_thought");

    expect(() =>
      limiter.check("user1", "capture_thought"),
    ).toThrow(RateLimitError);
  });

  it("should not enforce write limit for non-write tools", () => {
    const config = makeConfig({ perUserWritePerMinute: 1 });
    limiter = new RateLimiter(config);

    limiter.check("user1", "capture_thought");

    // query_memory should still work even though write limit is hit
    expect(() =>
      limiter.check("user1", "query_memory"),
    ).not.toThrow();
  });

  it("should track users independently", () => {
    const config = makeConfig({ perUserPerMinute: 2 });
    limiter = new RateLimiter(config);

    limiter.check("user1", "query_memory");
    limiter.check("user1", "query_memory");

    // user1 is at limit, but user2 should still work
    expect(() =>
      limiter.check("user2", "query_memory"),
    ).not.toThrow();
  });

  it("should include retryAfterSeconds in error", () => {
    const config = makeConfig({ perUserPerMinute: 1 });
    limiter = new RateLimiter(config);

    limiter.check("user1", "query_memory");

    try {
      limiter.check("user1", "query_memory");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect(
        (error as RateLimitError).retryAfterSeconds,
      ).toBeGreaterThan(0);
    }
  });

  it("should cleanup old entries", () => {
    limiter.check("user1", "query_memory");
    limiter.cleanup();
    // Should not throw after cleanup (entries still valid within window)
    // This just verifies cleanup() doesn't crash
  });
});
