/**
 * list_products Tool Handler
 *
 * MCP Tool: list_products
 * 查看專案結構 — 回傳精簡版 Area/Product/Topic 結構。
 *
 * Required Scope: read:tasks
 */

import type { BackendApiClient } from '../backend-client/api-client'
import type { AuthContext } from '../types'

interface ProductItem {
  id: string
  name?: string
  area?: { id: string; name: string }
  status?: string
  topics?: Array<{ id: string; name: string }>
  [key: string]: unknown
}

export async function handleListProducts(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  _input: Record<string, unknown>,
  _sanitized: boolean,
) {
  const data = await apiClient.listProducts(authContext.userId)

  // 驗證 API 回應格式
  if (!data) {
    console.error('[list_products] API returned null or undefined')
    return { products: [], total: 0 }
  }

  let products: ProductItem[]
  if (Array.isArray(data)) {
    products = data
  } else if (typeof data === 'object' && 'products' in data && Array.isArray(data.products)) {
    products = data.products
  } else {
    console.error('[list_products] Unexpected API response format:', typeof data)
    return { products: [], total: 0 }
  }

  const slim = products.map((p: ProductItem) => ({
    id: p.id,
    name: p.name,
    area: p.area?.name,
    status: p.status,
    topics: p.topics?.map((t) => ({ id: t.id, name: t.name })),
  }))

  return { products: slim, total: slim.length }
}
