/**
 * POC Librarian Engine - Database Teardown Script
 *
 * 清理 poc_librarian schema 中的所有測試資料
 * 🛡️ 只操作 poc_librarian schema，不影響主系統
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function teardownDatabase() {
  console.log('🧹 開始清理 POC Librarian 測試資料...\n');

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ 錯誤：DATABASE_URL 環境變數未設定');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ 資料庫連線成功');

    // 🛡️ 設定 search_path，確保只操作 poc_librarian
    await client.query('SET search_path TO poc_librarian;');

    // 統計清理前的資料量
    const beforeStats = await getTableStats(client);
    console.log('\n📊 清理前的資料量：');
    Object.entries(beforeStats).forEach(([table, count]) => {
      console.log(`   - ${table}: ${count} 筆`);
    });

    // 清理資料（按依賴順序）
    console.log('\n🗑️ 清理資料...');

    await client.query('DELETE FROM poc_librarian.evaluations;');
    console.log('   ✅ evaluations 已清空');

    await client.query('DELETE FROM poc_librarian.rules;');
    console.log('   ✅ rules 已清空');

    await client.query('DELETE FROM poc_librarian.corrections;');
    console.log('   ✅ corrections 已清空');

    // 驗證清理結果
    const afterStats = await getTableStats(client);
    console.log('\n📊 清理後的資料量：');
    Object.entries(afterStats).forEach(([table, count]) => {
      console.log(`   - ${table}: ${count} 筆`);
    });

    console.log('\n🎉 POC Librarian 測試資料清理完成！');

  } catch (error) {
    console.error('\n❌ 清理失敗：');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function getTableStats(client: pg.Client): Promise<Record<string, number>> {
  const tables = ['corrections', 'rules', 'evaluations'];
  const stats: Record<string, number> = {};

  for (const table of tables) {
    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM poc_librarian.${table}`
      );
      stats[table] = parseInt(result.rows[0].count, 10);
    } catch {
      stats[table] = 0;
    }
  }

  return stats;
}

// 執行
teardownDatabase();
