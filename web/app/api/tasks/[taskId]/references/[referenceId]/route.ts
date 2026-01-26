import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
}

// PATCH /api/tasks/[taskId]/references/[referenceId] - 更新 reference
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string; referenceId: string }> }
) {
  try {
    const { taskId, referenceId } = await params;
    const body = await request.json();
    const { content, title } = body;

    // 查詢 Task
    const task = await prisma.task.findUnique({
      where: { id: taskId, deleted_at: null },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 獲取現有的 references
    const existingReferences = (task.references as Reference[]) || [];

    // 找到要更新的 reference
    const referenceIndex = existingReferences.findIndex(
      (ref) => ref.id === referenceId
    );

    if (referenceIndex === -1) {
      return NextResponse.json(
        { error: "Reference not found" },
        { status: 404 }
      );
    }

    // 更新 reference
    const updatedReference = {
      ...existingReferences[referenceIndex],
      ...(content !== undefined && { content: content.trim() }),
      ...(title !== undefined && { title: title?.trim() || null }),
    };

    const updatedReferences = [...existingReferences];
    updatedReferences[referenceIndex] = updatedReference;

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
      reference: updatedReference,
    });
  } catch (error) {
    console.error("Update reference failed:", error);
    return NextResponse.json(
      {
        error: "Failed to update reference",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
