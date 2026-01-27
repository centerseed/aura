import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/areas - 獲取用戶的所有 Areas
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);

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
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch areas" }, { status: 500 });
  }
}

// POST /api/areas - 創建新的 Area
export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);
    const body = await request.json();
    const { name, scope, description } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
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
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ success: true, area, created: true });
  } catch (error) {
    console.error("Failed to create area:", error);
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create area" }, { status: 500 });
  }
}
