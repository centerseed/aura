/**
 * Capture MCP Tool Handlers — Unit Tests
 *
 * Tests the capture-related tool handlers: capture, capture_thought, report_done.
 * BackendApiClient and Use Cases are fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationException } from '../../../../src/lib/api-response'
import type { BackendApiClient } from '../../../../src/mcp/backend-client/api-client'
import type { AuthContext } from '../../../../src/mcp/types'
import { handleCapture } from '../../../../src/mcp/tools/capture'
import { handleCaptureThought } from '../../../../src/mcp/tools/capture-thought'
import { handleReportDone } from '../../../../src/mcp/tools/report-done'

// Mock Use Cases
vi.mock('../../../../src/application/use-cases/mcp/capture', () => ({
  CaptureUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      id: 'capture-123',
      status: 'processed',
      classified_as: 'execution_plan',
      filed_to: { area: 'Engineering', product: 'Zentropy' },
      parent_id: 'parent-123',
      agent_actions: ['Gatekeeper: identified as execution plan'],
    }),
  })),
}))

vi.mock('../../../../src/application/use-cases/mcp/report-done', () => ({
  ReportDoneUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      action_id: 'task-123',
      status: 'completed',
      completed_at: '2026-02-18T10:00:00Z',
      deviation: {
        estimated_minutes: 60,
        actual_minutes: 75,
        ratio: 1.25,
      },
      coach_feedback: 'Took 25% longer than estimated (1.25x).',
      archived: true,
    }),
  })),
}))

function mockApiClient(overrides: Partial<BackendApiClient> = {}): BackendApiClient {
  return {
    captureThought: vi.fn(),
    appendToKnowledge: vi.fn(),
    queryMemory: vi.fn(),
    ...overrides,
  } as unknown as BackendApiClient
}

const authContext: AuthContext = {
  userId: 'user-123',
  clientId: 'test-client',
  scopes: ['write:inbox'],
  tokenExpiry: Date.now() + 3600_000,
}

describe('handleCapture', () => {
  describe('正常路徑', () => {
    it('should handle thought mode via brain-dump pipeline', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({
          id: 'thought-123',
          status: 'processed',
        }),
      })

      const result = await handleCapture(
        api,
        authContext,
        {
          content: 'This is a thought',
          source: 'mcp',
          mode: 'thought',
        },
        false,
      )

      expect(api.captureThought).toHaveBeenCalledWith('user-123', {
        content: 'This is a thought',
        source: 'mcp',
        context_hint: undefined,
      })
      expect(result).toMatchObject({
        id: 'thought-123',
        status: 'processed',
        classified_as: 'thought',
      })
    })

    it('should default to thought mode when mode not specified', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({
          id: 'thought-456',
          status: 'processed',
        }),
      })

      await handleCapture(
        api,
        authContext,
        {
          content: 'No mode specified',
          source: 'web',
        },
        false,
      )

      expect(api.captureThought).toHaveBeenCalled()
    })

    it('should add _warning when sanitized is true', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({
          id: 'thought-789',
          status: 'processed',
        }),
      })

      const result = await handleCapture(
        api,
        authContext,
        {
          content: 'Content with potentially sensitive data',
          source: 'mcp',
        },
        true, // sanitized = true
      )

      expect(result._warning).toBe('content_sanitized')
    })
  })

  describe('參數驗證', () => {
    it('should throw ValidationException when content is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleCapture(api, authContext, { source: 'mcp' }, false),
      ).rejects.toThrow(ValidationException)

      await expect(
        handleCapture(api, authContext, { source: 'mcp' }, false),
      ).rejects.toThrow('content is required')
    })

    it('should throw ValidationException when content is empty', async () => {
      const api = mockApiClient()

      await expect(
        handleCapture(api, authContext, { content: '   ', source: 'mcp' }, false),
      ).rejects.toThrow('content cannot be empty')
    })

    it('should accept missing source (optional, defaults to mcp-client)', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({ id: 'cap-1' }),
      })

      // source is now optional - should not throw
      await expect(
        handleCapture(api, authContext, { content: 'test' }, false),
      ).resolves.toBeDefined()
    })

    it('should throw ValidationException when mode is invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleCapture(
          api,
          authContext,
          { content: 'test', source: 'mcp', mode: 'invalid_mode' },
          false,
        ),
      ).rejects.toThrow('mode must be one of')
    })
  })

  describe('邊界條件', () => {
    it('should handle content with only one character', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({
          id: 'thought-min',
          status: 'processed',
        }),
      })

      await expect(
        handleCapture(api, authContext, { content: 'x', source: 'mcp' }, false),
      ).resolves.toBeDefined()
    })

    it('should handle very long content', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({
          id: 'thought-long',
          status: 'processed',
        }),
      })

      const longContent = 'a'.repeat(10000)

      await expect(
        handleCapture(api, authContext, { content: longContent, source: 'mcp' }, false),
      ).resolves.toBeDefined()
    })
  })
})

describe('handleCaptureThought', () => {
  describe('正常路徑', () => {
    it('should capture thought successfully', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({
          id: 'thought-123',
          status: 'processed',
        }),
      })

      const result = await handleCaptureThought(
        api,
        authContext,
        {
          content: 'Remember to check the logs',
          source: 'claude-desktop',
          context_hint: 'Engineering/Zentropy',
        },
        false,
      )

      expect(api.captureThought).toHaveBeenCalledWith('user-123', {
        content: 'Remember to check the logs',
        source: 'claude-desktop',
        context_hint: 'Engineering/Zentropy',
      })
      expect(result).toEqual({
        id: 'thought-123',
        status: 'processed',
      })
    })

    it('should add _warning when sanitized', async () => {
      const api = mockApiClient({
        captureThought: vi.fn().mockResolvedValue({
          id: 'thought-456',
          status: 'processed',
        }),
      })

      const result = await handleCaptureThought(
        api,
        authContext,
        { content: 'Sensitive content', source: 'mcp' },
        true,
      )

      expect(result._warning).toBe('content_sanitized')
    })
  })

  describe('參數驗證', () => {
    it('should throw when content is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleCaptureThought(api, authContext, { source: 'mcp' }, false),
      ).rejects.toThrow('content is required')
    })

    it('should throw when content is empty', async () => {
      const api = mockApiClient()

      // Empty string is still a valid string, so it won't trigger "is required"
      // Instead it will trigger the "cannot be empty" check after trim
      await expect(
        handleCaptureThought(api, authContext, { content: '   ', source: 'mcp' }, false),
      ).rejects.toThrow('content cannot be empty')
    })

    it('should throw when source is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleCaptureThought(api, authContext, { content: 'test' }, false),
      ).rejects.toThrow('source is required')
    })

    it('should throw when content type is invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleCaptureThought(
          api,
          authContext,
          { content: 123, source: 'mcp' } as any,
          false,
        ),
      ).rejects.toThrow(ValidationException)
    })
  })
})

describe('handleReportDone', () => {
  describe('正常路徑', () => {
    it('should report task completion with all parameters', async () => {
      const api = mockApiClient()

      const result = await handleReportDone(
        api,
        authContext,
        {
          action_id: 'task-123',
          actual_duration_minutes: 75,
          outcome: 'completed',
          notes: 'Task completed successfully',
        },
        false,
      )

      expect(result).toMatchObject({
        action_id: 'task-123',
        status: 'completed',
        deviation: {
          estimated_minutes: 60,
          actual_minutes: 75,
          ratio: 1.25,
        },
        archived: true,
      })
    })

    it('should handle minimal parameters (only action_id)', async () => {
      const api = mockApiClient()

      const result = await handleReportDone(
        api,
        authContext,
        { action_id: 'task-456' },
        false,
      )

      expect(result).toBeDefined()
      expect(result.action_id).toBe('task-123') // mocked value
    })

    it('should handle partial outcome', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-789', outcome: 'partial' },
          false,
        ),
      ).resolves.toBeDefined()
    })

    it('should handle blocked outcome', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-999', outcome: 'blocked' },
          false,
        ),
      ).resolves.toBeDefined()
    })
  })

  describe('參數驗證', () => {
    it('should throw when action_id is missing', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(api, authContext, {}, false),
      ).rejects.toThrow('action_id is required')
    })

    it('should throw when action_id is not a string', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(api, authContext, { action_id: 123 } as any, false),
      ).rejects.toThrow('action_id is required')
    })

    it('should throw when actual_duration_minutes is negative', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-123', actual_duration_minutes: -10 },
          false,
        ),
      ).rejects.toThrow('actual_duration_minutes must be a non-negative number')
    })

    it('should throw when actual_duration_minutes is not a number', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-123', actual_duration_minutes: '60' } as any,
          false,
        ),
      ).rejects.toThrow('actual_duration_minutes must be a number')
    })

    it('should throw when outcome is invalid', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-123', outcome: 'invalid' } as any,
          false,
        ),
      ).rejects.toThrow('outcome must be one of')
    })
  })

  describe('邊界條件', () => {
    it('should handle actual_duration_minutes = 0', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-123', actual_duration_minutes: 0 },
          false,
        ),
      ).resolves.toBeDefined()
    })

    it('should handle very large duration', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-123', actual_duration_minutes: 10000 },
          false,
        ),
      ).resolves.toBeDefined()
    })

    it('should handle empty notes string', async () => {
      const api = mockApiClient()

      await expect(
        handleReportDone(
          api,
          authContext,
          { action_id: 'task-123', notes: '' },
          false,
        ),
      ).resolves.toBeDefined()
    })
  })
})
