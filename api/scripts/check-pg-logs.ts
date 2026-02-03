import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPGLogs() {
  try {
    // 嘗試從 PostgreSQL 的 pg_stat_statements 找到刪除語句
    const result = await prisma.$queryRaw`
      SELECT
        query,
        calls,
        total_exec_time,
        mean_exec_time
      FROM pg_stat_statements
      WHERE query LIKE '%DELETE%task%'
      ORDER BY last_exec_time DESC
      LIMIT 10
    `;

    console.log('📊 最近的 DELETE 操作:');
    console.log(result);

  } catch (error: any) {
    if (error.message.includes('pg_stat_statements')) {
      console.log('⚠️  pg_stat_statements 擴展未啟用');
      console.log('   無法查詢 SQL 歷史記錄');
    } else {
      console.error('❌ 查詢失敗:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkPGLogs();
