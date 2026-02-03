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
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/', '.next/', 'dist/', 'build/', 'tests/archive/**'],
    testTimeout: 10000,
    watch: false,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '.next/',
        '**/*.config.{ts,js}',
        '**/types/**',
        '**/*.d.ts',
        'scripts/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
})
