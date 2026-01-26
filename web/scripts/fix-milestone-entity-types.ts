import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 更新所有小寫的 entity_type 為大寫
    const result = await prisma.$executeRaw`
      UPDATE milestones
      SET entity_type = UPPER(entity_type)::entitytypeenum
      WHERE entity_type::text IN ('area', 'product', 'topic')
      AND deleted_at IS NULL;
    `;

    console.log(`Updated ${result} milestone(s) entity_type to uppercase`);

    // 驗證更新結果
    const milestones = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      entity_type: string;
      status: string;
    }>>`
      SELECT id, name, entity_type, status
      FROM milestones
      WHERE deleted_at IS NULL
      LIMIT 5;
    `;

    console.log('\nSample milestones after update:');
    console.table(milestones);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
