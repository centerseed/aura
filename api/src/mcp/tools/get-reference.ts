/**
 * MCP Tool: get_reference
 *
 * 取得特定 reference 的完整內容（包含可能很大的 content 欄位）。
 * 搭配 search 工具使用：先用 search 取得 reference metadata，再用此工具取得完整內容。
 */

import { ValidationException } from "../../lib/api-response";
import type { BackendApiClient } from "../backend-client/api-client";
import type { AuthContext } from "../types";

export interface GetReferenceInput {
  reference_id: string;
  product_id?: string;
  task_id?: string;
}

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
}

interface GetReferenceResponse {
  reference: Reference;
  source: "product" | "task";
}

export async function handleGetReference(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
): Promise<unknown> {
  // 驗證並轉換參數
  const params = validateGetReferenceInput(input);

  // sanitized 警告訊息（如果內容被過濾）
  const warningMessage = sanitized
    ? "\n\n⚠️ Note: Some content may have been filtered for security reasons."
    : "";

  // 呼叫 Backend API
  const data = (await apiClient.getReference(authContext.userId, {
    reference_id: params.reference_id,
    product_id: params.product_id,
    task_id: params.task_id,
  })) as GetReferenceResponse;

  const { reference, source } = data;

  // 格式化回應
  const lines: string[] = [
    `# Reference: ${reference.title || reference.id}`,
    "",
    `**Type**: ${reference.type}`,
    `**Source**: ${source}`,
    `**Created**: ${reference.created_at}`,
    "",
    "## Content",
    "",
    reference.content,
    warningMessage,
  ];

  return {
    content: [
      {
        type: "text",
        text: lines.join("\n"),
      },
    ],
  };
}

/**
 * 驗證 get_reference 的輸入參數
 */
function validateGetReferenceInput(
  input: Record<string, unknown>,
): GetReferenceInput {
  // 驗證 reference_id
  if (!input.reference_id || typeof input.reference_id !== "string") {
    throw new ValidationException(
      "reference_id is required to fetch the reference content",
      "reference_id",
    );
  }

  // 驗證至少有 product_id 或 task_id
  const hasProductId =
    input.product_id && typeof input.product_id === "string";
  const hasTaskId = input.task_id && typeof input.task_id === "string";

  if (!hasProductId && !hasTaskId) {
    throw new ValidationException(
      "Either product_id or task_id must be provided to locate the reference. " +
        "Use product_id if the reference belongs to a product, or task_id if it belongs to a task.",
      "product_id|task_id",
    );
  }

  return {
    reference_id: input.reference_id as string,
    product_id: hasProductId ? (input.product_id as string) : undefined,
    task_id: hasTaskId ? (input.task_id as string) : undefined,
  };
}
