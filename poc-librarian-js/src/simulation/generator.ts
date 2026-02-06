/**
 * POC Librarian Engine - Data Generator
 *
 * 生成模擬測試數據
 */

import { ALL_PERSONAS, getExpectedCategory } from './personas.js';
import { TEST_INPUTS, generateTrainingCorrections } from './scenarios.js';
import type { Persona } from '../core/types.js';

// ============================================================================
// Types
// ============================================================================

export interface GeneratedInput {
  input: string;
  expectedCategory: string;
  phaseNumber: number;
}

export interface GeneratedCorrection {
  input: string;
  aiPrediction: string;
  userCorrection: string;
  phaseNumber: number;
}

// ============================================================================
// Data Generation
// ============================================================================

/**
 * 為指定 Persona 生成階段測試輸入
 */
export function generatePhaseInputs(
  persona: Persona,
  phaseNumber: number
): GeneratedInput[] {
  const phaseIndex = phaseNumber - 1;

  if (phaseIndex < 0 || phaseIndex >= TEST_INPUTS.length) {
    throw new Error(`無效的階段編號: ${phaseNumber}`);
  }

  const inputs = TEST_INPUTS[phaseIndex];

  return inputs.map(input => ({
    input,
    expectedCategory: getExpectedCategory(input, persona),
    phaseNumber,
  }));
}

/**
 * 為指定 Persona 生成所有階段的測試輸入
 */
export function generateAllPhaseInputs(persona: Persona): GeneratedInput[] {
  const allInputs: GeneratedInput[] = [];

  for (let phase = 1; phase <= TEST_INPUTS.length; phase++) {
    allInputs.push(...generatePhaseInputs(persona, phase));
  }

  return allInputs;
}

/**
 * 模擬 AI 錯誤預測
 *
 * 在冷啟動階段，AI 會給出「錯誤」的預測
 * 用戶需要修正這些錯誤，系統從中學習
 */
export function simulateAIPrediction(
  input: string,
  persona: Persona,
  hasLearned: boolean = false
): { prediction: string; confidence: number } {
  const expectedCategory = getExpectedCategory(input, persona);

  if (hasLearned) {
    // 學習後，AI 預測應該正確
    return {
      prediction: expectedCategory,
      confidence: 0.85,
    };
  }

  // 冷啟動：AI 給出「錯誤」預測
  // 根據 Persona 的特性，反轉某些分類
  const wrongPredictions: Record<string, string> = {
    '公司資產': '個人娛樂',
    '營運成本': '工作工具',
    '人才投資': '職涯發展',
    '個人娛樂': '公司資產',
    '工作工具': '營運成本',
    '職涯發展': '人才投資',
  };

  const wrongPrediction = wrongPredictions[expectedCategory] || '個人娛樂';

  return {
    prediction: wrongPrediction,
    confidence: 0.6,
  };
}

/**
 * 生成模擬修正資料
 *
 * 當 AI 預測錯誤時，用戶會修正
 */
export function generateSimulatedCorrections(
  persona: Persona,
  phaseNumber: number,
  predictedCategories: Map<string, string>
): GeneratedCorrection[] {
  const inputs = generatePhaseInputs(persona, phaseNumber);
  const corrections: GeneratedCorrection[] = [];

  for (const { input, expectedCategory } of inputs) {
    const aiPrediction = predictedCategories.get(input);

    if (aiPrediction && aiPrediction !== expectedCategory) {
      corrections.push({
        input,
        aiPrediction,
        userCorrection: expectedCategory,
        phaseNumber,
      });
    }
  }

  return corrections;
}

/**
 * 生成初始訓練資料（用於快速測試）
 */
export function generateInitialTrainingData(
  persona: Persona,
  count: number = 15
): GeneratedCorrection[] {
  const corrections = generateTrainingCorrections(
    persona.id,
    persona.rules,
    count
  );

  return corrections.map((c, idx) => ({
    ...c,
    phaseNumber: 1,
  }));
}
