import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth-middleware";

// Validation schema for update
const UpdateAreaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  scope: z.string().optional(),
  description: z.string().optional(),
});

// PUT /api/areas/:id - 更新 Area
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json();
    const validated = UpdateAreaSchema.parse(body);

    // 檢查 area 是否存在且屬於當前用戶
    const existing = await prisma.area.findFirst({
      where: { id: params.id, user_id: userId, deleted_at: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }

    // 如果要修改名稱，檢查是否重複
    if (validated.name && validated.name !== existing.name) {
      const duplicate = await prisma.area.findFirst({
        where: {
          user_id: existing.user_id,
          name: validated.name,
          deleted_at: null,
          id: { not: params.id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Area with this name already exists" },
          { status: 409 }
        );
      }
    }

    // 更新 Area
    const updated = await prisma.area.update({
      where: { id: params.id },
      data: {
        name: validated.name,
        scope: validated.scope,
        description: validated.description,
      },
    });

    return NextResponse.json({ success: true, area: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Failed to update area:", error);
    return NextResponse.json(
      {
        error: "Failed to update area",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE /api/areas/:id - 軟刪除 Area
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const userId = await authenticateRequest(request, prisma);

    // 檢查 area 是否存在且屬於當前用戶
    const existing = await prisma.area.findFirst({
      where: { id: params.id, user_id: userId, deleted_at: null },
      include: {
        products: {
          where: { deleted_at: null },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }

    // 檢查是否有關聯的 Products
    if (existing.products.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete area with existing products",
          details: `This area has ${existing.products.length} product(s). Please delete or move them first.`,
        },
        { status: 409 }
      );
    }

    // 軟刪除
    await prisma.area.update({
      where: { id: params.id },
      data: { deleted_at: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete area:", error);
    return NextResponse.json(
      {
        error: "Failed to delete area",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
