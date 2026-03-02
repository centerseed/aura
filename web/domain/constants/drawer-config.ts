/**
 * DRAWER_CONFIG - Drawer 狀態配置（唯一真實來源）
 *
 * 定義各種 Drawer 狀態的所有顯示屬性：
 * - 標籤、圖示、點色（sidebar 用）
 * - 徽章樣式（task badge 用）
 * - 欄位漸層與邊框（kanban column 用）
 */

import { Inbox, Rocket, RefreshCw, BookOpen, Archive, type LucideIcon } from 'lucide-react'
import type { DrawerStatus } from '@/types'

export interface DrawerConfigItem {
  label: string
  icon: LucideIcon
  color: string
  dotColor: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  columnGradient: string
  columnBorder: string
  userSelectable: boolean
}

export const DRAWER_CONFIG: Record<DrawerStatus, DrawerConfigItem> = {
  INBOX: {
    label: '規劃中',
    icon: Inbox,
    color: 'text-amber-500',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-500/20',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
    columnGradient: 'from-amber-500/10 to-orange-500/5',
    columnBorder: 'border-amber-200 dark:border-amber-800',
    userSelectable: true,
  },
  ACTIVE: {
    label: '進行中',
    icon: Rocket,
    color: 'text-blue-500',
    dotColor: 'bg-blue-500',
    badgeBg: 'bg-blue-500/20',
    badgeBorder: 'border-blue-500/30',
    badgeText: 'text-blue-400',
    columnGradient: 'from-blue-500/10 to-cyan-500/5',
    columnBorder: 'border-blue-200 dark:border-blue-800',
    userSelectable: true,
  },
  MAINTAIN: {
    label: '維護中',
    icon: RefreshCw,
    color: 'text-indigo-500',
    dotColor: 'bg-indigo-500',
    badgeBg: 'bg-indigo-500/20',
    badgeBorder: 'border-indigo-500/30',
    badgeText: 'text-indigo-400',
    columnGradient: 'from-indigo-500/10 to-emerald-500/5',
    columnBorder: 'border-indigo-200 dark:border-blue-800',
    userSelectable: false,
  },
  REFERENCE: {
    label: '參考資料',
    icon: BookOpen,
    color: 'text-green-500',
    dotColor: 'bg-green-500',
    badgeBg: 'bg-green-500/20',
    badgeBorder: 'border-green-500/30',
    badgeText: 'text-green-400',
    columnGradient: 'from-green-500/10 to-emerald-500/5',
    columnBorder: 'border-green-200 dark:border-green-800',
    userSelectable: true,
  },
  ARCHIVE: {
    label: '已歸檔',
    icon: Archive,
    color: 'text-slate-400',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-500/20',
    badgeBorder: 'border-slate-500/30',
    badgeText: 'text-slate-400',
    columnGradient: 'from-slate-500/10 to-slate-500/5',
    columnBorder: 'border-slate-200 dark:border-slate-700',
    userSelectable: true,
  },
}
