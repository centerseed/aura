import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 查詢所有用戶
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        auth_provider: true,
        created_at: true,
        _count: {
          select: {
            areas: true
          }
        }
      }
    });
    
    console.log(`\n📊 資料庫中的所有用戶 (${users.length} 個):\n`);
    
    for (const user of users) {
      console.log(`👤 ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Areas: ${user._count.areas}`);
      
      // 查詢這個用戶的詳細統計
      const taskCount = await prisma.task.count({
        where: {
          product: {
            area: {
              user_id: user.id
            }
          }
        }
      });
      
      const productCount = await prisma.product.count({
        where: {
          area: {
            user_id: user.id
          }
        }
      });
      
      console.log(`   Products: ${productCount}`);
      console.log(`   Tasks: ${taskCount}`);
      console.log('');
    }
    
    // 查詢資料庫中 Task 總數
    const totalTasks = await prisma.task.count();
    const totalProducts = await prisma.product.count();
    const totalAreas = await prisma.area.count();
    
    console.log(`\n💾 資料庫總計:`);
    console.log(`   Areas: ${totalAreas}`);
    console.log(`   Products: ${totalProducts}`);
    console.log(`   Tasks: ${totalTasks}`);
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
