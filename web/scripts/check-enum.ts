import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 查詢資料庫中的 enum 值
    const result = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = 'milestonestatusenum'::regtype
      ORDER BY enumsortorder;
    `;

    console.log('Database enum values:', result);

    // 嘗試創建一個測試 milestone
    const testUser = await prisma.user.findFirst();
    if (testUser) {
      const testArea = await prisma.area.findFirst({ where: { user_id: testUser.id } });
      if (testArea) {
        console.log('\nAttempting to create test milestone...');
        try {
          const milestone = await prisma.milestone.create({
            data: {
              user_id: testUser.id,
              name: 'Test Milestone',
              target_date: new Date(),
              entity_type: 'AREA',
              entity_id: testArea.id,
              priority: 5,
              status: 'planned',
            },
          });
          console.log('Success! Milestone created:', milestone.id);

          // 清理
          await prisma.milestone.delete({ where: { id: milestone.id } });
          console.log('Test milestone deleted');
        } catch (err) {
          console.error('Failed to create milestone:', err);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
