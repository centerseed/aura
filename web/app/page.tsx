"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Loader2, LogIn, Zap, RefreshCw, BookOpen, Sparkles, Check, ListTodo, Wand2, Sun, Moon, Calendar } from "lucide-react";
import { auth, googleProvider, appleProvider, signInWithPopup, signInAnonymously } from "@/lib/firebase";

export default function HomeDemo() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isEntering, setIsEntering] = useState(false);
  const [authMethod, setAuthMethod] = useState<"select" | "name">("select");
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // SSR 期間預設深色，避免 hydration mismatch 閃白
  const isDark = !mounted || resolvedTheme === "dark";

  const [activeDemoTab, setActiveDemoTab] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ uid: string; email?: string; name?: string } | null>(null);
  const [hasLibraryData, setHasLibraryData] = useState(false);

  // 追蹤是否正在進行登入流程（防止 onAuthStateChanged 的時序問題）
  const isSigningInRef = useRef(false);

  // 檢查使用者是否已登入
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // 如果正在進行登入流程，跳過此次檢查（由登入流程自行處理重定向）
      if (isSigningInRef.current) {
        return;
      }

      if (user) {
        // 使用者已登入，先從 /api/me 取得使用者資料庫 ID
        try {
          // 獲取 Firebase ID Token
          const token = await user.getIdToken();
          const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (meRes.ok) {
            const userData = await meRes.json();
            setCurrentUser({
              uid: user.uid,
              email: user.email || undefined,
              name: user.displayName || undefined,
            });
            // 修正: API 回應格式為 { success: true, data: { user: {...} } }
            setHasLibraryData(userData.data?.user?.hasAreas || false);
          } else {
            // 用戶在資料庫中不存在，未完成註冊
            setCurrentUser(null);
            setHasLibraryData(false);
          }
        } catch (error) {
          console.error("檢查使用者狀態失敗:", error);
          setCurrentUser(null);
          setHasLibraryData(false);
        }
      } else {
        // 使用者未登入
        setCurrentUser(null);
        setHasLibraryData(false);
      }
      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  // 主題配色
  const theme = isDark
    ? {
      bg: "bg-slate-900",
      text: "text-white",
      textMuted: "text-white/60",
      textMutedDarker: "text-white/50",
      textMutedLighter: "text-white/70",
      textMutedAlt: "text-white/80",
      border: "border-white/20",
      borderLight: "border-white/10",
      borderHover: "border-emerald-400/50",
      card: "bg-white/5",
      cardHover: "bg-white/8",
      cardBg: "bg-slate-900/98",
      accent: "text-emerald-400",
      accentBg: "bg-emerald-500/15",
      accentBorder: "border-emerald-500/60",
      shadow: "shadow-emerald-500/20",
    }
    : {
      bg: "bg-white",
      text: "text-slate-900",
      textMuted: "text-slate-500",
      textMutedDarker: "text-slate-400",
      textMutedLighter: "text-slate-700",
      textMutedAlt: "text-slate-800",
      border: "border-slate-200",
      borderLight: "border-slate-100",
      borderHover: "border-indigo-400",
      card: "bg-slate-50",
      cardHover: "bg-slate-100",
      cardBg: "bg-white",
      accent: "text-indigo-600",
      accentBg: "bg-indigo-50",
      accentBorder: "border-indigo-400",
      shadow: "shadow-indigo-200/40",
    };

  // 演示場景組 - 三個不同功能的演示（每個只保留一個場景）
  const demoTabs = [
    {
      id: 0,
      name: "自動分類",
      icon: Sparkles,
      scenario: {
        input: "下週要見投資人",
        category: "Active",
        icon: Zap,
        color: "amber",
        result: "自動設定提醒、加入日曆、準備相關資料"
      }
    },
    {
      id: 1,
      name: "零碎整理",
      icon: ListTodo,
      scenario: {
        input: "明天要打電話給客戶\n記得準備簡報\n下午3點開會",
        category: "TodoList",
        icon: ListTodo,
        color: "purple",
        outputItems: [
          { text: "打電話給客戶", time: "明天", priority: "高" },
          { text: "準備簡報", time: "明天", priority: "中" },
          { text: "參加會議", time: "下午 3:00", priority: "高" }
        ]
      }
    },
    {
      id: 2,
      name: "智能重組",
      icon: Wand2,
      scenario: {
        input: "相似專案：產品 A-前端、產品 A-UI",
        category: "Reorganize",
        icon: Wand2,
        color: "indigo",
        cards: [
          { title: "產品 A-前端", tasks: 8 },
          { title: "產品 A-UI", tasks: 5 }
        ],
        mergedCard: { title: "產品 A", tasks: 13, subtitle: "Product" }
      }
    },
    {
      id: 3,
      name: "Coach 晨報",
      icon: Calendar,
      scenario: {
        input: "早上 8:30，Zentropy 自動發送今日簡報",
        category: "Briefing",
        icon: Calendar,
        color: "emerald",
        briefingItems: [
          { type: "conflict", text: "⚠️ 下午 2 點有衝突：投資人會議 vs. 產品 Demo" },
          { type: "stagnant", text: "🔴 「財務規劃」已停滯 5 天，需關注" },
          { type: "priority", text: "✅ 今日 Top 3：準備簡報、回覆 Alice、更新 roadmap" }
        ]
      }
    }
  ];

  const currentScenario = demoTabs[activeDemoTab].scenario;

  const handleGoogleSignIn = async () => {
    setIsEntering(true);
    isSigningInRef.current = true;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          providerId: user.uid,
          email: user.email,
          name: user.displayName,
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`登入 API 失敗: ${response.status} - ${error}`);
      }
      const userData = await response.json();
      await redirectUser(userData);
    } catch (error) {
      console.error("Google 登入失敗:", error);
      setIsEntering(false);
      isSigningInRef.current = false;
      alert(`登入失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
    }
  };

  const handleAppleSignIn = async () => {
    setIsEntering(true);
    isSigningInRef.current = true;
    try {
      const result = await signInWithPopup(auth, appleProvider);
      const user = result.user;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "apple",
          providerId: user.uid,
          email: user.email,
          name: user.displayName,
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`登入 API 失敗: ${response.status} - ${error}`);
      }
      const userData = await response.json();
      await redirectUser(userData);
    } catch (error: any) {
      if (error?.code === "auth/popup-closed-by-user") {
        setIsEntering(false);
        isSigningInRef.current = false;
        return;
      }
      console.error("Apple 登入失敗:", error);
      setIsEntering(false);
      isSigningInRef.current = false;
      alert(`登入失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsEntering(true);
    isSigningInRef.current = true;
    try {
      const result = await signInAnonymously(auth);
      const user = result.user;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "anonymous",
          providerId: user.uid,
          email: null,
          name: "訪客",
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`登入 API 失敗: ${response.status} - ${error}`);
      }
      const userData = await response.json();
      await redirectUser(userData);
    } catch (error) {
      console.error("匿名登入失敗:", error);
      setIsEntering(false);
      isSigningInRef.current = false;
      alert(`登入失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
    }
  };

  const handleNameSignIn = async () => {
    if (!name.trim()) return;
    setIsEntering(true);
    isSigningInRef.current = true;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          providerId: null,
          email: `${name.toLowerCase().replace(/\s+/g, "")}@zentropy.local`,
          name: name,
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`登入 API 失敗: ${response.status} - ${error}`);
      }
      const userData = await response.json();
      await redirectUser(userData);
    } catch (error) {
      console.error("名稱登入失敗:", error);
      setIsEntering(false);
      isSigningInRef.current = false;
      alert(`登入失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
    }
  };

  const redirectUser = async (_userData: { id: string; email?: string | null; name?: string | null }) => {
    try {
      // 獲取當前 Firebase 用戶的 ID Token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found");
      }
      const token = await currentUser.getIdToken();

      const libraryRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/library`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!libraryRes.ok) {
        throw new Error(`Library fetch failed: ${libraryRes.status}`);
      }
      const libraryData = await libraryRes.json();

      // 短暫延遲確保路由過度順暢
      await new Promise(resolve => setTimeout(resolve, 300));

      // 修正: API 回應格式為 { success: true, data: { areas: [...] } }
      if (!libraryData || !libraryData.data?.areas || libraryData.data.areas.length === 0) {
        router.push(`/onboarding`);
      } else {
        router.push(`/dashboard`);
      }
    } catch (error) {
      console.error("檢查使用者狀態失敗:", error);
      setIsEntering(false);
      isSigningInRef.current = false;
      alert("無法檢查使用者狀態，請稍後再試");
    }
  };

  // 如果正在檢查認證狀態，顯示加載畫面
  if (isCheckingAuth) {
    return (
      <main className={`min-h-screen ${isDark ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-gradient-to-br from-white via-slate-50 to-indigo-50/40"} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${isDark ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-gradient-to-br from-white via-slate-50 to-indigo-50/40"} ${theme.text} overflow-hidden transition-colors duration-300`}>
      {/* 優雅背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 ${isDark ? "bg-indigo-500/20" : "bg-indigo-300/15"} rounded-full blur-3xl ${isDark ? "animate-pulse" : ""}`} />
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 ${isDark ? "bg-emerald-500/15" : "bg-emerald-300/10"} rounded-full blur-3xl ${isDark ? "animate-pulse delay-1000" : ""}`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 ${isDark ? "bg-indigo-500/10" : "bg-emerald-200/5"} rounded-full blur-3xl`} />
      </div>

      {/* 右上角操作按鈕 */}
      <div className="absolute top-8 right-8 z-50 flex items-center gap-3">
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`p-2.5 rounded-xl transition-all duration-300 ${isDark
            ? "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10"
            : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200"
          }`}
          title={isDark ? "切換淺色模式" : "切換深色模式"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={() => {
            if (currentUser) {
              if (hasLibraryData) {
                router.push("/dashboard");
              } else {
                router.push("/onboarding");
              }
            } else {
              setShowAuthPanel(!showAuthPanel);
            }
          }}
          className={`group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 hover:shadow-lg ${isDark
            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 hover:shadow-indigo-500/30 border border-emerald-400/40 hover:border-emerald-400/80"
            : "border border-indigo-700/20 shadow-md"
          }`}
          style={isDark ? {} : { background: "linear-gradient(to right, #4f46e5, #6366f1)", color: "#fff" }}
        >
          <LogIn className="w-4 h-4" />
          {currentUser ? "進入儀表板" : "登入"}
        </button>
      </div>

      {/* 主內容區 */}
      <div className="relative z-10">
        {/* Hero Section - 升級版 */}
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
          {/* Logo & Title */}
          <div className="text-center mb-16 space-y-8">
            <div className="space-y-4">
              <h1 className={`text-7xl md:text-8xl font-bold mb-6 ${isDark ? "bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent" : "text-slate-800"}`}>
                Zentropy
              </h1>
              <div className={`h-1 w-24 bg-gradient-to-r ${isDark ? "from-indigo-500 via-emerald-400" : "from-indigo-600 via-emerald-500"} to-transparent mx-auto mt-8`} />
            </div>

            <div className="space-y-3 max-w-2xl">
              <p className={`text-2xl md:text-3xl font-semibold ${theme.text} leading-relaxed`}>
                讓一切井然有序
              </p>
              <p className={`text-base md:text-lg ${theme.textMuted} leading-relaxed`}>
                你的 AI 營運長——讓一人多角的你，不再害怕漏掉任何事。
              </p>
            </div>
          </div>

          {/* 🎯 互動式演示區 - Brain Dump 體驗 */}
          <div className="max-w-5xl w-full mb-20">
            <div
              className={`relative p-8 md:p-12 rounded-3xl overflow-hidden ${isDark ? "border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl shadow-indigo-500/10" : ""}`}
              style={isDark ? {} : { background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 25px 60px -15px rgba(0,0,0,0.08), 0 10px 25px -10px rgba(0,0,0,0.04)" }}
            >
              {/* 裝飾性光暈 */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 ${isDark ? "bg-indigo-500/20" : "bg-indigo-300/20"} rounded-full blur-3xl`} />
              <div className={`absolute -bottom-20 -left-20 w-40 h-40 ${isDark ? "bg-emerald-500/20" : "bg-emerald-300/20"} rounded-full blur-3xl`} />

              <div className="relative z-10 space-y-8">
                {/* 標題 */}
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className={`w-5 h-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                    <span className={`text-xs uppercase tracking-widest ${isDark ? "text-emerald-400" : "text-emerald-600"} font-semibold`}>
                      即時體驗
                    </span>
                  </div>
                  <h3 className={`text-2xl md:text-3xl font-bold ${theme.text}`}>
                    AI 如何整理你的思緒
                  </h3>
                  <p className={`text-sm ${theme.textMuted}`}>
                    點擊下方任一想法，看系統如何瞬間分類與組織
                  </p>
                </div>

                {/* Tab 切換 */}
                <div className="flex items-center justify-center gap-2">
                  {demoTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveDemoTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${activeDemoTab === tab.id
                          ? isDark
                            ? "bg-indigo-500/20 border-2 border-indigo-400/50 text-white shadow-lg shadow-indigo-500/20"
                            : "bg-indigo-100 border-2 border-indigo-400 text-indigo-900 shadow-lg shadow-indigo-300/20"
                          : isDark
                            ? "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
                            : "bg-white border border-indigo-200/50 text-slate-600 hover:bg-indigo-50 hover:text-slate-900"
                          }`}
                      >
                        <TabIcon className="w-4 h-4" />
                        {tab.name}
                      </button>
                    );
                  })}
                </div>

                {/* 演示區 - 單欄居中 */}
                <div className="max-w-2xl mx-auto">
                  {/* 輸入示例（靜態顯示） */}
                  <div className="mb-6">
                    <div className={`text-xs uppercase tracking-wider ${theme.textMutedDarker} font-semibold mb-3 text-center`}>
                      📝 隨意輸入
                    </div>
                    <div className={`p-5 rounded-2xl ${isDark ? "bg-white/5" : "bg-indigo-50/50"} border-2 ${isDark ? "border-indigo-400/30" : "border-indigo-300"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-600"}`} />
                        <span className={`text-sm ${theme.text} font-medium`}>
                          {currentScenario.input}
                        </span>
                      </div>
                    </div>
                    <p className={`text-xs ${theme.textMutedDarker} text-center italic mt-3`}>
                      💡 不需分類、不需打標籤、不需想要放哪裡
                    </p>
                  </div>

                  {/* AI 處理結果 */}
                  <div className="space-y-4">
                    <div className={`text-xs uppercase tracking-wider ${theme.textMutedDarker} font-semibold mb-3 text-center`}>
                      ⚡ {activeDemoTab === 0 ? "AI 瞬間分類" : activeDemoTab === 1 ? "AI 智能拆解" : activeDemoTab === 2 ? "AI 重組建議" : "Coach 今日簡報"}
                    </div>
                    {(() => {
                      const scenario = currentScenario;
                      const colorMap = {
                        amber: {
                          border: isDark ? "border-amber-500/50" : "border-amber-400",
                          bg: isDark ? "from-amber-500/20" : "from-amber-50",
                          iconBg: isDark ? "bg-amber-500/30" : "bg-amber-200",
                          iconText: isDark ? "text-amber-400" : "text-amber-700",
                          text: isDark ? "text-amber-400" : "text-amber-700",
                          shadow: isDark ? "shadow-amber-500/20" : "shadow-amber-300/20"
                        },
                        blue: {
                          border: isDark ? "border-blue-500/50" : "border-blue-400",
                          bg: isDark ? "from-blue-500/20" : "from-blue-50",
                          iconBg: isDark ? "bg-blue-500/30" : "bg-blue-200",
                          iconText: isDark ? "text-blue-400" : "text-blue-700",
                          text: isDark ? "text-blue-400" : "text-blue-700",
                          shadow: isDark ? "shadow-blue-500/20" : "shadow-blue-300/20"
                        },
                        emerald: {
                          border: isDark ? "border-emerald-500/50" : "border-emerald-400",
                          bg: isDark ? "from-emerald-500/20" : "from-emerald-50",
                          iconBg: isDark ? "bg-emerald-500/30" : "bg-emerald-200",
                          iconText: isDark ? "text-emerald-400" : "text-emerald-700",
                          text: isDark ? "text-emerald-400" : "text-emerald-700",
                          shadow: isDark ? "shadow-emerald-500/20" : "shadow-emerald-300/20"
                        },
                        purple: {
                          border: isDark ? "border-purple-500/50" : "border-purple-400",
                          bg: isDark ? "from-purple-500/20" : "from-purple-50",
                          iconBg: isDark ? "bg-purple-500/30" : "bg-purple-200",
                          iconText: isDark ? "text-purple-400" : "text-purple-700",
                          text: isDark ? "text-purple-400" : "text-purple-700",
                          shadow: isDark ? "shadow-purple-500/20" : "shadow-purple-300/20"
                        },
                        indigo: {
                          border: isDark ? "border-indigo-500/50" : "border-indigo-400",
                          bg: isDark ? "from-indigo-500/20" : "from-indigo-50",
                          iconBg: isDark ? "bg-indigo-500/30" : "bg-indigo-200",
                          iconText: isDark ? "text-indigo-400" : "text-indigo-700",
                          text: isDark ? "text-indigo-400" : "text-indigo-700",
                          shadow: isDark ? "shadow-indigo-500/20" : "shadow-indigo-300/20"
                        }
                      };
                      const colors = colorMap[scenario.color as keyof typeof colorMap];
                      const ActiveIcon = scenario.icon;

                      const categoryLabels: Record<string, string> = {
                        Active: "🚀 衝刺 Active",
                        Maintain: "🔄 維護 Maintain",
                        Reference: "📚 參考 Reference",
                        TodoList: "✅ 待辦清單",
                        Reorganize: "🔄 智能重組",
                        Briefing: "📅 Coach 晨報"
                      };

                      // Tab 0: 自動分類 - 顯示分類卡片
                      if (activeDemoTab === 0 && 'result' in scenario) {
                        return (
                          <div
                            className={`p-6 rounded-2xl border-2 transition-all transform scale-105 ${colors.border} bg-gradient-to-br ${colors.bg} to-transparent shadow-xl ${colors.shadow}`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.iconBg}`}>
                                <ActiveIcon className={`w-6 h-6 ${colors.iconText}`} />
                              </div>
                              <div className="flex-1 min-w-0 space-y-3">
                                <div>
                                  <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${colors.text}`}>
                                    {categoryLabels[scenario.category]}
                                  </div>
                                  <div className={`text-sm font-medium ${theme.text} mb-2`}>
                                    {scenario.input}
                                  </div>
                                </div>
                                <div className={`text-sm ${theme.textMutedLighter} flex items-start gap-2`}>
                                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  <span>{scenario.result}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Tab 1: 零碎整理 - 顯示待辦清單
                      if (activeDemoTab === 1 && 'outputItems' in scenario) {
                        return (
                          <div className={`space-y-3 p-6 rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} to-transparent shadow-xl ${colors.shadow}`}>
                            <div className={`flex items-center gap-2 mb-4`}>
                              <ActiveIcon className={`w-5 h-5 ${colors.iconText}`} />
                              <span className={`text-sm font-bold ${colors.text}`}>AI 智能拆解</span>
                            </div>
                            {scenario.outputItems?.map((item: any, i: number) => (
                              <div
                                key={i}
                                className={`flex items-start gap-3 p-3 rounded-lg ${isDark ? "bg-white/5" : "bg-white"} border ${theme.borderLight} hover:scale-105 transition-transform`}
                              >
                                <div className={`w-5 h-5 rounded border-2 ${colors.border} flex-shrink-0 mt-0.5`} />
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium ${theme.text} mb-1`}>
                                    {item.order && <span className="mr-2">{item.order}</span>}
                                    {item.text}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    {item.time && (
                                      <span className={`${theme.textMutedDarker}`}>
                                        📅 {item.time}
                                      </span>
                                    )}
                                    {item.priority && (
                                      <span className={`px-2 py-0.5 rounded ${item.priority === "高"
                                        ? isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                                        : isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                                        }`}>
                                        {item.priority}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      // Tab 2: 智能重組 - 顯示前後對比或重組結果
                      if (activeDemoTab === 2) {
                        // 標籤合併效果
                        if ('before' in scenario && 'after' in scenario) {
                          return (
                            <div className={`space-y-4 p-6 rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} to-transparent shadow-xl ${colors.shadow}`}>
                              <div className={`flex items-center gap-2 mb-3`}>
                                <ActiveIcon className={`w-5 h-5 ${colors.iconText}`} />
                                <span className={`text-sm font-bold ${colors.text}`}>AI 智能重組</span>
                              </div>

                              {/* Before */}
                              <div>
                                <div className={`text-xs ${theme.textMutedDarker} mb-2`}>重組前:</div>
                                <div className="flex flex-wrap gap-2">
                                  {(scenario as any).before.map((tag: string, i: number) => (
                                    <span
                                      key={i}
                                      className={`px-3 py-1 rounded-lg text-xs ${isDark ? "bg-red-500/20 text-red-400 line-through" : "bg-red-100 text-red-700 line-through"}`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Arrow */}
                              <div className="flex items-center justify-center">
                                <div className={`text-2xl ${colors.text}`}>↓</div>
                              </div>

                              {/* After */}
                              <div>
                                <div className={`text-xs ${theme.textMutedDarker} mb-2`}>重組後:</div>
                                <div className="flex flex-wrap gap-2">
                                  {(scenario as any).after.map((tag: string, i: number) => (
                                    <span
                                      key={i}
                                      className={`px-3 py-1 rounded-lg text-xs font-medium ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {(scenario as any).affectedCount && (
                                <div className={`text-xs ${theme.textMuted} flex items-center gap-2 pt-2 border-t ${theme.borderLight}`}>
                                  <Check className="w-3 h-3" />
                                  已更新 {(scenario as any).affectedCount} 個相關任務
                                </div>
                              )}
                            </div>
                          );
                        }

                        // 多張卡片合併成一張效果
                        if ('cards' in scenario && 'mergedCard' in scenario) {
                          return (
                            <div className={`space-y-4 p-6 rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} to-transparent shadow-xl ${colors.shadow}`}>
                              <div className={`flex items-center gap-2 mb-4`}>
                                <ActiveIcon className={`w-5 h-5 ${colors.iconText}`} />
                                <span className={`text-sm font-bold ${colors.text}`}>AI 智能重組</span>
                              </div>

                              {/* 多張小卡片 */}
                              <div>
                                <div className={`text-xs ${theme.textMutedDarker} mb-2`}>整理前 - 分散的專案:</div>
                                <div className="grid grid-cols-2 gap-2">
                                  {(scenario as any).cards.map((card: any, i: number) => (
                                    <div
                                      key={i}
                                      className={`p-3 rounded-lg border ${isDark ? "bg-white/5 border-white/10 opacity-60" : "bg-white border-slate-200 opacity-60"}`}
                                    >
                                      <div className={`text-xs font-medium ${theme.text} mb-1`}>
                                        {card.title}
                                      </div>
                                      <div className={`text-xs ${theme.textMutedDarker}`}>
                                        {card.tasks} 個任務
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 合併箭頭 */}
                              <div className="flex items-center justify-center py-2">
                                <div className={`flex items-center gap-2 ${colors.text}`}>
                                  <div className="text-xs">合併</div>
                                  <div className="text-xl">↓</div>
                                </div>
                              </div>

                              {/* 合併後的大卡片 */}
                              <div>
                                <div className={`text-xs ${theme.textMutedDarker} mb-2`}>整理後 - 統一管理:</div>
                                <div
                                  className={`p-4 rounded-xl border-2 ${isDark ? "bg-emerald-500/10 border-emerald-500/50" : "bg-emerald-50 border-emerald-400"} transform scale-105 shadow-lg ${isDark ? "shadow-emerald-500/20" : "shadow-emerald-300/20"}`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className={`flex items-center gap-2 mb-1`}>
                                        <span className={`text-sm font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                                          {(scenario as any).mergedCard.title}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                                          {(scenario as any).mergedCard.subtitle}
                                        </span>
                                      </div>
                                      <div className={`text-xs ${theme.textMuted}`}>
                                        {(scenario as any).mergedCard.tasks} 個任務 (已整合)
                                      </div>
                                    </div>
                                    <Check className={`w-5 h-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                                  </div>
                                </div>
                              </div>

                              <div className={`text-xs ${theme.textMuted} flex items-start gap-2 pt-2 border-t ${theme.borderLight}`}>
                                <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>建立統一視圖，更容易追蹤整體進度</span>
                              </div>
                            </div>
                          );
                        }

                        // 任務重新分類
                        if ('outputItems' in scenario) {
                          const items = (scenario as any).outputItems;
                          return (
                            <div className={`space-y-3 p-6 rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} to-transparent shadow-xl ${colors.shadow}`}>
                              <div className={`flex items-center gap-2 mb-4`}>
                                <ActiveIcon className={`w-5 h-5 ${colors.iconText}`} />
                                <span className={`text-sm font-bold ${colors.text}`}>AI 重組建議</span>
                              </div>
                              {items.map((item: any, i: number) => (
                                <div
                                  key={i}
                                  className={`p-3 rounded-lg ${isDark ? "bg-white/5" : "bg-white"} border ${theme.borderLight}`}
                                >
                                  <div className={`text-sm font-medium ${theme.text} mb-1`}>
                                    {item.text}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded ${item.category === "Active"
                                      ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
                                      : item.category === "Maintain"
                                        ? isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
                                        : isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                      }`}>
                                      {item.category}
                                    </span>
                                    <span className={`text-xs ${theme.textMutedDarker}`}>
                                      {item.reason}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                      }

                      // Tab 3: Coach 晨報 - 顯示晨報項目
                      if (activeDemoTab === 3 && 'briefingItems' in scenario) {
                        const items = (scenario as any).briefingItems;
                        return (
                          <div className={`space-y-3 p-6 rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} to-transparent shadow-xl ${colors.shadow}`}>
                            <div className={`flex items-center gap-2 mb-4`}>
                              <ActiveIcon className={`w-5 h-5 ${colors.iconText}`} />
                              <span className={`text-sm font-bold ${colors.text}`}>今日晨報 · 08:30</span>
                            </div>
                            {items.map((item: any, i: number) => (
                              <div
                                key={i}
                                className={`p-3 rounded-lg border ${
                                  item.type === "conflict"
                                    ? isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-300"
                                    : item.type === "stagnant"
                                      ? isDark ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-300"
                                      : isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-300"
                                }`}
                              >
                                <div className={`text-sm ${theme.text}`}>{item.text}</div>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>

                {/* 底部說明 */}
                <div className={`text-center pt-6 border-t ${theme.borderLight}`}>
                  <p className={`text-sm ${theme.textMuted} leading-relaxed`}>
                    {activeDemoTab === 0 && (
                      <>✨ <strong>AI 自動識別優先級、自動建立關聯、自動提醒</strong> — 你只需要倒出腦中的想法</>
                    )}
                    {activeDemoTab === 1 && (
                      <>🤖 <strong>智能拆解零碎片段、建議執行順序、自動加上時間</strong> — 再亂的筆記都能變清單</>
                    )}
                    {activeDemoTab === 2 && (
                      <>🔄 <strong>發現重複標籤、合併相似專案、優化分類邏輯</strong> — 讓系統越用越聰明</>
                    )}
                    {activeDemoTab === 3 && (
                      <>📅 <strong>每日 8:30 自動分析全局、偵測衝突、標記停滯</strong> — 不是你管系統，是系統幫你管全局</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 核心價值主張 - 視覺化 */}
          <div className="grid md:grid-cols-4 gap-4 max-w-5xl mb-16 w-full">
            {[
              { icon: "🎯", text: "不再遺漏", desc: "全追蹤" },
              { icon: "⚡", text: "省 80% 時間", desc: "自動分類" },
              { icon: "🔍", text: "優先級清晰", desc: "一目瞭然" },
              { icon: "📅", text: "主動提醒", desc: "每日晨報" }
            ].map((item, i) => (
              <div
                key={i}
                className={`group p-5 text-center rounded-xl transition-all hover:scale-110 hover:shadow-lg ${isDark ? "border border-white/20 bg-white/5 hover:shadow-emerald-500/20" : ""}`}
                style={isDark ? {} : { background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px -4px rgba(0,0,0,0.06)" }}
              >
                <div className="text-4xl mb-3 group-hover:scale-125 transition-transform">{item.icon}</div>
                <div className={`text-sm font-semibold ${theme.text} mb-1`}>{item.text}</div>
                <div className={`text-xs ${theme.textMutedDarker}`}>{item.desc}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {!showAuthPanel && (
            <button
              onClick={() => setShowAuthPanel(true)}
              className={`group inline-flex items-center gap-3 px-8 py-4 rounded-xl
                font-semibold text-lg transition-all duration-300 hover:gap-4 hover:scale-105
                hover:shadow-2xl hover:shadow-indigo-500/30 ${isDark
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white border-2 border-emerald-400/40 hover:border-emerald-400/80"
                  : "border-2 border-indigo-700/20 shadow-lg"
                }`}
              style={isDark ? {} : { background: "linear-gradient(to right, #4f46e5, #6366f1)", color: "#fff" }}
            >
              立即開始體驗
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </div>

        {/* 功能詳情 Section */}
        <div className="relative min-h-screen flex items-center py-20 px-6">
          <div className="max-w-6xl mx-auto w-full space-y-24">

            {/* 功能: 不失控的優先級管理 - 場景化展示 */}
            <div className="space-y-12">
              <div className="text-center space-y-4">
                <div className={`text-xs uppercase tracking-widest ${isDark ? "text-emerald-400" : "text-emerald-600"} font-semibold`}>三大分類系統</div>
                <h2 className={`text-4xl md:text-5xl font-bold ${theme.text} leading-tight`}>不失控的優先級管理</h2>
                <p className={`${theme.textMuted} max-w-2xl mx-auto text-lg`}>
                  系統自動識別哪些是緊急衝刺、哪些是日常維護、哪些是知識參考
                </p>
              </div>

              {/* 三大分類 - 視覺化卡片 */}
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    icon: Zap,
                    title: "衝刺 Active",
                    subtitle: "緊急事項",
                    desc: "有期限、需主動推進的任務",
                    examples: ["產品上線倒數", "融資截止日", "重要客戶會議"],
                    color: isDark ? "amber" : "amber",
                    bgGradient: isDark ? "from-amber-500/20 to-transparent" : "from-amber-50 to-white",
                    borderColor: isDark ? "border-amber-500/40" : "border-amber-400"
                  },
                  {
                    icon: RefreshCw,
                    title: "維護 Maintain",
                    subtitle: "日常營運",
                    desc: "穩定營運、異常時亮燈",
                    examples: ["客戶回覆流程", "定期財務檢查", "日常行政作業"],
                    color: isDark ? "blue" : "blue",
                    bgGradient: isDark ? "from-blue-500/20 to-transparent" : "from-blue-50 to-white",
                    borderColor: isDark ? "border-blue-500/40" : "border-blue-400"
                  },
                  {
                    icon: BookOpen,
                    title: "參考 Reference",
                    subtitle: "知識庫",
                    desc: "無時效性、AI 自動推薦",
                    examples: ["過往案例", "SOP 文檔", "經驗總結"],
                    color: isDark ? "emerald" : "emerald",
                    bgGradient: isDark ? "from-emerald-500/20 to-transparent" : "from-emerald-50 to-white",
                    borderColor: isDark ? "border-emerald-500/40" : "border-emerald-400"
                  }
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={i}
                      className={`group relative p-8 rounded-2xl transition-all hover:scale-105 hover:shadow-2xl ${isDark ? `border-2 ${item.borderColor} bg-gradient-to-br ${item.bgGradient}` : ""} ${item.color === "amber"
                        ? isDark ? "hover:shadow-amber-500/20" : "hover:shadow-amber-300/20"
                        : item.color === "blue"
                          ? isDark ? "hover:shadow-blue-500/20" : "hover:shadow-blue-300/20"
                          : isDark ? "hover:shadow-emerald-500/20" : "hover:shadow-emerald-300/20"
                        }`}
                      style={isDark ? {} : {
                        background: "#fff",
                        border: `2px solid ${item.color === "amber" ? "#fbbf24" : item.color === "blue" ? "#60a5fa" : "#34d399"}`,
                        boxShadow: "0 8px 30px -8px rgba(0,0,0,0.06)"
                      }}
                    >
                      {/* Icon */}
                      <div className={`w-16 h-16 rounded-2xl ${item.color === "amber"
                        ? isDark ? "bg-amber-500/20" : "bg-amber-100"
                        : item.color === "blue"
                          ? isDark ? "bg-blue-500/20" : "bg-blue-100"
                          : isDark ? "bg-emerald-500/20" : "bg-emerald-100"
                        } flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-8 h-8 ${item.color === "amber"
                          ? isDark ? "text-amber-400" : "text-amber-600"
                          : item.color === "blue"
                            ? isDark ? "text-blue-400" : "text-blue-600"
                            : isDark ? "text-emerald-400" : "text-emerald-600"
                          }`} />
                      </div>

                      {/* 標題 */}
                      <div className="space-y-2 mb-4">
                        <h3 className={`text-xl font-bold ${theme.text}`}>{item.title}</h3>
                        <p className={`text-sm ${item.color === "amber"
                          ? isDark ? "text-amber-400/80" : "text-amber-700"
                          : item.color === "blue"
                            ? isDark ? "text-blue-400/80" : "text-blue-700"
                            : isDark ? "text-emerald-400/80" : "text-emerald-700"
                          } font-medium`}>{item.subtitle}</p>
                      </div>

                      {/* 描述 */}
                      <p className={`text-sm ${theme.textMuted} mb-6 leading-relaxed`}>{item.desc}</p>

                      {/* 範例 */}
                      <div className="space-y-2">
                        <div className={`text-xs uppercase tracking-wider ${theme.textMutedDarker} font-semibold mb-3`}>
                          範例:
                        </div>
                        {item.examples.map((example, j) => (
                          <div key={j} className={`flex items-start gap-2 text-sm ${theme.textMutedLighter}`}>
                            <span className={`${item.color === "amber"
                              ? isDark ? "text-amber-400" : "text-amber-600"
                              : item.color === "blue"
                                ? isDark ? "text-blue-400" : "text-blue-600"
                                : isDark ? "text-emerald-400" : "text-emerald-600"
                              }`}>•</span>
                            <span>{example}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 分隔線 */}
            <div className={`h-px bg-gradient-to-r from-transparent ${isDark ? "via-emerald-500/20" : "via-emerald-400/30"} to-transparent`} />

            {/* AI 主動治理 Section */}
            <div className="space-y-12">
              <div className="text-center space-y-4">
                <div className={`text-xs uppercase tracking-widest ${isDark ? "text-emerald-400" : "text-emerald-600"} font-semibold`}>AI 主動治理</div>
                <h2 className={`text-4xl md:text-5xl font-bold ${theme.text} leading-tight`}>不是你管 Zentropy</h2>
                <p className={`${theme.textMuted} max-w-2xl mx-auto text-lg`}>
                  是 Zentropy 幫你管全局 — 主動偵測、主動預警、主動提醒
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    icon: "🌅",
                    title: "每日晨報",
                    subtitle: "08:30 自動啟動",
                    desc: "每天早上自動分析全局，給出今日優先事項、逾期任務、行程摘要，讓你清醒就掌握全局。",
                    color: isDark ? "border-emerald-500/40" : "border-emerald-400",
                    bgGradient: isDark ? "from-emerald-500/10 to-transparent" : "from-emerald-50 to-white",
                    textColor: isDark ? "text-emerald-400" : "text-emerald-700"
                  },
                  {
                    icon: "⚡",
                    title: "衝突偵測",
                    subtitle: "跨 Area 預警",
                    desc: "自動掃描跨領域的時間衝突和資源競爭，在問題發生前提前預警，避免手忙腳亂。",
                    color: isDark ? "border-amber-500/40" : "border-amber-400",
                    bgGradient: isDark ? "from-amber-500/10 to-transparent" : "from-amber-50 to-white",
                    textColor: isDark ? "text-amber-400" : "text-amber-700"
                  },
                  {
                    icon: "🔍",
                    title: "停滯警示",
                    subtitle: "不讓任何事掉落",
                    desc: "追蹤哪些專案超過 N 天沒有進展，在晨報中主動提醒，確保重要事項不在忙碌中被遺忘。",
                    color: isDark ? "border-red-500/40" : "border-red-400",
                    bgGradient: isDark ? "from-red-500/10 to-transparent" : "from-red-50 to-white",
                    textColor: isDark ? "text-red-400" : "text-red-700"
                  }
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`group relative p-8 rounded-2xl transition-all hover:scale-105 hover:shadow-2xl ${isDark ? `border-2 ${item.color} bg-gradient-to-br ${item.bgGradient}` : ""}`}
                    style={isDark ? {} : {
                      background: "#fff",
                      border: `2px solid ${i === 0 ? "#34d399" : i === 1 ? "#fbbf24" : "#f87171"}`,
                      boxShadow: "0 8px 30px -8px rgba(0,0,0,0.06)"
                    }}
                  >
                    <div className="text-4xl mb-5 group-hover:scale-110 transition-transform">{item.icon}</div>
                    <div className="space-y-2 mb-4">
                      <h3 className={`text-xl font-bold ${theme.text}`}>{item.title}</h3>
                      <p className={`text-sm font-medium ${item.textColor}`}>{item.subtitle}</p>
                    </div>
                    <p className={`text-sm ${theme.textMuted} leading-relaxed`}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 第二條分隔線 */}
            <div className={`h-px bg-gradient-to-r from-transparent ${isDark ? "via-emerald-500/20" : "via-emerald-400/30"} to-transparent`} />

            {/* 定價與計畫 */}
            <div className="space-y-12">
              <div className="text-center space-y-4">
                <div className={`text-xs uppercase tracking-widest ${isDark ? "text-emerald-400" : "text-emerald-600"} font-semibold`}>選擇適合你的計畫</div>
                <h2 className={`text-4xl md:text-5xl font-bold ${theme.text} leading-tight`}>清晰透明的定價</h2>
                <p className={`${theme.textMuted} max-w-2xl mx-auto text-lg`}>從免費開始體驗，隨著需求升級。所有計畫都包含核心功能。</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    name: "Atom",
                    price: "免費",
                    period: "永久",
                    highlight: false,
                    features: [
                      "每月 50 則 AI 處理",
                      "1 個 Area 管理",
                      "無限基礎任務管理",
                      "無 Coach 功能"
                    ],
                    cta: "立即開始"
                  },
                  {
                    name: "Fusion",
                    price: "$5.99 USD",
                    period: "月",
                    highlight: true,
                    isActive: true,
                    features: [
                      "Atom 所有功能，無限制",
                      "多 Area 管理",
                      "Coach 晨晚報",
                      "衝突偵測與停滯警示",
                      "語音/圖片輸入"
                    ],
                    cta: "限時免費"
                  },
                  {
                    name: "Nexus",
                    price: "即將推出",
                    period: "",
                    highlight: false,
                    features: [
                      "Fusion 所有功能",
                      "MCP Server 支援",
                      "API 存取",
                      "優先客戶支援"
                    ],
                    cta: "敬請期待"
                  }
                ].map((plan, i) => (
                  <div
                    key={i}
                    className={`relative p-8 rounded-2xl transition-all hover:scale-105 ${isDark
                      ? plan.highlight
                        ? "border-2 border-indigo-500/60 bg-gradient-to-br from-indigo-500/20 to-transparent shadow-2xl shadow-indigo-500/30"
                        : "border-2 border-white/20 bg-white/5 hover:shadow-xl hover:shadow-emerald-500/20"
                      : ""
                    }`}
                    style={isDark ? {} : plan.highlight
                      ? { background: "linear-gradient(to bottom right, #eef2ff, #fff)", border: "2px solid #6366f1", boxShadow: "0 25px 60px -15px rgba(99,102,241,0.15)" }
                      : { background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 8px 30px -8px rgba(0,0,0,0.06)" }
                    }
                  >
                    {plan.highlight && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full text-xs font-bold text-white shadow-lg">
                        最受歡迎
                      </div>
                    )}

                    <div className="space-y-6">
                      {/* 價格 */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className={`text-2xl font-bold ${theme.text}`}>{plan.name}</h3>
                          {(plan as any).isActive && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                              目前使用中
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-5xl font-bold ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{plan.price}</span>
                          <span className={theme.textMutedDarker}>/ {plan.period}</span>
                        </div>
                      </div>

                      {/* 功能列表 */}
                      <ul className="space-y-3">
                        {plan.features.map((feature, j) => (
                          <li key={j} className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full ${isDark ? "bg-emerald-400/30" : "bg-emerald-500/20"} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              <Check className={`w-3 h-3 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                            </div>
                            <span className={`text-sm ${theme.textMutedLighter}`}>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <button
                        className={`w-full py-3.5 rounded-xl font-semibold transition-all hover:scale-105 ${plan.highlight
                          ? isDark
                            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg"
                            : "shadow-lg"
                          : isDark
                            ? "border-2 border-white/20 text-white hover:border-emerald-400/50 hover:bg-white/5"
                            : "border-2 border-slate-300 text-slate-900 hover:border-emerald-500 hover:bg-indigo-50"
                          }`}
                        style={plan.highlight && !isDark ? { background: "linear-gradient(to right, #4f46e5, #6366f1)", color: "#fff" } : {}}
                      >
                        {plan.cta}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`mt-12 pt-8 border-t ${isDark ? "border-white/5" : "border-slate-200"}`}>
                <p className={`text-sm ${theme.textMuted} text-center`}>所有計畫都可以隨時升級或降級，沒有鎖定期</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 認證面板 */}
      {showAuthPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-8 pt-24">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAuthPanel(false)}
          />

          <Card className={`relative w-full max-w-md backdrop-blur-xl p-8 rounded-lg shadow-2xl ${isDark ? "bg-slate-900/98 border border-emerald-500/40 shadow-black/50" : "bg-white border border-slate-200 shadow-slate-300/50"}`}>
            <button
              onClick={() => setShowAuthPanel(false)}
              className={`absolute top-4 right-4 transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-slate-400 hover:text-slate-600"}`}
            >
              ✕
            </button>

            {authMethod === "select" ? (
              <div className="space-y-4">
                <h2 className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"} mb-6`}>選擇登入方式</h2>

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
                  onClick={handleAppleSignIn}
                  disabled={isEntering}
                  className="w-full h-12 bg-black hover:bg-zinc-800 text-white font-medium"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      使用 Apple 帳號
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleAnonymousSignIn}
                  disabled={isEntering}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>訪客模式</>
                  )}
                </Button>

                <div className="relative flex items-center py-2">
                  <div className={`flex-1 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}></div>
                  <span className={`px-3 text-sm ${isDark ? "text-white/40" : "text-slate-400"}`}>或</span>
                  <div className={`flex-1 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}></div>
                </div>

                <Button
                  onClick={() => setAuthMethod("name")}
                  disabled={isEntering}
                  variant="outline"
                  className={`w-full h-12 ${isDark ? "border-white/20 bg-white/5 hover:bg-white/10 text-white" : "border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700"}`}
                >
                  使用名稱登入
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm font-medium ${isDark ? "text-white/70" : "text-slate-600"} mb-2`}>
                    如何稱呼你？
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNameSignIn()}
                    placeholder="輸入你的名字"
                    className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 ${isDark
                      ? "bg-white/5 border border-white/10 text-white placeholder:text-white/30"
                      : "bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400"
                    }`}
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleNameSignIn}
                  disabled={!name.trim() || isEntering}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium"
                >
                  {isEntering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>進入 Zentropy</>
                  )}
                </Button>

                <button
                  onClick={() => setAuthMethod("select")}
                  className={`w-full text-sm ${isDark ? "text-white/50 hover:text-white/70" : "text-slate-400 hover:text-slate-600"}`}
                >
                  ← 返回其他方式
                </button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 頁腳 */}
      <footer className={`relative border-t ${isDark ? "border-white/5" : "border-slate-200"} py-12 px-6`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-6 text-sm">
              <a href="/privacy" className={`${isDark ? "text-white/50 hover:text-white/80" : "text-slate-400 hover:text-slate-600"} transition-colors`}>
                隱私政策 Privacy Policy
              </a>
              <span className={isDark ? "text-white/20" : "text-slate-300"}>·</span>
              <a href="/terms" className={`${isDark ? "text-white/50 hover:text-white/80" : "text-slate-400 hover:text-slate-600"} transition-colors`}>
                服務條款 Terms of Service
              </a>
            </div>
            <p className={`text-xs uppercase tracking-widest ${isDark ? "text-white/30" : "text-slate-300"} font-mono`}>
              你的 AI 營運長 · 讓一切井然有序
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
