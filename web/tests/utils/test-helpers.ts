import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import type {
  Task,
  Area,
  Product,
  SubItem,
  Reference,
} from '@/types'
import type {
  MockRequestOptions,
  MockTaskOverrides,
  MockUserOverrides,
  MockAreaOverrides,
  MockProductOverrides,
  MockSubItemOverrides,
  MockReferenceOverrides,
} from '../mocks/types'

// Custom render function with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options })
}

// Mock NextRequest helper
// 回傳 any 避免 Request vs NextRequest 型別不相容問題
// 實際測試中只需要 headers.get() 和 json() 方法
export function createMockRequest(options: MockRequestOptions = {}): any {
  const {
    method = 'GET',
    body,
    headers = {},
    url = 'http://localhost:3000/api/test',
  } = options

  return {
    method,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
    } as unknown as Headers,
    json: async () => body,
    url,
  } as unknown as Request
}

// Mock task data factory
export function createMockTask(overrides: MockTaskOverrides = {}): Task {
  return {
    id: 'test-task-id',
    user_id: 'test-user-id',
    product_id: 'test-product-id',
    topic_id: null,
    content: 'Test Task',
    status: 'INBOX',
    lifecycle: 'embryo',
    ai_analysis: {
      narrative: 'Test narrative',
      strategy_used: 'boundary_match',
    },
    references: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// Mock user data factory
export function createMockUser(overrides: MockUserOverrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    auth_provider_id: 'firebase-uid-123',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// Mock area data factory
export function createMockArea(overrides: MockAreaOverrides = {}): Area {
  return {
    id: 'test-area-id',
    user_id: 'test-user-id',
    name: 'Test Area',
    scope: null,
    description: null,
    is_custom: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// Mock product data factory
export function createMockProduct(overrides: MockProductOverrides = {}): Product {
  return {
    id: 'test-product-id',
    user_id: 'test-user-id',
    area_id: 'test-area-id',
    name: 'Test Product',
    description: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// Mock topic data factory
export function createMockTopic(overrides: Partial<{ id: string; user_id: string; product_id: string; name: string; created_at: string }> = {}) {
  return {
    id: 'test-topic-id',
    user_id: 'test-user-id',
    product_id: 'test-product-id',
    name: 'Test Topic',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// Mock SubItem data factory
export function createMockSubItem(overrides: MockSubItemOverrides = {}): SubItem {
  return {
    id: 'test-subitem-id',
    content: 'Test SubItem',
    completed: false,
    created_at: new Date().toISOString(),
    completed_at: null,
    order: 0,
    ...overrides,
  }
}

// Mock Reference data factory
export function createMockReference(overrides: MockReferenceOverrides = {}): Reference {
  return {
    id: 'test-reference-id',
    type: 'url',
    content: 'https://example.com',
    title: 'Test Reference',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}
