import { getIdToken } from "./auth";

/**
 * 通用 API 客戶端，自動加入 Firebase ID Token
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const token = await getIdToken();

    if (!token) {
      throw new Error("Not authenticated - please log in");
    }

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };

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
 * 便利方法：GET 請求
 */
export async function getAPI(url: string) {
  const response = await fetchWithAuth(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * 便利方法：POST 請求
 */
export async function postAPI(url: string, data: any) {
  const response = await fetchWithAuth(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * 便利方法：PATCH 請求
 */
export async function patchAPI(url: string, data: any) {
  const response = await fetchWithAuth(url, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * 便利方法：DELETE 請求
 */
export async function deleteAPI(url: string) {
  const response = await fetchWithAuth(url, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
