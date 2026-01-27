import { vi } from 'vitest'

const mockGenerateObject = vi.fn()
const mockGenerateText = vi.fn()

export const googleAiMock = {
  generateObject: mockGenerateObject,
  generateText: mockGenerateText,
}

vi.mock('ai', () => ({
  generateObject: googleAiMock.generateObject,
  generateText: googleAiMock.generateText,
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'mocked-model'),
}))

// Helper to mock AI responses
export function mockAIGenerateObject(response: any) {
  mockGenerateObject.mockResolvedValue({
    object: response,
  })
}
