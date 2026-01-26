"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { auth, googleProvider, signInWithPopup, signInAnonymously } from "@/lib/firebase";

export default function HomeDemo() {
  const [name, setName] = useState("");
  const [isEntering, setIsEntering] = useState(false);
  const [authMethod, setAuthMethod] = useState<"select" | "name">("select");
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsEntering(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
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
      const libraryRes = await fetch(`/api/library?userId=${userData.id}`);
      const libraryData = await libraryRes.json();
      if (!libraryData || libraryData.length === 0) {
        window.location.href = `/onboarding`;
      } else {
        window.location.href = `/dashboard`;
      }
    } catch (error) {
      console.error("檢查使用者狀態失敗:", error);
      window.location.href = `/onboarding`;
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-hidden">
      {/* 結構化背景 - 使用線條而非模糊球體 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 對角線柵欄 */}
        <svg className="absolute inset-0 w-full h-full opacity-5" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 60 M 0 0 L 60 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* 頂部光源線 */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        {/* 右上角特色區塊 */}
        <div className="absolute -top-32 -right-32 w-96 h-96 border border-amber-500/10 rounded-full opacity-30" />
        <div className="absolute -top-24 -right-24 w-72 h-72 border border-amber-500/5 rounded-full opacity-20" />
      </div>

      {/* 右上角登入按鈕 */}
      <div className="absolute top-8 right-8 z-50">
        <button
          onClick={() => setShowAuthPanel(!showAuthPanel)}
          className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
            bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400
            text-white font-medium text-sm transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/30
            border border-amber-400/20"
        >
          <LogIn className="w-4 h-4" />
          登入
        </button>
      </div>

      {/* 主內容區 */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
          {/* Logo & Title */}
          <div className="text-center mb-24 space-y-8">
            {/* 品牌標識 */}
            <div className="space-y-4">
              <div className="text-xs font-mono uppercase tracking-widest text-amber-400/60 mb-8">
                Information Entropy Reduction
              </div>

              <h1 className="text-7xl md:text-8xl font-bold tracking-tight leading-none">
                <span className="block text-white">Zentropy</span>
              </h1>

              <div className="h-1 w-24 bg-gradient-to-r from-amber-500 via-amber-400 to-transparent mx-auto mt-8" />
            </div>

            {/* 副標題 */}
            <div className="space-y-3 max-w-2xl">
              <p className="text-2xl md:text-3xl font-light text-white/90 leading-relaxed">
                讓一切井然有序
              </p>
              <p className="text-base md:text-lg text-white/50 leading-relaxed font-light">
                為創業者設計的運營管理系統。碎片化的想法在此化為秩序，混亂的決策在此變得清晰。
              </p>
            </div>
          </div>

          {/* 功能介紹 - 4列結構 */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mb-24 w-full">
            {[
              {
                number: "01",
                title: "輕鬆記下任何事",
                description: "碎片化的想法、靈感、任務 - 無需整理格式，直接記錄"
              },
              {
                number: "02",
                title: "AI 自動分類與理解",
                description: "系統瞬間識別優先級、身分與關聯，將混亂轉化為清晰"
              },
              {
                number: "03",
                title: "雙軸矩陣管理",
                description: "橫軸狀態 × 縱軸實體，建立完整的業務全景視圖"
              },
              {
                number: "04",
                title: "語意自動關聯",
                description: "相關信息自動浮現，決策依據一目瞭然"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-6 border border-white/10 hover:border-amber-500/30
                  bg-white/2 hover:bg-white/5 transition-all duration-300 rounded-lg
                  hover:shadow-lg hover:shadow-amber-500/10"
              >
                {/* 邊角裝飾 */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-amber-500/20 group-hover:border-amber-500/40 transition-colors" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-amber-500/20 group-hover:border-amber-500/40 transition-colors" />

                {/* 內容 */}
                <div className="space-y-3">
                  <div className="text-3xl font-bold text-amber-400/40 group-hover:text-amber-400/60 transition-colors">
                    {feature.number}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {!showAuthPanel && (
            <button
              onClick={() => setShowAuthPanel(true)}
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-lg
                bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400
                text-white font-semibold transition-all duration-300 hover:gap-4
                border border-amber-400/20 hover:shadow-2xl hover:shadow-amber-500/20"
            >
              立即開始體驗
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </div>

        {/* 功能詳情 Section */}
        <div className="relative min-h-screen flex items-center py-20 px-6">
          <div className="max-w-6xl mx-auto w-full space-y-24">
            {/* 功能1: 三個 Agent */}
            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold">功能</div>
                <h2 className="text-4xl font-bold text-white leading-tight">三個協作 AI Agent</h2>
              </div>

              {[
                { name: "守門人", emoji: "🚪", desc: "接收與穩定化處理，識別行動與關聯" },
                { name: "圖書管理員", emoji: "📚", desc: "自動歸檔、上下文鏈接、智能推薦" },
                { name: "營運教練", emoji: "🎯", desc: "衝突偵測、日程管理、晨晚報主持" }
              ].map((agent, i) => (
                <div key={i} className="group p-6 border border-white/10 hover:border-amber-500/30 bg-white/2 hover:bg-white/5 rounded-lg transition-all">
                  <div className="text-4xl mb-3">{agent.emoji}</div>
                  <h3 className="text-lg font-semibold text-white mb-2">{agent.name}</h3>
                  <p className="text-sm text-white/50">{agent.desc}</p>
                </div>
              ))}
            </div>

            {/* 分隔線 */}
            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

            {/* 功能2: 雙軸矩陣 */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold">核心架構</div>
                <h2 className="text-4xl font-bold text-white leading-tight">雙軸管理模型</h2>
                <p className="text-white/50 max-w-2xl">業務管理從未如此清晰 - 縱軸定義「關於什麼」，橫軸定義「何時該看」</p>
              </div>

              <div className="relative p-8 border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent rounded-lg overflow-hidden">
                {/* 矩陣視覺 */}
                <div className="grid grid-cols-3 gap-0 aspect-square bg-zinc-900/50 border border-white/5 rounded">
                  {Array(9).fill(0).map((_, i) => (
                    <div key={i} className="border-r border-b border-white/5 hover:bg-amber-500/10 transition-colors flex items-center justify-center text-xs text-white/30 font-mono">
                      {i + 1}
                    </div>
                  ))}
                </div>

                <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-xs uppercase text-white/30 writing-vertical font-mono">
                  Entity
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs uppercase text-white/30 font-mono">
                  Status
                </div>
              </div>
            </div>

            {/* 分隔線 */}
            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

            {/* 功能3: Vault 系統 */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold">資訊管理</div>
                <h2 className="text-4xl font-bold text-white leading-tight">Zentropy Vault</h2>
                <p className="text-white/50 max-w-2xl">自動歸檔系統，按業務實體組織，按需查詢與關聯</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  "00 Core - 核心策略與架構",
                  "01 Compliance - 法律與合規",
                  "02 Treasury - 財務與稅務",
                  "03 Lifecycle - 專案生命週期",
                  "05 Growth - 成長與行銷",
                  "06 History - 歷史歸檔"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 border border-white/5 hover:border-amber-500/20 bg-white/2 hover:bg-white/5 rounded transition-all">
                    <div className="w-2 h-2 rounded-full bg-amber-400/50" />
                    <span className="text-sm text-white/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 認證面板 - 右上角悬浮 */}
      {showAuthPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-8 pt-24">
          {/* 背景黑幕 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAuthPanel(false)}
          />

          {/* 認證卡片 - 右上角 */}
          <Card className="relative w-full max-w-md bg-zinc-900/95 border border-amber-500/20 backdrop-blur-xl p-8 rounded-lg shadow-2xl">
            {/* 關閉按鈕 */}
            <button
              onClick={() => setShowAuthPanel(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              ✕
            </button>

            {authMethod === "select" ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white mb-6">選擇登入方式</h2>

                <Button
                  onClick={handleGoogleSignIn}
                  disabled={isEntering}
                  className="w-full h-12 bg-white hover:bg-white/90 text-zinc-900 font-medium"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      使用 Google 帳號
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleAnonymousSignIn}
                  disabled={isEntering}
                  className="w-full h-12 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-medium"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>訪客模式</>
                  )}
                </Button>

                <div className="relative flex items-center py-2">
                  <div className="flex-1 border-t border-white/10"></div>
                  <span className="px-3 text-sm text-white/40">或</span>
                  <div className="flex-1 border-t border-white/10"></div>
                </div>

                <Button
                  onClick={() => setAuthMethod("name")}
                  disabled={isEntering}
                  variant="outline"
                  className="w-full h-12 border-white/20 bg-white/5 hover:bg-white/10 text-white"
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
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleNameSignIn}
                  disabled={!name.trim() || isEntering}
                  className="w-full h-12 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-medium"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>進入 Zentropy</>
                  )}
                </Button>

                <button
                  onClick={() => setAuthMethod("select")}
                  className="w-full text-sm text-white/50 hover:text-white/70"
                >
                  ← 返回其他方式
                </button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 頁腳 */}
      <footer className="relative border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs uppercase tracking-widest text-white/30 font-mono">
            資訊熵減系統 · 為創業者設計
          </p>
        </div>
      </footer>
    </main>
  );
}
