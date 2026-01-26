import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/products/reorder - 更新多個 products 的 display_order
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      );
    }

    // 驗證每個 update 項目都有 id 和 display_order
    for (const update of updates) {
      if (!update.id || typeof update.display_order !== "number") {
        return NextResponse.json(
          { error: "Each update must have id and display_order" },
          { status: 400 }
        );
      }
    }

    // 在一個 transaction 中更新所有 products
    await prisma.$transaction(
      updates.map((update: { id: string; display_order: number }) =>
        prisma.product.update({
          where: { id: update.id },
          data: { display_order: update.display_order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder products:", error);
    return NextResponse.json(
      { error: "Failed to reorder products" },
      { status: 500 }
    );
  }
}
