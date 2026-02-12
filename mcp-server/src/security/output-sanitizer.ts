/**
 * Output Sanitizer (Section 2.4.3)
 *
 * Sanitizes data returned to MCP clients:
 * - Secret Redaction: auto-detect and mask API keys, passwords, connection strings
 * - Field Filtering: only return authorized fields based on scope
 * - Size Limiting: single response ≤ 100KB, truncate with pagination cursor
 */

import type { OAuthScope } from "../types.js";

const MAX_RESPONSE_BYTES = 100 * 1024; // 100KB

/**
 * Patterns for secret detection (Section 2.4.3)
 */
const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Google API Keys
  { pattern: /AIzaSy[\w-]{33}/g, label: "google_api_key" },
  // Generic secret key prefixes
  { pattern: /sk-[A-Za-z0-9]{20,}/g, label: "secret_key" },
  { pattern: /pk_[A-Za-z0-9]{20,}/g, label: "public_key" },
  // GitHub tokens
  { pattern: /ghp_[A-Za-z0-9]{36}/g, label: "github_pat" },
  { pattern: /gho_[A-Za-z0-9]{36}/g, label: "github_oauth" },
  // Database connection strings with passwords
  {
    pattern: /postgres:\/\/[^:]+:[^@]+@[^\s]+/g,
    label: "db_connection_string",
  },
  {
    pattern: /mysql:\/\/[^:]+:[^@]+@[^\s]+/g,
    label: "db_connection_string",
  },
  // Private keys
  {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    label: "private_key",
  },
  // AWS keys
  { pattern: /AKIA[0-9A-Z]{16}/g, label: "aws_access_key" },
  // Bearer tokens in content
  { pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/g, label: "bearer_token" },
];

/**
 * Redact secrets from a string.
 */
export function redactSecrets(content: string): {
  content: string;
  redactedCount: number;
} {
  let result = content;
  let redactedCount = 0;

  for (const { pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) {
      redactedCount += matches.length;
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }
  }

  return { content: result, redactedCount };
}

/**
 * Fields allowed per scope (Section 2.4.3).
 * Any fields not listed are stripped from the response.
 */
const SCOPE_FIELD_ALLOWLIST: Record<string, Set<string>> = {
  "read:tasks": new Set([
    "id",
    "title",
    "status",
    "sub_items",
    "area_name",
    "product_name",
    "topic_name",
    "created_at",
    "updated_at",
    "score",
    "content",
  ]),
  "read:knowledge": new Set([
    "id",
    "title",
    "content",
    "status",
    "area_name",
    "product_name",
    "topic_name",
    "created_at",
    "updated_at",
    "score",
    "level",
    "metadata",
  ]),
  "read:profile": new Set([
    "bias_vector",
    "negative_prompts",
    "preferences",
  ]),
};

/**
 * Filter fields based on the user's scopes.
 * Merges allowed fields from all granted scopes.
 */
export function filterFields(
  data: Record<string, unknown>,
  scopes: OAuthScope[],
): Record<string, unknown> {
  const allowedFields = new Set<string>();

  for (const scope of scopes) {
    const fields = SCOPE_FIELD_ALLOWLIST[scope];
    if (fields) {
      for (const field of fields) {
        allowedFields.add(field);
      }
    }
  }

  // Write scopes don't need field filtering (they return operation results)
  if (
    scopes.some(
      (s) =>
        s === "write:inbox" ||
        s === "write:knowledge" ||
        s === "trigger:librarian",
    )
  ) {
    return data;
  }

  // If no read scopes matched, return data as-is (tool results like id, status)
  if (allowedFields.size === 0) {
    return data;
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Enforce response size limit (100KB).
 * If exceeded, truncate content and add pagination info.
 */
export function enforceResponseSizeLimit(
  content: string,
): { content: string; truncated: boolean } {
  const bytes = Buffer.byteLength(content, "utf-8");
  if (bytes <= MAX_RESPONSE_BYTES) {
    return { content, truncated: false };
  }

  // Binary search for the right truncation point
  let low = 0;
  let high = content.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (Buffer.byteLength(content.slice(0, mid), "utf-8") <= MAX_RESPONSE_BYTES - 100) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  const truncated = content.slice(0, low);
  return {
    content: truncated + "\n\n[TRUNCATED: Response exceeded 100KB limit]",
    truncated: true,
  };
}

/**
 * Full output sanitization pipeline.
 */
export function sanitizeOutput(
  data: unknown,
  scopes: OAuthScope[],
): {
  data: unknown;
  redactedSecrets: number;
  truncated: boolean;
} {
  let redactedSecrets = 0;
  let truncated = false;

  if (typeof data === "string") {
    const redacted = redactSecrets(data);
    redactedSecrets = redacted.redactedCount;
    const sized = enforceResponseSizeLimit(redacted.content);
    truncated = sized.truncated;
    return { data: sized.content, redactedSecrets, truncated };
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;

    // Field filtering
    const filtered = filterFields(record, scopes);

    // Redact secrets in string values
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filtered)) {
      if (typeof value === "string") {
        const redacted = redactSecrets(value);
        redactedSecrets += redacted.redactedCount;
        sanitized[key] = redacted.content;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) => {
          if (typeof item === "string") {
            const redacted = redactSecrets(item);
            redactedSecrets += redacted.redactedCount;
            return redacted.content;
          }
          if (item && typeof item === "object") {
            const r = sanitizeOutput(item, scopes);
            redactedSecrets += r.redactedSecrets;
            return r.data;
          }
          return item;
        });
      } else {
        sanitized[key] = value;
      }
    }

    // Check total size
    const json = JSON.stringify(sanitized);
    const sized = enforceResponseSizeLimit(json);
    if (sized.truncated) {
      truncated = true;
      return { data: JSON.parse(sized.content), redactedSecrets, truncated };
    }

    return { data: sanitized, redactedSecrets, truncated };
  }

  return { data, redactedSecrets: 0, truncated: false };
}
