/**
 * MCP Request Context
 *
 * Uses AsyncLocalStorage to pass request metadata (e.g., access token)
 * from the HTTP layer to tool handlers without explicit parameter passing.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface McpRequestContext {
  /** Raw access token from Authorization header (without "Bearer " prefix) */
  accessToken?: string;
  /** Original HTTP headers */
  headers?: Record<string, string | string[] | undefined>;
}

export const mcpRequestContext = new AsyncLocalStorage<McpRequestContext>();

/**
 * Get the current MCP request context.
 * Returns undefined if not running within an MCP request.
 */
export function getCurrentContext(): McpRequestContext | undefined {
  return mcpRequestContext.getStore();
}

/**
 * Get the access token from the current request context.
 */
export function getCurrentAccessToken(): string | undefined {
  return mcpRequestContext.getStore()?.accessToken;
}
