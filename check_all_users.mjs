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
      console.log(`   Auth: ${user.auth_provider}`);
      console.log(`   Created: ${user.created_at.toLocaleString('zh-TW')}`);
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
      
      console.log(`   Tasks: ${taskCount}`);
      console.log('');
    }
    
    // 查詢最近的 Task 活動
    const recentTasks = await prisma.task.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        content: true,
        status: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
        product: {
          select: {
            name: true,
            area: {
              select: {
                name: true,
                user: {
                  select: {
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    console.log(`\n📝 最近建立的 Tasks (最多 10 個):\n`);
    recentTasks.forEach(task => {
      console.log(`   ${task.deleted_at ? '❌ [已刪除]' : '✓'} ${task.content}`);
      console.log(`      User: ${task.product.area.user.email}`);
      console.log(`      Area: ${task.product.area.name} > Product: ${task.product.name}`);
      console.log(`      Created: ${task.created_at.toLocaleString('zh-TW')}`);
      if (task.deleted_at) {
        console.log(`      Deleted: ${task.deleted_at.toLocaleString('zh-TW')}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
