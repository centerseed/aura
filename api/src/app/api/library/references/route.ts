/**
 * GET /api/library/references - 取得特定 reference 的完整內容
 *
 * 根據 product_id/task_id + reference_id 取得完整的 reference（包含 content）。
 * 供 MCP get_reference 工具呼叫。
 */

import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth-middleware";
import { prisma } from "@/lib/db";
import {
  ApiResponseBuilder,
  ValidationException,
  NotFoundException,
  catchDomainException,
} from "@/lib/api-response";

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  return catchDomainException(async () => {
    const userId = await authenticateRequest(request, prisma);
    const { searchParams } = new URL(request.url);

    const productId = searchParams.get("product_id");
    const taskId = searchParams.get("task_id");
    const referenceId = searchParams.get("reference_id");

    if (!referenceId) {
      throw new ValidationException("reference_id is required");
    }

    if (!productId && !taskId) {
      throw new ValidationException("product_id or task_id is required");
    }

    let reference: Reference | null = null;
    let source: "product" | "task" | null = null;

    // 從 product 查詢
    if (productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }

      const references = (product.references as unknown as Reference[]) || [];
      reference = references.find((r) => r.id === referenceId) || null;
      source = "product";
    }

    // 從 task 查詢
    if (!reference && taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          user_id: userId,
          deleted_at: null,
        },
      });

      if (!task) {
        throw new NotFoundException(`Task ${taskId} not found`);
      }

      const references = (task.references as unknown as Reference[]) || [];
      reference = references.find((r) => r.id === referenceId) || null;
      source = "task";
    }

    if (!reference) {
      throw new NotFoundException(
        `Reference ${referenceId} not found in ${productId ? `product ${productId}` : `task ${taskId}`}`
      );
    }

    return ApiResponseBuilder.success({
      reference,
      source,
    });
  });
}
