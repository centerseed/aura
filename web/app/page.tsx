"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Sparkles, Brain, Layers, Zap, Loader2, UserCircle2 } from "lucide-react";
import { auth, googleProvider, signInWithPopup, signInAnonymously } from "@/lib/firebase";

export default function Home() {
  const [name, setName] = useState("");
  const [isEntering, setIsEntering] = useState(false);
  const [authMethod, setAuthMethod] = useState<"select" | "name">("select");

  const handleGoogleSignIn = async () => {
    setIsEntering(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 將 Firebase 認證資訊傳送到後端建立/更新使用者
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          providerId: user.uid,
          email: user.email,
          name: user.displayName,
        }),
      });

      if (!response.ok) throw new Error("登入失敗");

      const userData = await response.json();
      await redirectUser(userData);
    } catch (error) {
      console.error("Google 登入失敗:", error);
      setIsEntering(false);
      alert("登入失敗，請稍後再試");
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsEntering(true);
    try {
      const result = await signInAnonymously(auth);
      const user = result.user;

      // 將匿名使用者資訊傳送到後端
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "anonymous",
          providerId: user.uid,
          email: null,
          name: "訪客",
        }),
      });

      if (!response.ok) throw new Error("登入失敗");

      const userData = await response.json();
      await redirectUser(userData);
    } catch (error) {
      console.error("匿名登入失敗:", error);
      setIsEntering(false);
      alert("登入失敗，請稍後再試");
    }
  };

  const handleNameSignIn = async () => {
    if (!name.trim()) return;
    setIsEntering(true);

    try {
      // 使用名稱登入（保留舊有功能）
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          providerId: null,
          email: `${name.toLowerCase().replace(/\s+/g, "")}@zentropy.local`,
          name: name,
        }),
      });

      if (!response.ok) throw new Error("登入失敗");

      const userData = await response.json();
      await redirectUser(userData);
    } catch (error) {
      console.error("名稱登入失敗:", error);
      setIsEntering(false);
      alert("登入失敗，請稍後再試");
    }
  };

  const redirectUser = async (userData: { id: string; email?: string | null; name?: string | null }) => {
    try {
      // 檢查用戶是否有 Areas（是否已完成 onboarding）
      const libraryRes = await fetch(`/api/library?userId=${userData.id}`);
      const libraryData = await libraryRes.json();

      // 重定向到乾淨的 URL（無用戶資訊）
      if (!libraryData || libraryData.length === 0) {
        window.location.href = `/onboarding`;
      } else {
        window.location.href = `/dashboard`;
      }
    } catch (error) {
      console.error("檢查使用者狀態失敗:", error);
      // 預設導向 onboarding
      window.location.href = `/onboarding`;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-20">
          {/* Logo & Title */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-white/70">AI 驅動的知識治理系統</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
              Zentropy
            </h1>

            <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              讓一切井然有序
              <br />
            </p>
          </div>

          {/* Login Card */}
          <Card className={`max-w-md mx-auto bg-white/5 border-white/10 backdrop-blur-xl p-8 transition-all duration-500 ${isEntering ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
            {authMethod === "select" ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white text-center mb-6">選擇登入方式</h2>

                {/* Google SSO */}
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={isEntering}
                  className="w-full h-12 bg-white hover:bg-white/90 text-slate-900 font-medium transition-all duration-300 flex items-center justify-center gap-3"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      使用 Google 帳號登入
                    </>
                  )}
                </Button>

                {/* 匿名登入 */}
                <Button
                  onClick={handleAnonymousSignIn}
                  disabled={isEntering}
                  className="w-full h-12 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white font-medium transition-all duration-300 flex items-center justify-center gap-3"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UserCircle2 className="w-5 h-5" />
                      匿名訪客模式
                    </>
                  )}
                </Button>

                {/* 分隔線 */}
                <div className="relative flex items-center py-2">
                  <div className="flex-1 border-t border-white/10"></div>
                  <span className="px-3 text-sm text-white/40">或</span>
                  <div className="flex-1 border-t border-white/10"></div>
                </div>

                {/* 使用名稱登入 */}
                <Button
                  onClick={() => setAuthMethod("name")}
                  disabled={isEntering}
                  variant="outline"
                  className="w-full h-12 border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium transition-all duration-300"
                >
                  使用名稱登入
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    如何稱呼你？
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNameSignIn()}
                    placeholder="輸入你的名字"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleNameSignIn}
                  disabled={!name.trim() || isEntering}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium transition-all duration-300 disabled:opacity-50"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      進入 Zentropy
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <button
                  onClick={() => setAuthMethod("select")}
                  className="w-full text-sm text-white/50 hover:text-white/70 transition-colors"
                >
                  ← 返回其他登入方式
                </button>
              </div>
            )}
          </Card>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-20">
            {[
              {
                icon: Brain,
                title: "輕鬆記下任何事",
                description: "碎片化的想法也能瞬間被理解和保存，無需整理格式",
                color: "from-purple-500 to-pink-500"
              },
              {
                icon: Layers,
                title: "讓AI幫你整理",
                description: "自動識別優先級、身分與關聯，將混亂轉化為清晰決策",
                color: "from-blue-500 to-cyan-500"
              },
              {
                icon: Zap,
                title: "一切都井然有序",
                description: "雙軸矩陣 × 語意引力，讓心智成本歸零，專注真正重要的事",
                color: "from-amber-500 to-orange-500"
              }
            ].map((feature, i) => (
              <Card
                key={i}
                className="group p-6 bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-300 cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-white/30 text-sm">
          <p>資訊熵減系統 · Information Entropy Reduction</p>
        </div>
      </footer>
    </main>
  );
}
