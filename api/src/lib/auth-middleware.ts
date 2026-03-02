import { NextRequest } from "next/server";
import { getAuth } from "./firebase-admin";
import { UnauthorizedException, ForbiddenException } from "./api-response";
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

    const signInProvider = decodedToken.firebase?.sign_in_provider ?? "";
    const authProvider = signInProvider.startsWith("apple")
      ? "APPLE"
      : signInProvider === "password" || signInProvider === "emailLink"
        ? "EMAIL"
        : "GOOGLE";

    user = await prisma.user.create({
      data: {
        email,
        name,
        auth_provider: authProvider,
        auth_provider_id: firebaseUid,
      },
    });

    console.log(`✅ Auto-created user: ${user.id} (${email})`);
  }

  return user.id;
}

/**
 * 驗證 Admin 請求：Firebase UID 必須在 ADMIN_UIDS 白名單內
 * 返回 DB UUID
 */
export async function authenticateAdminRequest(
  request: NextRequest,
  prisma: any
): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedException("Missing or invalid token");
  }
  const decodedToken = await getAuth().verifyIdToken(authHeader.substring(7));
  const adminUids = (process.env.ADMIN_UIDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!adminUids.includes(decodedToken.uid)) {
    throw new ForbiddenException('Admin only')
  }
  return getOrCreateUser(decodedToken.uid, decodedToken, prisma)
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

    // 測試模式：僅在本地資料庫或測試環境允許 X-Test-User-Id header
    const isLocalDb = process.env.DATABASE_URL?.includes('localhost') ||
                      process.env.DATABASE_URL?.includes('127.0.0.1');
    const isTest = process.env.NODE_ENV === 'test';

    if (isLocalDb || isTest) {
      const testUserId = request.headers.get("x-test-user-id");
      if (testUserId) {
        // 若已是 UUID（MCP auth layer 已解析過），直接回傳，避免雙重解析
        if (testUserId.includes('-')) {
          console.log(`Test mode: Using resolved UUID ${testUserId}`);
          return testUserId;
        }
        // 否則是 Firebase UID，透過 getOrCreateUser 解析成 DB UUID
        const resolvedId = await getOrCreateUser(testUserId, { uid: testUserId }, prisma);
        console.log(`Test mode: Firebase UID ${testUserId} → DB UUID ${resolvedId}`);
        return resolvedId;
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
    // 已經是 UnauthorizedException 就直接丟出
    if (error instanceof UnauthorizedException) {
      throw error;
    }
    // Firebase auth 錯誤統一包裝為 UnauthorizedException
    const message = error instanceof Error ? error.message : "Authentication failed";
    console.error("Authentication failed:", message);
    throw new UnauthorizedException("Invalid or expired token");
  }
}
