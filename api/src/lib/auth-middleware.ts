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
 * 從 Firebase uid 取得對應的資料庫 user ID
 */
export async function getUserIdFromFirebaseUid(
  firebaseUid: string,
  prisma: any
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: {
      auth_provider_id: firebaseUid,
    },
  });

  return user?.id || null;
}

/**
 * 驗證 API 請求並返回 user ID
 * 使用 Firebase ID Token 認證
 */
export async function authenticateRequest(
  request: NextRequest,
  prisma: any
): Promise<string> {
  try {
    const firebaseUid = await verifyIdToken(request);
    const userId = await getUserIdFromFirebaseUid(firebaseUid, prisma);

    if (!userId) {
      throw new UnauthorizedException("Invalid token: User not found in database");
    }

    return userId;
  } catch (error) {
    console.error("Authentication failed:", error);
    throw error;
  }
}
