/**
 * Reference MCP Tool Handlers — Unit Tests
 *
 * Tests the reference-related tool handlers: get_reference, add_reference.
 * BackendApiClient is fully mocked.
 */

import { describe, it, expect, vi } from 'vitest'
import { ValidationException } from '../../../../src/lib/api-response'
import type { BackendApiClient } from '../../../../src/mcp/backend-client/api-client'
import type { AuthContext } from '../../../../src/mcp/types'
import { handleGetReference } from '../../../../src/mcp/tools/get-reference'
import { handleAddReference } from '../../../../src/mcp/tools/add-reference'

function mockApiClient(overrides: Partial<BackendApiClient> = {}): BackendApiClient {
  return {
    getReference: vi.fn(),
    addProductReference: vi.fn(),
    ...overrides,
  } as unknown as BackendApiClient
}

const authContext: AuthContext = {
  userId: 'user-123',
  clientId: 'test-client',
  scopes: ['read:knowledge', 'write:knowledge'],
  tokenExpiry: Date.now() + 3600_000,
}

describe('handleGetReference', () => {
  describe('正常路徑', () => {
    it('should get reference from product successfully', async () => {
      const api = mockApiClient({
        getReference: vi.fn().mockResolvedValue({
          reference: {
            id: 'ref-123',
            type: 'note',
            content: 'This is a detailed architecture document...',
            title: 'Architecture Overview',
            created_at: '2026-02-18T10:00:00Z',
          },
          source: 'product',
        }),
      })

      const result = await handleGetReference(
        api,
        authContext,
        {
          reference_id: 'ref-123',
          product_id: 'prod-456',
        },
        false,
      )

      expect(api.getReference).toHaveBeenCalledWith('user-123', {
        reference_id: 'ref-123',
        product_id: 'prod-456',
        task_id: undefined,
      })

      expect(result).toHaveProperty('content')
      expect(result.content).toBeInstanceOf(Array)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Architecture Overview')
      expect(result.content[0].text).toContain('This is a detailed architecture document')
    })

    it('should get reference from task successfully', async () => {
      const api = mockApiClient({
        getReference: vi.fn().mockResolvedValue({
          reference: {
            id: 'ref-789',
            type: 'url',
            content: 'https://example.com/api-docs',
            title: 'API Documentation',
            created_at: '2026-02-17T15:30:00Z',
          },
          source: 'task',
        }),
      })

      const result = await handleGetReference(
        api,
        authContext,
        {
          reference_id: 'ref-789',
          task_id: 'task-999',
        },
        false,
      )

      expect(api.getReference).toHaveBeenCalledWith('user-123', {
        reference_id: 'ref-789',
        product_id: undefined,
        task_id: 'task-999',
      })

      expect(result.content[0].text).toContain('API Documentation')
      expect(result.content[0].text).toContain('https://example.com/api-docs')
    })

    it('should add warning when sanitized is true', async () => {
      const api = mockApiClient({
        getReference: vi.fn().mockResolvedValue({
          reference: {
            id: 'ref-sensitive',
            type: 'note',
            content: 'Contains potentially sensitive information',
            title: 'Sensitive Doc',
            created_at: '2026-02-18T10:00:00Z',
          },
          source: 'product',
        }),
      })

      const result = await handleGetReference(
        api,
        authContext,
        {
          reference_id: 'ref-sensitive',
          product_id: 'prod-123',
        },
        true, // sanitized = true
      )

      expect(result.content[0].text).toContain('⚠️ Note: Some content may have been filtered')
    })

    it('should handle reference without title', async () => {
      const api = mockApiClient({
        getReference: vi.fn().mockResolvedValue({
          reference: {
            id: 'ref-no-title',
            type: 'note',
            content: 'Content without title',
            title: null,
            created_at: '2026-02-18T10:00:00Z',
          },
          source: 'product',
        }),
      })

      const result = await handleGetReference(
        api,
        authContext,
        {
          reference_id: 'ref-no-title',
          product_id: 'prod-123',
        },
        false,
      )

      // Should use reference ID as fallback
      expect(result.content[0].text).toContain('ref-no-title')
    })
  })

  describe('參數驗證', () => {
    it('should throw when reference_id is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleGetReference(
          api,
          authContext,
          { product_id: 'prod-123' },
          false,
        ),
      ).rejects.toThrow('reference_id is required')
    })

    it('should throw when both product_id and task_id are missing', async () => {
      const api = mockApiClient()

      await expect(
        handleGetReference(
          api,
          authContext,
          { reference_id: 'ref-123' },
          false,
        ),
      ).rejects.toThrow('product_id or task_id')
    })

    it('should throw when reference_id is not a string', async () => {
      const api = mockApiClient()

      await expect(
        handleGetReference(
          api,
          authContext,
          { reference_id: 123, product_id: 'prod-123' } as any,
          false,
        ),
      ).rejects.toThrow(ValidationException)
    })

    it('should throw when product_id is not a string', async () => {
      const api = mockApiClient()

      await expect(
        handleGetReference(
          api,
          authContext,
          { reference_id: 'ref-123', product_id: 456 } as any,
          false,
        ),
      ).rejects.toThrow(ValidationException)
    })
  })

  describe('邊界條件', () => {
    it('should handle both product_id and task_id provided (uses both)', async () => {
      const api = mockApiClient({
        getReference: vi.fn().mockResolvedValue({
          reference: {
            id: 'ref-both',
            type: 'note',
            content: 'Test',
            title: 'Test',
            created_at: '2026-02-18T10:00:00Z',
          },
          source: 'product',
        }),
      })

      await expect(
        handleGetReference(
          api,
          authContext,
          {
            reference_id: 'ref-both',
            product_id: 'prod-123',
            task_id: 'task-456',
          },
          false,
        ),
      ).resolves.toBeDefined()
    })

    it('should handle very long content', async () => {
      const api = mockApiClient({
        getReference: vi.fn().mockResolvedValue({
          reference: {
            id: 'ref-long',
            type: 'note',
            content: 'a'.repeat(100000),
            title: 'Long Document',
            created_at: '2026-02-18T10:00:00Z',
          },
          source: 'product',
        }),
      })

      const result = await handleGetReference(
        api,
        authContext,
        {
          reference_id: 'ref-long',
          product_id: 'prod-123',
        },
        false,
      )

      expect(result.content[0].text.length).toBeGreaterThan(100000)
    })
  })
})

describe('handleAddReference', () => {
  describe('正常路徑', () => {
    it('should add URL reference successfully', async () => {
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-123',
          productName: 'Zentropy',
          reference: {
            id: 'ref-new-url',
            type: 'url',
            content: 'https://example.com/docs',
            title: 'External Docs',
            created_at: '2026-02-18T11:00:00Z',
          },
        }),
      })

      const result = await handleAddReference(
        api,
        authContext,
        {
          product_id: 'prod-123',
          type: 'url',
          content: 'https://example.com/docs',
          title: 'External Docs',
        },
        false,
      )

      expect(api.addProductReference).toHaveBeenCalledWith(
        'user-123',
        'prod-123',
        {
          type: 'url',
          content: 'https://example.com/docs',
          title: 'External Docs',
        },
      )

      expect(result.content[0].text).toContain('✅ Reference added to product: Zentropy')
      expect(result.content[0].text).toContain('ref-new-url')
      expect(result.content[0].text).toContain('url')
    })

    it('should add note reference successfully', async () => {
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-456',
          productName: 'MyApp',
          reference: {
            id: 'ref-new-note',
            type: 'note',
            content: 'This is a detailed architecture document with many sections and paragraphs...',
            title: 'Architecture',
            created_at: '2026-02-18T11:30:00Z',
          },
        }),
      })

      const result = await handleAddReference(
        api,
        authContext,
        {
          product_id: 'prod-456',
          type: 'note',
          content: 'This is a detailed architecture document with many sections and paragraphs...',
          title: 'Architecture',
        },
        false,
      )

      expect(result.content[0].text).toContain('MyApp')
      expect(result.content[0].text).toContain('note')
    })

    it('should add reference without title', async () => {
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-789',
          productName: 'TestProduct',
          reference: {
            id: 'ref-no-title',
            type: 'url',
            content: 'https://test.com',
            title: null,
            created_at: '2026-02-18T12:00:00Z',
          },
        }),
      })

      const result = await handleAddReference(
        api,
        authContext,
        {
          product_id: 'prod-789',
          type: 'url',
          content: 'https://test.com',
        },
        false,
      )

      expect(result.content[0].text).toContain('(no title)')
    })

    it('should preview long content', async () => {
      const longContent = 'a'.repeat(500)
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-999',
          productName: 'LongDoc',
          reference: {
            id: 'ref-long',
            type: 'note',
            content: longContent,
            title: 'Long Document',
            created_at: '2026-02-18T12:30:00Z',
          },
        }),
      })

      const result = await handleAddReference(
        api,
        authContext,
        {
          product_id: 'prod-999',
          type: 'note',
          content: longContent,
          title: 'Long Document',
        },
        false,
      )

      // Should truncate to 200 chars + "..."
      expect(result.content[0].text).toContain('...')
      const previewStart = result.content[0].text.indexOf('## Content Preview')
      const previewContent = result.content[0].text.substring(previewStart)
      expect(previewContent.length).toBeLessThan(longContent.length)
    })

    it('should add warning when sanitized', async () => {
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-123',
          productName: 'Product',
          reference: {
            id: 'ref-sanitized',
            type: 'note',
            content: 'Potentially sensitive content',
            title: 'Test',
            created_at: '2026-02-18T13:00:00Z',
          },
        }),
      })

      const result = await handleAddReference(
        api,
        authContext,
        {
          product_id: 'prod-123',
          type: 'note',
          content: 'Potentially sensitive content',
          title: 'Test',
        },
        true, // sanitized = true
      )

      expect(result.content[0].text).toContain('⚠️ Note: Some content may have been filtered')
    })

    it('should trim whitespace from content and title', async () => {
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-trim',
          productName: 'TrimTest',
          reference: {
            id: 'ref-trim',
            type: 'note',
            content: 'Trimmed content',
            title: 'Trimmed title',
            created_at: '2026-02-18T13:30:00Z',
          },
        }),
      })

      await handleAddReference(
        api,
        authContext,
        {
          product_id: 'prod-trim',
          type: 'note',
          content: '  Trimmed content  ',
          title: '  Trimmed title  ',
        },
        false,
      )

      expect(api.addProductReference).toHaveBeenCalledWith(
        'user-123',
        'prod-trim',
        {
          type: 'note',
          content: 'Trimmed content',
          title: 'Trimmed title',
        },
      )
    })
  })

  describe('參數驗證', () => {
    it('should throw when product_id is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            type: 'url',
            content: 'https://example.com',
          },
          false,
        ),
      ).rejects.toThrow('product_id is required')
    })

    it('should throw when type is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-123',
            content: 'https://example.com',
          },
          false,
        ),
      ).rejects.toThrow('type is required')
    })

    it('should throw when type is invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-123',
            type: 'invalid',
            content: 'test',
          } as any,
          false,
        ),
      ).rejects.toThrow('type must be either')
    })

    it('should throw when content is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-123',
            type: 'url',
          },
          false,
        ),
      ).rejects.toThrow('content is required')
    })

    it('should throw when content is empty', async () => {
      const api = mockApiClient()

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-123',
            type: 'url',
            content: '   ',
          },
          false,
        ),
      ).rejects.toThrow('content cannot be empty')
    })

    it('should throw when parameter types are invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 123,
            type: 'url',
            content: 'test',
          } as any,
          false,
        ),
      ).rejects.toThrow(ValidationException)
    })

    it('should throw when title type is invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-123',
            type: 'url',
            content: 'https://example.com',
            title: 123,
          } as any,
          false,
        ),
      ).rejects.toThrow('title must be a string')
    })
  })

  describe('邊界條件', () => {
    it('should handle minimal content', async () => {
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-min',
          productName: 'MinTest',
          reference: {
            id: 'ref-min',
            type: 'note',
            content: 'x',
            title: 'Min',
            created_at: '2026-02-18T14:00:00Z',
          },
        }),
      })

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-min',
            type: 'note',
            content: 'x',
            title: 'Min',
          },
          false,
        ),
      ).resolves.toBeDefined()
    })

    it('should handle very long content', async () => {
      const longContent = 'a'.repeat(100000)
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-long',
          productName: 'LongTest',
          reference: {
            id: 'ref-long',
            type: 'note',
            content: longContent,
            title: 'Long',
            created_at: '2026-02-18T14:30:00Z',
          },
        }),
      })

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-long',
            type: 'note',
            content: longContent,
          },
          false,
        ),
      ).resolves.toBeDefined()
    })

    it('should handle special characters in content', async () => {
      const api = mockApiClient({
        addProductReference: vi.fn().mockResolvedValue({
          productId: 'prod-special',
          productName: 'SpecialTest',
          reference: {
            id: 'ref-special',
            type: 'note',
            content: '<script>alert("xss")</script>',
            title: 'Special',
            created_at: '2026-02-18T15:00:00Z',
          },
        }),
      })

      await expect(
        handleAddReference(
          api,
          authContext,
          {
            product_id: 'prod-special',
            type: 'note',
            content: '<script>alert("xss")</script>',
          },
          false,
        ),
      ).resolves.toBeDefined()
    })
  })
})
