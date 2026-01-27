import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 查看所有 Tasks 的創建和更新時間
    const allTasks = await prisma.task.findMany({
      where: {
        product: {
          area: {
            user: {
              email: 'centerseedwu@gmail.com'
            }
          }
        }
      },
      select: {
        id: true,
        content: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
        status: true,
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
      orderBy: { created_at: 'desc' }
    });
    
    console.log(`\n📊 您的所有 Tasks (包含已刪除): ${allTasks.length} 個\n`);
    
    allTasks.forEach(task => {
      console.log(`${task.deleted_at ? '❌' : '✓'} ${task.content}`);
      console.log(`   Area: ${task.product.area.name} > Product: ${task.product.name}`);
      console.log(`   Created: ${task.created_at.toLocaleString('zh-TW')}`);
      console.log(`   Updated: ${task.updated_at.toLocaleString('zh-TW')}`);
      if (task.deleted_at) {
        console.log(`   Deleted: ${task.deleted_at.toLocaleString('zh-TW')}`);
      }
      console.log('');
    });
    
    // 查看最近的 Products
    const products = await prisma.product.findMany({
      where: {
        area: {
          user: {
            email: 'centerseedwu@gmail.com'
          }
        }
      },
      select: {
        name: true,
        created_at: true,
        _count: {
          select: {
            tasks: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });
    
    console.log(`\n📦 最近的 Products (前 10 個):\n`);
    products.forEach(p => {
      console.log(`${p.name} - Tasks: ${p._count.tasks} - Created: ${p.created_at.toLocaleString('zh-TW')}`);
    });
    
  } catch (error) {
    console.error('錯誤:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
