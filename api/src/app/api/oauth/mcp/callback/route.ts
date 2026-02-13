/**
 * MCP OAuth 2.1 Callback Endpoint
 *
 * POST /api/oauth/mcp/callback
 *
 * Receives the Firebase ID token from the sign-in page,
 * verifies it, generates an authorization code, and redirects
 * back to Claude Code's redirect_uri with the code.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";
import { getOrCreateUser } from "@/lib/auth-middleware";
import { prisma } from "@/lib/db";
import { generateAuthCode } from "@/mcp/oauth/jwt";

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: NextRequest) {
  try {
    // Parse form data from the sign-in page
    const formData = await request.formData();
    const idToken = formData.get("id_token") as string;
    const encodedState = formData.get("oauth_state") as string;

    if (!idToken || !encodedState) {
      return errorHtml("Missing id_token or oauth_state");
    }

    // Decode the OAuth state
    let oauthState: {
      client_id: string;
      redirect_uri: string;
      code_challenge: string;
      state: string;
      scope: string;
    };

    try {
      oauthState = JSON.parse(
        Buffer.from(encodedState, "base64url").toString("utf-8"),
      );
    } catch {
      return errorHtml("Invalid oauth_state");
    }

    // Verify the Firebase ID token
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    // Get or create the Zentropy user
    const userId = await getOrCreateUser(decodedToken.uid, decodedToken, prisma);

    // Generate a single-use authorization code
    const code = generateAuthCode();

    // Store the auth code in DB
    await prisma.mcpAuthCode.create({
      data: {
        code,
        user_id: userId,
        client_id: oauthState.client_id,
        redirect_uri: oauthState.redirect_uri,
        code_challenge: oauthState.code_challenge,
        scope: oauthState.scope,
        expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS),
      },
    });

    // Build the redirect URL back to Claude Code
    const redirectUrl = new URL(oauthState.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (oauthState.state) {
      redirectUrl.searchParams.set("state", oauthState.state);
    }

    // Redirect to Claude Code with the authorization code
    return NextResponse.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    console.error("[oauth/mcp/callback] Error:", error);
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return errorHtml(`授權失敗: ${message}`);
  }
}

function errorHtml(message: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Error</title>
<style>
  body { font-family: sans-serif; background: #0a0a0a; color: #e0e0e0;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
    padding: 40px; max-width: 420px; text-align: center; }
  .error { color: #ef4444; }
</style>
</head><body>
  <div class="card">
    <h2 class="error">${escapeHtml(message)}</h2>
    <p style="margin-top:16px;color:#888">請關閉此頁面並重試。</p>
  </div>
</body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
