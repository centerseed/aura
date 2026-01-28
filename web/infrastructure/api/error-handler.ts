/**
 * API Error Handler - 統一錯誤處理
 *
 * 統一所有 API 錯誤處理邏輯，消除重複的認證錯誤檢查
 * 原本在 17 個 API 路由檔案中重複實作
 */

/**
 * 基礎 API 錯誤類別
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 認證錯誤（401）
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = '認證失敗，請重新登入') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

/**
 * 授權錯誤（403）
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = '沒有權限執行此操作') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

/**
 * 資源未找到（404）
 */
export class NotFoundError extends ApiError {
  constructor(message: string = '資源未找到') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

/**
 * 驗證錯誤（400）
 */
export class ValidationError extends ApiError {
  constructor(message: string = '請求資料驗證失敗') {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

/**
 * 伺服器錯誤（500）
 */
export class ServerError extends ApiError {
  constructor(message: string = '伺服器錯誤') {
    super(message, 500, 'SERVER_ERROR')
    this.name = 'ServerError'
  }
}

/**
 * 根據 HTTP 狀態碼拋出對應的錯誤
 */
export function throwApiError(status: number, message: string): never {
  switch (status) {
    case 401:
      throw new AuthenticationError(message)
    case 403:
      throw new AuthorizationError(message)
    case 404:
      throw new NotFoundError(message)
    case 400:
      throw new ValidationError(message)
    case 500:
    case 503:
      throw new ServerError(message)
    default:
      throw new ApiError(message, status)
  }
}

/**
 * 處理通用錯誤並轉換為 ApiError
 *
 * 統一錯誤處理邏輯，包含：
 * - 認證錯誤檢測（原本在 17 個檔案中重複）
 * - 錯誤訊息標準化
 */
export function handleError(error: unknown): ApiError {
  // 已經是 ApiError，直接返回
  if (error instanceof ApiError) {
    return error
  }

  // 轉換為字串訊息
  const errorMessage = error instanceof Error ? error.message : String(error)

  // 檢測認證錯誤（原本重複的邏輯）
  if (errorMessage.includes('token') || errorMessage.includes('Unauthorized')) {
    return new AuthenticationError('認證失敗，請重新登入')
  }

  // 檢測授權錯誤
  if (errorMessage.includes('permission') || errorMessage.includes('Forbidden')) {
    return new AuthorizationError('沒有權限執行此操作')
  }

  // 檢測未找到錯誤
  if (errorMessage.includes('not found') || errorMessage.includes('Not Found')) {
    return new NotFoundError(errorMessage)
  }

  // 其他錯誤
  return new ServerError(errorMessage)
}
