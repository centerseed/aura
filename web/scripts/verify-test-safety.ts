/**
 * 驗證測試環境安全性
 * 確保測試不會碰到 Supabase 生產資料庫
 */

import dotenv from 'dotenv'
import path from 'path'

// 載入測試環境變數
dotenv.config({ path: path.join(process.cwd(), '.env.test') })

console.log('🔍 驗證測試環境安全性...\n')

let hasError = false

// 檢查 1: DATABASE_URL 必須存在
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('❌ DATABASE_URL 未設定')
  hasError = true
} else {
  console.log('✅ DATABASE_URL 已設定')
}

// 檢查 2: 必須是測試資料庫
const isTestDatabase = (
  dbUrl?.includes('_test') ||
  dbUrl?.includes('localhost:5432') ||
  dbUrl?.includes('127.0.0.1:5432') ||
  dbUrl?.includes('localhost:54322') ||
  dbUrl?.includes('test.supabase')
)

if (!isTestDatabase) {
  console.error('❌ DATABASE_URL 不是測試資料庫！')
  console.error(`   當前 URL: ${dbUrl?.substring(0, 50)}...`)
  hasError = true
} else {
  console.log('✅ DATABASE_URL 指向測試資料庫')
  console.log(`   URL: ${dbUrl}`)
}

// 檢查 3: 不可包含 Supabase 生產域名
if (dbUrl?.includes('supabase.com') || dbUrl?.includes('supabase.co')) {
  console.error('❌ DATABASE_URL 包含 Supabase 域名！')
  hasError = true
} else {
  console.log('✅ DATABASE_URL 不包含 Supabase 生產域名')
}

// 檢查 4: NODE_ENV 必須是 test
const nodeEnv = process.env.NODE_ENV
if (nodeEnv !== 'test') {
  console.error(`❌ NODE_ENV 不是 "test"，當前值: ${nodeEnv}`)
  hasError = true
} else {
  console.log('✅ NODE_ENV = test')
}

// 檢查 5: .env.test 檔案必須存在
const fs = require('fs')
const envTestPath = path.join(process.cwd(), '.env.test')
if (!fs.existsSync(envTestPath)) {
  console.error('❌ .env.test 檔案不存在')
  hasError = true
} else {
  console.log('✅ .env.test 檔案存在')
}

// 檢查 6: vitest.config.ts 必須載入 .env.test
const vitestConfigPath = path.join(process.cwd(), 'vitest.config.ts')
if (fs.existsSync(vitestConfigPath)) {
  const vitestConfig = fs.readFileSync(vitestConfigPath, 'utf-8')
  if (vitestConfig.includes('.env.test')) {
    console.log('✅ vitest.config.ts 設定載入 .env.test')
  } else {
    console.error('❌ vitest.config.ts 未設定載入 .env.test')
    hasError = true
  }
} else {
  console.error('❌ vitest.config.ts 不存在')
  hasError = true
}

console.log('\n' + '='.repeat(60))

if (hasError) {
  console.error('\n❌ 測試環境不安全！請修復上述錯誤後再執行測試。\n')
  process.exit(1)
} else {
  console.log('\n✅ 測試環境安全檢查通過！\n')
  console.log('📋 安全措施：')
  console.log('  1. ✅ DATABASE_URL 指向本地測試資料庫')
  console.log('  2. ✅ 不包含 Supabase 生產域名')
  console.log('  3. ✅ NODE_ENV = test')
  console.log('  4. ✅ .env.test 檔案存在')
  console.log('  5. ✅ vitest.config.ts 正確配置')
  console.log('\n🛡️  測試執行前會進行 4 層安全檢查：')
  console.log('  1. 資料庫 URL 必須包含 "_test" 或 "localhost"')
  console.log('  2. NODE_ENV 不可為 "production"')
  console.log('  3. 必須指定 userId（禁止清理所有資料）')
  console.log('  4. 只能清理明確標記為測試的用戶')
  console.log('\n可以安全執行測試: npm test\n')
  process.exit(0)
}
