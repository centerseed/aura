/**
 * 資料庫狀態檢查
 *
 * 顯示 poc_librarian schema 的表、資料筆數、domain configs 等。
 *
 * 用法：npm run db:status
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function dbStatus() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL 未設定');
    process.exit(1);
  }

  const isNeon = connectionString.includes('neon.tech');
  const client = new Client({
    connectionString,
    ssl: isNeon ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();

    const sanitized = connectionString.replace(/:[^@]+@/, ':***@');
    console.log(`🔗 ${sanitized}`);
    console.log(`📦 類型: ${isNeon ? 'Neon' : 'Local'} PostgreSQL\n`);

    // 檢查 schema
    const schemaCheck = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'poc_librarian'`
    );
    if (schemaCheck.rows.length === 0) {
      console.log('❌ poc_librarian schema 不存在，請先執行 npm run db:init');
      return;
    }

    // 表列表 + 資料量
    console.log('📊 資料表統計：');
    const tables = ['corrections', 'rules', 'evaluations', 'domain_configs'];
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM poc_librarian.${table}`);
        console.log(`   ${table}: ${result.rows[0].count} 筆`);
      } catch {
        console.log(`   ${table}: (不存在)`);
      }
    }

    // Domain configs
    console.log('\n📋 Domain 設定：');
    try {
      const configs = await client.query(
        `SELECT domain, display_name, warm_threshold, distill_threshold, similarity_threshold, confidence_decay_days
         FROM poc_librarian.domain_configs ORDER BY domain`
      );
      for (const c of configs.rows) {
        console.log(`   ${c.domain} (${c.display_name})`);
        console.log(`     warm=${c.warm_threshold} distill=${c.distill_threshold} sim=${c.similarity_threshold} decay=${c.confidence_decay_days}d`);
      }
    } catch {
      console.log('   (domain_configs 表不存在)');
    }

    // 各 domain 的資料量
    console.log('\n📊 Domain 資料分佈：');
    try {
      const corByDomain = await client.query(
        `SELECT domain, COUNT(*) as count FROM poc_librarian.corrections GROUP BY domain ORDER BY domain`
      );
      if (corByDomain.rows.length === 0) {
        console.log('   corrections: (空)');
      } else {
        for (const r of corByDomain.rows) {
          console.log(`   corrections[${r.domain}]: ${r.count} 筆`);
        }
      }
    } catch { /* table doesn't exist */ }

    try {
      const rulesByDomain = await client.query(
        `SELECT domain, COUNT(*) as count, COUNT(*) FILTER (WHERE is_active) as active
         FROM poc_librarian.rules GROUP BY domain ORDER BY domain`
      );
      if (rulesByDomain.rows.length === 0) {
        console.log('   rules: (空)');
      } else {
        for (const r of rulesByDomain.rows) {
          console.log(`   rules[${r.domain}]: ${r.count} 筆 (${r.active} active)`);
        }
      }
    } catch { /* table doesn't exist */ }

    // pgvector
    const vectorCheck = await client.query(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS has_vector`
    );
    console.log(`\n🔧 pgvector: ${vectorCheck.rows[0].has_vector ? '✅ 已啟用' : '❌ 未啟用'}`);

  } catch (error) {
    console.error('❌ 連線失敗:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

dbStatus();
