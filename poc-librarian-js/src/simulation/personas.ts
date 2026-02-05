/**
 * POC Librarian Engine - Test Personas
 *
 * 定義測試人物誌，用於驗證 Per-User Learning
 */

import type { Persona } from '../core/types.js';

// ============================================================================
// Personas
// ============================================================================

/**
 * Alex - 創業者
 *
 * SaaS 創業者，所有科技產品都是公司資產
 */
export const PERSONA_ALEX: Persona = {
  id: 'alex',
  name: 'Alex (創業者)',
  description: 'SaaS 創業者，所有科技產品都視為公司資產或營運成本',
  rules: {
    'GPU': '公司資產',
    '顯卡': '公司資產',
    'RTX': '公司資產',
    '螢幕': '公司資產',
    'MacBook': '公司資產',
    'AWS': '營運成本',
    'Vercel': '營運成本',
    'Notion': '營運成本',
    'SaaS': '營運成本',
    '訂閱': '營運成本',
    '年費': '營運成本',
    '課程': '人才投資',
    '學習': '人才投資',
    '培訓': '人才投資',
    'Netflix': '個人娛樂',
    '遊戲': '個人娛樂',
    'Steam': '個人娛樂',
    'PS5': '個人娛樂',
  },
};

/**
 * Bob - 軟體工程師 / 玩家
 *
 * 軟體工程師，下班後是重度玩家
 */
export const PERSONA_BOB: Persona = {
  id: 'bob',
  name: 'Bob (玩家)',
  description: '軟體工程師，下班後是重度玩家，科技產品多為個人娛樂',
  rules: {
    'GPU': '個人娛樂',
    '顯卡': '個人娛樂',
    'RTX': '個人娛樂',
    '螢幕': '個人娛樂',
    'MacBook': '工作工具',
    'AWS': '工作工具',
    'Vercel': '工作工具',
    'Notion': '工作工具',
    'SaaS': '工作工具',
    '訂閱': '個人娛樂',
    '年費': '工作工具',
    '課程': '職涯發展',
    '學習': '職涯發展',
    '培訓': '職涯發展',
    'Netflix': '個人娛樂',
    '遊戲': '個人娛樂',
    'Steam': '個人娛樂',
    'PS5': '個人娛樂',
  },
};

// ============================================================================
// Persona Helpers
// ============================================================================

/**
 * 所有測試 Personas
 */
export const ALL_PERSONAS: Persona[] = [PERSONA_ALEX, PERSONA_BOB];

/**
 * 根據 Persona 的規則取得預期分類
 */
export function getExpectedCategory(input: string, persona: Persona): string {
  const normalizedInput = input.toLowerCase();

  for (const [keyword, category] of Object.entries(persona.rules)) {
    if (normalizedInput.includes(keyword.toLowerCase())) {
      return category;
    }
  }

  // 預設分類
  return '個人娛樂';
}

/**
 * 檢查分類是否正確
 */
export function isCorrectClassification(
  input: string,
  prediction: string,
  persona: Persona
): boolean {
  const expected = getExpectedCategory(input, persona);
  return prediction === expected;
}
