/**
 * POC Librarian Engine - Database Connection
 *
 * 提供 PostgreSQL 連線，並包含 3 層安全保護機制
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client, Pool } = pg;

// ============================================================================
// Safety Configuration
// ============================================================================

/**
 * 🛡️ 禁止操作清單（保護 Naruvia 主系統）
 */
const FORBIDDEN_PATTERNS = [
  /DROP\s+TABLE\s+(?!poc_librarian\.)/i,
  /DELETE\s+FROM\s+(?!poc_librarian\.)/i,
  /TRUNCATE\s+(?!poc_librarian\.)/i,
  /DROP\s+SCHEMA\s+(?!poc_librarian)/i,
];

/**
 * 🛡️ 允許的 schema
 */
const ALLOWED_SCHEMA = 'poc_librarian';

// ============================================================================
// Database Connection
// ============================================================================

let pool: pg.Pool | null = null;

/**
 * 建立資料庫連線池
 */
export async function createPool(): Promise<pg.Pool> {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('❌ DATABASE_URL 環境變數未設定');
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // 測試連線
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ 資料庫連線成功');
  } finally {
    client.release();
  }

  return pool;
}

/**
 * 取得資料庫連線池
 */
export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('❌ 資料庫連線池尚未初始化，請先呼叫 createPool()');
  }
  return pool;
}

/**
 * 關閉資料庫連線池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ 資料庫連線池已關閉');
  }
}

// ============================================================================
// Safe Query Execution
// ============================================================================

/**
 * 🛡️ 安全執行 SQL 查詢
 *
 * Layer 2: 檢查 SQL 是否包含禁止操作
 */
export async function safeQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  // 🛡️ 檢查禁止操作
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql)) {
      throw new Error(`❌ 安全檢查失敗：禁止操作 "${sql.substring(0, 100)}..."`);
    }
  }

  const pool = getPool();
  return pool.query<T>(sql, params);
}

/**
 * 🛡️ 在 poc_librarian schema 中執行查詢
 *
 * Layer 3: 強制設定 search_path
 */
export async function queryInSchema<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // 🛡️ 強制使用 poc_librarian schema
    await client.query(`SET search_path TO ${ALLOWED_SCHEMA};`);
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * 🛡️ 驗證資料庫安全性
 *
 * Layer 1: 確認 poc_librarian schema 存在
 */
export async function validateDatabaseSafety(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // 檢查 schema 是否存在
    const result = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = $1
    `, [ALLOWED_SCHEMA]);

    if (result.rows.length === 0) {
      console.log(`⚠️ Schema "${ALLOWED_SCHEMA}" 不存在，將自動建立`);
      return;
    }

    // 設定 search_path
    await client.query(`SET search_path TO ${ALLOWED_SCHEMA};`);

    // 驗證 search_path
    const schemaCheck = await client.query('SELECT current_schema();');
    if (schemaCheck.rows[0].current_schema !== ALLOWED_SCHEMA) {
      throw new Error(`❌ 安全檢查失敗：無法切換到 ${ALLOWED_SCHEMA} schema`);
    }

    console.log(`✅ 資料庫安全驗證通過：使用 ${ALLOWED_SCHEMA} schema`);
  } finally {
    client.release();
  }
}

// ============================================================================
// Transaction Support
// ============================================================================

/**
 * 在事務中執行操作
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO ${ALLOWED_SCHEMA};`);

    const result = await fn(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
