import type { PrismaClient } from "@prisma/client";

interface CleanupParams {
  productId: string;
  operatedTopicIds: string[];
  proposedTopicNames: string[];
}

/**
 * 清理不在 proposed_clusters 且不在 topic_operations 中的舊 topic。
 * - 如果舊 topic 上還有殘留 task（AI 漏掉的），先把 task 移到「未分類」
 * - 然後軟刪除舊 topic
 */
export async function cleanupZombieTopics(
  db: PrismaClient,
  params: CleanupParams,
) {
  const { productId, operatedTopicIds, proposedTopicNames } = params;
  const operatedSet = new Set(operatedTopicIds);
  const proposedSet = new Set(proposedTopicNames);

  const allTopics = await db.topic.findMany({
    where: { product_id: productId, deleted_at: null },
    select: { id: true, name: true },
  });

  console.log(`  [ZOMBIE CLEANUP] allTopics: ${allTopics.map(t => t.name).join(', ')}`);
  console.log(`  [ZOMBIE CLEANUP] operatedSet: ${operatedTopicIds.join(', ')}`);
  console.log(`  [ZOMBIE CLEANUP] proposedSet: ${proposedTopicNames.join(', ')}`);

  const deletedTopics: string[] = [];

  for (const topic of allTopics) {
    if (operatedSet.has(topic.id) || proposedSet.has(topic.name)) {
      console.log(`  [ZOMBIE CLEANUP] 保留: ${topic.name}`);
      continue;
    }

    // 檢查殘留 active task
    const activeTaskCount = await db.task.count({
      where: { topic_id: topic.id, deleted_at: null, status: { not: "ARCHIVE" } },
    });

    if (activeTaskCount > 0) {
      // AI 漏掉的 task → 移到「未分類」
      console.log(`  [ZOMBIE CLEANUP] ${topic.name} 有 ${activeTaskCount} 個殘留 task → 移到未分類`);
      await db.task.updateMany({
        where: { topic_id: topic.id, deleted_at: null, status: { not: "ARCHIVE" } },
        data: { topic_id: null },
      });
    }

    console.log(`  [ZOMBIE CLEANUP] 刪除: ${topic.name}`);
    await db.topic.update({
      where: { id: topic.id },
      data: { deleted_at: new Date() },
    });
    deletedTopics.push(topic.name);
  }

  return { deletedTopics };
}
