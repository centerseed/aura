import { vi, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>

// Mock the prisma module
vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}))

// Reset mock between tests
beforeEach(() => {
  mockReset(prismaMock)
})
