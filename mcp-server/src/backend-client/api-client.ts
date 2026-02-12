/**
 * HTTP client for communicating with the Zentropy Backend API.
 *
 * MCP Server acts as a pass-through: it authenticates and validates,
 * then delegates business logic to the Backend API (Section 6.3).
 */

import type { ServerConfig } from "../config.js";
import type {
  BackendTaskResponse,
  BackendKnowledgeResponse,
  BackendSearchResponse,
} from "../types.js";

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

  constructor(config: ServerConfig) {
    this.baseUrl = config.backendUrl.replace(/\/$/, "");
  }

  /**
   * POST /api/brain-dump — capture a thought into Inbox
   */
  async captureThought(
    userToken: string,
    params: {
      content: string;
      source: string;
      context_hint?: string;
    },
  ): Promise<BackendTaskResponse> {
    return this.post<BackendTaskResponse>(
      "/api/brain-dump",
      userToken,
      params,
    );
  }

  /**
   * POST /api/knowledge — append to knowledge base
   */
  async appendToKnowledge(
    userToken: string,
    params: {
      product_name: string;
      topic_name: string;
      title: string;
      content: string;
    },
  ): Promise<BackendKnowledgeResponse> {
    return this.post<BackendKnowledgeResponse>(
      "/api/knowledge",
      userToken,
      params,
    );
  }

  /**
   * POST /api/vector-search — semantic search across memory
   */
  async queryMemory(
    userToken: string,
    params: {
      query: string;
      scope?: string;
    },
  ): Promise<BackendSearchResponse> {
    return this.post<BackendSearchResponse>(
      "/api/vector-search",
      userToken,
      params,
    );
  }

  /**
   * GET /api/knowledge/:area/:product/:topic — read knowledge asset
   */
  async getKnowledgeAsset(
    userToken: string,
    area: string,
    product: string,
    topic: string,
  ): Promise<{ content: string; metadata: Record<string, unknown> }> {
    const path = `/api/knowledge/${encodeURIComponent(area)}/${encodeURIComponent(product)}/${encodeURIComponent(topic)}`;
    return this.get(path, userToken);
  }

  /**
   * GET /api/saga/:productId — read rolling saga
   */
  async getRollingSaga(
    userToken: string,
    productId: string,
  ): Promise<{ content: string; level: string }> {
    return this.get(
      `/api/saga/${encodeURIComponent(productId)}`,
      userToken,
    );
  }

  /**
   * GET /api/me/bias-vector — read user preferences
   */
  async getUserPreferences(
    userToken: string,
  ): Promise<{ bias_vector: Record<string, unknown>; negative_prompts: string[] }> {
    return this.get("/api/me/bias-vector", userToken);
  }

  private async post<T>(
    path: string,
    userToken: string,
    body: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new BackendApiError(response.status, text);
    }

    return response.json() as Promise<T>;
  }

  private async get<T>(path: string, userToken: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new BackendApiError(response.status, text);
    }

    return response.json() as Promise<T>;
  }
}
