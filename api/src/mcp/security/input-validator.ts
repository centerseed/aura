/**
 * Input Validator (Section 2.4.1)
 *
 * Layer 1: JSON Schema validation — enforces type, required fields, length limits.
 */

import { z } from "zod";
import { ALLOWED_SOURCES } from "../types";

export class InputValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "InputValidationError";
  }
}

export const CaptureThoughtSchema = z.object({
  content: z
    .string()
    .min(1, "Content is required")
    .max(10_000, "Content must not exceed 10,000 characters"),
  source: z.enum(ALLOWED_SOURCES, {
    errorMap: () => ({
      message: `Source must be one of: ${ALLOWED_SOURCES.join(", ")}`,
    }),
  }),
  context_hint: z
    .string()
    .max(200, "Context hint must not exceed 200 characters")
    .optional(),
});

export const AppendToKnowledgeSchema = z.object({
  product_name: z
    .string()
    .min(1, "Product name is required")
    .max(200, "Product name must not exceed 200 characters"),
  topic_name: z
    .string()
    .min(1, "Topic name is required")
    .max(200, "Topic name must not exceed 200 characters"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must not exceed 200 characters"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(50_000, "Content must not exceed 50,000 characters"),
});

export const QueryMemorySchema = z.object({
  query: z
    .string()
    .min(1, "Query is required")
    .max(500, "Query must not exceed 500 characters"),
  scope: z
    .string()
    .max(200, "Scope must not exceed 200 characters")
    .optional(),
});

const TOOL_SCHEMAS: Record<string, z.ZodType> = {
  capture_thought: CaptureThoughtSchema,
  append_to_knowledge: AppendToKnowledgeSchema,
  query_memory: QueryMemorySchema,
};

export function validateToolInput(
  toolName: string,
  input: unknown,
): Record<string, unknown> {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    // Tools registered via server.tool() with Zod schemas are already validated
    // by the MCP SDK before reaching the pipeline. Pass through gracefully.
    return (input ?? {}) as Record<string, unknown>;
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    const firstError = result.error.errors[0];
    const field = firstError.path.join(".") || "input";
    throw new InputValidationError(field, firstError.message);
  }

  return result.data as Record<string, unknown>;
}
