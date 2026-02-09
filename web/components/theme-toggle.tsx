"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 在 hydration 完成前，顯示預設的深色圖示（避免閃爍）
  if (!mounted) {
    return (
      <div className="p-2 rounded-lg text-white/60">
        <Sun className="w-5 h-5" />
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
      title={isDark ? "切換淺色主題" : "切換深色主題"}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
