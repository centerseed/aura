/**
 * 統一的 API 回應格式
 *
 * 所有 API Routes 必須使用此格式返回資料,確保：
 * 1. 前端可預期的回應結構
 * 2. 一致的錯誤處理
 * 3. 類型安全
 */

import { NextResponse } from 'next/server'

// ============================================================================
// Response Types
// ============================================================================

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: {
    timestamp: string
    page?: number
    limit?: number
    total?: number
    totalPages?: number
    [key: string]: unknown
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
  meta: {
    timestamp: string
    requestId?: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================================
// Error Codes
// ============================================================================

export enum ErrorCode {
  // 400 系列 - Client 錯誤
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',

  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 500 系列 - Server 錯誤
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  LLM_ERROR = 'LLM_ERROR',
}

// ============================================================================
// Error Code to HTTP Status Mapping
// ============================================================================

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.BUSINESS_LOGIC_ERROR]: 422,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.LLM_ERROR]: 503,
}

// ============================================================================
// API Response Builder
// ============================================================================

export class ApiResponseBuilder {
  /**
   * 成功回應
   */
  static success<T>(
    data: T,
    meta?: Omit<ApiSuccessResponse<T>['meta'], 'timestamp'>
  ): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    })
  }

  /**
   * 分頁成功回應
   */
  static successWithPagination<T>(
    data: T[],
    pagination: {
      page: number
      limit: number
      total: number
    }
  ): NextResponse<ApiSuccessResponse<T[]>> {
    return NextResponse.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
      },
    })
  }

  /**
   * 錯誤回應
   */
  static error(
    error: unknown,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    customMessage?: string
  ): NextResponse<ApiErrorResponse> {
    const message = customMessage || this.extractErrorMessage(error)
    const status = ERROR_STATUS_MAP[code] || 500

    // 生產環境不要暴露 error details
    const details = process.env.NODE_ENV === 'development'
      ? error
      : undefined

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
          details,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status }
    )
  }

  /**
   * 驗證錯誤
   */
  static validationError(message: string, details?: unknown): NextResponse<ApiErrorResponse> {
    return this.error(
      { message, details },
      ErrorCode.VALIDATION_ERROR,
      message
    )
  }

  /**
   * 未授權
   */
  static unauthorized(message: string = 'Unauthorized'): NextResponse<ApiErrorResponse> {
    return this.error(
      new Error(message),
      ErrorCode.UNAUTHORIZED,
      message
    )
  }

  /**
   * 無權限
   */
  static forbidden(message: string = 'Forbidden'): NextResponse<ApiErrorResponse> {
    return this.error(
      new Error(message),
      ErrorCode.FORBIDDEN,
      message
    )
  }

  /**
   * 資源不存在
   */
  static notFound(resource: string = 'Resource'): NextResponse<ApiErrorResponse> {
    return this.error(
      new Error(`${resource} not found`),
      ErrorCode.NOT_FOUND,
      `${resource} not found`
    )
  }

  /**
   * 衝突
   */
  static conflict(message: string): NextResponse<ApiErrorResponse> {
    return this.error(
      new Error(message),
      ErrorCode.CONFLICT,
      message
    )
  }

  /**
   * 業務邏輯錯誤
   */
  static businessLogicError(message: string): NextResponse<ApiErrorResponse> {
    return this.error(
      new Error(message),
      ErrorCode.BUSINESS_LOGIC_ERROR,
      message
    )
  }

  /**
   * 從 Error 物件提取訊息
   */
  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    return 'An unknown error occurred'
  }
}

// ============================================================================
// Domain Exceptions (可被 API Layer 捕獲並轉換)
// ============================================================================

export class DomainException extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.BUSINESS_LOGIC_ERROR
  ) {
    super(message)
    this.name = 'DomainException'
  }
}

export class ValidationException extends DomainException {
  constructor(message: string, public field?: string) {
    super(message, ErrorCode.VALIDATION_ERROR)
    this.name = 'ValidationException'
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message: string = 'Unauthorized') {
    super(message, ErrorCode.UNAUTHORIZED)
    this.name = 'UnauthorizedException'
  }
}

export class ForbiddenException extends DomainException {
  constructor(message: string = 'Forbidden') {
    super(message, ErrorCode.FORBIDDEN)
    this.name = 'ForbiddenException'
  }
}

export class NotFoundException extends DomainException {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ErrorCode.NOT_FOUND)
    this.name = 'NotFoundException'
  }
}

export class ConflictException extends DomainException {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT)
    this.name = 'ConflictException'
  }
}

export class RateLimitException extends DomainException {
  constructor(message: string = 'Daily AI usage limit exceeded') {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED)
    this.name = 'RateLimitException'
  }
}

// ============================================================================
// Helper: Catch Domain Exceptions
// ============================================================================

/**
 * 捕獲 Domain Exception 並轉換為對應的 API Response
 *
 * 範例:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   return catchDomainException(async () => {
 *     const useCase = new CreateTaskUseCase()
 *     const task = await useCase.execute(data)
 *     return ApiResponseBuilder.success(task)
 *   })
 * }
 * ```
 */
export async function catchDomainException<T = any>(
  handler: () => Promise<NextResponse<ApiSuccessResponse<T>>>
): Promise<NextResponse<any>> {
  try {
    return await handler()
  } catch (error) {
    // Domain Exceptions
    if (error instanceof ValidationException) {
      return ApiResponseBuilder.validationError(error.message, { field: error.field })
    }
    if (error instanceof UnauthorizedException) {
      return ApiResponseBuilder.unauthorized(error.message)
    }
    if (error instanceof ForbiddenException) {
      return ApiResponseBuilder.forbidden(error.message)
    }
    if (error instanceof NotFoundException) {
      return ApiResponseBuilder.notFound(error.message.replace(' not found', ''))
    }
    if (error instanceof ConflictException) {
      return ApiResponseBuilder.conflict(error.message)
    }
    if (error instanceof RateLimitException) {
      return ApiResponseBuilder.error(error, ErrorCode.RATE_LIMIT_EXCEEDED, error.message)
    }
    if (error instanceof DomainException) {
      return ApiResponseBuilder.businessLogicError(error.message)
    }

    // 檢查是否為認證錯誤（向後相容）
    if (error instanceof Error && error.message.includes('token')) {
      return ApiResponseBuilder.unauthorized(error.message)
    }

    // 未知錯誤
    console.error('[API Error]', error)
    return ApiResponseBuilder.error(error)
  }
}
