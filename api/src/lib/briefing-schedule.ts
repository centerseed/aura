const DEFAULT_MORNING_WINDOW_START = 7

interface BriefingWindowConfig {
  enabled?: boolean
  windowStart?: number
  windowEnd?: number
}

interface BriefingScheduleSettings {
  morning?: BriefingWindowConfig
  evening?: BriefingWindowConfig
}

interface UserSettings {
  briefingSchedule?: BriefingScheduleSettings
}

export function getMorningBriefingSchedule(settings: unknown): { enabled: boolean; windowStart: number } {
  const userSettings = (settings ?? {}) as UserSettings
  const morning = userSettings.briefingSchedule?.morning

  if (!morning) {
    return { enabled: true, windowStart: DEFAULT_MORNING_WINDOW_START }
  }

  return {
    enabled: morning.enabled ?? true,
    windowStart: typeof morning.windowStart === 'number' ? morning.windowStart : DEFAULT_MORNING_WINDOW_START,
  }
}
