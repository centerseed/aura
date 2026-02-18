/**
 * Knowledge MCP Tool Handlers — Unit Tests
 *
 * Tests the knowledge-related tool handlers: append_to_knowledge, query_memory.
 * BackendApiClient is fully mocked.
 */

import { describe, it, expect, vi } from 'vitest'
import { ValidationException } from '../../../../src/lib/api-response'
import type { BackendApiClient } from '../../../../src/mcp/backend-client/api-client'
import type { AuthContext } from '../../../../src/mcp/types'
import { handleAppendToKnowledge } from '../../../../src/mcp/tools/append-to-knowledge'
import { handleQueryMemory } from '../../../../src/mcp/tools/query-memory'

function mockApiClient(overrides: Partial<BackendApiClient> = {}): BackendApiClient {
  return {
    appendToKnowledge: vi.fn(),
    queryMemory: vi.fn(),
    ...overrides,
  } as unknown as BackendApiClient
}

const authContext: AuthContext = {
  userId: 'user-123',
  clientId: 'test-client',
  scopes: ['write:knowledge', 'read:knowledge'],
  tokenExpiry: Date.now() + 3600_000,
}

describe('handleAppendToKnowledge', () => {
  describe('正常路徑', () => {
    it('should append knowledge successfully with all parameters', async () => {
      const api = mockApiClient({
        appendToKnowledge: vi.fn().mockResolvedValue({
          id: 'ref-123',
          status: 'created',
          product_name: 'Zentropy',
          topic_name: 'Architecture',
        }),
      })

      const result = await handleAppendToKnowledge(
        api,
        authContext,
        {
          product_name: 'Zentropy',
          topic_name: 'Architecture',
          title: 'Clean Architecture Principles',
          content: 'Domain layer should not depend on infrastructure...',
        },
        false,
      )

      expect(api.appendToKnowledge).toHaveBeenCalledWith('user-123', {
        product_name: 'Zentropy',
        topic_name: 'Architecture',
        title: 'Clean Architecture Principles',
        content: 'Domain layer should not depend on infrastructure...',
      })

      expect(result).toEqual({
        id: 'ref-123',
        status: 'created',
        product_name: 'Zentropy',
        topic_name: 'Architecture',
      })
    })

    it('should add _warning when sanitized is true', async () => {
      const api = mockApiClient({
        appendToKnowledge: vi.fn().mockResolvedValue({
          id: 'ref-456',
          status: 'created',
          product_name: 'Product A',
          topic_name: 'Topic A',
        }),
      })

      const result = await handleAppendToKnowledge(
        api,
        authContext,
        {
          product_name: 'Product A',
          topic_name: 'Topic A',
          title: 'Sensitive Document',
          content: 'Contains API keys and passwords',
        },
        true, // sanitized = true
      )

      expect(result._warning).toBe('content_sanitized')
    })

    it('should handle long content', async () => {
      const api = mockApiClient({
        appendToKnowledge: vi.fn().mockResolvedValue({
          id: 'ref-long',
          status: 'created',
          product_name: 'Docs',
          topic_name: 'Guides',
        }),
      })

      const longContent = 'a'.repeat(50000)

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 'Docs',
            topic_name: 'Guides',
            title: 'Long Guide',
            content: longContent,
          },
          false,
        ),
      ).resolves.toBeDefined()
    })
  })

  describe('參數驗證', () => {
    it('should throw when product_name is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            topic_name: 'Topic',
            title: 'Title',
            content: 'Content',
          },
          false,
        ),
      ).rejects.toThrow('product_name is required')
    })

    it('should throw when topic_name is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 'Product',
            title: 'Title',
            content: 'Content',
          },
          false,
        ),
      ).rejects.toThrow('topic_name is required')
    })

    it('should throw when title is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 'Product',
            topic_name: 'Topic',
            content: 'Content',
          },
          false,
        ),
      ).rejects.toThrow('title is required')
    })

    it('should throw when content is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 'Product',
            topic_name: 'Topic',
            title: 'Title',
          },
          false,
        ),
      ).rejects.toThrow('content is required')
    })

    it('should throw when content is empty', async () => {
      const api = mockApiClient()

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 'Product',
            topic_name: 'Topic',
            title: 'Title',
            content: '   ',
          },
          false,
        ),
      ).rejects.toThrow('content cannot be empty')
    })

    it('should throw when parameter types are invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 123,
            topic_name: 'Topic',
            title: 'Title',
            content: 'Content',
          } as any,
          false,
        ),
      ).rejects.toThrow(ValidationException)
    })
  })

  describe('邊界條件', () => {
    it('should handle minimal valid content', async () => {
      const api = mockApiClient({
        appendToKnowledge: vi.fn().mockResolvedValue({
          id: 'ref-min',
          status: 'created',
          product_name: 'P',
          topic_name: 'T',
        }),
      })

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 'P',
            topic_name: 'T',
            title: 'T',
            content: 'x',
          },
          false,
        ),
      ).resolves.toBeDefined()
    })

    it('should handle special characters in content', async () => {
      const api = mockApiClient({
        appendToKnowledge: vi.fn().mockResolvedValue({
          id: 'ref-special',
          status: 'created',
          product_name: 'Test',
          topic_name: 'Test',
        }),
      })

      await expect(
        handleAppendToKnowledge(
          api,
          authContext,
          {
            product_name: 'Test',
            topic_name: 'Test',
            title: 'Special Chars',
            content: '!@#$%^&*(){}[]<>?/\\|`~',
          },
          false,
        ),
      ).resolves.toBeDefined()
    })
  })
})

describe('handleQueryMemory', () => {
  describe('正常路徑', () => {
    it('should query memory successfully with results', async () => {
      const api = mockApiClient({
        queryMemory: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'res-1',
              title: 'Architecture Decision',
              content: 'We decided to use Clean Architecture...',
              score: 0.92,
              product_name: 'Zentropy',
              area_name: 'Engineering',
            },
            {
              id: 'res-2',
              title: 'API Design',
              content: 'RESTful API with JSON responses...',
              score: 0.85,
              product_name: 'Zentropy',
              area_name: 'Engineering',
            },
          ],
          total: 2,
        }),
      })

      const result = await handleQueryMemory(
        api,
        authContext,
        {
          query: 'How should we structure the backend?',
          scope: 'Engineering',
        },
        false,
      )

      expect(api.queryMemory).toHaveBeenCalledWith('user-123', {
        query: 'How should we structure the backend?',
        scope: 'Engineering',
      })

      expect(result.results).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.results[0].title).toBe('Architecture Decision')
    })

    it('should query without scope', async () => {
      const api = mockApiClient({
        queryMemory: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
        }),
      })

      const result = await handleQueryMemory(
        api,
        authContext,
        { query: 'What is the database schema?' },
        false,
      )

      expect(api.queryMemory).toHaveBeenCalledWith('user-123', {
        query: 'What is the database schema?',
        scope: undefined,
      })
      expect(result.results).toEqual([])
    })

    it('should add _warning when sanitized', async () => {
      const api = mockApiClient({
        queryMemory: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
        }),
      })

      const result = await handleQueryMemory(
        api,
        authContext,
        { query: 'Search for API keys' },
        true,
      )

      expect(result._warning).toBe('content_sanitized')
    })

    it('should handle empty results', async () => {
      const api = mockApiClient({
        queryMemory: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
        }),
      })

      const result = await handleQueryMemory(
        api,
        authContext,
        { query: 'Non-existent topic' },
        false,
      )

      expect(result.results).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('參數驗證', () => {
    it('should throw when query is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleQueryMemory(api, authContext, {}, false),
      ).rejects.toThrow('query is required')
    })

    it('should throw when query is empty', async () => {
      const api = mockApiClient()

      await expect(
        handleQueryMemory(api, authContext, { query: '   ' }, false),
      ).rejects.toThrow('query cannot be empty')
    })

    it('should throw when query is not a string', async () => {
      const api = mockApiClient()

      await expect(
        handleQueryMemory(api, authContext, { query: 123 } as any, false),
      ).rejects.toThrow('query is required')
    })

    it('should throw when scope type is invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleQueryMemory(
          api,
          authContext,
          { query: 'test', scope: 123 } as any,
          false,
        ),
      ).rejects.toThrow('scope must be a string')
    })
  })

  describe('邊界條件', () => {
    it('should handle minimal query length', async () => {
      const api = mockApiClient({
        queryMemory: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
        }),
      })

      await expect(
        handleQueryMemory(api, authContext, { query: 'x' }, false),
      ).resolves.toBeDefined()
    })

    it('should handle very long query', async () => {
      const api = mockApiClient({
        queryMemory: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
        }),
      })

      const longQuery = 'What '.repeat(100) + '?'

      await expect(
        handleQueryMemory(api, authContext, { query: longQuery }, false),
      ).resolves.toBeDefined()
    })

    it('should handle special characters in query', async () => {
      const api = mockApiClient({
        queryMemory: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
        }),
      })

      await expect(
        handleQueryMemory(
          api,
          authContext,
          { query: 'How to use <script> tags?' },
          false,
        ),
      ).resolves.toBeDefined()
    })
  })
})
