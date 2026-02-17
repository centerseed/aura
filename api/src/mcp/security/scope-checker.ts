/**
 * Tool-Level Authorization / Scope Checker (Section 2.3.3)
 *
 * Verifies that the authenticated user's scopes permit the requested operation.
 */

import type { AuthContext, OAuthScope } from "../types";

export class ScopeError extends Error {
  constructor(
    public readonly requiredScopes: OAuthScope[],
    public readonly availableScopes: OAuthScope[],
  ) {
    super(
      `Insufficient permissions. Required: [${requiredScopes.join(", ")}], ` +
        `available: [${availableScopes.join(", ")}]`,
    );
    this.name = "ScopeError";
  }
}

/** Mapping of each tool to its required scopes */
const TOOL_SCOPE_MAP: Record<string, OAuthScope[]> = {
  capture_thought: ["write:inbox"],
  append_to_knowledge: ["write:knowledge"],
  query_memory: ["read:tasks"],
  // v2 tools
  capture: ["write:inbox"],
  report_done: ["write:inbox"],
  search: ["read:tasks"],
  save_knowledge: ["write:knowledge"],
  // dev tools
  list_tasks: ["read:tasks"],
  create_task: ["write:inbox"],
  update_task: ["write:inbox"],
  list_products: ["read:tasks"],
  get_plan: ["read:tasks"],
};

/** Mapping of resource URI patterns to required scopes */
const RESOURCE_SCOPE_MAP: Record<string, OAuthScope[]> = {
  knowledge: ["read:knowledge"],
  saga: ["read:knowledge"],
  profile: ["read:profile"],
  tasks: ["read:tasks"],
};

export function checkToolScope(
  authContext: AuthContext,
  toolName: string,
): void {
  const required = TOOL_SCOPE_MAP[toolName];
  if (!required) {
    throw new ScopeError([toolName as OAuthScope], authContext.scopes);
  }

  if (toolName === "query_memory") {
    const hasReadTasks = authContext.scopes.includes("read:tasks");
    const hasReadKnowledge = authContext.scopes.includes("read:knowledge");
    if (!hasReadTasks && !hasReadKnowledge) {
      throw new ScopeError(
        ["read:tasks", "read:knowledge"],
        authContext.scopes,
      );
    }
    return;
  }

  const missing = required.filter((s) => !authContext.scopes.includes(s));
  if (missing.length > 0) {
    throw new ScopeError(required, authContext.scopes);
  }
}

export function checkResourceScope(
  authContext: AuthContext,
  resourceType: string,
): void {
  const required = RESOURCE_SCOPE_MAP[resourceType];
  if (!required) {
    throw new ScopeError(
      [resourceType as OAuthScope],
      authContext.scopes,
    );
  }

  const missing = required.filter((s) => !authContext.scopes.includes(s));
  if (missing.length > 0) {
    throw new ScopeError(required, authContext.scopes);
  }
}
