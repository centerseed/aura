/**
 * Task Consolidation 數據恢復腳本
 *
 * 用途：
 * 1. 恢復被錯誤刪除的 tasks
 * 2. 回滾錯誤的 consolidation 操作
 * 3. 驗證數據完整性
 *
 * 用法：
 *   npx tsx scripts/restore-consolidation.ts --user-id=<user_id> [--date=YYYY-MM-DD]
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface RestoreOptions {
  userId: string;
  date?: string; // YYYY-MM-DD format
  dryRun?: boolean;
}

interface DeletedTaskInfo {
  id: string;
  content: string;
  deleted_at: Date;
  ai_analysis: any;
  sub_items: any[];
}

async function restoreConsolidation(options: RestoreOptions) {
  console.log('🔧 開始數據恢復程序...\n');
  console.log('選項:', options);

  const cutoffDate = options.date
    ? new Date(options.date)
    : new Date(Date.now() - 24 * 60 * 60 * 1000); // 預設：過去 24 小時

  console.log(`\n📅 恢復範圍：${cutoffDate.toLocaleString('zh-TW')} 之後被刪除的 tasks\n`);

  // 1. 查找被刪除的 tasks
  const deletedTasks = await prisma.$queryRaw<DeletedTaskInfo[]>`
    SELECT
      id, content, deleted_at, ai_analysis, sub_items
    FROM tasks
    WHERE user_id::text = ${options.userId}
    AND deleted_at >= ${cutoffDate}
    ORDER BY deleted_at DESC
  `;

  if (deletedTasks.length === 0) {
    console.log('✅ 沒有找到需要恢復的 tasks');
    return;
  }

  console.log(`⚠️  找到 ${deletedTasks.length} 個被刪除的 tasks:\n`);

  const tasksToRestore: DeletedTaskInfo[] = [];
  const backup: any[] = [];

  for (const task of deletedTasks) {
    const analysis = task.ai_analysis || {};
    const subItems = task.sub_items || [];

    console.log(`📌 ${task.content.slice(0, 60)}`);
    console.log(`   ID: ${task.id.slice(0, 8)}...`);
    console.log(`   刪除時間: ${task.deleted_at.toLocaleString('zh-TW')}`);
    console.log(`   Sub-items: ${subItems.length} 個`);

    // 檢查是否是 consolidation 的受害者
    if (analysis.consolidated_at || analysis.semantic_preservation) {
      console.log(`   🔍 偵測到 consolidation 操作`);
      console.log(`   Consolidated at: ${analysis.consolidated_at || 'N/A'}`);

      // 這個 task 可能是 parent（不應該被刪除）
      if (analysis.semantic_preservation && subItems.length > 0) {
        console.log(`   ⚠️  這是 parent task，有 ${subItems.length} 個 sub-items！`);
        console.log(`   → 應該恢復此 task`);
        tasksToRestore.push(task);
      }
    }

    // 備份資訊
    backup.push({
      id: task.id,
      content: task.content,
      deleted_at: task.deleted_at,
      ai_analysis: task.ai_analysis,
      sub_items_count: subItems.length,
    });

    console.log('');
  }

  if (tasksToRestore.length === 0) {
    console.log('✅ 所有被刪除的 tasks 都是正常刪除（不是誤刪）');
    return;
  }

  console.log('\n===== 恢復計畫 =====');
  console.log(`將恢復 ${tasksToRestore.length} 個 tasks:\n`);

  tasksToRestore.forEach((task, index) => {
    console.log(`${index + 1}. ${task.content.slice(0, 60)}`);
    console.log(`   ID: ${task.id}`);
    console.log(`   Sub-items: ${task.sub_items.length} 個`);
  });

  if (options.dryRun) {
    console.log('\n🔒 Dry run 模式，不執行實際恢復');
    return;
  }

  console.log('\n⚙️  執行恢復...');

  // 2. 執行恢復
  const restored = await prisma.task.updateMany({
    where: {
      id: { in: tasksToRestore.map(t => t.id) },
    },
    data: {
      deleted_at: null,
    },
  });

  console.log(`\n✅ 成功恢復 ${restored.count} 個 tasks`);

  // 3. 儲存備份日誌
  const logPath = join(__dirname, '..', 'logs', `restore-${Date.now()}.json`);
  writeFileSync(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    userId: options.userId,
    cutoffDate: cutoffDate.toISOString(),
    deletedTasksFound: deletedTasks.length,
    tasksRestored: restored.count,
    backup,
  }, null, 2));

  console.log(`\n📝 恢復日誌已儲存到: ${logPath}`);

  // 4. 驗證恢復結果
  console.log('\n🔍 驗證恢復結果...');
  for (const task of tasksToRestore) {
    const restored = await prisma.task.findUnique({
      where: { id: task.id },
      select: { id: true, content: true, deleted_at: true, sub_items: true },
    });

    if (restored && restored.deleted_at === null) {
      const subItems = (restored.sub_items as any[]) || [];
      console.log(`✅ ${restored.content.slice(0, 60)} (${subItems.length} sub-items)`);
    } else {
      console.log(`❌ ${task.content.slice(0, 60)} - 恢復失敗！`);
    }
  }

  console.log('\n===== 恢復完成 =====\n');
  console.log('建議：');
  console.log('1. 檢查前端是否能正確顯示這些 tasks');
  console.log('2. 驗證 sub-items 數據完整性');
  console.log('3. 檢查相關的 consolidation 操作是否正確\n');
}

// 解析命令行參數
const args = process.argv.slice(2);
const options: RestoreOptions = {
  userId: '',
  dryRun: false,
};

for (const arg of args) {
  if (arg.startsWith('--user-id=')) {
    options.userId = arg.split('=')[1];
  } else if (arg.startsWith('--date=')) {
    options.date = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
}

if (!options.userId) {
  console.error('❌ 錯誤：必須提供 --user-id 參數');
  console.log('\n用法：');
  console.log('  npx tsx scripts/restore-consolidation.ts --user-id=<user_id> [--date=YYYY-MM-DD] [--dry-run]');
  console.log('\n範例：');
  console.log('  npx tsx scripts/restore-consolidation.ts --user-id=467c7125-d890-429f-b46f-168429b1907e');
  console.log('  npx tsx scripts/restore-consolidation.ts --user-id=467c7125-d890-429f-b46f-168429b1907e --date=2026-02-02');
  console.log('  npx tsx scripts/restore-consolidation.ts --user-id=467c7125-d890-429f-b46f-168429b1907e --dry-run');
  process.exit(1);
}

// 執行恢復
restoreConsolidation(options)
  .catch((error) => {
    console.error('❌ 恢復失敗:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
