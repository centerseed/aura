/**
 * Mock Types - 測試 Mock 類型定義
 *
 * 消除測試中的 any 使用，提供類型安全的 Mock 類型
 */

import type {
  Task,
  TaskCard,
  Area,
  Product,
  Milestone,
  SubItem,
  Reference,
} from '@/types'

/**
 * Mock 請求選項
 */
export interface MockRequestOptions {
  body?: Record<string, unknown>
  headers?: Record<string, string>
  method?: string
  status?: number
  url?: string
}

/**
 * Mock Task 覆寫選項
 */
export type MockTaskOverrides = Partial<Task>

/**
 * Mock TaskCard 覆寫選項
 */
export type MockTaskCardOverrides = Partial<TaskCard>

/**
 * Mock User 覆寫選項
 */
export interface MockUserOverrides {
  id?: string
  email?: string
  name?: string
  auth_provider_id?: string
  created_at?: string
}

/**
 * Mock Area 覆寫選項
 */
export type MockAreaOverrides = Partial<Area>

/**
 * Mock Product 覆寫選項
 */
export type MockProductOverrides = Partial<Product>

/**
 * Mock Milestone 覆寫選項
 */
export type MockMilestoneOverrides = Partial<Milestone>

/**
 * Mock SubItem 覆寫選項
 */
export type MockSubItemOverrides = Partial<SubItem>

/**
 * Mock Reference 覆寫選項
 */
export type MockReferenceOverrides = Partial<Reference>

/**
 * Mock Response 選項
 */
export interface MockResponseOptions {
  status?: number
  statusText?: string
  headers?: Record<string, string>
}
