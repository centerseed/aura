import { auth } from "./firebase";
import { User } from "firebase/auth";

/**
 * 獲取當前登入的 Firebase 用戶
 */
export async function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * 等待 Firebase Auth 初始化完成
 */
export async function waitForAuth(): Promise<User | null> {
  return getCurrentUser();
}

/**
 * 獲取當前用戶的 ID Token（用於後端驗證）
 */
export async function getIdToken(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.getIdToken();
}
