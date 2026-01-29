/**
 * 資料庫連線測試腳本
 * 用於診斷 Prisma 連線問題
 */
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn', 'info'],
  });

  try {
    console.log('🔄 正在測試資料庫連線...');
    console.log('📍 DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

    // 簡單的查詢測試
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ 資料庫連線成功!');

    // 測試 User 表是否存在
    const userCount = await prisma.user.count();
    console.log(`✅ User 表存在,共有 ${userCount} 個用戶`);

  } catch (error) {
    console.error('❌ 資料庫連線失敗:');
    console.error('錯誤碼:', error.code);
    console.error('錯誤訊息:', error.message);
    console.error('\n詳細錯誤:', error);

    if (error.code === 'P1001') {
      console.log('\n💡 可能的解決方案:');
      console.log('1. 檢查 Supabase 專案是否處於暫停狀態');
      console.log('2. 確認 DATABASE_URL 中的密碼是否正確');
      console.log('3. 嘗試在 DATABASE_URL 加入 sslmode=require');
      console.log('4. 檢查網路防火牆設定');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
