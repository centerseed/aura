"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Loader2, LogIn, Zap, RefreshCw, BookOpen, Sparkles, Check, ListTodo, Wand2 } from "lucide-react";
import { auth, googleProvider, signInWithPopup, signInAnonymously } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";

// Helper function to get auth headers
async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  const token = await user.getIdToken();
  return { 'Authorization': `Bearer ${token}` };
}

export default function HomeDemo() {
  const [name, setName] = useState("");
  const [isEntering, setIsEntering] = useState(false);
  const [authMethod, setAuthMethod] = useState<"select" | "name">("select");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [activeDemo, setActiveDemo] = useState(0);
  const [activeDemoTab, setActiveDemoTab] = useState(0);

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
        textMuted: "text-slate-600",
        textMutedDarker: "text-slate-500",
        textMutedLighter: "text-slate-700",
        textMutedAlt: "text-slate-800",
        border: "border-indigo-200/50",
        borderLight: "border-indigo-100/50",
        borderHover: "border-emerald-400/60",
        card: "bg-indigo-50/40",
        cardHover: "bg-indigo-100/50",
        cardBg: "bg-white",
        accent: "text-emerald-600",
        accentBg: "bg-emerald-100/60",
        accentBorder: "border-emerald-400/60",
        shadow: "shadow-emerald-300/30",
      };

  // 演示場景組 - 三個不同功能的演示
  const demoTabs = [
    {
      id: 0,
      name: "自動分類",
      icon: Sparkles,
      scenarios: [
        {
          input: "下週要見投資人",
          category: "Active",
          icon: Zap,
          color: "amber",
          result: "自動設定提醒、加入日曆、準備相關資料"
        },
        {
          input: "客戶反饋要記錄",
          category: "Maintain",
          icon: RefreshCw,
          color: "blue",
          result: "歸入客戶管理流程、標記待處理"
        },
        {
          input: "產品定價策略文件",
          category: "Reference",
          icon: BookOpen,
          color: "emerald",
          result: "存入知識庫，需要時自動推薦"
        }
      ]
    },
    {
      id: 1,
      name: "零碎整理",
      icon: ListTodo,
      scenarios: [
        {
          input: "明天要打電話給客戶\n記得準備簡報\n下午3點開會",
          category: "TodoList",
          icon: ListTodo,
          color: "blue",
          result: "自動拆分成 3 個待辦事項，加上時間標記和優先級"
        },
        {
          input: "產品改版：修 bug、優化 UI、寫文檔",
          category: "TodoList",
          icon: ListTodo,
          color: "blue",
          result: "智能拆解成子任務清單，建議執行順序"
        },
        {
          input: "週一發文、週三客服、週五覆盤",
          category: "TodoList",
          icon: ListTodo,
          color: "blue",
          result: "自動轉換為結構化的週計畫"
        }
      ]
    },
    {
      id: 2,
      name: "智能重組",
      icon: Wand2,
      scenarios: [
        {
          input: "重複標籤：#客戶管理 #客戶 #CRM",
          category: "Reorganize",
          icon: Wand2,
          color: "indigo",
          result: "合併為 #客戶管理，自動更新相關任務"
        },
        {
          input: "混亂任務：5 個「待辦」都沒截止日",
          category: "Reorganize",
          icon: Wand2,
          color: "indigo",
          result: "建議分類到 Active/Maintain，設定優先級"
        },
        {
          input: "相似專案：產品 A 開發、產品 B 開發",
          category: "Reorganize",
          icon: Wand2,
          color: "indigo",
          result: "建議合併到「產品開發」Area，建立統一視圖"
        }
      ]
    }
  ];

  const demoScenarios = demoTabs[activeDemoTab].scenarios;

  const handleGoogleSignIn = async () => {
    setIsEntering(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
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
      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
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
      alert("登入失敗,請稍後再試");
    }
  };

  const handleNameSignIn = async () => {
    if (!name.trim()) return;
    setIsEntering(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
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
      const libraryRes = await fetch(`${API_BASE_URL}/api/library`, { headers: await getAuthHeaders() });
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
    <main className={`min-h-screen ${isDark ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50"} ${theme.text} overflow-hidden transition-colors duration-300`}>
      {/* 優雅背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 ${isDark ? "bg-indigo-500/20" : "bg-indigo-300/15"} rounded-full blur-3xl ${isDark ? "animate-pulse" : ""}`} />
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 ${isDark ? "bg-emerald-500/15" : "bg-emerald-300/10"} rounded-full blur-3xl ${isDark ? "animate-pulse delay-1000" : ""}`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 ${isDark ? "bg-indigo-500/10" : "bg-emerald-200/5"} rounded-full blur-3xl`} />
      </div>

      {/* 右上角操作按鈕 */}
      <div className="absolute top-8 right-8 z-50 flex items-center gap-3">
        <button
          onClick={() => setShowAuthPanel(!showAuthPanel)}
          className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400
            text-white font-medium text-sm transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/30
            border border-emerald-400/40 hover:border-emerald-400/80"
        >
          <LogIn className="w-4 h-4" />
          登入
        </button>
      </div>

      {/* 主內容區 */}
      <div className="relative z-10">
        {/* Hero Section - 升級版 */}
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
          {/* Logo & Title */}
          <div className="text-center mb-16 space-y-8">
            <div className="space-y-4">
              <h1 className={`text-7xl md:text-8xl font-bold mb-6 ${isDark ? "bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent" : "bg-gradient-to-r from-indigo-600 via-slate-900 to-slate-900 bg-clip-text text-transparent"}`}>
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
            <div className={`relative p-8 md:p-12 border ${theme.border} ${theme.card} rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl ${isDark ? "shadow-indigo-500/10" : "shadow-indigo-300/10"}`}>
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
                        onClick={() => {
                          setActiveDemoTab(tab.id);
                          setActiveDemo(0);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                          activeDemoTab === tab.id
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

                {/* 演示區 - 左右佈局 */}
                <div className="grid md:grid-cols-2 gap-8 items-start">
                  {/* 左側：輸入示例 */}
                  <div className="space-y-4">
                    <div className={`p-5 rounded-2xl ${isDark ? "bg-white/5" : "bg-indigo-50/50"} border ${theme.borderLight}`}>
                      <div className="space-y-4">
                        <div className={`text-xs uppercase tracking-wider ${theme.textMutedDarker} font-semibold mb-3`}>
                          📝 隨意輸入 (點擊試試)
                        </div>
                        <div className="space-y-3">
                          {demoScenarios.map((scenario, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveDemo(i)}
                              className={`w-full p-4 rounded-xl text-left transition-all transform hover:scale-105 ${
                                activeDemo === i
                                  ? isDark
                                    ? "bg-indigo-500/20 border-2 border-indigo-400/50 shadow-lg shadow-indigo-500/20"
                                    : "bg-indigo-100 border-2 border-indigo-400 shadow-lg shadow-indigo-300/20"
                                  : isDark
                                  ? "bg-white/5 border border-white/10 hover:bg-white/10"
                                  : "bg-white border border-indigo-200/50 hover:bg-indigo-50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${activeDemo === i ? (isDark ? "bg-emerald-400" : "bg-emerald-600") : (isDark ? "bg-white/30" : "bg-slate-400")}`} />
                                <span className={`text-sm ${activeDemo === i ? theme.text : theme.textMutedLighter}`}>
                                  {scenario.input}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className={`text-xs ${theme.textMutedDarker} text-center italic`}>
                      💡 不需分類、不需打標籤、不需想要放哪裡
                    </p>
                  </div>

                  {/* 右側：AI 處理結果 */}
                  <div className="space-y-4">
                    <div className={`text-xs uppercase tracking-wider ${theme.textMutedDarker} font-semibold mb-3 px-5`}>
                      ⚡ {activeDemoTab === 0 ? "AI 瞬間分類" : activeDemoTab === 1 ? "AI 智能拆解" : "AI 重組建議"}
                    </div>
                    {(() => {
                      const scenario = demoScenarios[activeDemo];
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
                        Reorganize: "🔄 智能重組"
                      };

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
                                <div className={`text-sm font-medium ${theme.text} mb-2 whitespace-pre-line`}>
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
                    })()}

                    {/* 其他兩個的縮略版 */}
                    <div className="space-y-2 opacity-60">
                      {demoScenarios.filter((_, i) => i !== activeDemo).map((scenario, i) => {
                        const ScenarioIcon = scenario.icon;
                        const colorMap: Record<string, {bg: string; text: string}> = {
                          amber: {
                            bg: isDark ? "bg-amber-500/20" : "bg-amber-100",
                            text: isDark ? "text-amber-400" : "text-amber-600"
                          },
                          blue: {
                            bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
                            text: isDark ? "text-blue-400" : "text-blue-600"
                          },
                          emerald: {
                            bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
                            text: isDark ? "text-emerald-400" : "text-emerald-600"
                          },
                          indigo: {
                            bg: isDark ? "bg-indigo-500/20" : "bg-indigo-100",
                            text: isDark ? "text-indigo-400" : "text-indigo-600"
                          }
                        };
                        const colors = colorMap[scenario.color];

                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-xl border ${theme.borderLight} ${isDark ? "bg-white/5" : "bg-white"}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                                <ScenarioIcon className={`w-3 h-3 ${colors.text}`} />
                              </div>
                              <span className={`text-xs ${theme.textMuted} truncate`}>
                                {scenario.input.split('\n')[0]}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
              { icon: "🧠", text: "決策有依據", desc: "智能關聯" }
            ].map((item, i) => (
              <div
                key={i}
                className={`group p-5 text-center border ${theme.border} ${theme.card} hover:${theme.cardHover} rounded-xl transition-all hover:scale-110 hover:shadow-lg ${isDark ? "hover:shadow-emerald-500/20" : "hover:shadow-emerald-300/20"}`}
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
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl
                bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400
                text-white font-semibold text-lg transition-all duration-300 hover:gap-4 hover:scale-105
                border-2 border-emerald-400/40 hover:border-emerald-400/80 hover:shadow-2xl hover:shadow-indigo-500/30"
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
                      className={`group relative p-8 border-2 ${item.borderColor} bg-gradient-to-br ${item.bgGradient} rounded-2xl transition-all hover:scale-105 hover:shadow-2xl ${
                        item.color === "amber"
                          ? isDark ? "hover:shadow-amber-500/20" : "hover:shadow-amber-300/20"
                          : item.color === "blue"
                          ? isDark ? "hover:shadow-blue-500/20" : "hover:shadow-blue-300/20"
                          : isDark ? "hover:shadow-emerald-500/20" : "hover:shadow-emerald-300/20"
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-16 h-16 rounded-2xl ${
                        item.color === "amber"
                          ? isDark ? "bg-amber-500/20" : "bg-amber-100"
                          : item.color === "blue"
                          ? isDark ? "bg-blue-500/20" : "bg-blue-100"
                          : isDark ? "bg-emerald-500/20" : "bg-emerald-100"
                      } flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-8 h-8 ${
                          item.color === "amber"
                            ? isDark ? "text-amber-400" : "text-amber-600"
                            : item.color === "blue"
                            ? isDark ? "text-blue-400" : "text-blue-600"
                            : isDark ? "text-emerald-400" : "text-emerald-600"
                        }`} />
                      </div>

                      {/* 標題 */}
                      <div className="space-y-2 mb-4">
                        <h3 className={`text-xl font-bold ${theme.text}`}>{item.title}</h3>
                        <p className={`text-sm ${
                          item.color === "amber"
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
                            <span className={`${
                              item.color === "amber"
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
                      "每月 50 次 AI 自動分類",
                      "每月 10 次零碎整理、智能重組",
                      "一個用戶地圖",
                      "無限使用"
                    ],
                    cta: "立即開始"
                  },
                  {
                    name: "Fusion",
                    price: "NT$ 240",
                    period: "月",
                    highlight: true,
                    isActive: true,
                    features: [
                      "Atom 版所有功能，無限制",
                      "無限輸入和整理",
                      "語音/圖片輸入（開發中）",
                      "Google 日曆串接（開發中）"
                    ],
                    cta: "限時免費"
                  },
                  {
                    name: "Cosmos",
                    price: "近期登場",
                    period: "",
                    highlight: false,
                    features: [
                      "Fusion 所有功能",
                      "MCP 支援",
                      "多人協作模式",
                      "智慧行程管理"
                    ],
                    cta: "敬請期待"
                  }
                ].map((plan, i) => (
                  <div
                    key={i}
                    className={`relative p-8 rounded-2xl border-2 transition-all hover:scale-105 ${
                      plan.highlight
                        ? isDark
                          ? "border-indigo-500/60 bg-gradient-to-br from-indigo-500/20 to-transparent shadow-2xl shadow-indigo-500/30"
                          : "border-emerald-500 bg-gradient-to-br from-indigo-50 to-white shadow-2xl shadow-emerald-400/30"
                        : `${theme.border} ${theme.card} hover:shadow-xl ${isDark ? "hover:shadow-emerald-500/20" : "hover:shadow-emerald-300/20"}`
                    }`}
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
                        className={`w-full py-3.5 rounded-xl font-semibold transition-all hover:scale-105 ${
                          plan.highlight
                            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg"
                            : isDark
                            ? "border-2 border-white/20 text-white hover:border-emerald-400/50 hover:bg-white/5"
                            : "border-2 border-slate-300 text-slate-900 hover:border-emerald-500 hover:bg-indigo-50"
                        }`}
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

          <Card className="relative w-full max-w-md bg-slate-900/98 border border-emerald-500/40 backdrop-blur-xl p-8 rounded-lg shadow-2xl shadow-black/50">
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
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium"
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
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
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
            你的 AI 營運長 · 讓一切井然有序
          </p>
        </div>
      </footer>
    </main>
  );
}
