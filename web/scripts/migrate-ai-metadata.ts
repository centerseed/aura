/**
 * 資料遷移腳本: 將 ai_analysis JSON 中的重組相關欄位遷移到 task_ai_metadata 表
 *
 * 使用方式:
 *   tsx scripts/migrate-ai-metadata.ts
 *
 * 功能:
 * 1. 從所有 tasks 的 ai_analysis 欄位提取 urgency_level、time_inference_reasoning、reorganized_at
 * 2. 將這些資料寫入 task_ai_metadata 表
 * 3. 不會刪除或修改原本的 ai_analysis JSON（保持向後相容）
 *
 * 注意:
 * - 執行前請確保已執行 Prisma migration (npx prisma migrate deploy)
 * - 此腳本是 idempotent，可以重複執行
 * - 使用 UPSERT 語法，不會產生重複資料
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface AIAnalysis {
  urgency_level?: string;
  time_inference_reasoning?: string;
  reorganized_at?: string;
  // ... 其他欄位不需要處理
}

async function migrateAIMetadata() {
  console.log('\n🚀 開始遷移 AI metadata 到獨立資料表...\n');

  // 1. 查找所有有 ai_analysis 的 tasks
  const tasks = await prisma.task.findMany({
    where: {
      ai_analysis: {
        not: Prisma.DbNull,
      },
      deleted_at: null, // 只處理未刪除的 tasks
    },
    select: {
      id: true,
      ai_analysis: true,
    },
  });

  console.log(`📊 找到 ${tasks.length} 個 tasks 有 ai_analysis 資料\n`);

  // 2. 統計需要遷移的 tasks
  let tasksWithMetadata = 0;
  let tasksWithoutMetadata = 0;

  const metadataToMigrate: Array<{
    task_id: string;
    time_inference_reasoning: string | null;
    urgency_level: string | null;
    reorganized_at: Date | null;
  }> = [];

  for (const task of tasks) {
    const analysis = task.ai_analysis as AIAnalysis | null;

    if (!analysis) {
      tasksWithoutMetadata++;
      continue;
    }

    // 檢查是否有需要遷移的欄位
    const hasMetadata =
      analysis.urgency_level ||
      analysis.time_inference_reasoning ||
      analysis.reorganized_at;

    if (hasMetadata) {
      tasksWithMetadata++;

      // 準備要遷移的資料
      metadataToMigrate.push({
        task_id: task.id,
        time_inference_reasoning: analysis.time_inference_reasoning || null,
        urgency_level: analysis.urgency_level || null,
        reorganized_at: analysis.reorganized_at
          ? new Date(analysis.reorganized_at)
          : null,
      });
    } else {
      tasksWithoutMetadata++;
    }
  }

  console.log(`✅ 需要遷移的 tasks: ${tasksWithMetadata} 個`);
  console.log(`⚪ 不需要遷移的 tasks: ${tasksWithoutMetadata} 個\n`);

  if (metadataToMigrate.length === 0) {
    console.log('✅ 沒有需要遷移的資料，完成！\n');
    return;
  }

  // 3. 批次寫入 task_ai_metadata（使用 UPSERT）
  console.log('📝 開始批次寫入 task_ai_metadata...\n');

  let successCount = 0;
  let errorCount = 0;

  // 逐一 upsert（Prisma 不支援 batch upsert，需要逐一執行）
  // 但因為只有少數 tasks 有重組資料，所以性能可接受
  for (const metadata of metadataToMigrate) {
    try {
      await prisma.taskAIMetadata.upsert({
        where: {
          task_id: metadata.task_id,
        },
        create: {
          task_id: metadata.task_id,
          time_inference_reasoning: metadata.time_inference_reasoning,
          urgency_level: metadata.urgency_level,
          reorganized_at: metadata.reorganized_at,
        },
        update: {
          time_inference_reasoning: metadata.time_inference_reasoning,
          urgency_level: metadata.urgency_level,
          reorganized_at: metadata.reorganized_at,
          updated_at: new Date(),
        },
      });
      successCount++;

      // 每處理 10 個顯示進度
      if (successCount % 10 === 0) {
        console.log(`   已處理: ${successCount}/${metadataToMigrate.length}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`   ❌ 錯誤 (task ${metadata.task_id.slice(0, 8)}):`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\n✅ 成功遷移: ${successCount} 個 tasks`);
  if (errorCount > 0) {
    console.log(`❌ 失敗: ${errorCount} 個 tasks`);
  }

  // 4. 顯示統計資訊
  console.log('\n📊 遷移統計:\n');

  const urgencyStats = await prisma.taskAIMetadata.groupBy({
    by: ['urgency_level'],
    _count: true,
  });

  console.log('緊急程度分布:');
  urgencyStats.forEach(stat => {
    console.log(`  - ${stat.urgency_level || '(null)'}: ${stat._count} 個 tasks`);
  });

  const totalMetadata = await prisma.taskAIMetadata.count();
  console.log(`\n總計: ${totalMetadata} 個 tasks 有 AI metadata\n`);

  console.log('🎉 遷移完成！\n');
}

migrateAIMetadata()
  .catch((error) => {
    console.error('❌ 遷移失敗:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
