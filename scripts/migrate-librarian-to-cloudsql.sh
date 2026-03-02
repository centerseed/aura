#!/usr/bin/env bash
#
# 從 Neon 遷移 poc_librarian 資料到 Cloud SQL
#
# 前提：
#   1. Cloud SQL Auth Proxy 已在 127.0.0.1:5433 運行
#   2. pg_dump 工具已安裝（brew install postgresql）
#   3. poc-librarian-js/.env 有 DATABASE_URL（Neon URL）
#   4. api/.env 有 CLOUDSQL_DATABASE_URL
#
# 用法：
#   ./scripts/migrate-librarian-to-cloudsql.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📦 Librarian 資料遷移：Neon → Cloud SQL"
echo ""

# ============================================================================
# 讀取連線 URL
# ============================================================================
LIBRARIAN_ENV="$REPO_ROOT/poc-librarian-js/.env"
API_ENV="$REPO_ROOT/api/.env"

if [ ! -f "$LIBRARIAN_ENV" ]; then
  echo "❌ $LIBRARIAN_ENV 不存在"
  exit 1
fi

if [ ! -f "$API_ENV" ]; then
  echo "❌ $API_ENV 不存在"
  exit 1
fi

NEON_URL=$(grep '^DATABASE_URL' "$LIBRARIAN_ENV" | cut -d= -f2- | tr -d '"')
CLOUD_SQL_URL=$(grep '^CLOUDSQL_DATABASE_URL' "$API_ENV" | cut -d= -f2- | tr -d '"')

if [ -z "$NEON_URL" ]; then
  echo "❌ poc-librarian-js/.env 中找不到 DATABASE_URL"
  exit 1
fi

if [ -z "$CLOUD_SQL_URL" ]; then
  echo "❌ api/.env 中找不到 CLOUDSQL_DATABASE_URL"
  exit 1
fi

NEON_SAFE=$(echo "$NEON_URL" | sed 's|:[^@]*@|:***@|')
CLOUD_SAFE=$(echo "$CLOUD_SQL_URL" | sed 's|:[^@]*@|:***@|')
echo "📤 Source (Neon):      $NEON_SAFE"
echo "📥 Target (Cloud SQL): $CLOUD_SAFE"
echo ""

# ============================================================================
# 先用 Node.js 確認來源資料量
# ============================================================================
echo "📊 確認 Neon 資料量..."
node -e "
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: '$NEON_URL', ssl: { rejectUnauthorized: false } });
  await client.connect();
  const tables = ['corrections', 'rules', 'evaluations', 'domain_configs'];
  for (const t of tables) {
    const r = await client.query('SELECT COUNT(*) FROM poc_librarian.' + t);
    console.log('  ' + t + ': ' + r.rows[0].count + ' rows');
  }
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
"

echo ""
echo "📊 確認 Cloud SQL 現有資料..."
node -e "
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: '$CLOUD_SQL_URL' });
  await client.connect();
  const tables = ['corrections', 'rules', 'evaluations'];
  for (const t of tables) {
    const r = await client.query('SELECT COUNT(*) FROM poc_librarian.' + t);
    console.log('  ' + t + ': ' + r.rows[0].count + ' rows');
  }
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
"

echo ""
echo "⚠️  即將把 Neon 的 poc_librarian 資料（corrections, rules, evaluations）插入 Cloud SQL"
echo "   domain_configs 已由 init-neon-db.ts 建立，跳過"
read -p "   確認執行？[y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 取消"
  exit 0
fi

# ============================================================================
# 用 Node.js 直接遷移資料（避免 pg_dump 工具依賴）
# ============================================================================
echo ""
echo "🚀 開始遷移..."

node -e "
const { Client } = require('pg');

async function run() {
  const src = new Client({ connectionString: '$NEON_URL', ssl: { rejectUnauthorized: false } });
  const dst = new Client({ connectionString: '$CLOUD_SQL_URL' });

  await src.connect();
  await dst.connect();
  console.log('✅ 連線成功');

  // ---- corrections ----
  console.log('');
  console.log('📤 遷移 corrections...');
  const corr = await src.query('SELECT * FROM poc_librarian.corrections');
  let inserted = 0;
  for (const row of corr.rows) {
    try {
      await dst.query(\`
        INSERT INTO poc_librarian.corrections
        (id, user_id, domain, original_input, ai_prediction, user_correction, corrected_field, embedding, processed, phase_number, created_at)
        VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10,\$11)
        ON CONFLICT (id) DO NOTHING
      \`, [row.id, row.user_id, row.domain, row.original_input, row.ai_prediction, row.user_correction, row.corrected_field, row.embedding, row.processed, row.phase_number, row.created_at]);
      inserted++;
    } catch(e) {
      console.error('  Error inserting correction', row.id, ':', e.message);
    }
  }
  console.log('  ✅ corrections: ' + inserted + '/' + corr.rows.length + ' rows');

  // ---- rules ----
  console.log('');
  console.log('📤 遷移 rules...');
  const rules = await src.query('SELECT * FROM poc_librarian.rules');
  inserted = 0;
  for (const row of rules.rows) {
    try {
      await dst.query(\`
        INSERT INTO poc_librarian.rules
        (id, user_id, domain, description, trigger_conditions, result_action, confidence, times_applied, times_correct, embedding, is_active, created_at, last_used_at)
        VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10,\$11,\$12,\$13)
        ON CONFLICT (id) DO NOTHING
      \`, [row.id, row.user_id, row.domain, row.description, row.trigger_conditions, row.result_action, row.confidence, row.times_applied, row.times_correct, row.embedding, row.is_active, row.created_at, row.last_used_at]);
      inserted++;
    } catch(e) {
      console.error('  Error inserting rule', row.id, ':', e.message);
    }
  }
  console.log('  ✅ rules: ' + inserted + '/' + rules.rows.length + ' rows');

  // ---- evaluations ----
  console.log('');
  console.log('📤 遷移 evaluations...');
  const evals = await src.query('SELECT * FROM poc_librarian.evaluations');
  inserted = 0;
  for (const row of evals.rows) {
    try {
      await dst.query(\`
        INSERT INTO poc_librarian.evaluations
        (id, user_id, phase_number, input, expected_output, actual_output, is_correct, rules_applied, latency_ms, created_at)
        VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10)
        ON CONFLICT (id) DO NOTHING
      \`, [row.id, row.user_id, row.phase_number, row.input, row.expected_output, row.actual_output, row.is_correct, row.rules_applied, row.latency_ms, row.created_at]);
      inserted++;
    } catch(e) {
      console.error('  Error inserting evaluation', row.id, ':', e.message);
    }
  }
  console.log('  ✅ evaluations: ' + inserted + '/' + evals.rows.length + ' rows');

  await src.end();
  await dst.end();
  console.log('');
  console.log('🎉 遷移完成！');
}

run().catch(e => { console.error('❌ 遷移失敗:', e.message); process.exit(1); });
"

# ============================================================================
# 驗證
# ============================================================================
echo ""
echo "📊 驗證 Cloud SQL 資料量..."
node -e "
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: '$CLOUD_SQL_URL' });
  await client.connect();
  const tables = ['corrections', 'rules', 'evaluations', 'domain_configs'];
  for (const t of tables) {
    const r = await client.query('SELECT COUNT(*) FROM poc_librarian.' + t);
    console.log('  ' + t + ': ' + r.rows[0].count + ' rows');
  }
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
"
