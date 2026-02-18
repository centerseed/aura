/**
 * MCP Tool: add_reference
 *
 * 新增 reference 到指定的 product。
 * 支援兩種類型：url（外部連結）或 note（文件內容）。
 */

import { ValidationException } from "../../lib/api-response";
import type { BackendApiClient } from "../backend-client/api-client";
import type { AuthContext } from "../types";

export interface AddReferenceInput {
  product_id: string;
  type: "url" | "note";
  content: string;
  title?: string;
}

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
}

interface AddReferenceResponse {
  productId: string;
  productName: string;
  reference: Reference;
}

export async function handleAddReference(
  apiClient: BackendApiClient,
  authContext: AuthContext,
  input: Record<string, unknown>,
  sanitized: boolean,
): Promise<unknown> {
  // 驗證並轉換參數
  const params = validateAddReferenceInput(input);

  // sanitized 警告訊息（如果內容被過濾）
  const warningMessage = sanitized
    ? "\n\n⚠️ Note: Some content may have been filtered for security reasons."
    : "";

  // 呼叫 Backend API
  const data = (await apiClient.addProductReference(
    authContext.userId,
    params.product_id,
    {
      type: params.type,
      content: params.content.trim(),
      title: params.title?.trim(),
    }
  )) as AddReferenceResponse;

  const { productName, reference } = data;

  // 格式化回應
  const lines: string[] = [
    `✅ Reference added to product: ${productName}`,
    "",
    `**ID**: ${reference.id}`,
    `**Type**: ${reference.type}`,
    `**Title**: ${reference.title || "(no title)"}`,
    `**Created**: ${reference.created_at}`,
    "",
    "## Content Preview",
    "",
    reference.content.length > 200
      ? reference.content.substring(0, 200) + "..."
      : reference.content,
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
 * 驗證 add_reference 的輸入參數
 */
function validateAddReferenceInput(
  input: Record<string, unknown>,
): AddReferenceInput {
  // 驗證 product_id
  if (!input.product_id || typeof input.product_id !== "string") {
    throw new ValidationException(
      "product_id is required to add a reference to a product",
      "product_id",
    );
  }

  // 驗證 type
  if (!input.type || typeof input.type !== "string") {
    throw new ValidationException(
      "type is required and must be a string",
      "type",
    );
  }

  if (!["url", "note"].includes(input.type)) {
    throw new ValidationException(
      "type must be either 'url' (for external links) or 'note' (for text content)",
      "type",
    );
  }

  // 驗證 content
  if (!input.content || typeof input.content !== "string") {
    throw new ValidationException(
      "content is required and must be a string",
      "content",
    );
  }

  if (!input.content.trim()) {
    throw new ValidationException(
      "content cannot be empty or contain only whitespace",
      "content",
    );
  }

  // 驗證 title（可選）
  if (input.title !== undefined && typeof input.title !== "string") {
    throw new ValidationException("title must be a string", "title");
  }

  return {
    product_id: input.product_id as string,
    type: input.type as "url" | "note",
    content: input.content as string,
    title:
      input.title && typeof input.title === "string"
        ? input.title
        : undefined,
  };
}
