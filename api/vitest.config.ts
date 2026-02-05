import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// 載入 .env.test（override: true 強制覆蓋已存在的環境變數）
dotenv.config({ path: '.env.test', override: true })

// 強制設定 DATABASE_URL 為本地測試資料庫（用於整合測試）
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
}

// 🛡️ 阻斷 Supabase 生產資料庫（整合測試不應連接生產）
// 注意：remote-readonly 測試使用 DATABASE_URL_REMOTE，不受此限制
if (process.env.DATABASE_URL?.includes('supabase')) {
  console.error('🚨 DATABASE_URL 指向 Supabase，測試終止')
  process.exit(1)
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/application/**/*.ts',
        'src/domain/**/*.ts',
        'src/infrastructure/**/*.ts',
        'src/lib/**/*.ts',
      ],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '.next/',
        'dist/',
        'coverage/',
        'src/app/**/*.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
