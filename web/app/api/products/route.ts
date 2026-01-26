import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Status, Lifecycle } from "@prisma/client";

// Validation schema
const CreateProductSchema = z.object({
  userId: z.string().uuid(),
  areaId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["INBOX", "ACTIVE", "MAINTAIN", "REFERENCE", "ARCHIVE"]).default("ACTIVE"),
  lifecycle: z.enum(["FINITE", "PERPETUAL"]).default("FINITE"),
});

// POST /api/products - 創建新的 Product
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CreateProductSchema.parse(body);

    // 檢查 Area 是否存在
    const area = await prisma.area.findFirst({
      where: { id: validated.areaId, user_id: validated.userId, deleted_at: null },
    });

    if (!area) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }

    // 檢查是否已存在同名 Product
    const existing = await prisma.product.findFirst({
      where: {
        user_id: validated.userId,
        area_id: validated.areaId,
        name: validated.name,
        deleted_at: null,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Product with this name already exists in this area" }, { status: 409 });
    }

    // 創建新 Product
    const product = await prisma.product.create({
      data: {
        user_id: validated.userId,
        area_id: validated.areaId,
        name: validated.name,
        description: validated.description,
        status: Status[validated.status as keyof typeof Status],
        lifecycle: Lifecycle[validated.lifecycle as keyof typeof Lifecycle],
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }

    console.error("Failed to create product:", error);
    return NextResponse.json({
      error: "Failed to create product",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
