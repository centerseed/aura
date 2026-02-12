/**
 * Shared types for the Zentropy MCP Server
 */

/** OAuth scopes as defined in the spec (Section 2.3.1) */
export type OAuthScope =
  | "read:tasks"
  | "read:knowledge"
  | "read:profile"
  | "write:inbox"
  | "write:knowledge"
  | "trigger:librarian";

/** Authenticated user context attached to each request */
export interface AuthContext {
  userId: string;
  clientId: string;
  scopes: OAuthScope[];
  tokenExpiry: number;
}

/** Allowed sources for capture_thought (Section 2.4.1) */
export const ALLOWED_SOURCES = [
  "Claude Code",
  "Cursor",
  "Claude Desktop",
  "API",
] as const;

export type AllowedSource = (typeof ALLOWED_SOURCES)[number];

/** Audit log entry (Section 2.8) */
export interface AuditEntry {
  timestamp: string;
  user_id: string;
  client_id: string;
  tool: string;
  scope_used: OAuthScope[];
  input_hash: string;
  output_size_bytes: number;
  sanitization_applied: boolean;
  latency_ms: number;
  status: "success" | "error" | "rate_limited" | "unauthorized";
}

/** Backend API response types */
export interface BackendTaskResponse {
  id: string;
  status: string;
  title?: string;
  sub_items?: Array<{ id: string; title: string; status: string }>;
}

export interface BackendKnowledgeResponse {
  id: string;
  status: string;
  product_name: string;
  topic_name: string;
}

export interface BackendSearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  product_name?: string;
  area_name?: string;
}

export interface BackendSearchResponse {
  results: BackendSearchResult[];
  total: number;
}
