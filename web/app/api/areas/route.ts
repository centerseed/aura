import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/areas?userId=xxx - 獲取用戶的所有 Areas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const areas = await prisma.area.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    return NextResponse.json(areas);
  } catch (error) {
    console.error("Failed to fetch areas:", error);
    return NextResponse.json({ error: "Failed to fetch areas" }, { status: 500 });
  }
}

// POST /api/areas - 創建新的 Area
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, name, scope, description } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: "userId and name are required" }, { status: 400 });
    }

    // 檢查是否已存在同名 Area
    const existing = await prisma.area.findFirst({
      where: { user_id: userId, name, deleted_at: null },
    });

    if (existing) {
      // 更新 scope
      const updated = await prisma.area.update({
        where: { id: existing.id },
        data: { scope, description: description || scope },
      });
      return NextResponse.json({ success: true, area: updated, updated: true });
    }

    // 創建新 Area
    const area = await prisma.area.create({
      data: {
        user_id: userId,
        name,
        scope,
        description: description || scope,
        is_custom: true,
      },
    });

    return NextResponse.json({ success: true, area, created: true });
  } catch (error) {
    console.error("Failed to create area:", error);
    return NextResponse.json({ error: "Failed to create area" }, { status: 500 });
  }
}
