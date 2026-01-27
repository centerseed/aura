"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut, User, Mail, Shield, Loader2, ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userData, setUserData] = useState<{
    id: string;
    email: string | null;
    name: string | null;
    displayName: string;
    auth_provider: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        const userRes = await fetch("/api/me", {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (userRes.ok) {
          const data = await userRes.json();
          setUserData(data);
        }
      } catch (error) {
        console.error("載入用戶資料失敗:", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("登出失敗:", error);
      alert("登出失敗，請稍後再試");
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回 Dashboard
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            帳號設定
          </h1>
          <p className="text-slate-400 mt-2">管理你的帳號資訊與偏好設定</p>
        </div>

        <div className="space-y-6">
          {/* 用戶資訊卡片 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <User className="w-5 h-5 mr-2 text-indigo-400" />
                個人資訊
              </CardTitle>
              <CardDescription className="text-slate-400">
                你的基本帳號資訊
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 名稱 */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-400">名稱</p>
                    <p className="text-white font-medium">
                      {userData?.displayName || "未設定"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-400">Email</p>
                    <p className="text-white font-medium">
                      {userData?.email || "未設定"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 認證方式 */}
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-400">認證方式</p>
                    <p className="text-white font-medium">
                      {userData?.auth_provider === "GOOGLE" && "Google"}
                      {userData?.auth_provider === "ANONYMOUS" && "訪客"}
                      {userData?.auth_provider === "EMAIL" && "Email"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 帳號操作卡片 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">帳號操作</CardTitle>
              <CardDescription className="text-slate-400">
                管理你的帳號登入狀態
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    登出中...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    登出
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 其他設定預留區 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">偏好設定</CardTitle>
              <CardDescription className="text-slate-400">
                即將推出...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-500 text-sm">
                更多設定選項正在開發中
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
