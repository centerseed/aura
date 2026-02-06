/**
 * POC Librarian Engine - Core Type Definitions
 *
 * 定義所有核心介面和類型
 */

// ============================================================================
// Memory System Types
// ============================================================================

/**
 * 修正紀錄（用戶修正 AI 預測）
 */
export interface Correction {
  id: string;
  userId: string;
  domain: string;
  originalInput: string;
  aiPrediction: Record<string, unknown>;
  userCorrection: Record<string, unknown>;
  correctedField: string;
  embedding?: number[];
  processed: boolean;
  phaseNumber?: number;
  createdAt: Date;
}

/**
 * 蒸餾出的規則
 */
export interface Rule {
  id: string;
  userId: string;
  domain: string;
  description: string;
  triggerConditions: string[];
  resultAction: Record<string, unknown>;
  confidence: number;
  timesApplied: number;
  timesCorrect: number;
  embedding?: number[];
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * 評估結果
 */
export interface Evaluation {
  id: string;
  userId: string;
  phaseNumber: number;
  input: string;
  expectedOutput: Record<string, unknown>;
  actualOutput: Record<string, unknown>;
  isCorrect: boolean;
  rulesApplied: string[];
  latencyMs: number;
  createdAt: Date;
}

// ============================================================================
// Clustering Types
// ============================================================================

/**
 * 修正資料（帶 embedding）
 */
export interface CorrectionWithEmbedding extends Correction {
  embedding: number[];
}

/**
 * 群集
 */
export interface Cluster {
  id: number;
  corrections: CorrectionWithEmbedding[];
  centroid: number[];
}

/**
 * Clustering 品質指標
 */
export interface ClusteringQuality {
  isGood: boolean;
  silhouetteScore?: number;
  clusterCount: number;
  avgClusterSize: number;
  strategy: 'ml-kmeans' | 'llm-clustering';
}

// ============================================================================
// Simulation Types
// ============================================================================

/**
 * 測試人物誌
 */
export interface Persona {
  id: string;
  name: string;
  description: string;
  rules: Record<string, string>; // keyword pattern -> expected category
}

/**
 * 測試場景
 */
export interface TestScenario {
  input: string;
  expectedOutputs: Record<string, string>; // personaId -> expected output
  isAmbiguous: boolean;
}

/**
 * 模擬配置
 */
export interface SimulationConfig {
  personas: Persona[];
  inputsPerPhase: number;
  totalPhases: number;
  distillThreshold: number;
  clusteringThreshold: number;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * 用戶指標
 */
export interface UserMetrics {
  userId: string;
  totalInputs: number;
  totalCorrections: number;
  correctionRate: number;
  phases: PhaseMetrics[];
  learningCurve: number[];
  improvement: number;
}

/**
 * 階段指標
 */
export interface PhaseMetrics {
  phaseNumber: number;
  inputs: number;
  corrections: number;
  correctionRate: number;
  rulesApplied: number;
  rulesEffective: number;
}

/**
 * 規則指標
 */
export interface RuleMetrics {
  ruleId: string;
  userId: string;
  description: string;
  confidence: number;
  timesApplied: number;
  timesCorrect: number;
  accuracy: number;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

// ============================================================================
// LLM Types
// ============================================================================

/**
 * LLM 蒸餾結果
 */
export interface DistillationResult {
  ruleDescription: string;
  triggerConditions: string[];
  resultAction: Record<string, unknown>;
  confidence: number;
  reasoning: string;
}

/**
 * 分類結果
 */
export interface ClassificationResult {
  category: string;
  confidence: number;
  rulesUsed: string[];
  reasoning?: string;
}

// ============================================================================
// Adapter Types
// ============================================================================

/**
 * 觀察事件
 */
export interface ObserveEvent {
  userId: string;
  domain: string;
  type: 'correction' | 'feedback';
  input: string;
  aiPrediction: Record<string, unknown>;
  userCorrection: Record<string, unknown>;
  phaseNumber?: number;
}

/**
 * 檢索查詢
 */
export interface RecallQuery {
  userId: string;
  domain: string;
  input: string;
  topK?: number;
}

/**
 * Librarian Adapter 介面
 */
export interface LibrarianAdapter {
  observe(event: ObserveEvent): Promise<void>;
  recall(query: RecallQuery): Promise<Rule[]>;
  reflect(userId: string): Promise<Rule[]>;
}

// ============================================================================
// Rule Lifecycle Types (System 2 Improvements)
// ============================================================================

/**
 * 規則老化狀態
 */
export type RuleAgeStatus = 'active' | 'stale' | 'archived';

/**
 * 規則健康度評估
 */
export interface RuleHealthScore {
  ruleId: string;
  score: number;           // 0-1, 綜合健康分數
  factors: {
    accuracy: number;      // 準確率權重
    frequency: number;     // 使用頻率權重
    recency: number;       // 最近使用權重
    age: number;          // 規則年齡權重
  };
  recommendation: 'keep' | 'merge' | 'archive' | 'delete';
}

/**
 * 規則合併建議
 */
export interface RuleMergeCandidate {
  sourceRule: Rule;
  targetRule: Rule;
  similarity: number;
  reason: string;
}

/**
 * 規則驗證結果
 */
export interface RuleValidationResult {
  isValid: boolean;
  conflicts: RuleConflict[];
  mergeCandidate?: RuleMergeCandidate;
}

/**
 * 規則衝突
 */
export interface RuleConflict {
  existingRule: Rule;
  newRule: Partial<Rule>;
  conflictType: 'same_trigger_different_result' | 'subset' | 'overlap';
  resolution: 'keep_existing' | 'replace' | 'merge' | 'ask_user';
}

/**
 * 多階段蒸餾配置
 */
/**
 * Domain 設定
 */
export interface DomainConfig {
  domain: string;
  displayName: string;
  warmThreshold: number;
  distillThreshold: number;
  similarityThreshold: number;
  confidenceDecayDays: number;
  categories: string[] | null;
  createdAt: Date;
}

export interface MultiStageDistillConfig {
  stage1_clustering: {
    minClusterSize: number;
    silhouetteThreshold: number;
  };
  stage2_extraction: {
    minConfidence: number;
    maxRulesPerCluster: number;
  };
  stage3_validation: {
    conflictResolution: 'auto' | 'manual';
    mergeThreshold: number;
  };
}
