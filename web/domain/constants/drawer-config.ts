/**
 * DRAWER_CONFIG - Drawer 狀態配置
 *
 * 定義各種 Drawer 狀態的顯示屬性
 */

import { Inbox, Rocket, RefreshCw, BookOpen, Archive, type LucideIcon } from 'lucide-react'
import type { DrawerStatus } from '@/types'

export interface DrawerConfigItem {
  label: string
  icon: LucideIcon
  color: string
  dotColor: string
}

export const DRAWER_CONFIG: Record<DrawerStatus, DrawerConfigItem> = {
  INBOX: { label: '收件匣', icon: Inbox, color: 'text-amber-500', dotColor: 'bg-amber-500' },
  ACTIVE: { label: '進行中', icon: Rocket, color: 'text-blue-500', dotColor: 'bg-blue-500' },
  MAINTAIN: { label: '維護中', icon: RefreshCw, color: 'text-indigo-500', dotColor: 'bg-indigo-500' },
  REFERENCE: { label: '參考資料', icon: BookOpen, color: 'text-green-500', dotColor: 'bg-green-500' },
  ARCHIVE: { label: '已歸檔', icon: Archive, color: 'text-slate-400', dotColor: 'bg-slate-400' },
}
