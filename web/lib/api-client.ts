/**
 * API 客戶端 - 統一調用後端 API
 *
 * 用途：
 * - Web 前端調用獨立的 backend API (api/ 專案)
 * - 支援本地開發和生產環境
 */

import { getIdToken } from "./auth";

// API 基礎 URL - 根據環境變數決定
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
 * 處理 API 回應（支援新的統一格式）
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const data: ApiResponse<T> = await response.json();

  // 檢查新的統一回應格式
  if (data.success) {
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
 * 便利的 API 端點集合
 */
export const API = {
  // 用戶
  users: {
    me: () => getAPI('/api/me'),
    getById: (id: string) => getAPI(`/api/users/${id}`),
  },

  // 完整資料庫（Areas + Products + Tasks）
  library: () => getAPI<any[]>('/api/library'),

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
  tasks: {
    list: (params?: any) => getAPI<any[]>('/api/tasks' + (params ? `?${new URLSearchParams(params)}` : '')),
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
  milestones: {
    list: () => getAPI<any[]>('/api/milestones'),
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
}
