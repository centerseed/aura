import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 從截圖中看到的 Firebase UID
const FIREBASE_UID = 'Tfs1Zm4cfHgYMlj7ZNc30Cx2emO2';

async function findUser() {
  try {
    // 查詢用戶
    const user = await prisma.user.findFirst({
      where: {
        auth_provider_id: FIREBASE_UID
      },
      select: {
        id: true,
        email: true,
        name: true,
        auth_provider_id: true
      }
    });

    if (!user) {
      console.error('❌ 找不到用戶:', FIREBASE_UID);
      return;
    }

    console.log('✅ 找到用戶:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Firebase UID: ${user.auth_provider_id}`);

  } catch (error) {
    console.error('❌ 查詢失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUser();
