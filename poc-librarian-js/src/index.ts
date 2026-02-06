/**
 * POC Librarian Engine - Main Entry Point
 *
 * Universal Librarian Engine JavaScript POC
 * 驗證 Per-User Learning 的技術可行性
 */

// Core exports
export * from './core/types.js';
export * from './core/db.js';
export * from './core/vector-store.js';
export * from './core/llm-client.js';

// Intelligence exports
export * from './intelligence/clustering.js';
export * from './intelligence/distiller.js';

// Adapter exports
export * from './adapters/base-adapter.js';
export * from './adapters/naruvia-adapter.js';

// Simulation exports
export * from './simulation/personas.js';
export * from './simulation/scenarios.js';
export * from './simulation/generator.js';
export * from './simulation/runner.js';

// Metrics exports
export * from './metrics/user-metrics.js';
export * from './metrics/rule-evaluator.js';
export * from './metrics/report-generator.js';

// ============================================================================
// CLI Entry
// ============================================================================

import { createPool, closePool, validateDatabaseSafety } from './core/db.js';
import { runPOC } from './simulation/runner.js';
import { saveReportToDefault } from './metrics/report-generator.js';

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     Librarian POC - Per-User Learning Validation         ║
╚══════════════════════════════════════════════════════════╝
  `);

  try {
    // 初始化資料庫連線
    console.log('📦 初始化資料庫連線...');
    await createPool();
    await validateDatabaseSafety();

    // 執行 POC
    const reportData = await runPOC();

    // 儲存報告
    await saveReportToDefault(reportData);

    console.log('\n✅ POC 執行完成！');

  } catch (error) {
    console.error('\n❌ 執行失敗:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// 如果是直接執行（非 import）
const isMainModule = process.argv[1]?.includes('index');
if (isMainModule) {
  main();
}
