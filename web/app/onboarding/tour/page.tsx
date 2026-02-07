"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";
import { TourScene1 } from "@/components/onboarding/tour-scene-1";
import { TourScene2 } from "@/components/onboarding/tour-scene-2";
import { TourScene3 } from "@/components/onboarding/tour-scene-3";
import { TourNavigation } from "@/components/onboarding/tour-navigation";

// 極簡配色
const SCENE_COLORS = {
  1: "bg-slate-950",
  2: "bg-slate-950",
  3: "bg-slate-950",
};

function TourContent() {
  const router = useRouter();

  const [currentScene, setCurrentScene] = useState(1);
  const [userAreas, setUserAreas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // 從 Firebase Auth 獲取用戶的 Areas
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        // 未登入，重定向到首頁
        router.push("/");
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        const userRes = await fetch(`${API_BASE_URL}/api/me`, { headers });
        if (!userRes.ok) {
          throw new Error("無法獲取用戶資料");
        }
        const userData = await userRes.json();
        // API 回應格式: { success: true, data: { user: {...} } }
        setUserId(userData.data?.user?.id);

        const areasRes = await fetch(`${API_BASE_URL}/api/areas`, { headers });
        const areasData = await areasRes.json();
        // API 回應格式: { success: true, data: { areas: [...] } }
        const areas = areasData.data?.areas || [];
        setUserAreas(areas.map((area: any) => area.name));
      } catch (error) {
        console.error("Failed to load user areas:", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleNext = () => {
    if (currentScene < 3) {
      setCurrentScene(currentScene + 1);
    } else {
      router.push(`/dashboard`);
    }
  };

  const handlePrev = () => {
    if (currentScene > 1) setCurrentScene(currentScene - 1);
  };

  const handleSkip = () => {
    router.push(`/dashboard`);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-white/60">準備導覽中...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen transition-all duration-700 ${SCENE_COLORS[currentScene as keyof typeof SCENE_COLORS]}`}
    >
      {/* 極簡背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600/15 rounded-full blur-[100px]" />
      </div>

      {/* Scene Content */}
      <div className="relative max-w-5xl mx-auto px-6 py-8 pb-24">
        {currentScene === 1 && <TourScene1 userAreas={userAreas} />}
        {currentScene === 2 && <TourScene2 />}
        {currentScene === 3 && <TourScene3 />}
      </div>

      {/* Navigation */}
      <TourNavigation
        currentScene={currentScene}
        totalScenes={3}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
      />
    </main>
  );
}

function LoadingFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </main>
  );
}

export default function TourPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TourContent />
    </Suspense>
  );
}
