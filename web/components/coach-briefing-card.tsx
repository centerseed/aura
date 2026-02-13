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
  TrendingDown,
  Loader2,
  Sparkles,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { API } from "@/lib/api-client";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

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
// Main Export: CoachAgent (FAB + Drawer)
// ============================================================================

export function CoachAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [morningBriefing, setMorningBriefing] = useState<BriefingData | null>(null);
  const [eveningBriefing, setEveningBriefing] = useState<BriefingData | null>(null);
  const [activeTab, setActiveTab] = useState<"MORNING" | "EVENING">(
    new Date().getHours() < 14 ? "MORNING" : "EVENING"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const briefing = activeTab === "MORNING" ? morningBriefing : eveningBriefing;

  const loadBriefings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Load both morning and evening in parallel
      const [morningRes, eveningRes] = await Promise.allSettled([
        API.coach.getLatestBriefing({ type: "MORNING" }),
        API.coach.getLatestBriefing({ type: "EVENING" }),
      ]);

      const m = morningRes.status === "fulfilled" ? morningRes.value?.briefing || null : null;
      const e = eveningRes.status === "fulfilled" ? eveningRes.value?.briefing || null : null;
      setMorningBriefing(m);
      setEveningBriefing(e);

      // Check unread: either one is new
      const lastSeen = getLastSeenId();
      const newestId = e?.id || m?.id;
      if (newestId && lastSeen !== newestId) {
        setHasUnread(true);
        setShowBubble(true);
        bubbleTimerRef.current = setTimeout(() => setShowBubble(false), 6000);
      }
    } catch (err: any) {
      console.error("[Coach] Failed to load briefings:", err);
      setError(err?.message || "Failed to load briefings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefings();
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [loadBriefings]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
    setShowBubble(false);
    const newestId = eveningBriefing?.id || morningBriefing?.id;
    if (newestId) setLastSeenId(newestId);
  };

  const handleGenerate = async (type: "MORNING" | "EVENING") => {
    try {
      setIsGenerating(true);
      setError(null);
      const result = await API.coach.generateBriefing({ type });
      const b = result?.briefing || null;
      if (type === "MORNING") setMorningBriefing(b);
      else setEveningBriefing(b);
      if (b) setLastSeenId(b.id);
      setHasUnread(false);
    } catch (err: any) {
      console.error("[Coach] Failed to generate briefing:", err);
      setError(err?.message || "Failed to generate briefing");
    } finally {
      setIsGenerating(false);
    }
  };

  const isMorning = new Date().getHours() < 14;
  const newestBriefing = eveningBriefing || morningBriefing;
  const briefingLabel = newestBriefing
    ? newestBriefing.type === "MORNING" ? "晨報" : "晚報"
    : isMorning ? "晨報" : "晚報";

  // Count alerts across both briefings
  const alertCount = (morningBriefing
    ? morningBriefing.overdue_tasks.length + morningBriefing.conflicts.length
    : 0) + (eveningBriefing
    ? eveningBriefing.overdue_tasks.length + eveningBriefing.conflicts.length
    : 0);

  return (
    <>
      {/* Header inline button with bubble */}
      <div className="relative">
        <button
          onClick={handleOpen}
          className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
          title="營運顧問"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <MessageCircle className="w-5 h-5" />
          )}

          {/* Badge */}
          {hasUnread && !isLoading && (
            <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 items-center justify-center">
                {alertCount > 0 && (
                  <span className="text-[8px] font-bold text-white">{alertCount > 9 ? "9+" : alertCount}</span>
                )}
              </span>
            </span>
          )}
        </button>

        {/* Speech bubble - drops down from button */}
        {showBubble && !isLoading && (
          <button
            onClick={() => { setShowBubble(false); handleOpen(); }}
            className="absolute top-full right-0 mt-2 animate-in fade-in slide-in-from-top-2 duration-300 px-3 py-1.5 rounded-lg bg-indigo-500/90 backdrop-blur-sm text-white text-xs font-medium shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors whitespace-nowrap z-50"
          >
            {briefingLabel}已產生
          </button>
        )}
      </div>

      {/* Drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[420px] sm:max-w-[420px] bg-white dark:bg-[#0f1729] border-slate-200 dark:border-white/10 p-0 flex flex-col"
        >
          <SheetTitle className="sr-only">營運顧問簡報</SheetTitle>
          <SheetDescription className="sr-only">AI 營運顧問的每日簡報與建議</SheetDescription>

          <CoachDrawerContent
            briefing={briefing}
            morningBriefing={morningBriefing}
            eveningBriefing={eveningBriefing}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isLoading={isLoading}
            isGenerating={isGenerating}
            error={error}
            isMorning={isMorning}
            onGenerate={handleGenerate}
            onRefresh={loadBriefings}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

// Keep old export name for backward compatibility during migration
export const CoachBriefingCard = CoachAgent;

// ============================================================================
// Drawer Content
// ============================================================================

function CoachDrawerContent({
  briefing,
  morningBriefing,
  eveningBriefing,
  activeTab,
  onTabChange,
  isLoading,
  isGenerating,
  error,
  isMorning,
  onGenerate,
  onRefresh,
}: {
  briefing: BriefingData | null;
  morningBriefing: BriefingData | null;
  eveningBriefing: BriefingData | null;
  activeTab: "MORNING" | "EVENING";
  onTabChange: (tab: "MORNING" | "EVENING") => void;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  isMorning: boolean;
  onGenerate: (type: "MORNING" | "EVENING") => void;
  onRefresh: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

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

  // ---- Header with tabs ----
  const header = (
    <div className="border-b border-slate-200 dark:border-white/5">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">營運顧問</h2>
          <p className="text-xs text-slate-500 dark:text-white/40">
            {briefing ? briefing.briefing_date : "每日簡報"}
          </p>
        </div>
        <button
          onClick={() => onGenerate(activeTab)}
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
          晨報
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
          晚報
          {eveningBriefing && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />}
        </button>
      </div>
    </div>
  );

  // ---- Loading ----
  if (isLoading) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500 dark:text-indigo-400 mx-auto" />
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

  // ---- Empty ----
  if (!briefing) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-700 dark:text-white/70">尚未生成今日簡報</p>
              <p className="text-xs text-slate-500 dark:text-white/40">讓教練幫你整理今天的狀況</p>
            </div>
            <button
              onClick={() => onGenerate(activeTab)}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? "生成中..." : `生成${activeTab === "MORNING" ? "晨報" : "晚報"}`}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---- Briefing Content ----
  const hasConflicts = briefing.conflicts.length > 0;
  const hasOverdue = briefing.overdue_tasks.length > 0;
  const hasStagnation = briefing.stagnations.length > 0;
  const hasApproaching = briefing.approaching_tasks.length > 0;
  const hasDefer = briefing.defer_suggestions.length > 0;
  const hasCalendar = briefing.calendar_events.length > 0;
  const hasTomorrow = briefing.tomorrow_preview.length > 0;

  return (
    <>
      {header}

      <div className="flex-1 overflow-y-auto">
        {/* Conversational Summary */}
        <div className="px-5 py-4">
          <div className="bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-sm p-4 border border-slate-300 dark:border-white/5 shadow-sm dark:shadow-none">
            <p className="text-sm text-slate-800 dark:text-white/85 leading-relaxed">
              {briefing.summary}
            </p>
          </div>
        </div>

        {/* Alert badges row */}
        {(hasConflicts || hasOverdue) && (
          <div className="px-5 pb-3 flex gap-2 flex-wrap">
            {hasOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-500/20 shadow-sm dark:shadow-none">
                <Clock className="w-3 h-3" />
                {briefing.overdue_tasks.length} 逾期
              </span>
            )}
            {hasConflicts && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-500/20 shadow-sm dark:shadow-none">
                <AlertTriangle className="w-3 h-3" />
                {briefing.conflicts.length} 衝突
              </span>
            )}
            {hasStagnation && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-500/20 shadow-sm dark:shadow-none">
                <TrendingDown className="w-3 h-3" />
                {briefing.stagnations.length} 停滯
              </span>
            )}
          </div>
        )}

        {/* Top Actions (Recommendations) */}
        {briefing.recommendations.length > 0 && (
          <div className="px-5 pb-4">
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

        {/* Collapsible Detail Sections */}
        <div className="border-t border-slate-200 dark:border-white/5">
          <div className="px-5 pt-3 pb-1">
            <h3 className="text-xs font-medium text-slate-400 dark:text-white/30 uppercase tracking-wider">
              詳細資訊
            </h3>
          </div>

          {/* Calendar Events */}
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

          {/* Overdue Tasks */}
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
                    <span className="text-orange-400/80 text-xs shrink-0">
                      -{task.days_overdue}d
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Approaching Tasks */}
          {hasApproaching && (
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
                    <span className="text-amber-400/80 text-xs shrink-0">
                      {task.days_remaining}d
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Conflicts */}
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
                  <p key={i} className="text-sm text-slate-700 dark:text-white/70">
                    {conflict.description}
                  </p>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Stagnation */}
          {hasStagnation && (
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

          {/* Defer Suggestions (Evening) */}
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
                    <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5 ml-12">
                      {ds.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Tomorrow Preview */}
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

        {/* Bottom padding */}
        <div className="h-4" />
      </div>

      {/* Footer - generate button when briefing exists */}
      {isGenerating && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            重新生成中...
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Stagnation Item with Date Setting
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
      console.error("[Coach] Failed to update task date:", err);
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
// Collapsible Section Sub-component
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
