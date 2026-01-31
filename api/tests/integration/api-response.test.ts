/**
 * API Response 整合測試
 */

import { describe, it, expect } from 'vitest'
import {
  ApiResponseBuilder,
  ValidationException,
  NotFoundException,
  ConflictException,
  catchDomainException,
} from '@/lib/api-response'
import { NextResponse } from 'next/server'

describe('ApiResponseBuilder', () => {
  describe('success', () => {
    it('應該返回成功的 API 回應', () => {
      const data = { id: '123', name: 'Test' }
      const response = ApiResponseBuilder.success(data, {})

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
    })
  })

  describe('error', () => {
    it('應該返回錯誤的 API 回應', () => {
      const response = ApiResponseBuilder.error('Test error', 'VALIDATION_ERROR')

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(400)
    })
  })

  describe('validationError', () => {
    it('應該返回驗證錯誤回應', () => {
      const response = ApiResponseBuilder.validationError('Invalid input', {
        field: 'email',
      })

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(400)
    })
  })

  describe('notFound', () => {
    it('應該返回 404 回應', () => {
      const response = ApiResponseBuilder.notFound('User')

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(404)
    })
  })
})

describe('Domain Exceptions', () => {
  it('ValidationException 應該包含正確的訊息和欄位', () => {
    const error = new ValidationException('Invalid email', 'email')

    expect(error.message).toBe('Invalid email')
    expect(error.field).toBe('email')
  })

  it('NotFoundException 應該包含正確的訊息', () => {
    const error = new NotFoundException('User')

    expect(error.message).toBe('User not found')
  })

  it('ConflictException 應該包含正確的訊息', () => {
    const error = new ConflictException('Email already exists')

    expect(error.message).toBe('Email already exists')
  })
})

describe('catchDomainException', () => {
  it('應該捕獲 ValidationException 並返回錯誤回應', async () => {
    const handler = async () => {
      throw new ValidationException('Test validation error', 'test')
    }

    const response = await catchDomainException(handler)

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(400)
  })

  it('應該捕獲 NotFoundException 並返回 404', async () => {
    const handler = async () => {
      throw new NotFoundException('Resource not found')
    }

    const response = await catchDomainException(handler)

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(404)
  })

  it('應該捕獲一般錯誤並返回 500', async () => {
    const handler = async () => {
      throw new Error('Unexpected error')
    }

    const response = await catchDomainException(handler)

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(500)
  })

  it('應該允許成功的處理器正常執行', async () => {
    const handler = async () => {
      return ApiResponseBuilder.success({ message: 'Success' }, {})
    }

    const response = await catchDomainException(handler)

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(200)
  })
})
