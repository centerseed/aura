"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Loader2, LogIn, Sun, Moon } from "lucide-react";
import { auth, googleProvider, signInWithPopup, signInAnonymously } from "@/lib/firebase";

export default function HomeDemo() {
  const [name, setName] = useState("");
  const [isEntering, setIsEntering] = useState(false);
  const [authMethod, setAuthMethod] = useState<"select" | "name">("select");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // 主題配置
  const theme = isDark
    ? {
        bg: "bg-zinc-950",
        text: "text-white",
        textMuted: "text-white/60",
        textMutedDarker: "text-white/50",
        textMutedLighter: "text-white/70",
        textMutedAlt: "text-white/80",
        border: "border-white/20",
        borderLight: "border-white/10",
        borderHover: "border-amber-500/50",
        card: "bg-white/5",
        cardHover: "bg-white/8",
        cardBg: "bg-zinc-900/98",
        accent: "text-amber-400",
        accentBg: "bg-amber-500/15",
        accentBorder: "border-amber-500/60",
        shadow: "shadow-amber-500/20",
      }
    : {
        bg: "bg-white",
        text: "text-slate-900",
        textMuted: "text-slate-600",
        textMutedDarker: "text-slate-500",
        textMutedLighter: "text-slate-700",
        textMutedAlt: "text-slate-800",
        border: "border-slate-200",
        borderLight: "border-slate-100",
        borderHover: "border-amber-500",
        card: "bg-slate-50",
        cardHover: "bg-slate-100",
        cardBg: "bg-white",
        accent: "text-amber-600",
        accentBg: "bg-amber-50",
        accentBorder: "border-amber-500",
        shadow: "shadow-amber-200",
      };

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
    <main className={`min-h-screen ${theme.bg} ${theme.text} overflow-hidden transition-colors duration-300`}>
      {/* 簡潔背景 - 結合原設計的優雅與新色系 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 頂部光源線 */}
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${isDark ? "via-amber-500/20" : "via-amber-400/30"} to-transparent`} />

        {/* 右上角特色區塊 - 保留但簡化 */}
        <div className={`absolute -top-40 -right-40 w-96 h-96 border ${isDark ? "border-amber-500/10" : "border-amber-400/20"} rounded-full ${isDark ? "opacity-20" : "opacity-10"}`} />

        {/* 左下角平衡 - 保留原設計的藍色漸層 */}
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 ${isDark ? "bg-blue-500/5" : "bg-blue-400/5"} rounded-full blur-3xl`} />
      </div>

      {/* 右上角操作按鈕 */}
      <div className="absolute top-8 right-8 z-50 flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className={`p-2.5 rounded-xl transition-all duration-300 ${
            isDark
              ? "bg-white/5 hover:bg-white/10 text-amber-400"
              : "bg-slate-100 hover:bg-slate-200 text-amber-600"
          } border ${isDark ? "border-white/10" : "border-slate-300"}`}
          title={isDark ? "淺色模式" : "深色模式"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* 登入按鈕 */}
        <button
          onClick={() => setShowAuthPanel(!showAuthPanel)}
          className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
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
              <div className={`text-xs font-mono uppercase tracking-widest ${isDark ? "text-amber-400/60" : "text-amber-600/70"} mb-8`}>
                Information Entropy Reduction
              </div>

              <h1 className="text-7xl md:text-8xl font-bold tracking-tight leading-none">
                <span className={`block ${theme.text}`}>Zentropy</span>
              </h1>

              <div className={`h-1 w-24 bg-gradient-to-r ${isDark ? "from-amber-500 via-amber-400" : "from-amber-600 via-amber-500"} to-transparent mx-auto mt-8`} />
            </div>

            {/* 副標題 */}
            <div className="space-y-3 max-w-2xl">
              <p className={`text-2xl md:text-3xl font-semibold ${theme.text} leading-relaxed`}>
                讓一切井然有序
              </p>
              <p className={`text-base md:text-lg ${theme.textMuted} leading-relaxed`}>
                為創業者設計的運營管理系統。碎片化的想法在此化為秩序，混亂的決策在此變得清晰。
              </p>
            </div>
          </div>

          {/* 價值主張 - 核心收益 */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mb-24 w-full">
            {[
              {
                number: "01",
                title: "不再遺漏任何事",
                description: "所有靈感、待辦、決策都有蹤跡。系統幫你自動追蹤，決策不再遺漏"
              },
              {
                number: "02",
                title: "省去 80% 的整理時間",
                description: "不用手動分類、打標籤、建資料夾。AI 瞬間理解和分類，直接可用"
              },
              {
                number: "03",
                title: "優先級自動浮現",
                description: "系統識別緊急事項 vs 日常維護 vs 知識參考，專注真正重要的"
              },
              {
                number: "04",
                title: "決策依據一目瞭然",
                description: "相關信息自動關聯，不用翻箱倒櫃找資料，決策變得簡單"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className={`group relative p-6 border ${theme.border} hover:${isDark ? "border-amber-500/50" : "border-amber-500"}
                  ${theme.card} hover:${theme.cardHover} transition-all duration-300 rounded-2xl overflow-hidden
                  hover:shadow-lg ${isDark ? "hover:shadow-amber-500/20" : "hover:shadow-amber-500/10"}`}
              >
                {/* 邊角裝飾 - 精緻版本 */}
                <div className={`absolute top-0 left-0 w-4 h-4 rounded-br-lg ${isDark ? "bg-gradient-to-br from-amber-500/40 to-transparent group-hover:from-amber-500/80" : "bg-gradient-to-br from-amber-500/30 to-transparent group-hover:from-amber-600"} transition-colors`} />
                <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-tl-lg ${isDark ? "bg-gradient-to-tl from-amber-500/40 to-transparent group-hover:from-amber-500/80" : "bg-gradient-to-tl from-amber-500/30 to-transparent group-hover:from-amber-600"} transition-colors`} />

                {/* 內容 */}
                <div className="space-y-3 relative z-10">
                  <div className={`text-4xl font-bold ${isDark ? "text-amber-400/60 group-hover:text-amber-400/100" : "text-amber-600/70 group-hover:text-amber-600"} transition-colors`}>
                    {feature.number}
                  </div>
                  <h3 className={`text-lg font-semibold ${theme.text}`}>{feature.title}</h3>
                  <p className={`text-sm ${theme.textMuted} leading-relaxed`}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {!showAuthPanel && (
            <button
              onClick={() => setShowAuthPanel(true)}
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl
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

            {/* 功能2: 不失控的優先級管理 */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className={`text-xs uppercase tracking-widest ${isDark ? "text-amber-400" : "text-amber-600"} font-semibold`}>智能分類</div>
                <h2 className={`text-4xl font-bold ${theme.text} leading-tight`}>不失控的優先級管理</h2>
                <p className={`${theme.textMuted} max-w-2xl`}>系統自動識別哪些是緊急衝刺、哪些是日常維護、哪些是知識參考</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    icon: "🚀",
                    title: "衝刺 (緊急事項)",
                    desc: "有期限、需主動推進",
                    examples: "產品上線、融資截止、重要客戶"
                  },
                  {
                    icon: "⚙️",
                    title: "維護 (日常營運)",
                    desc: "穩定營運、異常亮燈",
                    examples: "日常流程、定期檢查、常規客服"
                  },
                  {
                    icon: "📖",
                    title: "參考 (知識庫)",
                    desc: "知識庫、自動推薦",
                    examples: "過往案例、SOP 文檔、經驗總結"
                  }
                ].map((item, i) => (
                  <div key={i} className={`p-6 border ${theme.border} hover:${isDark ? "border-amber-500/50" : "border-amber-500"} ${theme.card} hover:${theme.cardHover} rounded-2xl transition-all`}>
                    <div className="text-4xl mb-4">{item.icon}</div>
                    <h3 className={`text-lg font-semibold ${theme.text} mb-2`}>{item.title}</h3>
                    <p className={`text-sm ${theme.textMuted} mb-4`}>{item.desc}</p>
                    <p className={`text-xs ${isDark ? "text-amber-400/70" : "text-amber-600/70"}`}>例：{item.examples}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 分隔線 */}
            <div className={`h-px bg-gradient-to-r from-transparent ${isDark ? "via-amber-500/20" : "via-amber-400/30"} to-transparent`} />

            {/* 定價與計畫 */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className={`text-xs uppercase tracking-widest ${isDark ? "text-amber-400" : "text-amber-600"} font-semibold`}>選擇適合你的計畫</div>
                <h2 className={`text-4xl font-bold ${theme.text} leading-tight`}>清晰透明的定價</h2>
                <p className={`${theme.textMuted} max-w-2xl`}>從免費開始體驗，隨著需求升級。所有計畫都包含核心功能。</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    name: "免費版",
                    price: "¥0",
                    period: "永久",
                    highlight: false,
                    features: [
                      "無限 Brain Dump 記錄",
                      "AI 自動分類與標籤",
                      "優先級識別",
                      "基本搜尋",
                      "個人使用"
                    ],
                    cta: "立即開始"
                  },
                  {
                    name: "專業版",
                    price: "¥99",
                    period: "月",
                    highlight: true,
                    features: [
                      "所有免費版功能",
                      "AI 長期記憶系統",
                      "歷史演進追蹤",
                      "高級語意搜尋 (RAG)",
                      "智能摘要生成",
                      "MCP 整合 (Cursor/Claude)",
                      "優先支持"
                    ],
                    cta: "升級到專業版"
                  },
                  {
                    name: "團隊版",
                    price: "¥299",
                    period: "月",
                    highlight: false,
                    features: [
                      "所有專業版功能",
                      "多人協作 (Project 層級)",
                      "協作者管理與權限",
                      "團隊活動日誌",
                      "API 存取",
                      "自訂工作流",
                      "專屬支持"
                    ],
                    cta: "聯絡我們"
                  }
                ].map((plan, i) => (
                  <div
                    key={i}
                    className={`relative p-8 rounded-2xl border transition-all ${
                      plan.highlight
                        ? isDark
                          ? "border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-transparent shadow-lg shadow-amber-500/20"
                          : "border-amber-500 bg-gradient-to-br from-amber-50 to-transparent shadow-lg shadow-amber-500/10"
                        : `${theme.border} ${theme.card} hover:${theme.cardHover}`
                    }`}
                  >
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-500 rounded-full text-xs font-semibold text-white">
                        最受歡迎
                      </div>
                    )}

                    <div className="space-y-6">
                      {/* 價格 */}
                      <div>
                        <h3 className={`text-xl font-bold ${theme.text} mb-2`}>{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-4xl font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}>{plan.price}</span>
                          <span className={theme.textMutedDarker}>/ {plan.period}</span>
                        </div>
                      </div>

                      {/* 功能列表 */}
                      <ul className="space-y-3">
                        {plan.features.map((feature, j) => (
                          <li key={j} className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full ${isDark ? "bg-amber-400/30" : "bg-amber-500/20"} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              <div className={`w-2 h-2 rounded-full ${isDark ? "bg-amber-400" : "bg-amber-600"}`} />
                            </div>
                            <span className={`text-sm ${theme.textMutedLighter}`}>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <button
                        className={`w-full py-3 rounded-xl font-semibold transition-all ${
                          plan.highlight
                            ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white"
                            : isDark
                            ? "border border-white/20 text-white hover:border-amber-500/50 hover:bg-white/5"
                            : "border border-slate-300 text-slate-900 hover:border-amber-500 hover:bg-amber-50"
                        }`}
                      >
                        {plan.cta}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 比較表 */}
              <div className={`mt-16 pt-8 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
                <p className={`text-sm ${theme.textMuted} mb-6 text-center`}>所有計畫都可以隨時升級或降級，沒有鎖定期</p>
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
          <Card className="relative w-full max-w-md bg-zinc-900/98 border border-amber-500/40 backdrop-blur-xl p-8 rounded-lg shadow-2xl shadow-black/50">
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
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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
