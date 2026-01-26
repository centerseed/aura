import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
}

// POST /api/tasks/[taskId]/references - 新增 reference
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
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

    // 查詢 Task
    const task = await prisma.task.findUnique({
      where: { id: taskId, deleted_at: null },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 獲取現有的 references
    const existingReferences = (task.references as Reference[]) || [];

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
    await prisma.task.update({
      where: { id: taskId },
      data: {
        references: updatedReferences as any,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      reference: newReference,
      total: updatedReferences.length,
    });
  } catch (error) {
    console.error("Add reference failed:", error);
    return NextResponse.json(
      {
        error: "Failed to add reference",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[taskId]/references?referenceId=xxx - 刪除 reference
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get("referenceId");

    if (!referenceId) {
      return NextResponse.json(
        { error: "'referenceId' query parameter is required" },
        { status: 400 }
      );
    }

    // 查詢 Task
    const task = await prisma.task.findUnique({
      where: { id: taskId, deleted_at: null },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 獲取現有的 references
    const existingReferences = (task.references as Reference[]) || [];

    // 過濾掉要刪除的 reference
    const updatedReferences = existingReferences.filter(
      (ref) => ref.id !== referenceId
    );

    if (updatedReferences.length === existingReferences.length) {
      return NextResponse.json(
        { error: "Reference not found" },
        { status: 404 }
      );
    }

    // 保存到資料庫
    await prisma.task.update({
      where: { id: taskId },
      data: {
        references: updatedReferences as any,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      total: updatedReferences.length,
    });
  } catch (error) {
    console.error("Delete reference failed:", error);
    return NextResponse.json(
      {
        error: "Failed to delete reference",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
