"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/firebase";
import { User } from "firebase/auth";
import { API_BASE_URL } from "@/lib/api-client";
import { Check, Zap, Loader2, ArrowLeft } from "lucide-react";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? '';
const YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ?? '';

const FUSION_FEATURES = [
  "AI 任務分析 50 次 / 天（Brain Dump、圖片輸入）",
  "每日晨報 / 晚報（Coach Briefing）",
  "AI 智能排程建議",
  "Google Calendar 雙向同步",
  "MCP 整合（Claude Code / Cursor）",
  "跨裝置即時同步",
];

const ATOM_FEATURES = [
  "AI 任務分析 50 次 / 天（Brain Dump、圖片輸入）",
  "任務與專案管理",
  "MCP 整合（Claude Code / Cursor）",
  "跨裝置即時同步",
];

export default function PricingPage() {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
  const [isLoading, setIsLoading] = useState<"trial" | "upgrade" | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleCheckout = useCallback(
    async (trialEnabled: boolean) => {
      if (!firebaseUser) {
        router.push("/login?redirect=/pricing");
        return;
      }

      const priceId = billingPeriod === "monthly" ? MONTHLY_PRICE_ID : YEARLY_PRICE_ID;
      if (!priceId) {
        alert("Stripe Price ID 未設定，請聯繫客服。");
        return;
      }

      setIsLoading(trialEnabled ? "trial" : "upgrade");
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/payment/create-checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ priceId, trialEnabled }),
        });

        const data = await res.json();
        if (data.success && data.data.checkoutUrl) {
          window.location.href = data.data.checkoutUrl;
        } else {
          throw new Error(data.error?.message ?? "建立結帳頁面失敗");
        }
      } catch (err) {
        console.error("Checkout error:", err);
        alert(err instanceof Error ? err.message : "發生錯誤，請稍後再試");
        setIsLoading(null);
      }
    },
    [firebaseUser, billingPeriod, router]
  );

  const monthlyPrice = 5.99;
  const yearlyMonthlyPrice = (57.99 / 12).toFixed(2);
  const yearlyTotal = 57.99;
  const yearlyDiscount = Math.round((1 - 57.99 / (monthlyPrice * 12)) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-4">
            選擇你的方案
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            用 AI 驅動你的生產力，從整理思路到完成任務
          </p>

          {/* 月付 / 年付切換 */}
          <div className="flex items-center justify-center mt-8 gap-3">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingPeriod === "monthly"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              月付
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                billingPeriod === "yearly"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              年付
              <Badge className="bg-emerald-600 text-white text-xs px-1.5 py-0">
                省 {yearlyDiscount}%
              </Badge>
            </button>
          </div>
        </div>

        {/* 方案卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Atom 免費方案 */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-xl">Atom</CardTitle>
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  免費
                </Badge>
              </div>
              <p className="text-slate-400 text-sm mt-1">適合個人入門使用</p>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-slate-400 ml-1">/ 月</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {ATOM_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-slate-300 text-sm">
                    <Check className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-400 hover:text-white"
                onClick={() => router.push(firebaseUser ? "/dashboard" : "/")}
              >
                {firebaseUser ? "繼續使用" : "免費開始"}
              </Button>
            </CardContent>
          </Card>

          {/* Fusion 付費方案 */}
          <Card className="bg-slate-900 border-amber-500/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-indigo-500 via-amber-500 to-emerald-500" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Fusion
                </CardTitle>
                <Badge className="bg-amber-600 text-white">最受歡迎</Badge>
              </div>
              <p className="text-slate-400 text-sm mt-1">適合認真提升生產力的工作者</p>
              <div className="mt-4">
                {billingPeriod === "yearly" ? (
                  <>
                    <span className="text-4xl font-bold text-white">${yearlyMonthlyPrice}</span>
                    <span className="text-slate-400 ml-1">/ 月</span>
                    <p className="text-slate-500 text-sm mt-1">
                      年付 ${yearlyTotal}（平均 ${yearlyMonthlyPrice}/月）
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-bold text-white">${monthlyPrice}</span>
                    <span className="text-slate-400 ml-1">/ 月</span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {FUSION_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-slate-200 text-sm">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="space-y-3 pt-2">
                {/* 試用按鈕 */}
                <Button
                  onClick={() => handleCheckout(true)}
                  disabled={isLoading !== null}
                  className="w-full bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-700 hover:to-amber-700 text-white font-semibold"
                >
                  {isLoading === "trial" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      處理中...
                    </>
                  ) : (
                    "開始 14 天免費試用"
                  )}
                </Button>

                {/* 立即升級按鈕 */}
                <Button
                  onClick={() => handleCheckout(false)}
                  disabled={isLoading !== null}
                  variant="outline"
                  className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                >
                  {isLoading === "upgrade" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      處理中...
                    </>
                  ) : (
                    `立即升級（${billingPeriod === "yearly" ? `年付 $${yearlyTotal}` : `月付 $${monthlyPrice}`}）`
                  )}
                </Button>
              </div>

              <p className="text-slate-500 text-xs text-center">
                試用結束後自動轉為付費方案，可隨時取消
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center space-y-3">
          <p className="text-slate-400 text-sm">
            試用期間不需要信用卡？不對，Stripe 需要信用卡資訊以便試用結束後自動收費。
          </p>
          <p className="text-slate-400 text-sm">
            可以隨時在{" "}
            <button
              onClick={() => router.push("/settings")}
              className="text-indigo-400 hover:underline"
            >
              設定頁面
            </button>{" "}
            取消訂閱，不會額外收費。
          </p>
        </div>
      </div>
    </div>
  );
}
