/**
 * User Entity - 用戶領域模型
 */

export interface BriefingSchedule {
  morning?: {
    enabled: boolean
    windowStart: number // 0-23
    windowEnd: number // 1-24
  }
  evening?: {
    enabled: boolean
    windowStart: number // 0-23
    windowEnd: number // 1-24
  }
}

export interface UserSettings {
  displayName?: string
  briefingSchedule?: BriefingSchedule
}

export interface User {
  id: string
  email: string | null
  name: string | null
  timezone: string
  settings: UserSettings | null
}
