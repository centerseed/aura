import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const USER_ID = '467c7125-d890-429f-b46f-168429b1907e';

async function checkProductContent() {
  try {
    const products = await prisma.product.findMany({
      where: { user_id: USER_ID, deleted_at: null },
      select: {
        name: true,
        description: true,
        _count: {
          select: {
            tasks: {
              where: {
                deleted_at: null,
                status: { not: 'ARCHIVE' }
              }
            }
          }
        }
      }
    });

    console.log('📊 Products 內容檢查:\n');

    products.forEach(p => {
      console.log(`📦 ${p.name}`);
      console.log(`   描述: ${p.description || '(空白)'}`);
      console.log(`   未完成任務數: ${p._count.tasks}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 檢查失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductContent();
