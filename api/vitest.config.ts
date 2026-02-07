import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// 先載入 .env（提供真實 API keys 等），再用 .env.test 覆蓋測試專屬設定
dotenv.config({ path: '.env' })
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
      reporter: ['text', 'json', 'html', 'lcov'],

      // 🎯 覆蓋率門檻（未達標時測試失敗）
      // 漸進式門檻策略：從當前覆蓋率開始，逐步提升至最終目標 85%+
      // 當前覆蓋率: ~70%, 隨著 embedding/repository 測試完成後提升至 85%
      thresholds: {
        lines: 70,       // 最終目標: 85
        functions: 76,   // 最終目標: 85
        branches: 53,    // 最終目標: 80
        statements: 70,  // 最終目標: 85
      },

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
        'src/app/**/*.ts',          // Next.js routes 由整合測試覆蓋
        'src/domain/entities/**/*.ts', // 純型別定義（用戶明確接受 0% 覆蓋）
        'src/domain/interfaces/**/*.ts', // 介面定義
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
