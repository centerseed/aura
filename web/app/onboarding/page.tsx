"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import {
  Sparkles,
  Briefcase,
  User,
  Rocket,
  BookOpen,
  Coins,
  Plus,
  Check,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { API } from "@/lib/api-client";

// 預設身分選項
const PRESET_AREAS = [
  {
    name: "事業",
    scope: "職涯發展、創業經營、技能提升、事業規劃",
    icon: Briefcase,
    color: "from-blue-500 to-cyan-500",
  },
  {
    name: "個人",
    scope: "興趣愛好、自我學習、心靈成長、休閒娛樂",
    icon: User,
    color: "from-indigo-500 to-emerald-500",
  },
  {
    name: "人際",
    scope: "家庭關係、朋友社交、親子教育、人脈經營",
    icon: BookOpen,
    color: "from-green-500 to-emerald-500",
  },
  {
    name: "財務",
    scope: "投資理財、資產配置、預算管理、被動收入",
    icon: Coins,
    color: "from-amber-500 to-orange-500",
  },
];

function OnboardingContent() {
  const router = useRouter();

  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [customArea, setCustomArea] = useState({ name: "", scope: "" });
  const [showCustom, setShowCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState<string>("User");
  const [userId, setUserId] = useState<string | null>(null);

  // 載入用戶資訊
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        // 未登入，重定向到首頁
        router.push("/");
        return;
      }

      try {
        // API 回傳格式: { user: { id, email, displayName, ... } }
        const result = await API.users.me();
        const user = result.user;
        setUserId(user.id);
        setUserName(user.displayName || user.name || user.email || "User");
      } catch (error) {
        console.error("載入用戶資訊失敗:", error);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const toggleArea = (name: string) => {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    console.log("=== 開始提交 ===");
    const areasToCreate: { name: string; scope: string }[] = [];

    // 收集選中的預設身分
    for (const preset of PRESET_AREAS) {
      if (selectedAreas.has(preset.name)) {
        areasToCreate.push({ name: preset.name, scope: preset.scope });
      }
    }

    // 添加自定義身份
    if (customArea.name.trim() && customArea.scope.trim()) {
      areasToCreate.push({ name: customArea.name.trim(), scope: customArea.scope.trim() });
    }

    console.log("要創建的 Areas:", areasToCreate);

    if (areasToCreate.length === 0) {
      console.warn("沒有選擇任何身分");
      return;
    }

    setIsSubmitting(true);

    try {
      // 檢查是否有 userId
      if (!userId) {
        throw new Error("尚未載入用戶資料，請稍後再試");
      }

      console.log("正在為用戶創建 Areas...", userId);

      // 創建 Areas
      console.log("正在創建 Areas...");

      for (const area of areasToCreate) {
        console.log("創建 Area:", area.name);
        const result = await API.areas.create({
          name: area.name,
          scope: area.scope,
        });
        console.log("Area 創建結果:", result);
      }

      console.log("所有 Areas 創建成功，導向 onboarding tour");
      // 導向 onboarding tour 引導頁面
      router.push(`/onboarding/tour`);
    } catch (error) {
      console.error("=== 提交失敗 ===", error);
      alert(`提交失敗: ${error instanceof Error ? error.message : String(error)}`);
      setIsSubmitting(false);
    }
  };

  const totalSelected = selectedAreas.size + (customArea.name.trim() && customArea.scope.trim() ? 1 : 0);

  return (
    <main className="min-h-screen bg-slate-950 text-white relative">
      {/* 極簡背景 - 只保留細微裝飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600/15 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-6">
        {/* Header - 緊湊版 */}
        <div className="text-center mb-8 space-y-3">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 border border-indigo-500/20 backdrop-blur-xl shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-sm font-medium bg-gradient-to-r from-indigo-200 to-emerald-200 bg-clip-text text-transparent">設定你的身份地圖</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
            <span className="inline-block bg-gradient-to-br from-white via-white to-white/80 bg-clip-text text-transparent drop-shadow-2xl">
              嗨，
            </span>
            <span className="inline-block bg-gradient-to-r from-indigo-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent animate-[gradient_3s_ease_infinite] bg-[length:200%_auto]">
              {userName}
            </span>
          </h1>

          {/* Description */}
          <div className="max-w-2xl mx-auto space-y-1">
            <p className="text-lg text-white/80 leading-relaxed">
              在開始之前，讓我們先定義你的<span className="text-indigo-300 font-semibold">「身份地圖」</span>
            </p>
            <p className="text-sm text-white/50">
              系統會根據這些身分來組織你的資訊，讓一切井然有序
            </p>
          </div>
        </div>

        {/* Preset Areas - 緊湊版 */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-4 bg-gradient-to-b from-indigo-400 to-emerald-400 rounded-full"></span>
            選擇你的身份（可多選）
          </h2>

          <div className="grid md:grid-cols-2 gap-3">
            {PRESET_AREAS.map((area) => {
              const Icon = area.icon;
              const isSelected = selectedAreas.has(area.name);

              return (
                <button
                  key={area.name}
                  onClick={() => toggleArea(area.name)}
                  className={`
                    group relative p-4 rounded-2xl border-2 text-left
                    transition-all duration-500 ease-out
                    backdrop-blur-xl
                    ${isSelected
                      ? "border-indigo-400/60 bg-gradient-to-br from-indigo-500/20 via-indigo-500/15 to-emerald-500/20 shadow-2xl shadow-indigo-500/20 scale-[1.02]"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 hover:shadow-xl hover:shadow-white/5 hover:scale-[1.01]"
                    }
                  `}
                >
                  {/* 光暈效果 */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 rounded-2xl blur-xl -z-10"></div>
                  )}

                  {/* Selection Indicator */}
                  <div
                    className={`
                      absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center
                      transition-all duration-300 shadow-lg
                      ${isSelected
                        ? "bg-gradient-to-br from-indigo-500 to-indigo-600 scale-110 rotate-12"
                        : "bg-white/10 group-hover:bg-white/20 group-hover:scale-105"
                      }
                    `}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white animate-in zoom-in duration-200" />}
                  </div>

                  {/* 橫向排列：Icon + Content */}
                  <div className="flex items-start gap-4">
                    {/* Icon with Glow */}
                    <div className={`
                      relative w-16 h-16 rounded-2xl bg-gradient-to-br ${area.color}
                      flex items-center justify-center flex-shrink-0
                      shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3
                    `}>
                      <Icon className="w-8 h-8 text-white drop-shadow-lg" />
                      <div className={`absolute inset-0 bg-gradient-to-br ${area.color} rounded-2xl blur-md opacity-50 -z-10`}></div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                        {area.name}
                      </h3>
                      <p className="text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">
                        {area.scope}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Area - 緊湊版 */}
        <div className="mb-6">
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="group flex items-center gap-2 text-white/50 hover:text-indigo-300 transition-all duration-300 hover:gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              </div>
              <span className="font-medium">新增自定義身份</span>
            </button>
          ) : (
            <div className="relative p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-xl shadow-xl">
              {/* 裝飾性光暈 */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 rounded-2xl blur-lg -z-10"></div>

              <h3 className="text-white font-bold mb-5 flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-white" />
                </div>
                自定義身份
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2.5">身份名稱</label>
                  <input
                    type="text"
                    value={customArea.name}
                    onChange={(e) => setCustomArea((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="例如：創作者、學生、父母"
                    className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2.5">這個身份包含什麼？</label>
                  <textarea
                    value={customArea.scope}
                    onChange={(e) => setCustomArea((prev) => ({ ...prev, scope: e.target.value }))}
                    placeholder="例如：內容創作、影片製作、社群經營..."
                    rows={3}
                    className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary & Submit - 緊湊版 */}
        <div className="flex items-center justify-between pt-5 border-t border-white/10">
          <div className="text-base">
            {totalSelected > 0 ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-white/60">已選擇</span>
                <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-400/30 text-indigo-200 font-bold text-sm shadow-lg">
                  {totalSelected}
                </span>
                <span className="text-white/60">個身份</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-white/40">
                <div className="w-2 h-2 rounded-full bg-white/20"></div>
                <span>請至少選擇一個身份</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={totalSelected === 0 || isSubmitting}
            className="group relative h-13 px-10 bg-gradient-to-r from-indigo-600 via-indigo-600 to-emerald-600 hover:from-indigo-500 hover:via-indigo-500 hover:to-emerald-500 text-white font-semibold text-base rounded-xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            {/* 光暈效果 */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-emerald-600 rounded-xl blur opacity-50 group-hover:opacity-75 transition duration-300 -z-10"></div>

            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>建立中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>建立我的身份地圖</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
