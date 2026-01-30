import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Drawer 狀態配置
export const DRAWER_CONFIG = {
  "00_inbox": {
    label: "收件匣",
    icon: "Inbox",
    bg: "bg-drawer-inbox",
    border: "border-amber-400",
  },
  "10_active": {
    label: "進行中",
    icon: "Rocket",
    bg: "bg-drawer-active",
    border: "border-blue-500",
  },
  "20_maintain": {
    label: "維護中",
    icon: "RefreshCw",
    bg: "bg-drawer-maintain",
    border: "border-purple-500",
  },
  "30_reference": {
    label: "參考",
    icon: "BookOpen",
    bg: "bg-drawer-reference",
    border: "border-green-500",
  },
  "40_archive": {
    label: "歸檔",
    icon: "Archive",
    bg: "bg-drawer-archive",
    border: "border-slate-400",
  },
} as const;
