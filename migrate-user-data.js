#!/usr/bin/env node

/**
 * 將一個用戶的資料遷移到另一個用戶
 */

const { Client } = require('pg');

const supabaseConnection = "postgresql://postgres.jeatbzmznavvjkwilsyn:REDACTED_DB_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

const sourceUserId = '3d54cc08-f1f5-4a27-b1d4-d7210214b4a2';
const targetUserId = '467c7125-d890-429f-b46f-168429b1907e';

async function migrateUserData() {
  console.log('🚀 開始用戶資料遷移...\n');
  console.log(`   源用戶: ${sourceUserId}`);
  console.log(`   目標用戶: ${targetUserId}\n`);

  const client = new Client({ connectionString: supabaseConnection });

  try {
    await client.connect();
    console.log('✅ 已連接到 Supabase\n');

    // 1. 檢查用戶是否存在
    console.log('🔍 檢查用戶...\n');

    const sourceUser = await client.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [sourceUserId]
    );

    const targetUser = await client.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [targetUserId]
    );

    if (sourceUser.rows.length === 0) {
      throw new Error(`源用戶不存在: ${sourceUserId}`);
    }

    if (targetUser.rows.length === 0) {
      throw new Error(`目標用戶不存在: ${targetUserId}`);
    }

    console.log(`   源用戶: ${sourceUser.rows[0].name || sourceUser.rows[0].email || 'Unnamed'}`);
    console.log(`   目標用戶: ${targetUser.rows[0].name || targetUser.rows[0].email || 'Unnamed'}\n`);

    // 2. 統計源用戶的資料
    console.log('📊 統計源用戶的資料...\n');

    const tables = [
      { name: 'areas', column: 'user_id' },
      { name: 'products', column: 'user_id' },
      { name: 'topics', column: 'user_id' },
      { name: 'tasks', column: 'user_id' },
      { name: 'milestones', column: 'user_id' },
      { name: 'governance_proposals', column: 'user_id' }
    ];

    const stats = {};

    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.column} = $1`,
        [sourceUserId]
      );
      stats[table.name] = parseInt(result.rows[0].count);
      console.log(`   ${table.name.padEnd(25)} ${String(stats[table.name]).padStart(5)} 筆`);
    }

    const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
    console.log(`\n   總計: ${totalRecords} 筆資料\n`);

    if (totalRecords === 0) {
      console.log('⚠️  源用戶沒有任何資料需要遷移');
      return;
    }

    // 3. 確認遷移
    console.log('⚠️  即將執行資料遷移...');
    console.log(`   這將把 ${totalRecords} 筆資料從源用戶轉移到目標用戶\n`);

    // 4. 執行遷移
    console.log('⏳ 開始遷移資料...\n');
    await client.query('BEGIN');

    try {
      for (const table of tables) {
        if (stats[table.name] > 0) {
          const result = await client.query(
            `UPDATE ${table.name} SET ${table.column} = $1 WHERE ${table.column} = $2`,
            [targetUserId, sourceUserId]
          );
          console.log(`   ✅ ${table.name}: 已遷移 ${result.rowCount} 筆`);
        }
      }

      await client.query('COMMIT');
      console.log('\n✅ 遷移事務已提交\n');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // 5. 驗證遷移結果
    console.log('🔍 驗證遷移結果...\n');

    console.log('   源用戶剩餘資料：');
    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.column} = $1`,
        [sourceUserId]
      );
      const count = parseInt(result.rows[0].count);
      console.log(`      ${table.name.padEnd(25)} ${String(count).padStart(5)} 筆`);
    }

    console.log('\n   目標用戶新增資料：');
    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.column} = $1`,
        [targetUserId]
      );
      const count = parseInt(result.rows[0].count);
      console.log(`      ${table.name.padEnd(25)} ${String(count).padStart(5)} 筆`);
    }

    await client.end();

    console.log('\n✅ 用戶資料遷移完成！');
    console.log('\n💡 提醒：');
    console.log('   - 所有資料已成功轉移到目標用戶');
    console.log('   - 源用戶帳號仍然存在，但沒有任何資料');
    console.log('   - 可以在 Supabase Dashboard 或 Prisma Studio 查看');

  } catch (error) {
    console.error('\n❌ 遷移失敗:', error.message);
    console.error('\n詳細錯誤:', error);
    process.exit(1);
  }
}

migrateUserData();
