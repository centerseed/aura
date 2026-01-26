import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/me - 根據 Firebase Auth UID 獲取當前用戶資訊
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const firebaseUid = searchParams.get("firebaseUid");

  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  }

  try {
    // 根據 Firebase UID 查詢用戶（auth_provider_id）
    const user = await prisma.user.findFirst({
      where: {
        auth_provider_id: firebaseUid,
      },
      include: {
        areas: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.name || (user.settings as any)?.displayName || user.email,
      auth_provider: user.auth_provider,
      areas: user.areas,
      hasAreas: user.areas.length > 0,
    });
  } catch (error) {
    console.error("Failed to get current user:", error);
    return NextResponse.json({ error: "Failed to get current user" }, { status: 500 });
  }
}
