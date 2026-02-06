/**
 * POC Librarian Engine - Database Setup Script
 *
 * 建立 poc_librarian schema 和所有必要的表
 * 🛡️ 只操作 poc_librarian schema，不影響主系統
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const EXTENSION_SQL = `
-- 啟用 pgvector（資料庫層級，需要先執行）
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
`;

const SCHEMA_SQL = `
-- ============================================================================
-- 🛡️ POC Librarian Schema Setup
-- ============================================================================

-- 建立獨立 schema（不影響主系統）
CREATE SCHEMA IF NOT EXISTS poc_librarian;

-- 設定 search_path（後續所有操作只在這個 schema）
SET search_path TO poc_librarian, public;

-- ============================================================================
-- Corrections 表（用戶修正紀錄）
-- ============================================================================
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

-- ============================================================================
-- Rules 表（蒸餾出的規則）
-- ============================================================================
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

-- ============================================================================
-- Evaluations 表（評估結果）
-- ============================================================================
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

-- ============================================================================
-- Domain Configs 表（各 domain 的蒸餾設定）
-- ============================================================================
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

-- 預設設定
INSERT INTO domain_configs (domain, display_name, warm_threshold, distill_threshold, similarity_threshold, confidence_decay_days, categories)
VALUES
    ('naruvia', 'Naruvia 任務分類', 3, 10, 0.85, 30,
     '["公司資產","營運成本","人才投資","個人娛樂","工作工具","職涯發展"]'),
    ('paceriz', 'Paceriz 課表修正', 5, 15, 0.80, 60, NULL)
ON CONFLICT (domain) DO NOTHING;

-- ============================================================================
-- 索引
-- ============================================================================

-- HNSW 向量索引（768 維可以使用 HNSW，限制是 2000 維）
CREATE INDEX IF NOT EXISTS idx_corrections_embedding
    ON corrections USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_rules_embedding
    ON rules USING hnsw (embedding vector_cosine_ops);

-- 常規索引
CREATE INDEX IF NOT EXISTS idx_corrections_user_processed
    ON corrections (user_id, domain, processed);

CREATE INDEX IF NOT EXISTS idx_rules_user_active
    ON rules (user_id, domain, is_active);

CREATE INDEX IF NOT EXISTS idx_evaluations_user_phase
    ON evaluations (user_id, phase_number);

-- ============================================================================
-- 驗證
-- ============================================================================
SELECT 'poc_librarian schema 設置完成' AS status;
`;

async function setupDatabase() {
  console.log('🚀 開始設置 POC Librarian 資料庫...\n');

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ 錯誤：DATABASE_URL 環境變數未設定');
    console.log('\n請複製 .env.example 為 .env 並填入資料庫連線資訊');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    // 連線資料庫
    await client.connect();
    console.log('✅ 資料庫連線成功');

    // 先安裝 pgvector extension（資料庫層級）
    console.log('📦 安裝 pgvector 擴展...');
    try {
      await client.query(EXTENSION_SQL);
      console.log('✅ pgvector 擴展已安裝');
    } catch (extError: any) {
      if (extError.code === '42710') {
        // extension already exists
        console.log('✅ pgvector 擴展已存在');
      } else {
        throw extError;
      }
    }

    // 執行 schema 建立
    console.log('📦 建立 poc_librarian schema 和表...');
    await client.query(SCHEMA_SQL);

    // 驗證表是否建立成功
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'poc_librarian'
      ORDER BY table_name
    `);

    console.log('\n✅ 已建立的表：');
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // 驗證 pgvector
    const vectorCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS has_vector
    `);

    if (vectorCheck.rows[0].has_vector) {
      console.log('\n✅ pgvector 擴展已啟用');
    } else {
      console.log('\n⚠️ pgvector 擴展未啟用，向量功能可能無法使用');
    }

    console.log('\n🎉 POC Librarian 資料庫設置完成！');
    console.log('   現在可以執行 npm run poc 開始驗證');

  } catch (error) {
    console.error('\n❌ 資料庫設置失敗：');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 執行
setupDatabase();
