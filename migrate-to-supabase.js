#!/usr/bin/env node

/**
 * 將本地資料庫資料遷移到 Supabase
 */

const { Client } = require('pg');
const fs = require('fs');

const supabaseConnection = "postgresql://postgres.jeatbzmznavvjkwilsyn:REDACTED_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";
const sqlFile = '/tmp/naruvia_data_export.sql';

async function migrate() {
  console.log('🚀 開始遷移資料到 Supabase...\n');

  const client = new Client({ connectionString: supabaseConnection });

  try {
    await client.connect();
    console.log('✅ 已連接到 Supabase\n');

    // 讀取 SQL 檔案並過濾出 INSERT 語句
    console.log('📖 讀取匯出檔案...');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    const lines = sqlContent.split('\n');

    // 只保留 INSERT 語句和 SELECT 語句
    const insertStatements = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('INSERT INTO') ||
             trimmed.startsWith('SELECT pg_catalog.setval');
    });

    console.log(`   原始檔案：${lines.length} 行`);
    console.log(`   INSERT 語句：${insertStatements.length} 行\n`);

    // 執行 SQL
    console.log('⏳ 執行 INSERT 語句...');
    await client.query('BEGIN');

    try {
      let successCount = 0;
      for (const statement of insertStatements) {
        if (statement.trim()) {
          await client.query(statement);
          successCount++;
          if (successCount % 50 === 0) {
            console.log(`   已執行 ${successCount}/${insertStatements.length} 條語句...`);
          }
        }
      }

      await client.query('COMMIT');
      console.log(`✅ 成功執行 ${successCount} 條 SQL 語句\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // 驗證資料
    console.log('🔍 驗證匯入的資料...\n');

    const tables = ['users', 'areas', 'products', 'topics', 'tasks', 'milestones'];

    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result.rows[0].count;
      console.log(`   ${table.padEnd(15)} ${String(count).padStart(5)} 筆`);
    }

    await client.end();

    console.log('\n✅ 遷移完成！');
    console.log('\n💡 提醒：');
    console.log('   - 資料已成功匯入到 Supabase');
    console.log('   - 可以在 Supabase Dashboard 的 Table Editor 查看');
    console.log('   - 本地資料庫資料仍保留，未受影響');

  } catch (error) {
    console.error('\n❌ 遷移失敗:', error.message);
    console.error('\n詳細錯誤:', error);
    process.exit(1);
  }
}

migrate();
