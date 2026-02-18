/**
 * Internal API Client for MCP Tool Handlers
 *
 * Since the MCP server is integrated into the same process as the API,
 * this client calls localhost routes. This reuses existing route handlers
 * with their full validation, auth, and error handling.
 *
 * Authentication: Uses HMAC-based internal auth (X-MCP-Internal / X-MCP-User-Id)
 * instead of Firebase tokens, since the MCP layer already verified the user's
 * identity via OAuth 2.1 JWT.
 */

import { signInternalAuth } from "../oauth/jwt";
import type {
  BackendTaskResponse,
  BackendKnowledgeResponse,
  BackendSearchResponse,
} from "../types";

export class BackendApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export class BackendApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async captureThought(
    userId: string,
    params: {
      content: string;
      source: string;
      context_hint?: string;
    },
  ): Promise<BackendTaskResponse> {
    return this.post<BackendTaskResponse>(
      "/api/brain-dump",
      userId,
      { text: params.content, source: params.source, context_hint: params.context_hint },
    );
  }

  async appendToKnowledge(
    userId: string,
    params: {
      product_name: string;
      topic_name: string;
      title: string;
      content: string;
    },
  ): Promise<BackendKnowledgeResponse> {
    return this.post<BackendKnowledgeResponse>(
      "/api/library/knowledge",
      userId,
      params,
    );
  }

  async queryMemory(
    userId: string,
    params: {
      query: string;
      scope?: string;
    },
  ): Promise<BackendSearchResponse> {
    return this.post<BackendSearchResponse>(
      "/api/library/search",
      userId,
      params,
    );
  }

  async getKnowledgeAsset(
    userId: string,
    area: string,
    product: string,
    topic: string,
  ): Promise<{ content: string; metadata: Record<string, unknown> }> {
    const path = `/api/library/${encodeURIComponent(area)}/${encodeURIComponent(product)}/${encodeURIComponent(topic)}`;
    return this.get(path, userId);
  }

  async getRollingSaga(
    userId: string,
    productId: string,
  ): Promise<{ content: string; level: string }> {
    return this.get(
      `/api/products/${encodeURIComponent(productId)}`,
      userId,
    );
  }

  async getUserPreferences(
    userId: string,
  ): Promise<{ bias_vector: Record<string, unknown>; negative_prompts: string[] }> {
    return this.get("/api/me", userId);
  }

  async listTasks(
    userId: string,
    params?: {
      status?: string;
      product_id?: string;
      topic_id?: string;
    },
  ): Promise<unknown> {
    const queryParts: string[] = []
    if (params?.status) queryParts.push(`status=${encodeURIComponent(params.status)}`)
    if (params?.product_id) queryParts.push(`product_id=${encodeURIComponent(params.product_id)}`)
    if (params?.topic_id) queryParts.push(`topic_id=${encodeURIComponent(params.topic_id)}`)

    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ""
    return this.get(`/api/tasks${query}`, userId);
  }

  async addSubItem(
    userId: string,
    taskId: string,
    content: string,
  ): Promise<unknown> {
    return this.post(`/api/tasks/${encodeURIComponent(taskId)}/sub-items`, userId, { content });
  }

  async updateSubItem(
    userId: string,
    taskId: string,
    subItemId: string,
    params: { completed?: boolean; content?: string },
  ): Promise<unknown> {
    return this.patch(
      `/api/tasks/${encodeURIComponent(taskId)}/sub-items/${encodeURIComponent(subItemId)}`,
      userId,
      params,
    );
  }

  async createTask(
    userId: string,
    params: {
      content: string;
      product_id?: string;
      topic_id?: string;
      status?: string;
      start_date?: string;
      due_date?: string;
    },
  ): Promise<unknown> {
    return this.post("/api/tasks", userId, params);
  }

  async updateTask(
    userId: string,
    params: {
      task_id: string;
      status?: string;
      content?: string;
      start_date?: string | null;
      due_date?: string | null;
    },
  ): Promise<unknown> {
    const { task_id, ...body } = params;
    return this.patch(`/api/tasks/${encodeURIComponent(task_id)}`, userId, body);
  }

  async listProducts(userId: string): Promise<unknown> {
    return this.get("/api/products", userId);
  }

  async getPlan(
    userId: string,
    params?: { date?: string },
  ): Promise<unknown> {
    const query = params?.date ? `?date=${encodeURIComponent(params.date)}` : "";
    return this.get(`/api/coach/plan${query}`, userId);
  }

  async getReference(
    userId: string,
    params: {
      reference_id: string;
      product_id?: string;
      task_id?: string;
    },
  ): Promise<unknown> {
    const queryParts: string[] = [
      `reference_id=${encodeURIComponent(params.reference_id)}`,
    ];
    if (params.product_id) {
      queryParts.push(`product_id=${encodeURIComponent(params.product_id)}`);
    }
    if (params.task_id) {
      queryParts.push(`task_id=${encodeURIComponent(params.task_id)}`);
    }
    const query = `?${queryParts.join("&")}`;
    return this.get(`/api/library/references${query}`, userId);
  }

  async addProductReference(
    userId: string,
    productId: string,
    params: {
      type: "url" | "note";
      content: string;
      title?: string;
    },
  ): Promise<unknown> {
    return this.post(`/api/products/${productId}/references`, userId, params);
  }

  /**
   * Build auth headers for internal API calls.
   *
   * Production (ZENTROPY_MCP_JWT_SECRET set):
   *   HMAC-signed X-MCP-Internal + X-MCP-User-Id headers,
   *   verified by authenticateRequest() in auth-middleware.
   *
   * Development (no secret):
   *   X-Test-User-Id header, accepted by authenticateRequest()
   *   when DATABASE_URL points to localhost.
   */
  private getInternalAuthHeaders(userId: string): Record<string, string> {
    if (process.env.ZENTROPY_MCP_JWT_SECRET) {
      const hmac = signInternalAuth(userId);
      return {
        "X-MCP-Internal": hmac,
        "X-MCP-User-Id": userId,
      };
    }
    // Dev mode: use test user header (requires local DATABASE_URL)
    return {
      "X-Test-User-Id": userId,
    };
  }

  private async post<T>(
    path: string,
    userId: string,
    body: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getInternalAuthHeaders(userId),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new BackendApiError(response.status, text);
    }

    return this.unwrapResponse<T>(await response.json());
  }

  private async patch<T>(
    path: string,
    userId: string,
    body: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.getInternalAuthHeaders(userId),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new BackendApiError(response.status, text);
    }

    return this.unwrapResponse<T>(await response.json());
  }

  private async get<T>(path: string, userId: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...this.getInternalAuthHeaders(userId),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new BackendApiError(response.status, text);
    }

    return this.unwrapResponse<T>(await response.json());
  }

  /**
   * Unwrap ApiResponseBuilder envelope { success, data } if present.
   */
  private unwrapResponse<T>(json: unknown): T {
    if (
      json !== null &&
      typeof json === "object" &&
      "success" in json &&
      (json as Record<string, unknown>).success === true &&
      "data" in json
    ) {
      return (json as Record<string, unknown>).data as T;
    }
    return json as T;
  }
}
