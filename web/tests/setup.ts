import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Next.js server utilities
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: (data: any, init?: ResponseInit) => ({
      status: init?.status || 200,
      json: async () => data,
    }),
  },
}))

// Mock Firebase environment variables for unit tests
// Note: Integration tests will use real DATABASE_URL from .env.local
if (!process.env.DATABASE_URL) {
  // Only set mock DATABASE_URL if not already set (for unit tests)
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
}

if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
  process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project'
}
if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
}
if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com'
}
