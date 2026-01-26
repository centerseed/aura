import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Validation schema for update
const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  area_id: z.string().uuid().optional(),
  status: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"]).optional(),
  lifecycle: z.enum(["FINITE", "PERPETUAL"]).optional(),
});

// PATCH /api/products/:id - 更新 Product（包括移動到新 Area）
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const body = await request.json();
    const validated = UpdateProductSchema.parse(body);

    // 檢查 product 是否存在
    const existing = await prisma.product.findFirst({
      where: { id: params.id, deleted_at: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 如果要修改名稱，檢查是否在目標 Area 中重複
    if (validated.name && validated.name !== existing.name) {
      const targetAreaId = validated.area_id || existing.area_id;
      const duplicate = await prisma.product.findFirst({
        where: {
          area_id: targetAreaId,
          name: validated.name,
          deleted_at: null,
          id: { not: params.id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Product with this name already exists in this area" },
          { status: 409 }
        );
      }
    }

    // 更新 Product
    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: validated.name,
        description: validated.description,
        area_id: validated.area_id,
        status: validated.status as any,
        lifecycle: validated.lifecycle as any,
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Failed to update product:", error);
    return NextResponse.json(
      {
        error: "Failed to update product",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE /api/products/:id - 軟刪除 Product
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // 檢查 product 是否存在
    const existing = await prisma.product.findFirst({
      where: { id: params.id, deleted_at: null },
      include: {
        tasks: {
          where: {
            deleted_at: null,
            status: { not: "ARCHIVE" } // 只檢查未歸檔的 tasks
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 檢查是否有關聯的未完成 Tasks
    if (existing.tasks.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete product with active tasks",
          details: `This product has ${existing.tasks.length} active task(s). Please complete, delete, or move them first.`,
        },
        { status: 409 }
      );
    }

    // 軟刪除
    await prisma.product.update({
      where: { id: params.id },
      data: { deleted_at: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json(
      {
        error: "Failed to delete product",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
