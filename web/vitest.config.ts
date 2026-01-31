import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { loadEnv } from 'vite'
import dotenv from 'dotenv'

// 🚨 測試環境：優先載入 .env.test（如果存在）
dotenv.config({ path: '.env.test' })

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
  ],
  test: {
    // Test environment
    environment: 'happy-dom',

    // Load environment variables
    env: {
      ...loadEnv(mode, process.cwd(), ''),
      // 確保 NODE_ENV 設為 test
      NODE_ENV: 'test',
    },

    // Global setup
    globals: true,
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration
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
      thresholds: {
        lines: 60,      // Start with achievable targets
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },

    // Test organization
    include: [
      '**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules/',
      '.next/',
      'dist/',
      'build/',
    ],

    // Performance
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    fileParallelism: false, // 避免資料庫連線池耗盡

    // Watch mode
    watch: false,

    // Reporter
    reporters: ['verbose'],
  },
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
}))
