// ===== Domain Types =====

export type DrawerStatus =
  | "INBOX"
  | "ACTIVE"
  | "MAINTAIN"
  | "REFERENCE"
  | "ARCHIVE";

export type LifecycleStatus =
  | "embryo"
  | "active"
  | "mature"
  | "dormant";

// L1: Area (身分)
export interface Area {
  id: string;
  user_id: string;
  name: string;
  scope: string | null;
  description: string | null;
  is_custom: boolean;
  created_at: string;
}

// L2: Product (資產)
export interface Product {
  id: string;
  user_id: string;
  area_id: string;
  name: string;
  description: string | null;
  created_at: string;
  // Relations
  area?: Area;
}

// L3: Topic (主題模組)
export interface Topic {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  created_at: string;
  // Relations
  product?: Product;
}

// Sub-item (待辦清單項目)
export interface SubItem {
  id: string;
  content: string;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  order: number;
}

export interface SubItemsMeta {
  total: number;
  completed: number;
  completion_rate: number;  // 0.0-1.0
}

// Reference (參考資料)
export interface Reference {
  id: string;
  type: "url" | "note";
  content: string;
  title?: string | null;
  created_at: string;
}

// Task (任務)
export interface Task {
  id: string;
  user_id: string;
  product_id: string;
  topic_id: string | null;
  content: string;
  status: DrawerStatus;
  lifecycle: LifecycleStatus;
  ai_analysis: {
    narrative?: string;
    strategy_used?: string;
    reasoning?: string;
    merged_items?: string[];
    sub_items?: SubItem[];  // 新增
    sub_items_meta?: SubItemsMeta;  // 新增
  };
  references: Reference[];  // 新增: 參考資料
  created_at: string;
  updated_at: string;
  // Relations
  product?: Product;
  topic?: Topic;
}

// ===== UI Types =====

export type MilestoneStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "delayed"
  | "cancelled";

export type EntityType = "AREA" | "PRODUCT" | "TOPIC";

export interface Milestone {
  id: string;
  user_id: string;
  name: string;
  target_date: string;
  status: MilestoneStatus;
  entity_type: EntityType;
  entity_id: string;
  priority: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  // 關聯實體 (根據 entity_type 其中一個會有值)
  product?: { id: string; name: string } | null;
  area?: { id: string; name: string } | null;
  topic?: { id: string; name: string } | null;
}

export interface TaskTag {
  area: string;
  product: string;
  topic: string;
}

export interface TaskCard {
  id: string;
  title: string;
  narrative: string | null;
  drawer: DrawerStatus;
  lifecycle: LifecycleStatus;
  tag: TaskTag;
  strategy_used: string | null;
  reasoning: string | null;
  start_date?: string | null;
  due_date?: string | null;
  time_confidence?: number | null;
  inferred_from_milestone?: string | null;
  // 新增: Sub-items support
  sub_items?: SubItem[];
  sub_items_meta?: SubItemsMeta;
  // 新增: References support
  references?: Reference[];
  // ai_analysis 完整結構
  ai_analysis?: {
    narrative?: string;
    strategy_used?: string;
    reasoning?: string;
    merged_items?: string[];
    sub_items?: SubItem[];
    sub_items_meta?: SubItemsMeta;
  };
}

// Kanban Column 結構
export interface KanbanColumn {
  id: string;
  title: string;
  tasks: TaskCard[];
}

// ===== AI Types =====

export interface StructuredOutput {
  items: Array<{
    title: string;
    narrative: string;
    drawer: DrawerStatus;
    lifecycle: LifecycleStatus;
    tag: TaskTag;
    strategy_used: string;
    reasoning: string;
  }>;
}

export interface GovernanceAction {
  action_type: string;
  target_id?: string;
  old_name?: string;
  new_name?: string;
  target_area?: string;
  context?: string;
}

// ===== Product Reorganization Types =====

export interface TopicCluster {
  topic_name: string;
  description: string;
  task_ids: string[];
  confidence: number;
}

export interface TaskTimeInference {
  task_id: string;
  suggested_due_date: string | null;
  inferred_from_milestone_id: string | null;
  time_confidence: number;
  urgency_level: "critical" | "high" | "medium" | "low";
  reasoning: string;
}

export interface ReorganizeProposal {
  product_id: string;
  product_name: string;
  current_topics: string[];
  proposed_clusters: TopicCluster[];
  time_inferences: TaskTimeInference[];
  reasoning: string;
}
