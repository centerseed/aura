import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'centerseedwu@gmail.com' }
    });
    
    if (!user) {
      console.log('用戶不存在');
      return;
    }
    
    // 檢查被刪除的 Tasks
    const deletedTasks = await prisma.task.findMany({
      where: {
        product: {
          area: {
            user_id: user.id
          }
        },
        deleted_at: { not: null }
      },
      select: {
        id: true,
        content: true,
        status: true,
        deleted_at: true,
        product: {
          select: {
            name: true,
            area: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { deleted_at: 'desc' }
    });
    
    console.log(`\n🗑️  被刪除的 Tasks: ${deletedTasks.length} 個\n`);
    deletedTasks.slice(0, 10).forEach(task => {
      console.log(`   ❌ ${task.content}`);
      console.log(`      Area: ${task.product.area.name} > Product: ${task.product.name}`);
      console.log(`      刪除時間: ${task.deleted_at?.toLocaleString('zh-TW')}`);
      console.log('');
    });
    
    // 檢查所有 Tasks (包含未刪除的)
    const allTasks = await prisma.task.count({
      where: {
        product: {
          area: {
            user_id: user.id
          }
        }
      }
    });
    
    const activeTasks = await prisma.task.count({
      where: {
        product: {
          area: {
            user_id: user.id
          }
        },
        deleted_at: null
      }
    });
    
    console.log(`\n📊 統計:`);
    console.log(`   總 Tasks (包含已刪除): ${allTasks}`);
    console.log(`   活躍 Tasks: ${activeTasks}`);
    console.log(`   已刪除 Tasks: ${allTasks - activeTasks}`);
    
  } catch (error) {
    console.error('錯誤:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
