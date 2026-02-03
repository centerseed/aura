import { NextRequest } from "next/server";
import { getAuth } from "./firebase-admin";
import { UnauthorizedException } from "./api-response";

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
 */
export async function authenticateRequest(
  request: NextRequest,
  prisma: any
): Promise<string> {
  try {
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
