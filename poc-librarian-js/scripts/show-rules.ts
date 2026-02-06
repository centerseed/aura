import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const result = await client.query(`
    SELECT user_id, description, trigger_conditions, result_action, confidence
    FROM poc_librarian.rules
    ORDER BY user_id, created_at
  `);

  console.log('蒸餾出的規則：');
  console.log('='.repeat(70));

  for (const row of result.rows) {
    console.log('\n👤 用戶:', row.user_id);
    console.log('📝 描述:', row.description);
    console.log('🎯 觸發條件:', JSON.stringify(row.trigger_conditions, null, 2));
    console.log('📤 結果動作:', JSON.stringify(row.result_action, null, 2));
    console.log('📊 信心度:', (row.confidence * 100) + '%');
    console.log('-'.repeat(70));
  }

  await client.end();
}

main();
