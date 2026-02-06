/**
 * 初始化 Neon PostgreSQL 資料庫
 *
 * 在共用的 Neon DB 上建立 poc_librarian schema + 所有表。
 * 安全：只建立自己的 schema，不影響 api 的 public schema。
 *
 * 用法：npm run db:init
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function initNeonDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL 未設定，請先設定 .env');
    process.exit(1);
  }

  // 顯示連線目標（隱藏密碼）
  const sanitized = connectionString.replace(/:[^@]+@/, ':***@');
  console.log(`🔗 連線目標: ${sanitized}`);

  const isNeon = connectionString.includes('neon.tech');
  console.log(`📦 資料庫類型: ${isNeon ? 'Neon PostgreSQL' : '本地 PostgreSQL'}`);

  const client = new Client({
    connectionString,
    ssl: isNeon ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('✅ 連線成功\n');

    // Step 1: 檢查 pgvector
    console.log('📦 Step 1: 確認 pgvector 擴展...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;');
      console.log('   ✅ pgvector 已啟用');
    } catch (err: any) {
      if (err.code === '42710') {
        console.log('   ✅ pgvector 已存在');
      } else {
        console.log(`   ⚠️ pgvector 安裝失敗: ${err.message}`);
        console.log('   （Neon 預設已啟用 pgvector，可忽略此錯誤）');
      }
    }

    // Step 2: 建立 schema
    console.log('\n📦 Step 2: 建立 poc_librarian schema...');
    await client.query('CREATE SCHEMA IF NOT EXISTS poc_librarian;');
    console.log('   ✅ Schema 已建立');

    // Step 3: 建立表
    console.log('\n📦 Step 3: 建立資料表...');
    await client.query(`
      SET search_path TO poc_librarian, public;

      -- Corrections 表
      CREATE TABLE IF NOT EXISTS corrections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          domain VARCHAR(50) NOT NULL DEFAULT 'naruvia',
          original_input TEXT NOT NULL,
          ai_prediction JSONB NOT NULL,
          user_correction JSONB NOT NULL,
          corrected_field TEXT NOT NULL,
          embedding VECTOR(768),
          processed BOOLEAN DEFAULT FALSE,
          phase_number INT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Rules 表
      CREATE TABLE IF NOT EXISTS rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          domain VARCHAR(50) NOT NULL DEFAULT 'naruvia',
          description TEXT NOT NULL,
          trigger_conditions JSONB,
          result_action JSONB,
          confidence FLOAT DEFAULT 0.5,
          times_applied INT DEFAULT 0,
          times_correct INT DEFAULT 0,
          embedding VECTOR(768),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_used_at TIMESTAMPTZ
      );

      -- Evaluations 表
      CREATE TABLE IF NOT EXISTS evaluations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          phase_number INT NOT NULL,
          input TEXT NOT NULL,
          expected_output JSONB,
          actual_output JSONB,
          is_correct BOOLEAN,
          rules_applied UUID[],
          latency_ms INT,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Domain Configs 表
      CREATE TABLE IF NOT EXISTS domain_configs (
          domain VARCHAR(50) PRIMARY KEY,
          display_name VARCHAR(100),
          warm_threshold INT DEFAULT 3,
          distill_threshold INT DEFAULT 10,
          similarity_threshold FLOAT DEFAULT 0.85,
          confidence_decay_days INT DEFAULT 30,
          categories JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ 資料表已建立');

    // Step 3.5: 遷移 — 為既有表加 domain 欄位（冪等）
    console.log('\n📦 Step 3.5: 遷移既有表（加 domain 欄位）...');
    const migrations = [
      `ALTER TABLE corrections ADD COLUMN IF NOT EXISTS domain VARCHAR(50) NOT NULL DEFAULT 'naruvia'`,
      `ALTER TABLE rules ADD COLUMN IF NOT EXISTS domain VARCHAR(50) NOT NULL DEFAULT 'naruvia'`,
    ];
    for (const sql of migrations) {
      try {
        await client.query(sql);
      } catch (err: any) {
        // 忽略 "column already exists" 錯誤
        if (err.code !== '42701') throw err;
      }
    }
    console.log('   ✅ 遷移完成');

    // Step 4: 建立索引
    console.log('\n📦 Step 4: 建立索引...');
    // 先移除舊版不含 domain 的索引（冪等）
    const dropOldIndexes = [
      `DROP INDEX IF EXISTS idx_corrections_user_processed`,
      `DROP INDEX IF EXISTS idx_rules_user_active`,
    ];
    for (const sql of dropOldIndexes) {
      await client.query(sql);
    }

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_corrections_embedding ON corrections USING hnsw (embedding vector_cosine_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_rules_embedding ON rules USING hnsw (embedding vector_cosine_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_corrections_user_domain_processed ON corrections (user_id, domain, processed)`,
      `CREATE INDEX IF NOT EXISTS idx_rules_user_domain_active ON rules (user_id, domain, is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_evaluations_user_phase ON evaluations (user_id, phase_number)`,
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }
    console.log('   ✅ 索引已建立');

    // Step 5: 預設 domain configs
    console.log('\n📦 Step 5: 載入預設 domain 設定...');
    await client.query(`
      INSERT INTO domain_configs (domain, display_name, warm_threshold, distill_threshold, similarity_threshold, confidence_decay_days, categories)
      VALUES
          ('naruvia', 'Naruvia 任務分類', 3, 10, 0.85, 30,
           '["公司資產","營運成本","人才投資","個人娛樂","工作工具","職涯發展"]'),
          ('paceriz', 'Paceriz 課表修正', 5, 15, 0.80, 60, NULL)
      ON CONFLICT (domain) DO NOTHING;
    `);
    console.log('   ✅ Domain configs 已載入');

    // Step 6: 驗證
    console.log('\n📦 Step 6: 驗證...');
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'poc_librarian' ORDER BY table_name
    `);
    console.log('   已建立的表：');
    tables.rows.forEach(r => console.log(`   - ${r.table_name}`));

    const configs = await client.query(`SELECT domain, display_name FROM poc_librarian.domain_configs`);
    console.log('   已設定的 domains：');
    configs.rows.forEach(r => console.log(`   - ${r.domain}: ${r.display_name}`));

    console.log('\n🎉 Neon DB 初始化完成！');

  } catch (error) {
    console.error('\n❌ 初始化失敗:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initNeonDb();
