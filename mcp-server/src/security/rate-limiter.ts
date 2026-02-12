/**
 * Rate Limiter (Section 2.6)
 *
 * Implements sliding window rate limiting at multiple levels:
 * - Global: 1,000 requests per minute
 * - Per-user: 100 requests per minute
 * - Per-user write operations: 20 requests per minute
 * - Per-user query_memory: 30 requests per minute
 */

import type { ServerConfig } from "../config.js";

export class RateLimitError extends Error {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`,
    );
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface WindowEntry {
  timestamps: number[];
}

const WRITE_TOOLS = new Set(["capture_thought", "append_to_knowledge"]);
const QUERY_TOOLS = new Set(["query_memory"]);
const WINDOW_MS = 60_000; // 1 minute

export class RateLimiter {
  private readonly global: WindowEntry = { timestamps: [] };
  private readonly perUser = new Map<string, WindowEntry>();
  private readonly perUserWrite = new Map<string, WindowEntry>();
  private readonly perUserQuery = new Map<string, WindowEntry>();

  private readonly limits: ServerConfig["rateLimits"];

  constructor(config: ServerConfig) {
    this.limits = config.rateLimits;
  }

  /**
   * Check rate limits for a request. Throws RateLimitError if exceeded.
   */
  check(userId: string, toolName: string): void {
    const now = Date.now();

    // 1. Global limit
    this.checkWindow(this.global, now, this.limits.globalPerMinute);

    // 2. Per-user limit
    const userEntry = this.getOrCreate(this.perUser, userId);
    this.checkWindow(userEntry, now, this.limits.perUserPerMinute);

    // 3. Per-user write limit
    if (WRITE_TOOLS.has(toolName)) {
      const writeEntry = this.getOrCreate(
        this.perUserWrite,
        userId,
      );
      this.checkWindow(
        writeEntry,
        now,
        this.limits.perUserWritePerMinute,
      );
    }

    // 4. Per-user query limit
    if (QUERY_TOOLS.has(toolName)) {
      const queryEntry = this.getOrCreate(
        this.perUserQuery,
        userId,
      );
      this.checkWindow(
        queryEntry,
        now,
        this.limits.perUserQueryPerMinute,
      );
    }

    // Record the request
    this.record(this.global, now);
    this.record(userEntry, now);
    if (WRITE_TOOLS.has(toolName)) {
      this.record(
        this.getOrCreate(this.perUserWrite, userId),
        now,
      );
    }
    if (QUERY_TOOLS.has(toolName)) {
      this.record(
        this.getOrCreate(this.perUserQuery, userId),
        now,
      );
    }
  }

  private checkWindow(
    entry: WindowEntry,
    now: number,
    limit: number,
  ): void {
    // Prune old entries
    const cutoff = now - WINDOW_MS;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= limit) {
      // Calculate retry-after from the oldest entry in the window
      const oldest = entry.timestamps[0];
      const retryAfterMs = oldest + WINDOW_MS - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      throw new RateLimitError(Math.max(1, retryAfterSeconds));
    }
  }

  private record(entry: WindowEntry, now: number): void {
    entry.timestamps.push(now);
  }

  private getOrCreate(
    map: Map<string, WindowEntry>,
    key: string,
  ): WindowEntry {
    let entry = map.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      map.set(key, entry);
    }
    return entry;
  }

  /** Cleanup old data to prevent memory leaks. Call periodically. */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    for (const [key, entry] of this.perUser) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) this.perUser.delete(key);
    }
    for (const [key, entry] of this.perUserWrite) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) this.perUserWrite.delete(key);
    }
    for (const [key, entry] of this.perUserQuery) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) this.perUserQuery.delete(key);
    }
    this.global.timestamps = this.global.timestamps.filter(
      (t) => t > cutoff,
    );
  }
}
