import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/users?id=xxx 或 /api/users?name=xxx - 根據 ID 或名字獲取或創建用戶
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id");
  const name = searchParams.get("name");

  if (!userId && !name) {
    return NextResponse.json({ error: "id or name is required" }, { status: 400 });
  }

  try {
    let user;

    // 優先使用 ID 查詢
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          areas: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    } else if (name) {
      // 用 email 作為唯一識別 (name@naruvia.local)
      const email = `${name.toLowerCase().replace(/\s+/g, "_")}@naruvia.local`;

      // 先嘗試找到現有用戶
      user = await prisma.user.findUnique({
        where: { email },
        include: {
          areas: true,
        },
      });

      // 如果不存在，創建新用戶
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            settings: { displayName: name },
          },
          include: {
            areas: true,
          },
        });
      }
    }

    return NextResponse.json({
      id: user!.id,
      email: user!.email,
      name: user!.name,
      displayName: user!.name || (user!.settings as any)?.displayName || user!.email,
      areas: user!.areas,
      hasAreas: user!.areas.length > 0,
    });
  } catch (error) {
    console.error("Failed to get/create user:", error);
    return NextResponse.json({ error: "Failed to get/create user" }, { status: 500 });
  }
}
