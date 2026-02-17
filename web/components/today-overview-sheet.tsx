"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sun,
  Moon,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  Calendar,
  CalendarPlus,
  CalendarClock,
  TrendingDown,
  Loader2,
  Sparkles,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  GripVertical,
  ListTodo,
  X,
} from "lucide-react";
import { API } from "@/lib/api-client";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BriefingSchedule } from "@/domain/entities/user.entity";
import { isInBriefingWindow, getCurrentLocalHour } from "@/lib/briefing-window-utils";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ============================================================================
// Types
// ============================================================================

interface CalendarEventSummary {
  id: string;
  summary: string;
  start_date_time: string;
  end_date_time: string;
  meet_link: string | null;
  attendees: string[];
}

interface TaskSummary {
  id: string;
  content: string;
  status: string;
  due_date: string | null;
  area_name: string;
  product_name: string;
  days_overdue: number | null;
  days_remaining: number | null;
}

interface ConflictItem {
  type: string;
  severity: string;
  description: string;
}

interface StagnationItem {
  type: string;
  entity_id: string;
  entity_name: string;
  area_name: string;
  days_inactive: number;
  suggestion: string;
  parent_task_content?: string;
}

interface Recommendation {
  priority: number;
  action: string;
  reasoning: string;
}

interface DeferSuggestion {
  task_id: string;
  task_content: string;
  suggested_action: string;
  reasoning: string;
}

interface BriefingData {
  id: string;
  type: "MORNING" | "EVENING";
  briefing_date: string;
  calendar_events: CalendarEventSummary[];
  overdue_tasks: TaskSummary[];
  approaching_tasks: TaskSummary[];
  conflicts: ConflictItem[];
  stagnations: StagnationItem[];
  completed_tasks: TaskSummary[];
  remaining_tasks: TaskSummary[];
  tomorrow_preview: CalendarEventSummary[];
  summary: string;
  recommendations: Recommendation[];
  defer_suggestions: DeferSuggestion[];
  created_at: string;
}

interface PlanItem {
  id: string;
  task_id: string;
  sub_task_id?: string | null;
  content: string;
  product_name?: string;
  area_name?: string;
  order: number;
  estimated_minutes?: number;
  completed: boolean;
  pinned: boolean;
  deferred: boolean;
  status: "today" | "overflow";
  user_adjusted: boolean;
}

interface DailyPlan {
  id: string;
  plan_date: string;
  items: PlanItem[];
  overflow_items?: any[];
  capacity_note?: string;
  coach_message?: string;
}

// ============================================================================
// LocalStorage helpers
// ============================================================================

const STORAGE_KEY = "coach_last_seen_briefing_id";

function getLastSeenId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function setLastSeenId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

// ============================================================================
// Props
// ============================================================================

interface TodayOverviewSheetProps {
  onCompleteTask: (taskId: string) => void;
  onOpenTask?: (taskId: string, subTaskId?: string | null) => void;
}

// ============================================================================
// Main Export: TodayOverviewSheet (Header button + Sheet)
// ============================================================================

export function TodayOverviewSheet({
  onCompleteTask,
  onOpenTask,
}: TodayOverviewSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Briefing state
  const [morningBriefing, setMorningBriefing] = useState<BriefingData | null>(null);
  const [eveningBriefing, setEveningBriefing] = useState<BriefingData | null>(null);
  const [activeTab, setActiveTab] = useState<"MORNING" | "EVENING">(
    new Date().getHours() >= 21 ? "EVENING" : "MORNING"
  );
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plan state
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [completingItems, setCompletingItems] = useState<Set<string>>(new Set());

  // User settings
  const [userSettings, setUserSettings] = useState<BriefingSchedule | undefined>(undefined);
  const [userTimezone, setUserTimezone] = useState<string>("Asia/Taipei");
  const [currentLocalHour, setCurrentLocalHour] = useState<number>(new Date().getHours());

  const briefing = activeTab === "MORNING" ? morningBriefing : eveningBriefing;

  // Count stats for the header button
  const todayPlanItems = plan?.items.filter((i) => !i.completed && i.status === "today") ?? [];
  const completedPlanItems = plan?.items.filter((i) => i.completed) ?? [];
  const totalPlanItems = plan?.items.filter((i) => i.status === "today").length ?? 0;

  const loadBriefings = useCallback(async () => {
    try {
      setIsLoadingBriefing(true);
      setError(null);
      const [morningRes, eveningRes] = await Promise.allSettled([
        API.coach.getLatestBriefing({ type: "MORNING" }),
        API.coach.getLatestBriefing({ type: "EVENING" }),
      ]);

      const m = morningRes.status === "fulfilled" ? morningRes.value?.briefing || null : null;
      const e = eveningRes.status === "fulfilled" ? eveningRes.value?.briefing || null : null;
      setMorningBriefing(m);
      setEveningBriefing(e);

      const lastSeen = getLastSeenId();
      const newestId = e?.id || m?.id;
      if (newestId && lastSeen !== newestId) {
        setHasUnread(true);
        setShowBubble(true);
        bubbleTimerRef.current = setTimeout(() => setShowBubble(false), 6000);
      }
    } catch (err: any) {
      console.error("[Today] Failed to load briefings:", err);
      setError(err?.message || "Failed to load briefings");
    } finally {
      setIsLoadingBriefing(false);
    }
  }, []);

  const loadPlan = useCallback(async () => {
    setIsLoadingPlan(true);
    try {
      const res = (await API.coach.plan.get()) as any;
      if (res?.plan) {
        setPlan(res.plan);
      }
    } catch {
      // no plan yet
    } finally {
      setIsLoadingPlan(false);
    }
  }, []);

  // Load user settings
  useEffect(() => {
    async function loadUserSettings() {
      try {
        const response = await API.users.me();
        const settings = response.user?.settings?.briefingSchedule;
        const timezone = response.user?.timezone || "Asia/Taipei";
        setUserSettings(settings);
        setUserTimezone(timezone);
        setCurrentLocalHour(getCurrentLocalHour(timezone));
      } catch {
        setUserTimezone("Asia/Taipei");
        setCurrentLocalHour(new Date().getHours());
      }
    }
    loadUserSettings();
  }, []);

  // Update local hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLocalHour(getCurrentLocalHour(userTimezone));
    }, 60000);
    return () => clearInterval(interval);
  }, [userTimezone]);

  // Initial load
  useEffect(() => {
    loadBriefings();
    loadPlan();
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [loadBriefings, loadPlan]);

  // 🔔 監聽新增 task 和更新 due_date 事件，重新載入 plan
  useEffect(() => {
    const handlePlanUpdate = () => {
      console.log('[TodayOverview] Plan update event received, reloading plan + briefings...');
      loadPlan();
      loadBriefings();
    };

    window.addEventListener('task-created', handlePlanUpdate);
    window.addEventListener('plan-updated', handlePlanUpdate);

    return () => {
      window.removeEventListener('task-created', handlePlanUpdate);
      window.removeEventListener('plan-updated', handlePlanUpdate);
    };
  }, [loadPlan]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
    setShowBubble(false);
    const newestId = eveningBriefing?.id || morningBriefing?.id;
    if (newestId) setLastSeenId(newestId);
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      const result = await API.coach.generateBriefing({
        type: activeTab,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const b = result?.briefing || null;
      if (activeTab === "MORNING") setMorningBriefing(b);
      else setEveningBriefing(b);
      if (b) setLastSeenId(b.id);
      setHasUnread(false);
      // Also reload plan since generateBriefing creates plan too
      await loadPlan();
    } catch (err: any) {
      console.error("[Today] Failed to generate:", err);
      setError(err?.message || "生成失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const shouldShowGenerateButton = useCallback(
    (type: "MORNING" | "EVENING") => {
      const inWindow = isInBriefingWindow(type, userSettings, currentLocalHour);
      if (!inWindow) return false;
      const existingBriefing = type === "MORNING" ? morningBriefing : eveningBriefing;
      if (!existingBriefing) return true;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const briefingDate = existingBriefing.briefing_date.split("T")[0];
      if (briefingDate === today) return false;
      return true;
    },
    [userSettings, currentLocalHour, morningBriefing, eveningBriefing]
  );

  // Alert count for badge
  const alertCount =
    (morningBriefing
      ? morningBriefing.overdue_tasks.length + morningBriefing.conflicts.length
      : 0) +
    (eveningBriefing
      ? eveningBriefing.overdue_tasks.length + eveningBriefing.conflicts.length
      : 0);

  const isLoading = isLoadingBriefing;

  // Header button label
  const buttonLabel = `今日 ${completedPlanItems.length}/${totalPlanItems || "—"}`;

  return (
    <>
      {/* Header button */}
      <div className="relative">
        <button
          onClick={handleOpen}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
          title="今日概覽"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-sm text-amber-400 font-medium">{buttonLabel}</span>

          {/* Unread badge */}
          {hasUnread && !isLoading && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 items-center justify-center">
                {alertCount > 0 && (
                  <span className="text-[8px] font-bold text-white">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </span>
            </span>
          )}
        </button>

        {/* Speech bubble */}
        {showBubble && !isLoading && (
          <button
            onClick={() => {
              setShowBubble(false);
              handleOpen();
            }}
            className="absolute top-full right-0 mt-2 animate-in fade-in slide-in-from-top-2 duration-300 px-3 py-1.5 rounded-lg bg-indigo-500/90 backdrop-blur-sm text-white text-xs font-medium shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors whitespace-nowrap z-50"
          >
            新簡報已產生
          </button>
        )}
      </div>

      {/* Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[460px] sm:max-w-[460px] bg-white dark:bg-[#0f1729] border-slate-200 dark:border-white/10 p-0 flex flex-col"
        >
          <SheetTitle className="sr-only">今日概覽</SheetTitle>
          <SheetDescription className="sr-only">今日態勢摘要與計畫</SheetDescription>

          <TodaySheetContent
            briefing={briefing}
            morningBriefing={morningBriefing}
            eveningBriefing={eveningBriefing}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isLoadingBriefing={isLoadingBriefing}
            isLoadingPlan={isLoadingPlan}
            isGenerating={isGenerating}
            error={error}
            onGenerate={handleGenerate}
            onRefresh={() => {
              loadBriefings();
              loadPlan();
            }}
            shouldShowGenerateButton={shouldShowGenerateButton}
            plan={plan}
            setPlan={setPlan}
            completingItems={completingItems}
            setCompletingItems={setCompletingItems}
            onCompleteTask={onCompleteTask}
            onOpenTask={onOpenTask}
            loadPlan={loadPlan}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

// ============================================================================
// Sheet Content
// ============================================================================

function TodaySheetContent({
  briefing,
  morningBriefing,
  eveningBriefing,
  activeTab,
  onTabChange,
  isLoadingBriefing,
  isLoadingPlan,
  isGenerating,
  error,
  onGenerate,
  onRefresh,
  shouldShowGenerateButton,
  plan,
  setPlan,
  completingItems,
  setCompletingItems,
  onCompleteTask,
  onOpenTask,
  loadPlan,
}: {
  briefing: BriefingData | null;
  morningBriefing: BriefingData | null;
  eveningBriefing: BriefingData | null;
  activeTab: "MORNING" | "EVENING";
  onTabChange: (tab: "MORNING" | "EVENING") => void;
  isLoadingBriefing: boolean;
  isLoadingPlan: boolean;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  onRefresh: () => void;
  shouldShowGenerateButton: (type: "MORNING" | "EVENING") => boolean;
  plan: DailyPlan | null;
  setPlan: React.Dispatch<React.SetStateAction<DailyPlan | null>>;
  completingItems: Set<string>;
  setCompletingItems: React.Dispatch<React.SetStateAction<Set<string>>>;
  onCompleteTask: (taskId: string) => void;
  onOpenTask?: (taskId: string, subTaskId?: string | null) => void;
  loadPlan: () => Promise<void>;
}) {
  const [expandedReport, setExpandedReport] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "";
    }
  };

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}（${"日一二三四五六"[today.getDay()]}）`;

  // ---- Header ----
  const header = (
    <div className="border-b border-slate-200 dark:border-white/5">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <Sun className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">今日概覽</h2>
          <p className="text-xs text-slate-500 dark:text-white/40">{dateStr}</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="p-1.5 rounded-lg text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/10 transition-all disabled:opacity-50"
          title="重新生成"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="px-5 flex gap-1">
        <button
          onClick={() => onTabChange("MORNING")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
            activeTab === "MORNING"
              ? "bg-amber-50 dark:bg-white/5 text-amber-700 dark:text-amber-300 border-b-2 border-amber-500 dark:border-amber-400"
              : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60"
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          早
          {morningBriefing && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />}
        </button>
        <button
          onClick={() => onTabChange("EVENING")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
            activeTab === "EVENING"
              ? "bg-indigo-50 dark:bg-white/5 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500 dark:border-indigo-400"
              : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60"
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          晚
          {eveningBriefing && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />}
        </button>
      </div>
    </div>
  );

  // ---- Loading ----
  if (isLoadingBriefing) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500 dark:text-amber-400 mx-auto" />
            <p className="text-sm text-slate-500 dark:text-white/40">載入中...</p>
          </div>
        </div>
      </>
    );
  }

  // ---- Error ----
  if (error && !briefing) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400 mx-auto" />
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            <button
              onClick={onRefresh}
              className="text-sm text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white underline"
            >
              重試
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---- Empty: no briefing ----
  if (!briefing) {
    const shouldShow = shouldShowGenerateButton(activeTab);
    if (!shouldShow) {
      return (
        <>
          {header}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 text-slate-400 dark:text-white/30" />
              </div>
              <p className="text-sm text-slate-500 dark:text-white/40">
                目前不在 {activeTab === "MORNING" ? "晨報" : "晚報"} 觀看時間內
              </p>
              <p className="text-xs text-slate-400 dark:text-white/30">
                可至「設定」調整時間窗口
              </p>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-700 dark:text-white/70">尚未生成今日簡報</p>
              <p className="text-xs text-slate-500 dark:text-white/40">讓教練幫你整理今天的狀況</p>
            </div>
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? "生成中..." : "生成今日概覽"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---- Main Content ----
  const isOutdated = (() => {
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const briefingDate = briefing.briefing_date.split("T")[0];
    return briefingDate !== todayDate;
  })();

  const hasConflicts = briefing.conflicts.length > 0;
  const hasOverdue = briefing.overdue_tasks.length > 0;
  const hasStagnation = briefing.stagnations.length > 0;
  const hasApproaching = briefing.approaching_tasks.length > 0;
  const hasDefer = briefing.defer_suggestions.length > 0;
  const hasCalendar = briefing.calendar_events.length > 0;
  const hasTomorrow = briefing.tomorrow_preview.length > 0;

  // Calculate total meeting time
  const totalMeetingMinutes = briefing.calendar_events.reduce((sum, evt) => {
    try {
      const start = new Date(evt.start_date_time).getTime();
      const end = new Date(evt.end_date_time).getTime();
      return sum + (end - start) / 60000;
    } catch {
      return sum;
    }
  }, 0);
  const meetingHours = Math.floor(totalMeetingMinutes / 60);
  const meetingMins = Math.round(totalMeetingMinutes % 60);

  return (
    <>
      {header}

      <div className="flex-1 overflow-y-auto">
        {/* Outdated banner */}
        {isOutdated && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
              這是 {briefing.briefing_date.split("T")[0]} 的簡報
            </p>
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {isGenerating ? "生成中..." : "產生今日概覽"}
            </button>
          </div>
        )}

        {/* ====== 態勢摘要區 ====== */}
        <div className="px-5 py-4">
          {/* Summary bubble */}
          <div className="bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-sm p-4 border border-slate-300 dark:border-white/5 shadow-sm dark:shadow-none">
            <p className="text-sm text-slate-800 dark:text-white/85 leading-relaxed">
              {briefing.summary}
            </p>
          </div>

          {/* Alert badges (晚報不顯示焦慮性 badges) */}
          {activeTab === "MORNING" && (hasConflicts || hasOverdue || hasStagnation || hasCalendar) && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {hasOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-500/20">
                  <Clock className="w-3 h-3" />
                  {briefing.overdue_tasks.length} 逾期
                </span>
              )}
              {hasConflicts && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  {briefing.conflicts.length} 衝突
                </span>
              )}
              {hasStagnation && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-500/20">
                  <TrendingDown className="w-3 h-3" />
                  {briefing.stagnations.length} 停滯
                </span>
              )}
              {hasCalendar && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/20">
                  <Calendar className="w-3 h-3" />
                  {briefing.calendar_events.length} 場會議
                  {totalMeetingMinutes > 0 && (
                    <span>（{meetingHours > 0 ? `${meetingHours}h` : ""}{meetingMins > 0 ? `${meetingMins}m` : ""}）</span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Expand full report (晚報直接展開) */}
          {activeTab === "MORNING" && (
            <button
              onClick={() => setExpandedReport(!expandedReport)}
              className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-colors"
            >
              {expandedReport ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expandedReport ? "收合完整報告" : "展開完整報告"}
            </button>
          )}
        </div>

        {/* ====== 展開的完整報告（晨報需點擊展開，晚報直接展開） ====== */}
        {(activeTab === "EVENING" || expandedReport) && (
          <div className="border-t border-slate-200 dark:border-white/5">
            {/* Recommendations */}
            {briefing.recommendations.length > 0 && (
              <div className="px-5 py-4">
                <h3 className="text-xs font-medium text-slate-500 dark:text-white/40 uppercase tracking-wider mb-2.5">
                  下一步行動
                </h3>
                <div className="space-y-2">
                  {briefing.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex gap-3 p-3 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-300 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors shadow-sm dark:shadow-none"
                    >
                      <span
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          rec.priority === 1
                            ? "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-500/30"
                            : rec.priority === 2
                            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                            : "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                        }`}
                      >
                        {rec.priority}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 dark:text-white/80 leading-snug font-medium">{rec.action}</p>
                        <p className="text-xs text-slate-600 dark:text-white/35 mt-1">{rec.reasoning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible detail sections */}
            <div className="border-t border-slate-200 dark:border-white/5">
              {activeTab === "MORNING" && (
                <div className="px-5 pt-3 pb-1">
                  <h3 className="text-xs font-medium text-slate-400 dark:text-white/30 uppercase tracking-wider">
                    詳細資訊
                  </h3>
                </div>
              )}

              {hasCalendar && (
                <CollapsibleSection
                  title="今日行事曆"
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  count={briefing.calendar_events.length}
                  isExpanded={expandedSections.has("calendar")}
                  onToggle={() => toggleSection("calendar")}
                >
                  <div className="space-y-1.5">
                    {briefing.calendar_events.map((evt) => (
                      <div key={evt.id} className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 dark:text-white/40 text-xs font-mono w-[90px] shrink-0">
                          {formatTime(evt.start_date_time)}-{formatTime(evt.end_date_time)}
                        </span>
                        <span className="text-slate-700 dark:text-white/70 truncate">{evt.summary}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {hasOverdue && (
                <CollapsibleSection
                  title="逾期任務"
                  icon={<Clock className="w-3.5 h-3.5 text-orange-400" />}
                  count={briefing.overdue_tasks.length}
                  isExpanded={expandedSections.has("overdue")}
                  onToggle={() => toggleSection("overdue")}
                  accentColor="text-orange-300"
                >
                  <div className="space-y-1.5">
                    {briefing.overdue_tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-700 dark:text-white/70 truncate">{task.content}</span>
                        <span className="text-orange-400/80 text-xs shrink-0">-{task.days_overdue}d</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {hasApproaching && activeTab === "MORNING" && (
                <CollapsibleSection
                  title="即將到期"
                  icon={<ArrowRight className="w-3.5 h-3.5 text-amber-400" />}
                  count={briefing.approaching_tasks.length}
                  isExpanded={expandedSections.has("approaching")}
                  onToggle={() => toggleSection("approaching")}
                  accentColor="text-amber-300"
                >
                  <div className="space-y-1.5">
                    {briefing.approaching_tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-700 dark:text-white/70 truncate">{task.content}</span>
                        <span className="text-amber-400/80 text-xs shrink-0">{task.days_remaining}d</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {hasConflicts && (
                <CollapsibleSection
                  title="衝突"
                  icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                  count={briefing.conflicts.length}
                  isExpanded={expandedSections.has("conflicts")}
                  onToggle={() => toggleSection("conflicts")}
                  accentColor="text-red-300"
                >
                  <div className="space-y-1.5">
                    {briefing.conflicts.map((conflict, i) => (
                      <p key={i} className="text-sm text-slate-700 dark:text-white/70">{conflict.description}</p>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {hasStagnation && activeTab === "MORNING" && (
                <CollapsibleSection
                  title="停滯警告"
                  icon={<TrendingDown className="w-3.5 h-3.5 text-yellow-400" />}
                  count={briefing.stagnations.length}
                  isExpanded={expandedSections.has("stagnation")}
                  onToggle={() => toggleSection("stagnation")}
                  accentColor="text-yellow-300"
                >
                  <div className="space-y-2">
                    {briefing.stagnations.map((stag, i) => (
                      <StagnationItemRow key={i} stag={stag} />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {hasDefer && (
                <CollapsibleSection
                  title="延後建議"
                  icon={<Clock className="w-3.5 h-3.5" />}
                  count={briefing.defer_suggestions.length}
                  isExpanded={expandedSections.has("defer")}
                  onToggle={() => toggleSection("defer")}
                >
                  <div className="space-y-2">
                    {briefing.defer_suggestions.map((ds, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              ds.suggested_action === "archive"
                                ? "bg-slate-500/20 text-slate-300"
                                : ds.suggested_action === "delegate"
                                ? "bg-purple-500/20 text-purple-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {ds.suggested_action === "defer"
                              ? "延後"
                              : ds.suggested_action === "archive"
                              ? "歸檔"
                              : "委派"}
                          </span>
                          <span className="text-slate-700 dark:text-white/70 truncate">{ds.task_content}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5 ml-12">{ds.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {hasTomorrow && (
                <CollapsibleSection
                  title="明日預覽"
                  icon={<Sun className="w-3.5 h-3.5 text-amber-400" />}
                  count={briefing.tomorrow_preview.length}
                  isExpanded={expandedSections.has("tomorrow")}
                  onToggle={() => toggleSection("tomorrow")}
                  accentColor="text-amber-300"
                >
                  <div className="space-y-1.5">
                    {briefing.tomorrow_preview.map((evt) => (
                      <div key={evt.id} className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 dark:text-white/40 text-xs font-mono w-[90px] shrink-0">
                          {formatTime(evt.start_date_time)}-{formatTime(evt.end_date_time)}
                        </span>
                        <span className="text-slate-700 dark:text-white/70 truncate">{evt.summary}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          </div>
        )}

        {/* ====== 今日計畫區（晨報顯示完整計畫，晚報只顯示已完成） ====== */}
        <div className="border-t border-slate-200 dark:border-white/5">
          {activeTab === "MORNING" ? (
            <PlanSection
              plan={plan}
              setPlan={setPlan}
              isLoading={isLoadingPlan}
              completingItems={completingItems}
              setCompletingItems={setCompletingItems}
              onCompleteTask={onCompleteTask}
              onOpenTask={onOpenTask}
              loadPlan={loadPlan}
            />
          ) : (
            <EveningCompletedSection
              plan={plan}
            />
          )}
        </div>

        <div className="h-4" />
      </div>

      {/* Footer */}
      {isGenerating && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            重新生成中...
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Evening Completed Section (晚報只顯示已完成，不顯示待辦)
// ============================================================================

function EveningCompletedSection({
  plan,
}: {
  plan: DailyPlan | null;
}) {
  const completedItems = plan?.items.filter((i) => i.completed && i.status === "today") ?? [];
  const totalCompleted = completedItems.length;

  if (totalCompleted === 0) {
    return (
      <div className="px-5 py-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-white/20 mx-auto mb-2" />
        <p className="text-sm text-slate-500 dark:text-white/40">今天辛苦了，好好休息</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-slate-500 dark:text-white/40 uppercase tracking-wider">
          今日成果
        </h3>
        <span className="text-[10px] text-slate-400 dark:text-white/30 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full">
          {totalCompleted}
        </span>
      </div>
      <ul className="space-y-0.5">
        {completedItems.map((item) => (
          <li key={item.id} className="flex items-start gap-2 py-1">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
            <p className="text-sm text-slate-600 dark:text-white/60 truncate">{item.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Plan Section (with DnD)
// ============================================================================

function PlanSection({
  plan,
  setPlan,
  isLoading,
  completingItems,
  setCompletingItems,
  onCompleteTask,
  onOpenTask,
  loadPlan,
}: {
  plan: DailyPlan | null;
  setPlan: React.Dispatch<React.SetStateAction<DailyPlan | null>>;
  isLoading: boolean;
  completingItems: Set<string>;
  setCompletingItems: React.Dispatch<React.SetStateAction<Set<string>>>;
  onCompleteTask: (taskId: string) => void;
  onOpenTask?: (taskId: string, subTaskId?: string | null) => void;
  loadPlan: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const todayItems = plan?.items.filter((i) => !i.completed && i.status === "today").sort((a, b) => a.order - b.order) ?? [];
  const overflowItems = plan?.items.filter((i) => !i.completed && i.status === "overflow").sort((a, b) => a.order - b.order) ?? [];
  const completedItems = plan?.items.filter((i) => i.completed && i.status === "today") ?? [];

  // Capacity note
  const capacityNote = plan?.capacity_note;

  const handleCompleteItem = async (item: PlanItem) => {
    setCompletingItems((prev) => new Set(prev).add(item.id));
    try {
      await API.coach.plan.updateItem(item.id, { completed: true });
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) => (i.id === item.id ? { ...i, completed: true } : i)),
        };
      });
      if (item.task_id) onCompleteTask(item.task_id);
      // Trigger plan + briefing reload via event
      window.dispatchEvent(new CustomEvent('plan-updated'));
    } catch {
      // ignore
    } finally {
      setCompletingItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;

    const allPending = [...todayItems, ...overflowItems];
    const draggedItem = allPending.find((i) => i.id === active.id);
    const targetItem = allPending.find((i) => i.id === over.id);
    if (!draggedItem || !targetItem) return;

    const fromSection = draggedItem.status;
    const toSection = targetItem.status;
    const isCrossSection = fromSection !== toSection;

    let updatedToday: PlanItem[];
    let updatedOverflow: PlanItem[];

    if (!isCrossSection) {
      if (fromSection === "today") {
        const oldIdx = todayItems.findIndex((i) => i.id === active.id);
        const newIdx = todayItems.findIndex((i) => i.id === over.id);
        updatedToday = arrayMove(todayItems, oldIdx, newIdx).map((item, idx) => ({ ...item, order: idx }));
        updatedOverflow = overflowItems;
      } else {
        const oldIdx = overflowItems.findIndex((i) => i.id === active.id);
        const newIdx = overflowItems.findIndex((i) => i.id === over.id);
        updatedToday = todayItems;
        updatedOverflow = arrayMove(overflowItems, oldIdx, newIdx).map((item, idx) => ({ ...item, order: todayItems.length + idx }));
      }
    } else {
      const movedItem = { ...draggedItem, status: toSection, user_adjusted: true };
      if (toSection === "today") {
        const targetIdx = todayItems.findIndex((i) => i.id === over.id);
        const newToday = [...todayItems];
        newToday.splice(targetIdx, 0, movedItem as PlanItem);
        updatedToday = newToday.map((item, idx) => ({ ...item, order: idx }));
        updatedOverflow = overflowItems.filter((i) => i.id !== draggedItem.id).map((item, idx) => ({ ...item, order: updatedToday.length + idx }));
      } else {
        const targetIdx = overflowItems.findIndex((i) => i.id === over.id);
        const newOverflow = [...overflowItems];
        newOverflow.splice(targetIdx, 0, movedItem as PlanItem);
        updatedToday = todayItems.filter((i) => i.id !== draggedItem.id).map((item, idx) => ({ ...item, order: idx }));
        updatedOverflow = newOverflow.map((item, idx) => ({ ...item, order: updatedToday.length + idx }));
      }
    }

    setPlan({ ...plan, items: [...updatedToday, ...updatedOverflow, ...completedItems] });

    try {
      const itemsToUpdate = [...updatedToday, ...updatedOverflow];
      await Promise.all(
        itemsToUpdate.map((item) => {
          const original = allPending.find((i) => i.id === item.id);
          const changed = original?.order !== item.order || original?.status !== item.status || (isCrossSection && item.id === draggedItem.id);
          if (!changed) return Promise.resolve();
          const updates: any = { order: item.order };
          if (isCrossSection && item.id === draggedItem.id) {
            updates.status = item.status;
            updates.user_adjusted = true;
          }
          return API.coach.plan.updateItem(item.id, updates);
        })
      );
    } catch {
      loadPlan();
    }
  };

  const activeItem = activeId ? [...todayItems, ...overflowItems].find((i) => i.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="px-5 py-6 flex justify-center">
        <Loader2 className="w-5 h-5 text-slate-400 dark:text-white/40 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="px-5 py-6 text-center">
        <ListTodo className="w-8 h-8 text-slate-300 dark:text-white/20 mx-auto mb-2" />
        <p className="text-sm text-slate-500 dark:text-white/40">生成簡報後自動產生計畫</p>
      </div>
    );
  }

  return (
    <>
      {/* Section header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-500 dark:text-white/40 uppercase tracking-wider">
          今日計畫
        </h3>
        {capacityNote && (
          <span className="text-xs text-slate-400 dark:text-white/30">{capacityNote}</span>
        )}
      </div>

      {plan.coach_message && (
        <div className="mx-5 mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/10">
          <p className="text-xs text-blue-600 dark:text-blue-300/80">{plan.coach_message}</p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Today items - 今日區塊加上邊框 */}
        <div className="mx-5 mb-3">
          <div className="rounded-lg border-2 border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/5 p-3">
            {todayItems.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-white/40 py-2">所有任務已完成！</p>
            ) : (
              <SortableContext items={todayItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-0.5">
                  {todayItems.map((item, idx) => (
                    <SortablePlanItem
                      key={item.id}
                      item={item}
                      idx={idx}
                      section="today"
                      isCompleting={completingItems.has(item.id)}
                      onComplete={handleCompleteItem}
                      onOpenTask={onOpenTask}
                    />
                  ))}
                </ul>
              </SortableContext>
            )}
          </div>
        </div>

        {/* Capacity line + Overflow */}
        {overflowItems.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 border-t border-dashed border-slate-300 dark:border-white/10" />
              <span className="text-xs text-slate-500 dark:text-white/50 font-medium flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" />
                明後天的代辦事項
              </span>
              <div className="flex-1 border-t border-dashed border-slate-300 dark:border-white/10" />
            </div>
            <SortableContext items={overflowItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {overflowItems.map((item, idx) => (
                  <SortablePlanItem
                    key={item.id}
                    item={item}
                    idx={todayItems.length + idx}
                    section="overflow"
                    isCompleting={completingItems.has(item.id)}
                    onComplete={handleCompleteItem}
                    onOpenTask={onOpenTask}
                  />
                ))}
              </ul>
            </SortableContext>
          </div>
        )}

        <DragOverlay>
          {activeItem ? (
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2 shadow-xl border border-gray-200 dark:border-white/20">
              <p className="text-sm text-gray-700 dark:text-white/80 truncate">
                {activeItem.product_name && <span className="text-gray-400 dark:text-white/40">[{activeItem.product_name}] </span>}
                {activeItem.content}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Today's completed items — 只從 plan 計算 */}
      {completedItems.length > 0 && (
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 dark:text-white/30">今日已完成</span>
            <span className="text-[10px] text-slate-400 dark:text-white/30 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full">
              {completedItems.length}
            </span>
          </div>
          <ul className="space-y-0.5">
            {completedItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2 py-1">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                <p className="text-sm text-slate-400 dark:text-white/40 line-through truncate">{item.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer hint */}
      <div className="px-5 py-2">
        <p className="text-[10px] text-slate-400 dark:text-white/25 text-center">
          拖拽可在「今日」與「明後天」區域之間移動
        </p>
      </div>
    </>
  );
}

// ============================================================================
// SortablePlanItem
// ============================================================================

function SortablePlanItem({
  item,
  idx,
  isCompleting,
  onComplete,
  onOpenTask,
  section,
}: {
  item: PlanItem;
  idx: number;
  isCompleting: boolean;
  onComplete: (item: PlanItem) => void;
  onOpenTask?: (taskId: string, subTaskId?: string | null) => void;
  section: "today" | "overflow";
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { section },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isOverflow = section === "overflow";

  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-2 py-1.5 group">
      <div
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing p-0.5 text-gray-300 group-hover:text-gray-400 dark:text-white/20 dark:group-hover:text-white/40 transition-colors"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      <button
        onClick={() => onComplete(item)}
        disabled={isCompleting}
        className="mt-0.5 shrink-0 text-gray-400 hover:text-green-500 dark:text-white/30 dark:hover:text-green-400 transition-colors disabled:opacity-50"
      >
        {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Circle className="w-4 h-4" />}
      </button>
      <button
        onClick={() => onOpenTask?.(item.task_id, item.sub_task_id)}
        className="min-w-0 flex-1 text-left hover:bg-gray-100 dark:hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
      >
        <p className={`text-sm truncate ${isOverflow ? "text-gray-400 dark:text-white/50" : "text-gray-700 dark:text-white/80"}`}>
          <span className="text-gray-400 dark:text-white/40 mr-1">{idx + 1}.</span>
          {item.product_name && <span className="text-gray-400 dark:text-white/30">[{item.product_name}] </span>}
          {item.content}
        </p>
        {item.user_adjusted && (
          <span className="text-[10px] text-blue-500/60 dark:text-blue-400/60 ml-5">手動調整</span>
        )}
      </button>
      {item.estimated_minutes && (
        <span className="shrink-0 flex items-center gap-1 text-xs text-gray-400 dark:text-white/30">
          <Clock className="w-3 h-3" />
          {item.estimated_minutes}m
        </span>
      )}
    </li>
  );
}

// ============================================================================
// Stagnation Item
// ============================================================================

function StagnationItemRow({ stag }: { stag: StagnationItem }) {
  const [showDateInput, setShowDateInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSetDate = async (field: "start_date" | "due_date", value: string) => {
    if (!value || stag.type !== "stuck_task") return;
    try {
      setIsSaving(true);
      await API.tasks.update(stag.entity_id, {
        [field === "start_date" ? "startDate" : "dueDate"]: value,
      });
      setShowDateInput(false);
    } catch (err) {
      console.error("[Today] Failed to update task date:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const isSubTask = stag.type === "stuck_subtask";

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {isSubTask ? (
            <>
              <p className="text-slate-700 dark:text-white/70 truncate">{stag.parent_task_content}</p>
              <p className="text-xs text-slate-600 dark:text-white/50 truncate ml-3">
                └─ {stag.entity_name}（已開始 {stag.days_inactive} 天）
              </p>
            </>
          ) : (
            <>
              <p className="text-slate-700 dark:text-white/70 truncate">{stag.entity_name}</p>
              <p className="text-xs text-slate-500 dark:text-white/40">
                {stag.area_name} - {stag.days_inactive} 天未更新
              </p>
            </>
          )}
        </div>
        {stag.type === "stuck_task" && (
          <button
            onClick={() => setShowDateInput(!showDateInput)}
            className="shrink-0 p-1 rounded text-slate-400 dark:text-white/30 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title="設定日期"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {showDateInput && (
        <div className="mt-1.5 ml-0 flex gap-2 items-center">
          <label className="text-[10px] text-slate-400 dark:text-white/30">截止日</label>
          <input
            type="date"
            disabled={isSaving}
            onChange={(e) => handleSetDate("due_date", e.target.value)}
            className="text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-white/70 disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Collapsible Section
// ============================================================================

function CollapsibleSection({
  title,
  icon,
  count,
  isExpanded,
  onToggle,
  children,
  accentColor = "text-slate-500 dark:text-white/60",
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-5 py-2 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-slate-400 dark:text-white/30" />
        ) : (
          <ChevronRight className="w-3 h-3 text-slate-400 dark:text-white/30" />
        )}
        <span className={accentColor}>{icon}</span>
        <span className={`text-xs font-medium ${accentColor}`}>{title}</span>
        <span className="text-[10px] text-slate-400 dark:text-white/30 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full ml-auto">
          {count}
        </span>
      </button>
      {isExpanded && <div className="px-5 pb-3 pl-10">{children}</div>}
    </div>
  );
}
