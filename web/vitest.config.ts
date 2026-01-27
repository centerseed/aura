import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'happy-dom',

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

    // Watch mode
    watch: false,

    // Reporter
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
