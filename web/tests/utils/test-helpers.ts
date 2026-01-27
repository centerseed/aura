import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'

// Custom render function with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options })
}

// Mock NextRequest helper
export function createMockRequest(options: {
  method?: string
  body?: any
  headers?: Record<string, string>
  url?: string
}) {
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
    },
    json: async () => body,
    url,
  } as any
}

// Mock task data factory
export function createMockTask(overrides: any = {}) {
  return {
    id: 'test-task-id',
    user_id: 'test-user-id',
    product_id: 'test-product-id',
    topic_id: null,
    content: 'Test Task',
    status: 'INBOX',
    ai_analysis: {
      narrative: 'Test narrative',
      strategy_used: 'boundary_match',
    },
    references: [],
    sub_items: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  }
}

// Mock user data factory
export function createMockUser(overrides: any = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    auth_provider_id: 'firebase-uid-123',
    created_at: new Date(),
    ...overrides,
  }
}

// Mock area data factory
export function createMockArea(overrides: any = {}) {
  return {
    id: 'test-area-id',
    user_id: 'test-user-id',
    name: 'Test Area',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  }
}

// Mock product data factory
export function createMockProduct(overrides: any = {}) {
  return {
    id: 'test-product-id',
    user_id: 'test-user-id',
    area_id: 'test-area-id',
    name: 'Test Product',
    lifecycle_status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  }
}

// Mock topic data factory
export function createMockTopic(overrides: any = {}) {
  return {
    id: 'test-topic-id',
    user_id: 'test-user-id',
    product_id: 'test-product-id',
    name: 'Test Topic',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  }
}
