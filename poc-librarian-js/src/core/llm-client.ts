/**
 * POC Librarian Engine - LLM Client
 *
 * 提供 Gemini API 封裝，用於分類和規則蒸餾
 */

import { google } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import type { Rule, CorrectionWithEmbedding, DistillationResult, ClassificationResult } from './types.js';

// ============================================================================
// Configuration
// ============================================================================

const CLASSIFICATION_MODEL = 'gemini-2.0-flash';
const DISTILLATION_MODEL = 'gemini-2.0-flash';

// ============================================================================
// Schemas (Zod)
// ============================================================================

const DistillationResultSchema = z.object({
  rule_description: z.string().describe('規則描述，格式：當 X 時，分類為 Y'),
  trigger_conditions: z.array(z.string()).describe('觸發條件列表，如 ["contains:GPU", "contains:顯卡"]'),
  result_action: z.object({
    field: z.string().describe('要設定的欄位，如 "category"'),
    value: z.string().describe('要設定的值，如 "公司資產"'),
  }),
  confidence: z.number().min(0).max(1).describe('信心度 0-1'),
  reasoning: z.string().describe('推理過程，最多 50 字'),
});

const ClassificationResultSchema = z.object({
  category: z.string().describe('分類結果'),
  confidence: z.number().min(0).max(1).describe('信心度 0-1'),
  reasoning: z.string().optional().describe('推理過程'),
});

// ============================================================================
// Classification
// ============================================================================

/**
 * 使用 LLM 分類任務（Zero-Shot 或 RAG 增強）
 */
export async function classifyTask(
  input: string,
  options: {
    useRag?: boolean;
    rules?: Rule[];
    categories?: string[];
  } = {}
): Promise<ClassificationResult> {
  const { useRag = false, rules = [], categories = [] } = options;

  let systemPrompt = `你是任務分類專家。根據用戶輸入，判斷這個任務應該屬於哪個分類。

可用分類：
${categories.length > 0 ? categories.map(c => `- ${c}`).join('\n') : '- 公司資產\n- 營運成本\n- 人才投資\n- 個人娛樂\n- 工作工具\n- 職涯發展'}

回應規則：
1. category 必須是上述分類之一
2. confidence 表示你的信心度（0-1）
3. 如果不確定，選擇最可能的分類並降低 confidence`;

  if (useRag && rules.length > 0) {
    systemPrompt += `\n\n## 用戶的個人化規則

以下是從用戶過去的修正中學習到的規則，請優先參考：

${rules.map((r, i) => `${i + 1}. ${r.description} (信心度: ${(r.confidence * 100).toFixed(0)}%)`).join('\n')}

**重要**：如果輸入符合任何規則，優先使用該規則的分類結果。`;
  }

  const { object } = await generateObject({
    model: google(CLASSIFICATION_MODEL),
    schema: ClassificationResultSchema,
    system: systemPrompt,
    prompt: `請分類以下任務：\n\n"${input}"`,
  });

  return {
    category: object.category,
    confidence: object.confidence,
    rulesUsed: useRag ? rules.map(r => r.id) : [],
    reasoning: object.reasoning,
  };
}

// ============================================================================
// Distillation
// ============================================================================

/**
 * 從修正群集中蒸餾規則
 */
export async function distillRule(
  corrections: CorrectionWithEmbedding[]
): Promise<DistillationResult | null> {
  if (corrections.length < 2) {
    console.log('⚠️ 修正數量不足（< 2），跳過蒸餾');
    return null;
  }

  const prompt = buildDistillationPrompt(corrections);

  try {
    const { object } = await generateObject({
      model: google(DISTILLATION_MODEL),
      schema: DistillationResultSchema,
      system: DISTILLATION_SYSTEM_PROMPT,
      prompt,
    });

    return {
      ruleDescription: object.rule_description,
      triggerConditions: object.trigger_conditions,
      resultAction: object.result_action,
      confidence: object.confidence,
      reasoning: object.reasoning,
    };
  } catch (error) {
    console.error('❌ 規則蒸餾失敗:', error);
    return null;
  }
}

/**
 * 多階段蒸餾系統 Prompt
 *
 * 設計原則 (基於 System 2 研究):
 * 1. 歸納而非死記 - 抽取共同模式，不是列舉所有案例
 * 2. 最小化原則 - 規則應該盡量簡潔
 * 3. 可驗證性 - 觸發條件必須明確可檢測
 * 4. 用戶意圖優先 - 理解修正背後的「為什麼」
 */
const DISTILLATION_SYSTEM_PROMPT = `你是規則蒸餾專家。從用戶的修正紀錄中，歸納出高品質的分類規則。

## 你的任務

分析修正紀錄，找出用戶的「決策模式」，而不是死記每個案例。

## 規則品質標準

### 1. 抽象層級適當
❌ 太具體: "當輸入是 '買 RTX 5090' 時..." (只適用於一個案例)
✅ 適當抽象: "當任務涉及 GPU/顯卡相關購買時..." (可泛化)
❌ 太抽象: "當任務涉及購物時..." (區分度不夠)

### 2. 觸發條件明確
- 使用 "contains:關鍵字" 格式
- 列出 2-5 個關鍵字/模式
- 優先選擇具有區分度的關鍵字

### 3. 信心度計算
- 修正一致性 100%: confidence = 0.90-0.95
- 修正一致性 80%+: confidence = 0.80-0.89
- 修正一致性 60%+: confidence = 0.70-0.79
- 修正一致性 < 60%: confidence < 0.70 (考慮是否應該分成多條規則)

### 4. 推理過程
- 說明為什麼這些修正可以歸為同一規則
- 說明用戶的分類邏輯（身份、情境、目的）
- 最多 50 字

## 範例

輸入：
- "買 RTX 5090" → 公司資產
- "升級 GPU" → 公司資產
- "購買顯卡" → 公司資產

輸出：
{
  "rule_description": "當任務涉及 GPU/顯卡購買或升級時，分類為「公司資產」",
  "trigger_conditions": ["contains:GPU", "contains:顯卡", "contains:RTX", "contains:顯示卡"],
  "result_action": { "field": "category", "value": "公司資產" },
  "confidence": 0.92,
  "reasoning": "用戶為創業者，將所有 GPU 相關支出視為公司設備投資"
}

## 注意事項

- 使用繁體中文
- 如果修正之間存在矛盾，降低 confidence 並在 reasoning 中說明
- 優先理解「用戶為什麼這樣分類」而非「輸入包含什麼字」`;

function buildDistillationPrompt(corrections: CorrectionWithEmbedding[]): string {
  const correctionTexts = corrections.map((c, i) => `
修正 ${i + 1}:
- 原始輸入: "${c.originalInput}"
- AI 預測: ${JSON.stringify(c.aiPrediction)}
- 用戶修正: ${JSON.stringify(c.userCorrection)}
- 修正欄位: ${c.correctedField}`).join('\n');

  return `分析以下 ${corrections.length} 筆修正紀錄，歸納出一條明確的分類規則：

${correctionTexts}

請根據這些修正的共同模式，歸納出一條規則。`;
}

// ============================================================================
// LLM-based Clustering
// ============================================================================

/**
 * 使用 LLM 進行語意分群（當 ml-kmeans 效果不佳時的 fallback）
 */
export async function llmClustering(
  corrections: CorrectionWithEmbedding[]
): Promise<{ clusterId: number; correctionId: string }[]> {
  if (corrections.length === 0) return [];

  const ClusteringSchema = z.object({
    clusters: z.array(z.object({
      cluster_id: z.number(),
      correction_ids: z.array(z.string()),
      common_pattern: z.string().describe('這組修正的共同模式'),
    })),
  });

  const correctionSummaries = corrections.map(c => ({
    id: c.id,
    input: c.originalInput,
    correction: c.userCorrection,
  }));

  const { object } = await generateObject({
    model: google(CLASSIFICATION_MODEL),
    schema: ClusteringSchema,
    system: `你是分群專家。將相似的修正紀錄分組。

分群依據：
1. 語意相似 — 描述類似的事物
2. 修正模式相同 — 修正的方向一致
3. 可歸納為同一規則 — 能用一條規則解釋

規則：
- 每個群組至少 2 筆修正
- 群組數量不超過 8 個
- 無法分組的修正放入獨立群組`,
    prompt: `請將以下 ${corrections.length} 筆修正分群：

${JSON.stringify(correctionSummaries, null, 2)}`,
  });

  // 轉換格式
  const result: { clusterId: number; correctionId: string }[] = [];
  for (const cluster of object.clusters) {
    for (const correctionId of cluster.correction_ids) {
      result.push({ clusterId: cluster.cluster_id, correctionId });
    }
  }

  return result;
}
