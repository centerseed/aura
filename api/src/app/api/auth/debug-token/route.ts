import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";

// POST /api/auth/debug-token
// Debug only — generates a Firebase custom token for a given UID
// Only available when DEBUG_AUTH_ENABLED=true
export async function POST(request: NextRequest) {
  if (process.env.DEBUG_AUTH_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Debug auth is not enabled" },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as { uid?: string };
    const { uid } = body;

    if (!uid || typeof uid !== "string") {
      return NextResponse.json(
        { error: "uid is required" },
        { status: 400 }
      );
    }

    const auth = getAuth();
    const customToken = await auth.createCustomToken(uid);

    return NextResponse.json({ data: { token: customToken } });
  } catch (error) {
    console.error("Generate debug token failed:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
