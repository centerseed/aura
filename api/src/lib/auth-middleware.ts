import { NextRequest } from "next/server";
import { getAuth } from "./firebase-admin";
import { UnauthorizedException } from "./api-response";
import { verifyInternalAuth } from "@/mcp/oauth/jwt";

/**
 * 從 Authorization header 提取並驗證 Firebase ID Token
 * 返回驗證後的 user ID
 */
export async function verifyIdToken(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedException("Missing or invalid token");
  }

  const token = authHeader.substring(7); // 移除 "Bearer " 前綴

  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new UnauthorizedException("Invalid or expired token");
  }
}

/**
 * 從 Firebase uid 取得或創建對應的資料庫用戶
 * 如果用戶不存在，會自動創建（使用 Firebase token 中的資訊）
 */
export async function getOrCreateUser(
  firebaseUid: string,
  decodedToken: any,
  prisma: any
): Promise<string> {
  // 先嘗試查找現有用戶
  let user = await prisma.user.findFirst({
    where: {
      auth_provider_id: firebaseUid,
    },
  });

  // 如果用戶不存在，自動創建
  if (!user) {
    console.log(`Creating new user for Firebase UID: ${firebaseUid}`);

    const email = decodedToken.email || null;
    const name = decodedToken.name || decodedToken.email?.split("@")[0] || "User";

    user = await prisma.user.create({
      data: {
        email,
        name,
        auth_provider: "GOOGLE", // 從 Firebase token 推斷
        auth_provider_id: firebaseUid,
      },
    });

    console.log(`✅ Auto-created user: ${user.id} (${email})`);
  }

  return user.id;
}

/**
 * 驗證 API 請求並返回 user ID
 * 使用 Firebase ID Token 認證
 * 如果用戶不存在於資料庫，會自動創建
 *
 * 測試模式：當 NODE_ENV === 'test' 或 DATABASE_URL 指向本地資料庫時，
 * 可以使用 X-Test-User-Id header 繞過認證
 */
export async function authenticateRequest(
  request: NextRequest,
  prisma: any
): Promise<string> {
  try {
    // Internal MCP auth: same-process calls from MCP tool handlers.
    // The MCP layer already verified the user via OAuth 2.1 JWT,
    // so we trust the HMAC-signed user ID for internal API calls.
    const mcpInternalHmac = request.headers.get("x-mcp-internal");
    const mcpUserId = request.headers.get("x-mcp-user-id");
    if (mcpInternalHmac && mcpUserId && process.env.ZENTROPY_MCP_JWT_SECRET) {
      if (verifyInternalAuth(mcpUserId, mcpInternalHmac)) {
        return mcpUserId;
      }
      // If HMAC doesn't match, fall through to normal auth
      console.warn("[auth] MCP internal auth HMAC mismatch, falling through");
    }

    // 測試模式：允許使用 X-Test-User-Id header（僅限本地環境）
    const isLocalDb = process.env.DATABASE_URL?.includes('localhost') ||
                      process.env.DATABASE_URL?.includes('127.0.0.1');
    const isTest = process.env.NODE_ENV === 'test';

    if ((isLocalDb || isTest)) {
      const testUserId = request.headers.get("x-test-user-id");
      if (testUserId) {
        console.log(`Test mode: Using test user ID: ${testUserId}`);
        return testUserId;
      }
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid token");
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // 取得或創建用戶
    const userId = await getOrCreateUser(decodedToken.uid, decodedToken, prisma);

    return userId;
  } catch (error) {
    console.error("Authentication failed:", error);
    throw error;
  }
}
