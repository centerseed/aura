import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const USER_ID = '467c7125-d890-429f-b46f-168429b1907e';

async function debugProductContent() {
  try {
    console.log('🔍 檢查每個 Product 的完整內容...\n');

    const products = await prisma.product.findMany({
      where: { user_id: USER_ID, deleted_at: null },
      select: {
        name: true,
        description: true,
        tasks: {
          where: {
            deleted_at: null,
            status: { not: 'ARCHIVE' }
          },
          select: { content: true },
          orderBy: { updated_at: 'desc' }
          // 不設 take，載入所有未完成任務
        }
      }
    });

    products.forEach(p => {
      console.log(`📦 ${p.name}`);
      console.log(`   描述: ${p.description || '(無)'}`);
      console.log(`   任務數: ${p.tasks.length}`);
      if (p.tasks.length > 0) {
        console.log(`   任務內容:`);
        p.tasks.forEach((t, i) => {
          console.log(`     ${i + 1}. ${t.content}`);
        });
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugProductContent();
