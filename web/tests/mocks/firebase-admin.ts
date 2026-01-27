import { vi } from 'vitest'

const mockVerifyIdToken = vi.fn()
const mockAuth = {
  verifyIdToken: mockVerifyIdToken,
}

export const firebaseAdminMock = {
  auth: () => mockAuth,
  mockVerifyIdToken,
}

// Mock the entire firebase-admin module
vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    auth: () => mockAuth,
    credential: {
      cert: vi.fn(),
    },
  },
  apps: [],
  initializeApp: vi.fn(),
  auth: () => mockAuth,
  credential: {
    cert: vi.fn(),
  },
}))

// Mock the local firebase-admin wrapper
vi.mock('@/lib/firebase-admin', () => ({
  getAuth: () => mockAuth,
}))

// Helper to setup auth mock
export function mockAuthenticatedUser(userId: string, firebaseUid = 'test-firebase-uid') {
  mockVerifyIdToken.mockResolvedValue({ uid: firebaseUid })
  return { userId, firebaseUid }
}

export function mockUnauthenticatedUser() {
  mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))
}
