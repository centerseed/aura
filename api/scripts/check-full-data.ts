import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkFullData() {
  try {
    // 排除測試用戶
    const realUsers = await prisma.user.findMany({
      where: {
        AND: [
          { deleted_at: null },
          {
            email: {
              not: {
                contains: 'test-'
              }
            }
          }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        _count: {
          select: {
            products: true,
            tasks: true,
            areas: true
          }
        }
      }
    });

    console.log('📊 真實用戶資料統計:\n');

    for (const user of realUsers) {
      console.log(`👤 ${user.email || user.name}`);
      console.log(`   📦 Products: ${user._count.products}`);
      console.log(`   📋 Tasks: ${user._count.tasks}`);
      console.log(`   🗂️  Areas: ${user._count.areas}`);
      console.log('');
    }

    // 檢查總計
    const totalProducts = await prisma.product.count({ where: { deleted_at: null } });
    const totalTasks = await prisma.task.count({ where: { deleted_at: null } });
    const totalAreas = await prisma.area.count({ where: { deleted_at: null } });

    console.log('📈 資料庫總計:');
    console.log(`   Products: ${totalProducts}`);
    console.log(`   Tasks: ${totalTasks}`);
    console.log(`   Areas: ${totalAreas}`);

  } catch (error) {
    console.error('❌ 查詢失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFullData();
