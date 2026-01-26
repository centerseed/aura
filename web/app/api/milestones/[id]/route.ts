import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Validation schema for update
const UpdateMilestoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  target_date: z.string().datetime({ offset: true }).optional(),
  entity_type: z.enum(["AREA", "PRODUCT", "TOPIC"]).optional(),
  entity_id: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  description: z.string().optional(),
  status: z.enum(["planned", "in_progress", "completed", "delayed", "cancelled"]).optional(),
});

// PUT /api/milestones/:id
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const body = await request.json();
    const validated = UpdateMilestoneSchema.parse(body);

    // 檢查 milestone 是否存在
    const existing = await prisma.milestone.findFirst({
      where: { id: params.id, deleted_at: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    // 準備更新資料
    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.target_date !== undefined) updateData.target_date = new Date(validated.target_date);
    if (validated.entity_type !== undefined) updateData.entity_type = validated.entity_type;
    if (validated.entity_id !== undefined) updateData.entity_id = validated.entity_id;
    if (validated.priority !== undefined) updateData.priority = validated.priority;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.status !== undefined) updateData.status = validated.status;

    const milestone = await prisma.milestone.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(milestone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to update milestone:", error);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}

// DELETE /api/milestones/:id (軟刪除)
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // 檢查 milestone 是否存在
    const existing = await prisma.milestone.findFirst({
      where: { id: params.id, deleted_at: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    // 軟刪除
    await prisma.milestone.update({
      where: { id: params.id },
      data: { deleted_at: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete milestone:", error);
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}
