/**
 * API Response Schemas - Runtime Type Validation
 *
 * 使用 Zod 在 runtime 驗證 API 回應格式
 * 確保 backend 回傳的資料結構正確
 */

import { z } from 'zod'

/**
 * 統一 API 回應格式
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      timestamp: z.string(),
    }).passthrough(),
  })

/**
 * Task Schema (寬鬆版本，允許額外欄位)
 */
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  drawer: z.enum(['ACTIVE', 'MAINTAIN', 'REFERENCE', 'ARCHIVE']),
  product_id: z.string().nullable(),
  due_date: z.string().nullable(),
  completed_at: z.string().nullable(),
}).passthrough() // passthrough 允許額外欄位（如 narrative, lifecycle, tag等）

/**
 * Product Schema (寬鬆版本，允許額外欄位)
 */
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  tasks: z.array(TaskSchema),
}).passthrough() // passthrough 允許額外欄位

/**
 * Area Schema
 */
export const AreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  products: z.array(ProductSchema),
}).passthrough()

/**
 * Milestone Schema
 */
export const MilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  target_date: z.string(),
  status: z.string(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
}).passthrough()

/**
 * API Endpoints Schemas
 */
export const ApiSchemas = {
  // /api/library - 必須回傳 { areas: Area[] }
  library: z.object({
    areas: z.array(AreaSchema),
  }),

  // /api/milestones - 必須回傳 { milestones: Milestone[] }
  milestones: z.object({
    milestones: z.array(MilestoneSchema),
  }),

  // /api/tasks - 必須回傳 { tasks: Task[] }
  tasks: z.object({
    tasks: z.array(TaskSchema),
  }),

  // /api/me - 必須回傳 { user: {...} }
  me: z.object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string().optional(),
      name: z.string().optional(),
    }).passthrough(),
  }),
}

export type Area = z.infer<typeof AreaSchema>
export type Product = z.infer<typeof ProductSchema>
export type Task = z.infer<typeof TaskSchema>
export type Milestone = z.infer<typeof MilestoneSchema>
