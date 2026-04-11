"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  Lightbulb,
  MapIcon,
  MessageSquareQuote,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InputType = "task" | "idea" | "discussion" | "insight" | "done";

type FlowItem = {
  id: string;
  type: InputType;
  text: string;
  area?: string;
  connectedTo?: string;
  energy?: "lift" | "drain" | "neutral";
  reflection?: string;
  // Insight-specific fields
  evidence?: string;
  framework?: string;
  time: string;
};

type DayData = {
  date: string; // "今天", "昨天", "3 天前"
  items: FlowItem[];
};

type MapNode = {
  id: string;
  label: string;
  area: string;
  x: number;
  y: number;
  energy: "bright" | "medium" | "dim" | "new";
};

type MapEdge = {
  from: string;
  to: string;
  isNew?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const FLOW_DATA: DayData[] = [
  {
    date: "今天",
    items: [
      {
        id: "f1",
        type: "task",
        text: "整理 Zentropy 首頁文案，想把價值講清楚。",
        area: "工作 / 品牌表達",
        connectedTo: "「別人看不懂我在做什麼」",
        time: "10:34",
      },
      {
        id: "f2",
        type: "done",
        text: "改完首頁 Hero",
        energy: "lift",
        reflection: "做完很順，但其實最有感的是把產品話講清楚，不是改字本身。",
        time: "09:50",
      },
      {
        id: "f4",
        type: "idea",
        text: "我其實更想做自己的作品，不想一直在改別人的東西。",
        area: "創作 / 個人作品",
        connectedTo: "本週第三次提到",
        time: "09:15",
      },
      {
        id: "f5",
        type: "done",
        text: "回覆合作提案",
        energy: "drain",
        reflection: "完成了，但能量偏低，像是在維持現狀。",
        time: "08:40",
      },
      {
        id: "f6",
        type: "insight",
        text: "你最近一直在講清楚產品，但幾乎沒有安排恢復注意力的空間。",
        evidence: "健康區連續 11 天零輸入，工作區佔本週輸入 54%。同時期完成的 3 個任務中，2 個標記為「消耗」。",
        framework: "生命之輪 — 沉默警報",
        time: "08:00",
      },
    ],
  },
  {
    date: "昨天",
    items: [
      {
        id: "f7",
        type: "done",
        text: "整理內容企劃",
        energy: "neutral",
        reflection: "中性，還需要更上游的定位來拉住方向。",
        time: "17:20",
      },
      {
        id: "f8",
        type: "idea",
        text: "品牌內容好像一直很空，不知道要寫什麼。",
        area: "創作",
        connectedTo: "「想做自己的作品」",
        time: "15:30",
      },
      {
        id: "f9",
        type: "task",
        text: "受眾分析：先搞清楚到底要打誰",
        area: "工作 / 品牌表達",
        time: "11:00",
      },
      {
        id: "f10",
        type: "discussion",
        text: "我要不要繼續接案，還是把接下來三個月拿去做產品？",
        area: "（新區域）決策",
        connectedTo: "收入壓力、作品 ownership、時間",
        time: "09:20",
      },
      {
        id: "f10b",
        type: "insight",
        text: "你每次提到「自己的作品」都特別有能量，但從來沒排時間做。",
        evidence: "本週 3 次提到創作相關想法，每次都伴隨高能量描述。但行事曆上零時間分配給這個方向。",
        framework: "好時光日誌 — 能量峰值",
        time: "08:00",
      },
    ],
  },
  {
    date: "3 天前",
    items: [
      {
        id: "f12",
        type: "done",
        text: "完成客戶交付",
        energy: "drain",
        reflection: "別人看不懂我在做什麼，我自己好像也講不太清楚。",
        time: "18:00",
      },
      {
        id: "f13",
        type: "idea",
        text: "週末想留下時間寫自己的東西。",
        area: "創作",
        connectedTo: "「想做自己的作品」",
        time: "12:30",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Project data                                                       */
/* ------------------------------------------------------------------ */

type ProjectTask = {
  id: string;
  text: string;
  done: boolean;
  overdue?: string;
  due?: string;
};

type Project = {
  id: string;
  name: string;
  priority: string;
  area: string;
  milestone?: string;
  tag: string;
  tasks: ProjectTask[];
};

const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "品牌重塑",
    priority: "P1",
    area: "工作",
    milestone: "Phase 1：定位收斂",
    tag: "品牌表達",
    tasks: [
      { id: "pt1", text: "整理首頁文案", done: false, overdue: "3 天" },
      { id: "pt2", text: "受眾分析", done: false },
      { id: "pt3", text: "競品研究", done: true },
      { id: "pt4", text: "定位一句話", done: false },
    ],
  },
  {
    id: "p2",
    name: "個人作品",
    priority: "P2",
    area: "創作",
    tag: "個人作品",
    tasks: [
      { id: "pt5", text: "整理作品點子", done: false },
      { id: "pt6", text: "寫一小段試試", done: true },
      { id: "pt7", text: "決定作品形式", done: false },
    ],
  },
  {
    id: "p3",
    name: "客戶案交付",
    priority: "P0",
    area: "工作",
    tag: "客戶",
    tasks: [
      { id: "pt8", text: "完成客戶交付", done: true },
      { id: "pt9", text: "回覆合作提案", done: true },
      { id: "pt10", text: "整理內容企劃", done: true },
      { id: "pt11", text: "客戶回饋跟進", done: false, due: "明天" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Map data                                                           */
/* ------------------------------------------------------------------ */

const MAP_NODES: MapNode[] = [
  { id: "n1", label: "首頁文案", area: "工作", x: 28, y: 30, energy: "new" },
  { id: "n2", label: "定位策略", area: "工作", x: 22, y: 38, energy: "bright" },
  { id: "n3", label: "別人看不懂", area: "工作", x: 15, y: 32, energy: "medium" },
  { id: "n4", label: "受眾分析", area: "工作", x: 32, y: 42, energy: "medium" },
  { id: "n5", label: "品牌內容", area: "工作", x: 20, y: 48, energy: "medium" },
  { id: "n6", label: "競品研究", area: "工作", x: 34, y: 52, energy: "dim" },
  { id: "n7", label: "客戶回饋", area: "工作", x: 26, y: 22, energy: "dim" },
  { id: "n9", label: "想做自己的作品", area: "創作", x: 72, y: 26, energy: "bright" },
  { id: "n10", label: "週末寫東西", area: "創作", x: 78, y: 34, energy: "medium" },
  { id: "n11", label: "品牌內容很空", area: "創作", x: 68, y: 36, energy: "medium" },
  { id: "n12", label: "合作提案", area: "關係", x: 14, y: 72, energy: "dim" },
  { id: "n13", label: "客戶關係", area: "關係", x: 22, y: 78, energy: "dim" },
  { id: "n14", label: "應該運動", area: "健康", x: 76, y: 74, energy: "dim" },
  { id: "n15", label: "接案 vs 產品", area: "決策", x: 50, y: 60, energy: "bright" },
];

const MAP_EDGES: MapEdge[] = [
  { from: "n1", to: "n2" },
  { from: "n1", to: "n3", isNew: true },
  { from: "n2", to: "n4" },
  { from: "n5", to: "n11" },
  { from: "n9", to: "n10" },
  { from: "n9", to: "n11" },
  { from: "n3", to: "n7" },
  { from: "n12", to: "n13" },
  { from: "n15", to: "n9" },
  { from: "n15", to: "n5" },
];

/* ------------------------------------------------------------------ */
/*  Visual helpers                                                     */
/* ------------------------------------------------------------------ */

const TYPE_STYLES: Record<InputType, { icon: typeof CheckCheck; label: string; accent: string; bg: string; border: string }> = {
  task: { icon: CheckCheck, label: "任務", accent: "text-emerald-300", bg: "bg-emerald-400/[0.06]", border: "border-emerald-400/15" },
  idea: { icon: Lightbulb, label: "想法", accent: "text-sky-300", bg: "bg-sky-400/[0.06]", border: "border-sky-400/15" },
  discussion: { icon: MessageSquareQuote, label: "討論", accent: "text-amber-300", bg: "bg-amber-400/[0.06]", border: "border-amber-400/15" },
  insight: { icon: Zap, label: "Insight", accent: "text-amber-200", bg: "bg-amber-300/[0.08]", border: "border-amber-300/20" },
  done: { icon: CheckCheck, label: "完成", accent: "text-white/50", bg: "bg-white/[0.02]", border: "border-white/6" },
};

const ENERGY_DOT: Record<string, string> = {
  lift: "bg-emerald-400",
  drain: "bg-amber-400",
  neutral: "bg-white/30",
};

const AREA_COLORS: Record<string, string> = {
  "工作": "text-cyan-300/50",
  "創作": "text-emerald-300/50",
  "關係": "text-indigo-300/50",
  "健康": "text-amber-300/50",
  "決策": "text-amber-300/50",
};

/* ------------------------------------------------------------------ */
/*  Flow item component                                                */
/* ------------------------------------------------------------------ */

function FlowEntry({ item, isActive, onClick }: { item: FlowItem; isActive: boolean; onClick: () => void }) {
  const style = TYPE_STYLES[item.type];
  const Icon = style.icon;

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border px-4 py-3 transition-all duration-300 ${
        isActive
          ? `${style.border} ${style.bg} ring-1 ring-current/10 shadow-[0_0_20px_rgba(255,255,255,0.04)]`
          : `${style.border} ${style.bg} hover:bg-white/[0.04]`
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon + time */}
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <Icon className={`h-4 w-4 ${style.accent}`} />
          <span className="text-[10px] text-white/20">{item.time}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type label */}
          <div className="flex items-center gap-2">
            <span className={`text-[11px] ${style.accent}`}>{style.label}</span>
            {item.energy && (
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${ENERGY_DOT[item.energy]}`} />
                <span className="text-[10px] text-white/25">
                  {item.energy === "lift" ? "有能量" : item.energy === "drain" ? "偏消耗" : "中性"}
                </span>
              </span>
            )}
          </div>

          {/* Text */}
          <div className={`mt-1 text-sm leading-6 ${item.type === "insight" ? "text-amber-200/80" : "text-white/65"}`}>
            {item.text}
          </div>

          {/* Insight evidence + framework */}
          {item.type === "insight" && item.evidence && (
            <div className="mt-2 space-y-2">
              <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/40">
                {item.evidence}
              </div>
              {item.framework && (
                <div className="text-[10px] text-white/20">
                  {item.framework}
                </div>
              )}
            </div>
          )}

          {/* Reflection inline (for done items) */}
          {item.type === "done" && item.reflection && (
            <div className="mt-2 rounded-lg border border-purple-400/10 bg-purple-400/[0.04] px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-purple-300/60" />
                <span className="text-[10px] text-purple-300/60">反思</span>
              </div>
              <div className="mt-1 text-sm leading-6 text-white/55">{item.reflection}</div>
            </div>
          )}

          {/* Context: where it landed + what it connected to */}
          {(item.area || item.connectedTo) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {item.area && (
                <span className="text-white/30">
                  → {item.area}
                </span>
              )}
              {item.connectedTo && (
                <span className="text-white/25">
                  ↗ 連到 {item.connectedTo}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  World Map (text labels + neural highlight)                         */
/* ------------------------------------------------------------------ */

function WorldMap({
  nodes,
  edges,
  hoveredNode,
  onHover,
  activeArea,
}: {
  nodes: MapNode[];
  edges: MapEdge[];
  hoveredNode: string | null;
  onHover: (id: string | null) => void;
  activeArea: string | null;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const connected = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const s = new Set<string>();
    edges.forEach((e) => {
      if (e.from === hoveredNode) s.add(e.to);
      if (e.to === hoveredNode) s.add(e.from);
    });
    return s;
  }, [hoveredNode, edges]);

  // Area labels
  const areas = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number; count: number }>();
    nodes.forEach((n) => {
      const a = map.get(n.area) ?? { cx: 0, cy: 0, count: 0 };
      a.cx += n.x;
      a.cy += n.y;
      a.count += 1;
      map.set(n.area, a);
    });
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      x: v.cx / v.count,
      y: v.cy / v.count - 7,
      count: v.count,
    }));
  }, [nodes]);

  return (
    <div className="relative h-full w-full min-h-[300px]">
      {/* Area glow blobs — neural highlight when active */}
      {areas.map((area) => {
        const isActive = activeArea && area.name === activeArea;
        const color = AREA_COLORS[area.name];
        return (
          <div
            key={`glow-${area.name}`}
            className="pointer-events-none absolute rounded-full transition-all duration-700"
            style={{
              left: `${area.x}%`,
              top: `${area.y + 4}%`,
              transform: "translate(-50%,-50%)",
              width: `${area.count * 12 + 40}px`,
              height: `${area.count * 10 + 30}px`,
              background: isActive
                ? `radial-gradient(ellipse, ${color?.includes("cyan") ? "rgba(93,234,255,0.18)" : color?.includes("emerald") ? "rgba(110,255,204,0.16)" : color?.includes("amber") ? "rgba(251,191,36,0.14)" : color?.includes("indigo") ? "rgba(165,180,252,0.12)" : "rgba(255,255,255,0.08)"} 0%, transparent 70%)`
                : `radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)`,
              filter: isActive ? "blur(20px)" : "blur(30px)",
            }}
          />
        );
      })}

      {/* Edges */}
      <svg className="absolute inset-0 h-full w-full">
        {edges.map((edge, i) => {
          const a = nodeMap.get(edge.from);
          const b = nodeMap.get(edge.to);
          if (!a || !b) return null;
          const hl = hoveredNode && (edge.from === hoveredNode || edge.to === hoveredNode);
          const faded = hoveredNode && !hl;
          const isAreaActive = activeArea && (a.area === activeArea || b.area === activeArea);
          return (
            <line
              key={i}
              x1={`${a.x}%`} y1={`${a.y}%`}
              x2={`${b.x}%`} y2={`${b.y}%`}
              stroke={edge.isNew ? "#6effcc" : "#fff"}
              strokeWidth={hl ? 1.2 : 0.6}
              opacity={faded ? 0.03 : hl ? 0.35 : isAreaActive ? 0.18 : 0.06}
              strokeDasharray={edge.isNew ? "3 3" : undefined}
              className="transition-opacity duration-500"
            />
          );
        })}
      </svg>

      {/* Area labels */}
      {areas.map((a) => {
        const isActive = activeArea && a.name === activeArea;
        return (
          <div
            key={a.name}
            className="pointer-events-none absolute transition-opacity duration-500"
            style={{ left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%,-100%)" }}
          >
            <span className={`text-[11px] transition-opacity duration-500 ${AREA_COLORS[a.name] ?? "text-white/20"} ${isActive ? "!opacity-60" : ""}`}>
              {a.name}
            </span>
          </div>
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isHovered = hoveredNode === node.id;
        const isConnected = connected.has(node.id);
        const isFaded = hoveredNode !== null && !isHovered && !isConnected;
        const isAreaActive = activeArea && node.area === activeArea;
        const color = AREA_COLORS[node.area] ?? "text-white/30";
        const baseOpacity = node.energy === "bright" ? "70" : node.energy === "medium" ? "45" : "20";

        return (
          <div
            key={node.id}
            className="absolute transition-all duration-500"
            style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%,-50%)" }}
            onMouseEnter={() => onHover(node.id)}
            onMouseLeave={() => onHover(null)}
          >
            <div
              className={`cursor-default whitespace-nowrap rounded-lg border px-2 py-1 text-xs leading-none transition-all duration-500
                ${color}
                ${isFaded
                  ? "opacity-10 border-transparent"
                  : isHovered
                    ? "opacity-100 scale-110 border-current/20 bg-current/10"
                    : isConnected
                      ? "opacity-80 border-current/15 bg-current/5"
                      : isAreaActive
                        ? `opacity-90 border-current/20 bg-current/8 scale-105`
                        : `opacity-${baseOpacity} border-white/[0.03]`
                }
                ${node.energy === "new" ? "motion-safe:animate-pulse" : ""}
              `}
            >
              {node.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export default function ZentropyWorldPage() {
  const [draft, setDraft] = useState("");
  const [inputType, setInputType] = useState<"task" | "idea" | "discussion">("task");
  const [view, setView] = useState<"flow" | "map">("flow");
  const [leftTab, setLeftTab] = useState<"flow" | "project">("flow");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<InputType | "all">("all");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [activeProjectArea, setActiveProjectArea] = useState<string | null>(null);

  // Derive activeArea from selected flow item OR project hover
  const activeArea = useMemo(() => {
    if (activeProjectArea) return activeProjectArea;
    if (!activeFlowId) return null;
    for (const day of FLOW_DATA) {
      const item = day.items.find((i) => i.id === activeFlowId);
      if (item?.area) {
        return item.area.replace(/（.*）/, "").split(" / ")[0].trim();
      }
    }
    return null;
  }, [activeFlowId, activeProjectArea]);

  const filteredDays = useMemo(() => {
    if (filter === "all") return FLOW_DATA;
    return FLOW_DATA.map((day) => ({
      ...day,
      items: day.items.filter((item) => item.type === filter),
    })).filter((day) => day.items.length > 0);
  }, [filter]);

  const filterOptions: { value: InputType | "all"; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "task", label: "任務" },
    { value: "idea", label: "想法" },
    { value: "done", label: "完成" },
    { value: "insight", label: "Insight" },
    { value: "discussion", label: "討論" },
  ];

  /* ══════════════ MAP VIEW ══════════════ */
  if (view === "map") {
    return (
      <div className="flex min-h-screen flex-col bg-[#060e1a]">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute left-[5%] top-[10%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/[0.04] blur-[100px]" />
          <div className="absolute bottom-[10%] right-[15%] h-[24rem] w-[24rem] rounded-full bg-emerald-500/[0.03] blur-[100px]" />
        </div>
        <header className="relative z-10 flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setView("flow")}
              className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/55"
            >
              <ArrowLeft className="h-4 w-4" />
              時間流
            </button>
            <span className="text-sm text-white/50">俯瞰地圖</span>
          </div>
          <Link href="/preview" className="text-xs text-white/20 hover:text-white/40">Preview</Link>
        </header>
        <main className="relative z-10 flex-1 px-8 py-4">
          <WorldMap
            nodes={MAP_NODES}
            edges={MAP_EDGES}
            hoveredNode={hoveredNode}
            onHover={setHoveredNode}
            activeArea={activeArea}
          />
        </main>
      </div>
    );
  }

  /* ══════════════ FLOW VIEW (main) ══════════════ */
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#060e1a]">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[5%] top-[10%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/[0.04] blur-[100px]" />
        <div className="absolute bottom-[10%] right-[15%] h-[24rem] w-[24rem] rounded-full bg-emerald-500/[0.03] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 shrink-0 flex items-center justify-between border-b border-white/6 px-8 py-4">
        <h1
          className="text-lg text-white/60"
          style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, serif' }}
        >
          管住混亂，看見方向。
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView("map")}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 hover:text-white/60"
          >
            <MapIcon className="h-3.5 w-3.5" />
            俯瞰地圖
          </button>
          <Link href="/preview" className="text-xs text-white/20 hover:text-white/40">Preview</Link>
        </div>
      </header>

      {/* Main: left scroll + right fixed */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* ── Left (3/5, scrollable) ── */}
        <div className="flex flex-[3] flex-col border-r border-white/6">
          {/* Tab bar: 時間流 | 專案 */}
          <div className="sticky top-0 z-10 shrink-0 border-b border-white/4 bg-[#060e1a]/95 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-4">
              {/* View tabs */}
              <div className="flex rounded-lg border border-white/6 p-0.5">
                {([["flow", "時間流"], ["project", "專案"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLeftTab(key)}
                    className={`rounded-md px-3 py-1 text-xs transition ${
                      leftTab === key
                        ? "bg-white/10 text-white/70"
                        : "text-white/25 hover:text-white/45"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Flow filters (only in flow mode) */}
              {leftTab === "flow" && (
                <div className="flex flex-wrap gap-1">
                  {filterOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFilter(opt.value)}
                      className={`rounded-lg px-2 py-1 text-[11px] transition ${
                        filter === opt.value
                          ? "bg-white/8 text-white/55"
                          : "text-white/18 hover:text-white/35"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {leftTab === "flow" ? (
              /* ── Time Flow ── */
              <div className="px-4 py-4">
                {filteredDays.map((day) => (
                  <div key={day.date} className="mb-5">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[11px] font-medium text-white/30">{day.date}</span>
                      <div className="h-px flex-1 bg-white/6" />
                    </div>
                    <div className="space-y-2">
                      {day.items.map((item) => (
                        <FlowEntry
                          key={item.id}
                          item={item}
                          isActive={activeFlowId === item.id}
                          onClick={() => setActiveFlowId(activeFlowId === item.id ? null : item.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Project Board ── */
              <div className="flex h-full gap-3 overflow-x-auto p-4">
                {PROJECTS.map((project) => {
                  const doneCount = project.tasks.filter((t) => t.done).length;
                  const totalCount = project.tasks.length;
                  return (
                    <div
                      key={project.id}
                      className="flex w-[260px] shrink-0 flex-col rounded-xl border border-white/6 bg-white/[0.02]"
                      onMouseEnter={() => setActiveProjectArea(project.area)}
                      onMouseLeave={() => setActiveProjectArea(null)}
                    >
                      {/* Project header */}
                      <div className="shrink-0 border-b border-white/6 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-white/40">
                            {project.priority}
                          </span>
                          <span className="text-sm font-medium text-white/70">{project.name}</span>
                        </div>
                        {project.milestone && (
                          <div className="mt-2 rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/30">
                            {project.milestone}
                          </div>
                        )}
                        {/* Progress */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-400/50 transition-all"
                              style={{ width: `${(doneCount / totalCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/25">{doneCount}/{totalCount}</span>
                        </div>
                      </div>

                      {/* Tasks */}
                      <div className="flex-1 overflow-y-auto px-3 py-2">
                        <div className="space-y-1.5">
                          {project.tasks.map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => setActiveProjectArea(project.area)}
                              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                                task.done
                                  ? "border-white/4 bg-white/[0.01]"
                                  : "border-white/6 bg-white/[0.03] hover:bg-white/[0.05]"
                              }`}
                            >
                              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                                task.done
                                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                                  : "border-white/15 text-transparent"
                              }`}>
                                {task.done && "✓"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs ${task.done ? "text-white/30 line-through" : "text-white/60"}`}>
                                  {task.text}
                                </span>
                                {task.overdue && (
                                  <span className="ml-2 text-[10px] text-red-400/70">逾期 {task.overdue}</span>
                                )}
                                {task.due && !task.overdue && (
                                  <span className="ml-2 text-[10px] text-white/25">{task.due}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tag */}
                      <div className="shrink-0 border-t border-white/4 px-3 py-2">
                        <span className="text-[10px] text-white/20">{project.tag}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right (2/5, fixed, NO scroll) ── */}
        <div className="flex flex-[2] flex-col overflow-hidden">
          {/* 生活重心 — top */}
          <div className="shrink-0 px-5 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] text-white/20">生活重心</span>
              {activeArea && (
                <span className="text-[10px] text-white/35">
                  · 正在看 <span className="text-white/50">{activeArea}</span>
                </span>
              )}
            </div>
            <div className="flex gap-4">
              {[
                { name: "工作", pct: 54, color: "bg-cyan-400", text: "text-cyan-300/50" },
                { name: "創作", pct: 19, color: "bg-emerald-400", text: "text-emerald-300/50" },
                { name: "關係", pct: 17, color: "bg-indigo-400", text: "text-indigo-300/50" },
                { name: "健康", pct: 10, color: "bg-amber-400", text: "text-amber-300/50", alert: "11 天沒動" },
              ].map((area) => (
                <button
                  key={area.name}
                  type="button"
                  onMouseEnter={() => {
                    for (const day of FLOW_DATA) {
                      const item = day.items.find((i) => i.area?.startsWith(area.name));
                      if (item) { setActiveFlowId(item.id); break; }
                    }
                  }}
                  onMouseLeave={() => setActiveFlowId(null)}
                  className="flex-1"
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`text-[11px] ${area.text}`}>{area.name}</span>
                    <span className="text-[10px] text-white/20">{area.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${area.color} transition-all duration-500`}
                      style={{ width: `${area.pct}%`, opacity: activeArea === area.name ? 0.8 : 0.4 }}
                    />
                  </div>
                  {area.alert && (
                    <div className="mt-1 text-[10px] text-amber-400/40">{area.alert}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge graph — fills remaining space */}
          <div className="flex-1 px-3 pb-3">
            <div className="h-full rounded-xl border border-white/6 bg-white/[0.01] p-2">
              <WorldMap
                nodes={MAP_NODES}
                edges={MAP_EDGES}
                hoveredNode={hoveredNode}
                onHover={setHoveredNode}
                activeArea={activeArea}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="relative z-10 shrink-0 border-t border-white/6 bg-[#060e1a]/95 px-8 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          {/* Type tabs */}
          <div className="flex gap-1">
            {(["task", "idea", "discussion"] as const).map((type) => {
              const s = TYPE_STYLES[type];
              const Icon = s.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInputType(type)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
                    inputType === type
                      ? `${s.border} ${s.bg} ${s.accent}`
                      : "border-white/6 text-white/20 hover:text-white/35"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>
          {/* Input */}
          <div className="relative flex-1">
            <label className="sr-only" htmlFor="z-input">輸入</label>
            <input
              id="z-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 pr-12 text-sm text-white/70 outline-none placeholder:text-white/15 focus:border-white/14"
              placeholder="把最亂的東西丟進來。"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white/8 text-white/40 hover:bg-white/14"
              aria-label="送出"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
