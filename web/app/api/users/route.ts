import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/users - 根據 Firebase Token 獲取或創建用戶
export async function GET(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request, prisma);

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      areas: user.areas,
      hasAreas: user.areas.length > 0,
    });
  } catch (error) {
    console.error("Failed to get user:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for authorization errors
    if (
      errorMessage.includes("Authorization") ||
      errorMessage.includes("Invalid or expired token") ||
      errorMessage.includes("User not found")
    ) {
      return NextResponse.json({
        error: "Unauthorized",
        details: "Authentication failed. Please provide a valid Firebase ID token.",
      }, { status: 401 });
    }

    return NextResponse.json({
      error: "Failed to get user",
      details: errorMessage
    }, { status: 500 });
  }
}
