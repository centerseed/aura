import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// 載入 .env.test
dotenv.config({ path: '.env.test' })

// 設定 DATABASE_URL
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
}

// 🛡️ 阻斷生產資料庫
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
