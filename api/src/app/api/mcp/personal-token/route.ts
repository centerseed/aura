import { NextRequest, NextResponse } from "next/server";

import { getAuth } from "@/lib/firebase-admin";
import { getOrCreateUser } from "@/lib/auth-middleware";
import { prisma } from "@/lib/db";
import {
  issueAccessToken,
  hashAccessToken,
  PERSONAL_ACCESS_TOKEN_TTL,
} from "@/mcp/oauth/jwt";

const DEFAULT_SCOPES = [
  "read:tasks",
  "read:knowledge",
  "read:profile",
  "write:inbox",
  "write:knowledge",
] as const;

const ALLOWED_SCOPES = new Set([
  ...DEFAULT_SCOPES,
  "trigger:librarian",
]);

const MAX_EXPIRES_IN_DAYS = 90;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const firebaseToken = authHeader.substring(7);
    const decodedToken = await getAuth().verifyIdToken(firebaseToken);
    const userId = await getOrCreateUser(decodedToken.uid, decodedToken, prisma);

    const body = (await request.json().catch(() => ({}))) as {
      client_name?: string;
      scopes?: string[];
      expires_in_days?: number;
    };

    const clientName = normalizeClientName(body.client_name);
    const scopes = normalizeScopes(body.scopes);
    const expiresInDays = normalizeExpiresInDays(body.expires_in_days);
    const expiresInSeconds = expiresInDays * 24 * 60 * 60;

    const accessToken = issueAccessToken({
      userId,
      clientId: clientName,
      scope: scopes.join(" "),
      issuer: "zentropy-mcp-personal-token",
      expiresInSeconds,
    });

    await prisma.mcpAccessToken.create({
      data: {
        token_hash: hashAccessToken(accessToken.token),
        user_id: userId,
        client_id: clientName,
        scope: scopes.join(" "),
        issued_at: new Date(),
        expires_at: accessToken.expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || new URL(request.url).origin;
    const mcpUrl = `${baseUrl}/mcp?access_token=${encodeURIComponent(accessToken.token)}`;

    return NextResponse.json({
      data: {
        access_token: accessToken.token,
        token_type: "Bearer",
        expires_in: accessToken.expiresIn,
        expires_at: accessToken.expiresAt.toISOString(),
        scopes,
        client_name: clientName,
        mcp_url: mcpUrl,
      },
    });
  } catch (error) {
    console.error("[api/mcp/personal-token] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to mint personal token",
      },
      { status: 500 },
    );
  }
}

function normalizeClientName(value?: string): string {
  const normalized = value?.trim();
  if (!normalized) return "codex";
  return normalized.slice(0, 100);
}

function normalizeScopes(value?: string[]): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_SCOPES];
  }

  const filtered = value
    .filter((scope): scope is string => typeof scope === "string")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0 && ALLOWED_SCOPES.has(scope as any));

  return filtered.length > 0 ? Array.from(new Set(filtered)) : [...DEFAULT_SCOPES];
}

function normalizeExpiresInDays(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return PERSONAL_ACCESS_TOKEN_TTL / (24 * 60 * 60);
  }

  const rounded = Math.floor(value);
  if (rounded < 1) return 1;
  if (rounded > MAX_EXPIRES_IN_DAYS) return MAX_EXPIRES_IN_DAYS;
  return rounded;
}
