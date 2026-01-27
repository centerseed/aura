import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'centerseedwu@gmail.com' },
      include: {
        areas: {
          include: {
            products: {
              include: {
                tasks: true
              }
            }
          }
        }
      }
    });
    
    if (!user) {
      console.log('用戶不存在');
      return;
    }
    
    console.log(`\n=== 用戶: ${user.name} (${user.email}) ===\n`);
    
    user.areas.forEach((area) => {
      console.log(`📁 Area: ${area.name}`);
      console.log(`   Products: ${area.products.length}`);
      
      area.products.forEach((product) => {
        console.log(`   └─ 📦 Product: ${product.name} (${product.status})`);
        console.log(`      Tasks: ${product.tasks.length}`);
        
        product.tasks.forEach((task) => {
          console.log(`      └─ ✓ Task: ${task.content}`);
          console.log(`         Status: ${task.status}`);
          console.log(`         Drawer: ${task.status}`);
        });
      });
      console.log('');
    });
    
    const totalTasks = user.areas.reduce((sum, area) => 
      sum + area.products.reduce((psum, product) => psum + product.tasks.length, 0), 0);
    
    const archivedTasks = user.areas.reduce((sum, area) => 
      sum + area.products.reduce((psum, product) => 
        psum + product.tasks.filter(t => t.status === 'ARCHIVE').length, 0), 0);
    
    console.log(`\n📊 統計:`);
    console.log(`   總 Areas: ${user.areas.length}`);
    console.log(`   總 Products: ${user.areas.reduce((sum, area) => sum + area.products.length, 0)}`);
    console.log(`   總 Tasks: ${totalTasks}`);
    console.log(`   已歸檔 Tasks: ${archivedTasks}`);
    console.log(`   活躍 Tasks: ${totalTasks - archivedTasks}`);
    
  } catch (error) {
    console.error('錯誤:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
