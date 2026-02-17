/**
 * 驗證腳本: 檢查 AI metadata 遷移的完整性和正確性
 *
 * 使用方式:
 *   tsx scripts/verify-ai-metadata.ts
 *
 * 驗證項目:
 * 1. 檢查 JSON 和新表的資料是否一致
 * 2. 檢查是否有資料遺失
 * 3. 檢查索引是否正確建立
 * 4. 顯示詳細的統計資訊
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface AIAnalysis {
  urgency_level?: string;
  time_inference_reasoning?: string;
  reorganized_at?: string;
}

async function verifyAIMetadata() {
  console.log('\n🔍 開始驗證 AI metadata 遷移...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 檢查資料表是否存在
  console.log('📋 Step 1: 檢查資料表結構\n');

  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'task_ai_metadata'
      ) as exists
    `;

    if (!tableExists[0].exists) {
      errors.push('❌ task_ai_metadata 表不存在，請先執行 migration');
      console.log('❌ task_ai_metadata 表不存在\n');
      return;
    }

    console.log('✅ task_ai_metadata 表已存在\n');
  } catch (error) {
    errors.push(`❌ 檢查資料表失敗: ${error}`);
    return;
  }

  // 2. 檢查索引是否建立
  console.log('📋 Step 2: 檢查索引\n');

  try {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'task_ai_metadata'
    `;

    const indexNames = indexes.map(idx => idx.indexname);

    console.log('已建立的索引:');
    indexNames.forEach(name => console.log(`  - ${name}`));

    const requiredIndexes = [
      'task_ai_metadata_pkey',
      'task_ai_metadata_task_id_key',
      'task_ai_metadata_urgency_level_idx',
      'task_ai_metadata_reorganized_at_idx',
    ];

    const missingIndexes = requiredIndexes.filter(idx => !indexNames.includes(idx));

    if (missingIndexes.length > 0) {
      warnings.push(`⚠️ 缺少索引: ${missingIndexes.join(', ')}`);
      console.log(`\n⚠️ 缺少索引: ${missingIndexes.join(', ')}`);
    } else {
      console.log('\n✅ 所有索引都已正確建立');
    }
    console.log('');
  } catch (error) {
    warnings.push(`⚠️ 檢查索引失敗: ${error}`);
  }

  // 3. 比對資料一致性
  console.log('📋 Step 3: 比對資料一致性\n');

  // 查找所有有 ai_analysis 且包含重組資料的 tasks
  const tasksWithAnalysis = await prisma.task.findMany({
    where: {
      ai_analysis: { not: Prisma.DbNull },
      deleted_at: null,
    },
    select: {
      id: true,
      ai_analysis: true,
      ai_metadata: true,
    },
  });

  console.log(`找到 ${tasksWithAnalysis.length} 個 tasks 有 ai_analysis\n`);

  let matchCount = 0;
  let mismatchCount = 0;
  let missingInNewTable = 0;
  let extraInNewTable = 0;

  for (const task of tasksWithAnalysis) {
    const analysis = task.ai_analysis as AIAnalysis | null;

    if (!analysis) continue;

    const hasReorgData =
      analysis.urgency_level ||
      analysis.time_inference_reasoning ||
      analysis.reorganized_at;

    if (hasReorgData) {
      // 應該要有對應的 metadata record
      if (!task.ai_metadata) {
        missingInNewTable++;
        warnings.push(`⚠️ Task ${task.id.slice(0, 8)} 在 JSON 有資料但新表沒有`);
        continue;
      }

      // 檢查資料是否一致
      const urgencyMatch =
        task.ai_metadata.urgency_level === (analysis.urgency_level || null);
      const reasoningMatch =
        task.ai_metadata.time_inference_reasoning ===
        (analysis.time_inference_reasoning || null);

      const reorganizedAtMatch =
        (!task.ai_metadata.reorganized_at && !analysis.reorganized_at) ||
        (task.ai_metadata.reorganized_at &&
          analysis.reorganized_at &&
          new Date(task.ai_metadata.reorganized_at).getTime() ===
            new Date(analysis.reorganized_at).getTime());

      if (urgencyMatch && reasoningMatch && reorganizedAtMatch) {
        matchCount++;
      } else {
        mismatchCount++;
        console.log(`⚠️ 不一致 (task ${task.id.slice(0, 8)}):`);
        if (!urgencyMatch) {
          console.log(`   urgency_level: JSON="${analysis.urgency_level}" vs DB="${task.ai_metadata.urgency_level}"`);
        }
        if (!reasoningMatch) {
          console.log(`   reasoning: 長度 JSON=${analysis.time_inference_reasoning?.length || 0} vs DB=${task.ai_metadata.time_inference_reasoning?.length || 0}`);
        }
        if (!reorganizedAtMatch) {
          console.log(`   reorganized_at: JSON="${analysis.reorganized_at}" vs DB="${task.ai_metadata.reorganized_at}"`);
        }
      }
    } else {
      // 不應該有 metadata record
      if (task.ai_metadata) {
        extraInNewTable++;
        warnings.push(`⚠️ Task ${task.id.slice(0, 8)} 在 JSON 沒資料但新表有`);
      }
    }
  }

  console.log('\n資料一致性統計:');
  console.log(`  ✅ 一致: ${matchCount} 個 tasks`);
  if (mismatchCount > 0) {
    console.log(`  ⚠️ 不一致: ${mismatchCount} 個 tasks`);
  }
  if (missingInNewTable > 0) {
    console.log(`  ⚠️ 新表缺少: ${missingInNewTable} 個 tasks`);
  }
  if (extraInNewTable > 0) {
    console.log(`  ⚠️ 新表多餘: ${extraInNewTable} 個 tasks`);
  }
  console.log('');

  // 4. 顯示統計資訊
  console.log('📋 Step 4: 統計資訊\n');

  const totalMetadata = await prisma.taskAIMetadata.count();
  const totalTasks = await prisma.task.count({
    where: { deleted_at: null },
  });

  console.log(`總 tasks 數: ${totalTasks}`);
  console.log(`有 AI metadata 的 tasks: ${totalMetadata} (${((totalMetadata / totalTasks) * 100).toFixed(1)}%)\n`);

  // 緊急程度分布
  const urgencyStats = await prisma.taskAIMetadata.groupBy({
    by: ['urgency_level'],
    _count: true,
  });

  console.log('緊急程度分布:');
  urgencyStats.forEach(stat => {
    const percentage = ((stat._count / totalMetadata) * 100).toFixed(1);
    console.log(`  - ${stat.urgency_level || '(null)'}: ${stat._count} (${percentage}%)`);
  });
  console.log('');

  // 最近重組的 tasks
  const recentReorganized = await prisma.taskAIMetadata.count({
    where: {
      reorganized_at: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近 7 天
      },
    },
  });

  console.log(`最近 7 天重組的 tasks: ${recentReorganized}\n`);

  // 5. 總結
  console.log('📋 驗證總結\n');

  if (errors.length > 0) {
    console.log('❌ 發現錯誤:');
    errors.forEach(err => console.log(`   ${err}`));
    console.log('');
  }

  if (warnings.length > 0 && warnings.length <= 10) {
    console.log('⚠️ 發現警告:');
    warnings.forEach(warn => console.log(`   ${warn}`));
    console.log('');
  } else if (warnings.length > 10) {
    console.log(`⚠️ 發現 ${warnings.length} 個警告（過多不顯示細節）\n`);
  }

  if (errors.length === 0 && mismatchCount === 0 && missingInNewTable === 0) {
    console.log('✅ 驗證通過！資料遷移完整且正確。\n');
  } else {
    console.log('⚠️ 驗證發現問題，請檢查上述錯誤和警告。\n');
  }
}

verifyAIMetadata()
  .catch((error) => {
    console.error('❌ 驗證失敗:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
