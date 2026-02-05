/**
 * POC Librarian Engine - Run POC Script
 *
 * 執行完整的 POC 驗證流程
 */

import dotenv from 'dotenv';
import { createPool, closePool, validateDatabaseSafety } from '../src/core/db.js';
import { runPOC, SimulationRunner } from '../src/simulation/runner.js';
import { saveReportToDefault, generateReport } from '../src/metrics/report-generator.js';
import { ALL_PERSONAS } from '../src/simulation/personas.js';

dotenv.config();

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIArgs {
  phase?: number;
  reportOnly?: boolean;
  help?: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {};

  for (const arg of process.argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--report-only') {
      args.reportOnly = true;
    } else if (arg.startsWith('--phase=')) {
      args.phase = parseInt(arg.replace('--phase=', ''), 10);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Librarian POC - Per-User Learning Validation

用法:
  npm run poc              執行完整 POC
  npm run poc:baseline     執行 Phase 1 (冷啟動)
  npm run poc:train        執行 Phase 2 (學習)
  npm run poc:evaluate     執行 Phase 3 (評估)
  npm run poc:report       僅生成報告

選項:
  --phase=N       執行指定階段 (1-3)
  --report-only   僅生成報告（不執行測試）
  --help, -h      顯示此幫助訊息

環境變數:
  DATABASE_URL                   PostgreSQL 連線字串
  GOOGLE_GENERATIVE_AI_API_KEY   Gemini API Key
  POC_INPUTS_PER_PHASE          每階段輸入數 (預設: 10)
  POC_DISTILL_THRESHOLD          蒸餾閾值 (預設: 10)
  `);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║     Librarian POC - Per-User Learning Validation         ║
╚══════════════════════════════════════════════════════════╝
  `);

  // 檢查環境變數
  if (!process.env.DATABASE_URL) {
    console.error('❌ 錯誤：DATABASE_URL 環境變數未設定');
    console.log('\n請複製 .env.example 為 .env 並填入資料庫連線資訊');
    process.exit(1);
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('❌ 錯誤：GOOGLE_GENERATIVE_AI_API_KEY 環境變數未設定');
    console.log('\n請在 .env 中設定 Gemini API Key');
    process.exit(1);
  }

  try {
    // 初始化資料庫連線
    console.log('📦 初始化資料庫連線...');
    await createPool();
    await validateDatabaseSafety();

    // 讀取配置
    const config = {
      personas: ALL_PERSONAS,
      inputsPerPhase: parseInt(process.env.POC_INPUTS_PER_PHASE || '10', 10),
      totalPhases: 3,
      distillThreshold: parseInt(process.env.POC_DISTILL_THRESHOLD || '10', 10),
      clusteringThreshold: parseFloat(process.env.POC_CLUSTERING_THRESHOLD || '0.85'),
    };

    console.log('\n📋 配置:');
    console.log(`   - 測試用戶: ${config.personas.map(p => p.name).join(', ')}`);
    console.log(`   - 每階段輸入: ${config.inputsPerPhase}`);
    console.log(`   - 蒸餾閾值: ${config.distillThreshold}`);
    console.log(`   - 分群閾值: ${config.clusteringThreshold}`);

    // 執行 POC
    const reportData = await runPOC(config);

    // 儲存報告
    await saveReportToDefault(reportData);

    // 列印最終結果
    console.log('\n' + '='.repeat(60));
    console.log('🎉 POC 執行完成！');
    console.log('='.repeat(60));

    // 檢查是否成功
    const avgImprovement = Object.values(reportData.userMetrics)
      .reduce((sum, m) => sum + m.improvement, 0) / Object.keys(reportData.userMetrics).length;

    const diffRate = reportData.differentiationResults.passed / reportData.differentiationResults.total;

    if (avgImprovement > 0.5 && diffRate >= 0.8) {
      console.log('\n✅ Per-User Learning 驗證成功！');
      console.log('   建議：可進入 MVP 整合階段');
    } else {
      console.log('\n⚠️ Per-User Learning 驗證部分成功');
      console.log('   建議：調整蒸餾策略或增加訓練資料');
    }

  } catch (error) {
    console.error('\n❌ 執行失敗:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// 執行
main();
