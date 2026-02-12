/**
 * Internal API Client for MCP Tool Handlers
 *
 * Since the MCP server is integrated into the same process as the API,
 * this client calls localhost routes. This reuses existing route handlers
 * with their full validation, auth, and error handling.
 *
 * The access token from the MCP client is passed through directly,
 * so API routes authenticate the user via Firebase as usual.
 */

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
      { text: params.content, source: params.source, context_hint: params.context_hint },
    );
  }

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
      "/api/library/knowledge",
      userToken,
      params,
    );
  }

  async queryMemory(
    userToken: string,
    params: {
      query: string;
      scope?: string;
    },
  ): Promise<BackendSearchResponse> {
    return this.post<BackendSearchResponse>(
      "/api/library/search",
      userToken,
      params,
    );
  }

  async getKnowledgeAsset(
    userToken: string,
    area: string,
    product: string,
    topic: string,
  ): Promise<{ content: string; metadata: Record<string, unknown> }> {
    const path = `/api/library/${encodeURIComponent(area)}/${encodeURIComponent(product)}/${encodeURIComponent(topic)}`;
    return this.get(path, userToken);
  }

  async getRollingSaga(
    userToken: string,
    productId: string,
  ): Promise<{ content: string; level: string }> {
    return this.get(
      `/api/products/${encodeURIComponent(productId)}`,
      userToken,
    );
  }

  async getUserPreferences(
    userToken: string,
  ): Promise<{ bias_vector: Record<string, unknown>; negative_prompts: string[] }> {
    return this.get("/api/me", userToken);
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
