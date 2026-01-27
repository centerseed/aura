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
      console.log('❌ 用戶不存在於資料庫');
    } else {
      console.log('✅ 找到用戶:');
      console.log(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        auth_provider: user.auth_provider,
        auth_provider_id: user.auth_provider_id,
        areas_count: user.areas.length,
        products_count: user.areas.reduce((sum, area) => sum + area.products.length, 0),
        tasks_count: user.areas.reduce((sum, area) => 
          sum + area.products.reduce((psum, product) => psum + product.tasks.length, 0), 0)
      }, null, 2));
      
      if (user.areas.length === 0) {
        console.log('\n⚠️  用戶沒有任何 Area 資料');
      }
    }
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
