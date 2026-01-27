import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/firebase-admin";

// GET /api/me - 獲取當前登入用戶的資訊
export async function GET(request: NextRequest) {
  try {
    // 驗證 Firebase ID Token
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // 根據 Firebase UID 查詢用戶
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
    if (error instanceof Error && error.message.includes("verification")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to get current user" }, { status: 500 });
  }
}
