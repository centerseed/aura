/**
 * API 客戶端 - 統一調用後端 API
 *
 * 用途：
 * - Web 前端調用獨立的 backend API (api/ 專案)
 * - 支援本地開發和生產環境
 * - Runtime type validation (使用 Zod 驗證 API 回應格式)
 */

import { getIdToken } from "./auth";
import { ApiSchemas } from "./api-schemas";
import type { z } from "zod";

// API 基礎 URL - 根據環境變數決定
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * 構建完整的 API URL
 */
export function apiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

/**
 * 統一的 API 回應格式（對應 backend 的 ApiResponseBuilder）
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * API 錯誤類別
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 通用 API 客戶端，自動加入 Firebase ID Token
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const token = await getIdToken();

    if (!token) {
      throw new Error("Not authenticated - please log in");
    }

    // 建立完整 URL
    const url = `${API_BASE_URL}${endpoint}`;

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };

    console.log(`[API] ${options.method || 'GET'} ${url}`);

    return fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

/**
 * 處理 API 回應（支援新的統一格式 + Runtime validation）
 */
async function handleResponse<T>(
  response: Response,
  schema?: z.ZodType<T>
): Promise<T> {
  const data: ApiResponse<T> = await response.json();

  // 檢查新的統一回應格式
  if (data.success) {
    // Runtime type validation (如果有提供 schema)
    if (schema) {
      const validation = schema.safeParse(data.data);
      if (!validation.success) {
        console.error('❌ API Response Validation Failed:', {
          endpoint: response.url,
          errors: validation.error.issues,
          receivedData: data.data,
        });
        throw new ApiError(
          `API response format error: ${validation.error.issues[0].message}`,
          'VALIDATION_ERROR',
          response.status,
          validation.error.issues
        );
      }
      return validation.data;
    }
    return data.data;
  } else {
    // 錯誤回應
    throw new ApiError(
      data.error.message,
      data.error.code,
      response.status,
      data.error.details
    );
  }
}

/**
 * 便利方法：GET 請求
 */
export async function getAPI<T = any>(endpoint: string): Promise<T> {
  const response = await fetchWithAuth(endpoint, { method: "GET" });
  return handleResponse<T>(response);
}

/**
 * 便利方法：POST 請求
 */
export async function postAPI<T = any>(endpoint: string, data?: any): Promise<T> {
  const response = await fetchWithAuth(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

/**
 * 便利方法：PUT 請求
 */
export async function putAPI<T = any>(endpoint: string, data?: any): Promise<T> {
  const response = await fetchWithAuth(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

/**
 * 便利方法：PATCH 請求
 */
export async function patchAPI<T = any>(endpoint: string, data?: any): Promise<T> {
  const response = await fetchWithAuth(endpoint, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<T>(response);
}

/**
 * 便利方法：DELETE 請求
 */
export async function deleteAPI<T = any>(endpoint: string): Promise<T> {
  const response = await fetchWithAuth(endpoint, { method: "DELETE" });
  return handleResponse<T>(response);
}

/**
 * 便利的 API 端點集合（加入 Runtime Validation）
 */
export const API = {
  // Dashboard - 統一資料載入（解決 HTTP/1.1 序列化問題）
  // 在 API 層使用 Promise.all 並發查詢，前端只需一次 HTTP 請求
  dashboard: async (params?: {
    include?: string
    include_archived?: boolean
    tasks_status?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.include) queryParams.set('include', params.include)
    if (params?.include_archived) queryParams.set('include_archived', 'true')
    if (params?.tasks_status) queryParams.set('tasks_status', params.tasks_status)

    const queryString = queryParams.toString()
    const endpoint = '/api/dashboard' + (queryString ? `?${queryString}` : '')
    const response = await fetchWithAuth(endpoint, { method: 'GET' })
    return handleResponse(response) as Promise<{
      user?: any
      library?: { areas: any[] }
      milestones?: any[]
      completedToday?: { tasks: any[]; meta: any }
      areas?: any[]
      products?: any[]
      tasks?: { tasks: any[]; meta: any }
    }>
  },

  // 用戶
  // ⚠️ 注意: getAPI 已在 handleResponse 中自動解包 data
  // 所以這裡的型別是 data 內部的結構，不是完整的 API 回應
  users: {
    me: async () => {
      const response = await fetchWithAuth('/api/me', { method: 'GET' });
      return handleResponse(response, ApiSchemas.me) as Promise<{ user: any }>;
    },
    getById: (id: string) => getAPI(`/api/users/${id}`),
  },

  // 完整資料庫（Areas + Products + Tasks）
  // ⚠️ 注意: getAPI 已在 handleResponse 中自動解包 data
  // ⚠️ Runtime validation: 確保回傳 { areas: [...] } 格式
  library: async () => {
    const response = await fetchWithAuth('/api/library', { method: 'GET' });
    return handleResponse(response, ApiSchemas.library) as Promise<{ areas: any[] }>;
  },

  // 領域
  areas: {
    list: () => getAPI<any[]>('/api/areas'),
    create: (data: any) => postAPI('/api/areas', data),
    update: (id: string, data: any) => putAPI(`/api/areas/${id}`, data),
    delete: (id: string) => deleteAPI(`/api/areas/${id}`),
  },

  // 產品
  products: {
    list: () => getAPI<any[]>('/api/products'),
    create: (data: any) => postAPI('/api/products', data),
    update: (id: string, data: any) => patchAPI(`/api/products/${id}`, data),
    delete: (id: string) => deleteAPI(`/api/products/${id}`),
    reorder: (data: any) => postAPI('/api/products/reorder', data),
  },

  // 任務
  // API 回傳格式: { tasks: [...] }
  // ⚠️ Runtime validation: 確保回傳 { tasks: [...] } 格式
  tasks: {
    list: async (params?: any) => {
      const endpoint = '/api/tasks' + (params ? `?${new URLSearchParams(params)}` : '');
      const response = await fetchWithAuth(endpoint, { method: 'GET' });
      return handleResponse(response, ApiSchemas.tasks) as Promise<{ tasks: any[] }>;
    },
    getById: (id: string) => getAPI(`/api/tasks/${id}`),
    create: (data: any) => postAPI('/api/tasks', data),
    update: (id: string, data: any) => patchAPI(`/api/tasks/${id}`, data),
    delete: (id: string) => deleteAPI(`/api/tasks/${id}`),

    // 子項目
    subItems: {
      add: (taskId: string, data: any) => postAPI(`/api/tasks/${taskId}/sub-items`, data),
      update: (taskId: string, subItemId: string, data: any) => patchAPI(`/api/tasks/${taskId}/sub-items/${subItemId}`, data),
      delete: (taskId: string, subItemId: string) => deleteAPI(`/api/tasks/${taskId}/sub-items/${subItemId}`),
    },

    // 參考資料
    references: {
      add: (taskId: string, data: any) => postAPI(`/api/tasks/${taskId}/references`, data),
      update: (taskId: string, referenceId: string, data: any) => patchAPI(`/api/tasks/${taskId}/references/${referenceId}`, data),
      delete: (taskId: string, referenceId: string) => deleteAPI(`/api/tasks/${taskId}/references/${referenceId}`),
    },

    // 合併任務
    merge: (taskId: string, data: any) => postAPI(`/api/tasks/${taskId}/merge-into`, data),
  },

  // Milestones
  // API 回傳格式: { milestones: [...] }
  // ⚠️ Runtime validation: 確保回傳 { milestones: [...] } 格式
  milestones: {
    list: async () => {
      const response = await fetchWithAuth('/api/milestones', { method: 'GET' });
      return handleResponse(response, ApiSchemas.milestones) as Promise<{ milestones: any[] }>;
    },
    create: (data: any) => postAPI('/api/milestones', data),
    update: (id: string, data: any) => putAPI(`/api/milestones/${id}`, data),
    delete: (id: string) => deleteAPI(`/api/milestones/${id}`),
  },

  // AI 功能
  ai: {
    brainDump: (data: any) => postAPI('/api/brain-dump', data),
    adjustTags: (data: any) => postAPI('/api/adjust-tags', data),
    suggestProduct: (data: any) => postAPI('/api/suggest-product', data),
    reorganize: (data: any) => postAPI('/api/reorganize', data),
  },

  // Coach Agent
  coach: {
    generateBriefing: (data: { type: 'MORNING' | 'EVENING'; date?: string; timezone?: string }) =>
      postAPI('/api/coach/briefing', data),
    getLatestBriefing: (params?: { type?: 'MORNING' | 'EVENING' }) => {
      const qs = params?.type ? `?type=${params.type}` : ''
      return getAPI(`/api/coach/briefing/latest${qs}`)
    },
  },
}
