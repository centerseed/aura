import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
  // 當 reference 從已刪除的 task 移動過來時，保留原始 task 資訊
  originalTaskId?: string;
  originalTaskContent?: string;
}

interface ReferenceWithSource extends Reference {
  source: "product" | "task";
  taskId?: string;
  taskContent?: string;
}

// GET /api/products/[id]/references - 取得該 product 的所有 references（包含 product 層級和 task 層級）
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const userId = await authenticateRequest(request, prisma);

    // 查詢 product 並驗證屬於當前用戶
    const product = await prisma.product.findFirst({
      where: { id: params.id, user_id: userId, deleted_at: null },
      include: {
        tasks: {
          where: { deleted_at: null },
          select: {
            id: true,
            content: true,
            references: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const allReferences: ReferenceWithSource[] = [];

    // 1. 加入 product 層級的 references
    const productReferences = (product.references as unknown as Reference[]) || [];
    for (const ref of productReferences) {
      allReferences.push({
        ...ref,
        source: "product",
        // 如果有原始 task 資訊（從已刪除的 task 移過來的），顯示它
        taskId: ref.originalTaskId,
        taskContent: ref.originalTaskContent || "(已刪除的任務)",
      });
    }

    // 2. 加入 task 層級的 references
    for (const task of product.tasks) {
      const taskReferences = (task.references as unknown as Reference[]) || [];
      for (const ref of taskReferences) {
        allReferences.push({
          ...ref,
          source: "task",
          taskId: task.id,
          taskContent: task.content,
        });
      }
    }

    // 按建立時間排序（最新的在前）
    allReferences.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      productId: product.id,
      productName: product.name,
      references: allReferences,
      total: allReferences.length,
    });
  } catch (error) {
    console.error("Get product references failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: "Failed to get product references",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/references - 新增 product 層級的 reference
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json();
    const { type, content, title } = body;

    // 驗證必填欄位
    if (!type || !["url", "note"].includes(type)) {
      return NextResponse.json(
        { error: "'type' must be 'url' or 'note'" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "'content' is required and cannot be empty" },
        { status: 400 }
      );
    }

    // 查詢 product 並驗證屬於當前用戶
    const product = await prisma.product.findFirst({
      where: { id: params.id, user_id: userId, deleted_at: null },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 獲取現有的 references
    const existingReferences = (product.references as unknown as Reference[]) || [];

    // 創建新的 reference
    const now = new Date().toISOString();
    const newReference: Reference = {
      id: crypto.randomUUID(),
      type,
      content: content.trim(),
      title: title?.trim() || null,
      created_at: now,
    };

    // 更新 references
    const updatedReferences = [...existingReferences, newReference];

    // 保存到資料庫
    await prisma.product.update({
      where: { id: params.id },
      data: {
        references: updatedReferences as any,
      },
    });

    return NextResponse.json({
      success: true,
      reference: newReference,
      total: updatedReferences.length,
    });
  } catch (error) {
    console.error("Add product reference failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: "Failed to add reference",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// PATCH /api/products/[id]/references - 更新 reference（標題和內容）
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json();
    const { referenceId, taskId, title, content } = body;

    if (!referenceId) {
      return NextResponse.json(
        { error: "'referenceId' is required" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "'content' is required and cannot be empty" },
        { status: 400 }
      );
    }

    // 查詢 product 並驗證屬於當前用戶
    const product = await prisma.product.findFirst({
      where: { id: params.id, user_id: userId, deleted_at: null },
      include: {
        tasks: {
          where: { deleted_at: null },
          select: {
            id: true,
            references: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let updated = false;

    // 如果指定了 taskId，從該 task 更新
    if (taskId) {
      const task = product.tasks.find((t) => t.id === taskId);
      if (task) {
        const taskReferences = (task.references as unknown as Reference[]) || [];
        const updatedReferences = taskReferences.map((ref) => {
          if (ref.id === referenceId) {
            updated = true;
            return {
              ...ref,
              title: title?.trim() || null,
              content: content.trim(),
            };
          }
          return ref;
        });

        if (updated) {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              references: updatedReferences as any,
            },
          });
        }
      }
    }

    // 如果沒有從 task 更新，嘗試從 product 更新
    if (!updated) {
      const productReferences = (product.references as unknown as Reference[]) || [];
      const updatedReferences = productReferences.map((ref) => {
        if (ref.id === referenceId) {
          updated = true;
          return {
            ...ref,
            title: title?.trim() || null,
            content: content.trim(),
          };
        }
        return ref;
      });

      if (updated) {
        await prisma.product.update({
          where: { id: params.id },
          data: {
            references: updatedReferences as any,
          },
        });
      }
    }

    // 如果還是沒找到，嘗試從所有 task 中搜尋並更新
    if (!updated) {
      for (const task of product.tasks) {
        const taskReferences = (task.references as unknown as Reference[]) || [];
        const updatedReferences = taskReferences.map((ref) => {
          if (ref.id === referenceId) {
            updated = true;
            return {
              ...ref,
              title: title?.trim() || null,
              content: content.trim(),
            };
          }
          return ref;
        });

        if (updated) {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              references: updatedReferences as any,
            },
          });
          break;
        }
      }
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Reference not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Update reference failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: "Failed to update reference",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]/references?referenceId=xxx - 刪除 reference（不論是 product 或 task 的）
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const userId = await authenticateRequest(request, prisma);
    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get("referenceId");
    const taskId = searchParams.get("taskId"); // 可選，如果提供則從特定 task 刪除

    if (!referenceId) {
      return NextResponse.json(
        { error: "'referenceId' query parameter is required" },
        { status: 400 }
      );
    }

    // 查詢 product 並驗證屬於當前用戶
    const product = await prisma.product.findFirst({
      where: { id: params.id, user_id: userId, deleted_at: null },
      include: {
        tasks: {
          where: { deleted_at: null },
          select: {
            id: true,
            references: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let deleted = false;

    // 如果指定了 taskId，從該 task 刪除
    if (taskId) {
      const task = product.tasks.find((t) => t.id === taskId);
      if (task) {
        const taskReferences = (task.references as unknown as Reference[]) || [];
        const updatedReferences = taskReferences.filter(
          (ref) => ref.id !== referenceId
        );

        if (updatedReferences.length < taskReferences.length) {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              references: updatedReferences as any,
            },
          });
          deleted = true;
        }
      }
    }

    // 如果沒有從 task 刪除，嘗試從 product 刪除
    if (!deleted) {
      const productReferences = (product.references as unknown as Reference[]) || [];
      const updatedReferences = productReferences.filter(
        (ref) => ref.id !== referenceId
      );

      if (updatedReferences.length < productReferences.length) {
        await prisma.product.update({
          where: { id: params.id },
          data: {
            references: updatedReferences as any,
          },
        });
        deleted = true;
      }
    }

    // 如果還是沒找到，嘗試從所有 task 中搜尋並刪除
    if (!deleted) {
      for (const task of product.tasks) {
        const taskReferences = (task.references as unknown as Reference[]) || [];
        const updatedReferences = taskReferences.filter(
          (ref) => ref.id !== referenceId
        );

        if (updatedReferences.length < taskReferences.length) {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              references: updatedReferences as any,
            },
          });
          deleted = true;
          break;
        }
      }
    }

    if (!deleted) {
      return NextResponse.json(
        { error: "Reference not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete reference failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: "Failed to delete reference",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
