import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 使用原始查詢來查看所有 milestone（繞過 Prisma 類型檢查）
    const result = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      entity_type: string;
      status: string;
    }>>`
      SELECT id, name, entity_type, status
      FROM milestones
      WHERE deleted_at IS NULL;
    `;

    console.log('Existing milestones:');
    console.table(result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
