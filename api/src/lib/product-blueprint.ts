/**
 * Product Blueprint — 動態語意表示
 *
 * Product 的 embedding 從靜態（name | description）升級為動態（name | description | topics | recent tasks）。
 * Blueprint 更新零 LLM 成本，只需一次 embedding API 呼叫。
 */

import { prisma } from "./db";
import { getEmbedding } from "./embedding";

const BLUEPRINT_STALENESS_THRESHOLD = 3;
const BLUEPRINT_MAX_LENGTH = 2000;

/**
 * 生成 product 的 blueprint 文本
 * 格式：name | description | Topics: [topic names] | Tasks: [task titles]
 */
export async function generateBlueprintText(productId: string): Promise<string> {
  const [product, topics, tasks] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, description: true },
    }),
    prisma.topic.findMany({
      where: { product_id: productId, deleted_at: null },
      select: { name: true },
    }),
    prisma.task.findMany({
      where: { product_id: productId, deleted_at: null, status: { not: "ARCHIVE" } },
      orderBy: { updated_at: "desc" },
      take: 20,
      select: { content: true },
    }),
  ]);

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const parts = [product.name];
  if (product.description) parts.push(product.description);
  if (topics.length) parts.push(`Topics: ${topics.map((t) => t.name).join(", ")}`);
  if (tasks.length) parts.push(`Tasks: ${tasks.map((t) => t.content).join(", ")}`);

  return parts.join(" | ").slice(0, BLUEPRINT_MAX_LENGTH);
}

/**
 * 更新 product 的 blueprint embedding
 */
export async function updateProductBlueprint(productId: string): Promise<void> {
  const blueprintText = await generateBlueprintText(productId);
  const embedding = await getEmbedding(blueprintText);
  const vectorStr = `[${embedding.join(",")}]`;

  const taskCount = await prisma.task.count({
    where: { product_id: productId, deleted_at: null, status: { not: "ARCHIVE" } },
  });

  await prisma.$executeRaw`
    UPDATE products
    SET blueprint_text = ${blueprintText},
        blueprint_embedding = ${vectorStr}::vector,
        blueprint_updated_at = NOW(),
        task_count_at_blueprint = ${taskCount}
    WHERE id = ${productId}::uuid
  `;

  console.log(
    `✅ [blueprint] Updated blueprint for Product "${blueprintText.slice(0, 50)}..." (${taskCount} tasks)`
  );
}

/**
 * 條件式更新：當前 task 數與上次生成時差距 >= threshold 時才重新生成
 */
export async function maybeRefreshBlueprint(productId: string): Promise<void> {
  const [product, currentTaskCount] = await Promise.all([
    prisma.$queryRaw<Array<{ task_count_at_blueprint: number }>>`
      SELECT task_count_at_blueprint
      FROM products
      WHERE id = ${productId}::uuid
    `,
    prisma.task.count({
      where: { product_id: productId, deleted_at: null, status: { not: "ARCHIVE" } },
    }),
  ]);

  const lastCount = product[0]?.task_count_at_blueprint ?? 0;

  if (currentTaskCount - lastCount >= BLUEPRINT_STALENESS_THRESHOLD) {
    await updateProductBlueprint(productId);
  }
}
