import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import dotenv from 'dotenv'

// 載入 .env.test
dotenv.config({ path: '.env.test' })

// 🛡️ 阻斷生產資料庫
if (process.env.DATABASE_URL?.includes('supabase')) {
  console.error('🚨 DATABASE_URL 指向 Supabase，測試終止')
  process.exit(1)
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/e2e/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/', '.next/', 'dist/', 'build/'],
    // AI tests can be slow; single-threaded to avoid concurrent overload
    testTimeout: 90000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    watch: false,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
})
