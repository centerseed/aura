/**
 * POC Librarian Engine - Test Scenarios
 *
 * 定義測試場景和差異化測試案例
 */

import type { TestScenario } from '../core/types.js';

// ============================================================================
// Test Inputs
// ============================================================================

/**
 * 測試輸入（分階段）
 *
 * 每個階段 10 個輸入，共 3 階段
 */
export const TEST_INPUTS: string[][] = [
  // Phase 1: 冷啟動（模稜兩可的輸入）
  [
    '買 RTX 5090 顯卡',
    '訂購 32 吋 4K 螢幕',
    '升級 MacBook Pro M4',
    '續訂 AWS 年費',
    '購買 Notion Team Plan',
    '升級 Vercel Pro',
    '報名 AI 課程',
    '買 Steam 遊戲',
    'PS5 Pro 預購',
    '續訂 Netflix',
  ],
  // Phase 2: 學習中（包含一些重複模式）
  [
    '買 RTX 4090 顯卡',
    '購買 27 吋螢幕',
    'MacBook Air 維修',
    'AWS EC2 費用',
    'Notion 訂閱續費',
    'Vercel 帳單',
    '參加 Python 培訓',
    'Steam 特價遊戲',
    'PS5 遊戲預購',
    'Disney+ 訂閱',
  ],
  // Phase 3: 成熟（驗證學習效果）
  [
    '買新顯卡 RTX 5080',
    '購買 4K 顯示器',
    'MacBook 配件',
    'AWS S3 費用',
    'Notion AI 升級',
    'Vercel Pro 續約',
    '線上學習課程',
    'Steam Deck 購買',
    'PS5 手把',
    'YouTube Premium',
  ],
];

// ============================================================================
// Differentiation Tests
// ============================================================================

/**
 * 差異化測試案例
 *
 * 這些輸入對不同 Persona 應該有不同的分類結果
 */
export const DIFFERENTIATION_TESTS: TestScenario[] = [
  {
    input: '買 RTX 5090',
    expectedOutputs: {
      alex: '公司資產',
      bob: '個人娛樂',
    },
    isAmbiguous: true,
  },
  {
    input: '續訂 AWS 年費',
    expectedOutputs: {
      alex: '營運成本',
      bob: '工作工具',
    },
    isAmbiguous: true,
  },
  {
    input: '買 Steam 遊戲',
    expectedOutputs: {
      alex: '個人娛樂',
      bob: '個人娛樂',
    },
    isAmbiguous: false,
  },
  {
    input: '報名 AI 課程',
    expectedOutputs: {
      alex: '人才投資',
      bob: '職涯發展',
    },
    isAmbiguous: true,
  },
  {
    input: '購買 MacBook Pro',
    expectedOutputs: {
      alex: '公司資產',
      bob: '工作工具',
    },
    isAmbiguous: true,
  },
  {
    input: '續訂 Notion',
    expectedOutputs: {
      alex: '營運成本',
      bob: '工作工具',
    },
    isAmbiguous: true,
  },
  {
    input: '買 PS5 遊戲',
    expectedOutputs: {
      alex: '個人娛樂',
      bob: '個人娛樂',
    },
    isAmbiguous: false,
  },
  {
    input: '32 吋曲面螢幕',
    expectedOutputs: {
      alex: '公司資產',
      bob: '個人娛樂',
    },
    isAmbiguous: true,
  },
];

// ============================================================================
// Training Data Generation
// ============================================================================

/**
 * 生成訓練修正資料
 *
 * 模擬用戶修正 AI 的錯誤預測
 */
export function generateTrainingCorrections(
  personaId: string,
  personaRules: Record<string, string>,
  count: number
): Array<{
  input: string;
  aiPrediction: string;
  userCorrection: string;
}> {
  const corrections: Array<{
    input: string;
    aiPrediction: string;
    userCorrection: string;
  }> = [];

  // 模擬 AI 的「錯誤」預測（反轉 Persona 的規則）
  const wrongCategories: Record<string, string> = {
    '公司資產': '個人娛樂',
    '營運成本': '工作工具',
    '人才投資': '職涯發展',
    '個人娛樂': '公司資產',
    '工作工具': '營運成本',
    '職涯發展': '人才投資',
  };

  const keywords = Object.keys(personaRules);
  const usedInputs = new Set<string>();

  for (let i = 0; i < count && i < keywords.length; i++) {
    const keyword = keywords[i];
    const correctCategory = personaRules[keyword];

    // 生成包含關鍵字的輸入
    const input = generateInputWithKeyword(keyword, usedInputs);
    usedInputs.add(input);

    // AI 給出「錯誤」預測
    const aiPrediction = wrongCategories[correctCategory] || '個人娛樂';

    corrections.push({
      input,
      aiPrediction,
      userCorrection: correctCategory,
    });
  }

  return corrections;
}

/**
 * 根據關鍵字生成輸入
 */
function generateInputWithKeyword(keyword: string, usedInputs: Set<string>): string {
  const templates: Record<string, string[]> = {
    'GPU': ['買 GPU', '購買新 GPU', 'GPU 升級'],
    '顯卡': ['買顯卡', '購買新顯卡', '顯卡升級'],
    'RTX': ['買 RTX 顯卡', 'RTX 5090', 'RTX 4080'],
    '螢幕': ['買螢幕', '購買新螢幕', '4K 螢幕'],
    'MacBook': ['買 MacBook', 'MacBook 維修', 'MacBook Pro'],
    'AWS': ['AWS 費用', '續訂 AWS', 'AWS 年費'],
    'Vercel': ['Vercel 費用', '續訂 Vercel', 'Vercel Pro'],
    'Notion': ['Notion 訂閱', '續訂 Notion', 'Notion Team'],
    'SaaS': ['SaaS 訂閱', 'SaaS 費用', '購買 SaaS'],
    '訂閱': ['軟體訂閱', '服務訂閱', '雲端訂閱'],
    '年費': ['年費續訂', '會員年費', '服務年費'],
    '課程': ['線上課程', '培訓課程', '報名課程'],
    '學習': ['學習資源', '購買學習', '學習訂閱'],
    '培訓': ['專業培訓', '技術培訓', '報名培訓'],
    'Netflix': ['Netflix 訂閱', '續訂 Netflix', 'Netflix 費用'],
    '遊戲': ['買遊戲', '購買遊戲', '遊戲預購'],
    'Steam': ['Steam 遊戲', 'Steam 購買', 'Steam 特價'],
    'PS5': ['PS5 遊戲', 'PS5 配件', 'PS5 手把'],
  };

  const options = templates[keyword] || [`購買 ${keyword}`, `${keyword} 費用`, `${keyword} 支出`];

  // 選擇一個未使用的選項
  for (const option of options) {
    if (!usedInputs.has(option)) {
      return option;
    }
  }

  // 如果全部用過，加上編號
  return `${options[0]} #${usedInputs.size + 1}`;
}
