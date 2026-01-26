#!/usr/bin/env node

/**
 * 驗證 Supabase 遷移資料的完整性
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.jeatbzmznavvjkwilsyn:REDACTED_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
    }
  }
});

async function verify() {
  console.log('🔍 開始驗證 Supabase 資料完整性...\n');

  try {
    // 1. 檢查資料表筆數
    console.log('📊 資料表統計：\n');
    const userCount = await prisma.user.count();
    const areaCount = await prisma.area.count();
    const productCount = await prisma.product.count();
    const topicCount = await prisma.topic.count();
    const taskCount = await prisma.task.count();
    const milestoneCount = await prisma.milestone.count();

    console.log(`   Users:      ${userCount} 筆`);
    console.log(`   Areas:      ${areaCount} 筆`);
    console.log(`   Products:   ${productCount} 筆`);
    console.log(`   Topics:     ${topicCount} 筆`);
    console.log(`   Tasks:      ${taskCount} 筆`);
    console.log(`   Milestones: ${milestoneCount} 筆`);

    // 2. 檢查使用者資料樣本
    console.log('\n👤 使用者資料樣本：\n');
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        name: true,
        auth_provider: true,
        created_at: true
      }
    });

    users.forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.name || 'Unnamed'} (${user.email || 'No email'})`);
      console.log(`      Provider: ${user.auth_provider}`);
      console.log(`      Created: ${user.created_at.toISOString().split('T')[0]}`);
    });

    // 3. 檢查外鍵關聯
    console.log('\n🔗 檢查資料關聯：\n');

    // 檢查有產品的領域數量
    const areasWithProducts = await prisma.area.findMany({
      where: {
        products: {
          some: {}
        }
      },
      take: 3,
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    console.log(`   有產品的領域：${areasWithProducts.length} 個`);
    areasWithProducts.forEach(area => {
      console.log(`      - ${area.name}: ${area._count.products} 個產品`);
    });

    // 檢查有任務的主題數量
    const topicsWithTasks = await prisma.topic.findMany({
      where: {
        tasks: {
          some: {}
        }
      },
      take: 3,
      include: {
        _count: {
          select: { tasks: true }
        }
      }
    });

    console.log(`\n   有任務的主題：${topicsWithTasks.length} 個`);
    topicsWithTasks.forEach(topic => {
      console.log(`      - ${topic.title}: ${topic._count.tasks} 個任務`);
    });

    // 4. 檢查資料完整性
    console.log('\n✅ 資料完整性檢查：\n');

    // 檢查孤兒產品（沒有關聯到領域的產品）
    const orphanProducts = await prisma.product.count({
      where: {
        area_id: null
      }
    });
    console.log(`   孤兒產品（無領域）: ${orphanProducts} 個`);

    // 檢查孤兒主題（沒有關聯到產品的主題）
    const orphanTopics = await prisma.topic.count({
      where: {
        product_id: null
      }
    });
    console.log(`   孤兒主題（無產品）: ${orphanTopics} 個`);

    // 檢查孤兒任務（沒有關聯到主題的任務）
    const orphanTasks = await prisma.task.count({
      where: {
        topic_id: null
      }
    });
    console.log(`   孤兒任務（無主題）: ${orphanTasks} 個`);

    console.log('\n✅ 驗證完成！');
    console.log('\n💡 下一步：');
    console.log('   1. 開啟 Prisma Studio 查看資料：http://localhost:5556');
    console.log('   2. 測試登入功能：cd web && npm run dev');
    console.log('   3. 訪問 http://localhost:3000 測試三種登入方式');

  } catch (error) {
    console.error('\n❌ 驗證失敗:', error.message);
    console.error('\n詳細錯誤:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
