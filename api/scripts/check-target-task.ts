import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const taskId = 'ff7a5616-6628-4e09-ad96-c8702faec59d';

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      product: { include: { area: true } },
      topic: true,
    }
  });

  if (!task) {
    console.log('找不到任務');
    return;
  }

  console.log(`\n任務詳情:`);
  console.log(`ID: ${task.id}`);
  console.log(`標題: ${task.content}`);
  console.log(`Product: ${task.product.name}`);
  console.log(`Area: ${task.product.area.name}`);
  console.log(`Topic: ${task.topic?.name || 'null'}`);
  console.log(`創建時間: ${task.created_at}`);
  console.log(`Sub-items: ${JSON.stringify(task.sub_items, null, 2)}`);

  console.log(`\n\n問題分析:`);
  console.log(`用戶輸入: "@Zentropy 修正所有前後端的bug"`);
  console.log(`任務標題: "${task.content}"`);
  console.log(`\n這兩者完全不相關！`);
  console.log(`"修正所有前後端的bug" 和 "架構可重用 App Repo 層" 是完全不同的事情`);
  console.log(`\nAI 錯誤地認為這是追加 sub-item，而不是創建新任務`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
