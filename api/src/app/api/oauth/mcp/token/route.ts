/**
 * MCP OAuth 2.1 Token Endpoint
 *
 * POST /api/oauth/mcp/token
 *
 * Exchanges an authorization code for an access token (+ refresh token).
 * Also handles refresh_token grant for token renewal.
 *
 * Supports:
 *   - grant_type=authorization_code (code exchange with PKCE)
 *   - grant_type=refresh_token (token renewal)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  issueAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  hashAccessToken,
  verifyPkce,
} from "@/mcp/oauth/jwt";

export async function POST(request: NextRequest) {
  try {
    // Token endpoint accepts application/x-www-form-urlencoded or JSON
    let params: Record<string, string>;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      params = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      params = (await request.json()) as Record<string, string>;
    }

    const grantType = params.grant_type;

    if (grantType === "authorization_code") {
      return handleAuthorizationCode(params);
    }

    if (grantType === "refresh_token") {
      return handleRefreshToken(params);
    }

    return tokenError("unsupported_grant_type", "Supported: authorization_code, refresh_token");
  } catch (error) {
    console.error("[oauth/mcp/token] Error:", error);
    return tokenError(
      "server_error",
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

async function handleAuthorizationCode(
  params: Record<string, string>,
): Promise<NextResponse> {
  const { code, redirect_uri, code_verifier, client_id } = params;

  if (!code) return tokenError("invalid_request", "code is required");
  if (!redirect_uri) return tokenError("invalid_request", "redirect_uri is required");
  if (!code_verifier) return tokenError("invalid_request", "code_verifier is required (PKCE)");
  if (!client_id) return tokenError("invalid_request", "client_id is required");

  // Look up the authorization code
  const authCode = await prisma.mcpAuthCode.findUnique({
    where: { code },
  });

  if (!authCode) {
    return tokenError("invalid_grant", "Authorization code not found or already used");
  }

  // Check if already used
  if (authCode.used) {
    // Possible token theft — revoke all tokens for this user/client
    await prisma.mcpRefreshToken.updateMany({
      where: { user_id: authCode.user_id, client_id: authCode.client_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return tokenError("invalid_grant", "Authorization code already used");
  }

  // Check expiry
  if (authCode.expires_at < new Date()) {
    return tokenError("invalid_grant", "Authorization code expired");
  }

  // Validate client_id and redirect_uri match
  if (authCode.client_id !== client_id) {
    return tokenError("invalid_grant", "client_id mismatch");
  }
  if (authCode.redirect_uri !== redirect_uri) {
    return tokenError("invalid_grant", "redirect_uri mismatch");
  }

  // Verify PKCE
  if (!verifyPkce(code_verifier, authCode.code_challenge)) {
    return tokenError("invalid_grant", "PKCE verification failed");
  }

  // Mark code as used
  await prisma.mcpAuthCode.update({
    where: { id: authCode.id },
    data: { used: true },
  });

  // Issue tokens
  const accessToken = issueAccessToken({
    userId: authCode.user_id,
    clientId: authCode.client_id,
    scope: authCode.scope,
  });

  const refreshToken = generateRefreshToken();

  // Store refresh token hash in DB
  await prisma.mcpRefreshToken.create({
    data: {
      token_hash: refreshToken.hash,
      user_id: authCode.user_id,
      client_id: authCode.client_id,
      scope: authCode.scope,
      expires_at: refreshToken.expiresAt,
    },
  });

  // Store access token hash in DB for tracking and future revocation
  const accessTokenHash = hashAccessToken(accessToken.token);
  await prisma.mcpAccessToken.create({
    data: {
      token_hash: accessTokenHash,
      user_id: authCode.user_id,
      client_id: authCode.client_id,
      scope: authCode.scope,
      issued_at: new Date(),
      expires_at: accessToken.expiresAt,
    },
  });

  return NextResponse.json({
    access_token: accessToken.token,
    token_type: "Bearer",
    expires_in: accessToken.expiresIn,
    refresh_token: refreshToken.raw,
    scope: authCode.scope,
  });
}

async function handleRefreshToken(
  params: Record<string, string>,
): Promise<NextResponse> {
  const { refresh_token, client_id } = params;

  if (!refresh_token) return tokenError("invalid_request", "refresh_token is required");
  if (!client_id) return tokenError("invalid_request", "client_id is required");

  const tokenHash = hashRefreshToken(refresh_token);

  // Look up the refresh token
  const storedToken = await prisma.mcpRefreshToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!storedToken) {
    return tokenError("invalid_grant", "Refresh token not found");
  }

  if (storedToken.revoked_at) {
    return tokenError("invalid_grant", "Refresh token has been revoked");
  }

  if (storedToken.expires_at < new Date()) {
    return tokenError("invalid_grant", "Refresh token expired");
  }

  if (storedToken.client_id !== client_id) {
    return tokenError("invalid_grant", "client_id mismatch");
  }

  // Rotate: revoke old refresh token, issue new pair
  await prisma.mcpRefreshToken.update({
    where: { id: storedToken.id },
    data: { revoked_at: new Date() },
  });

  const accessToken = issueAccessToken({
    userId: storedToken.user_id,
    clientId: storedToken.client_id,
    scope: storedToken.scope,
  });

  const newRefreshToken = generateRefreshToken();

  await prisma.mcpRefreshToken.create({
    data: {
      token_hash: newRefreshToken.hash,
      user_id: storedToken.user_id,
      client_id: storedToken.client_id,
      scope: storedToken.scope,
      expires_at: newRefreshToken.expiresAt,
    },
  });

  // Store new access token hash in DB for tracking and future revocation
  const accessTokenHash = hashAccessToken(accessToken.token);
  await prisma.mcpAccessToken.create({
    data: {
      token_hash: accessTokenHash,
      user_id: storedToken.user_id,
      client_id: storedToken.client_id,
      scope: storedToken.scope,
      issued_at: new Date(),
      expires_at: accessToken.expiresAt,
    },
  });

  return NextResponse.json({
    access_token: accessToken.token,
    token_type: "Bearer",
    expires_in: accessToken.expiresIn,
    refresh_token: newRefreshToken.raw,
    scope: storedToken.scope,
  });
}

function tokenError(
  error: string,
  description: string,
  status: number = 400,
): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status },
  );
}
