/**
 * API错误类型枚举
 */
export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',           // 网络连接错误
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',           // 请求超时
  AUTH_ERROR = 'AUTH_ERROR',                 // 认证失败（401）
  PERMISSION_ERROR = 'PERMISSION_ERROR',     // 权限不足（403）
  NOT_FOUND = 'NOT_FOUND',                   // 资源不存在（404）
  SERVER_ERROR = 'SERVER_ERROR',             // 服务器错误（5xx）
  VALIDATION_ERROR = 'VALIDATION_ERROR',     // 数据验证错误（400）
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',           // 未知错误
}

/**
 * API错误类
 * 用于处理所有API调用相关的错误
 */
export class ApiError extends Error {
  public readonly type: ApiErrorType;
  public readonly statusCode?: number;
  public readonly originalError?: Error;
  public readonly requestUrl?: string;
  public readonly canRetry: boolean;

  constructor(
    message: string,
    type: ApiErrorType = ApiErrorType.UNKNOWN_ERROR,
    options?: {
      statusCode?: number;
      originalError?: Error;
      requestUrl?: string;
      canRetry?: boolean;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = options?.statusCode;
    this.originalError = options?.originalError;
    this.requestUrl = options?.requestUrl;
    this.canRetry = options?.canRetry ?? false;

    // 维护正确的原型链
    Object.setPrototypeOf(this, ApiError.prototype);

    // 保留原始错误的堆栈信息
    if (options?.originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.originalError.stack}`;
    }
  }

  /**
   * 从HTTP响应创建ApiError
   */
  static fromResponse(response: any, requestUrl?: string): ApiError {
    const statusCode = response.status || response.code;
    const message = response.message || response.msg || 'API请求失败';

    let type: ApiErrorType;
    let canRetry = false;

    // 根据状态码判断错误类型
    if (statusCode === 401) {
      type = ApiErrorType.AUTH_ERROR;
      canRetry = false;
    } else if (statusCode === 403) {
      type = ApiErrorType.PERMISSION_ERROR;
      canRetry = false;
    } else if (statusCode === 404) {
      type = ApiErrorType.NOT_FOUND;
      canRetry = false;
    } else if (statusCode === 400) {
      type = ApiErrorType.VALIDATION_ERROR;
      canRetry = false;
    } else if (statusCode >= 500) {
      type = ApiErrorType.SERVER_ERROR;
      canRetry = true; // 服务器错误可以重试
    } else {
      type = ApiErrorType.UNKNOWN_ERROR;
      canRetry = false;
    }

    return new ApiError(message, type, {
      statusCode,
      requestUrl,
      canRetry,
    });
  }

  /**
   * 从网络错误创建ApiError
   */
  static fromNetworkError(error: Error, requestUrl?: string): ApiError {
    // 判断是否为超时错误
    const isTimeout =
      error.message.includes('timeout') ||
      error.message.includes('timed out') ||
      error.name === 'TimeoutError';

    const type = isTimeout ? ApiErrorType.TIMEOUT_ERROR : ApiErrorType.NETWORK_ERROR;
    const message = isTimeout ? '请求超时，请检查网络连接' : '网络连接失败，请检查网络设置';

    return new ApiError(message, type, {
      originalError: error,
      requestUrl,
      canRetry: true, // 网络错误和超时都可以重试
    });
  }

  /**
   * 获取用户友好的错误提示
   */
  getUserMessage(): string {
    switch (this.type) {
      case ApiErrorType.NETWORK_ERROR:
        return '网络连接失败，请检查网络设置后重试';

      case ApiErrorType.TIMEOUT_ERROR:
        return '请求超时，请稍后重试';

      case ApiErrorType.AUTH_ERROR:
        return '登录已过期，请重新登录';

      case ApiErrorType.PERMISSION_ERROR:
        return '您没有权限执行此操作';

      case ApiErrorType.NOT_FOUND:
        return '请求的资源不存在';

      case ApiErrorType.SERVER_ERROR:
        return '服务器繁忙，请稍后重试';

      case ApiErrorType.VALIDATION_ERROR:
        return this.message || '输入数据有误，请检查后重试';

      case ApiErrorType.UNKNOWN_ERROR:
      default:
        return this.message || '操作失败，请稍后重试';
    }
  }

  /**
   * 判断是否为认证错误
   */
  isAuthError(): boolean {
    return this.type === ApiErrorType.AUTH_ERROR;
  }

  /**
   * 判断是否为网络错误
   */
  isNetworkError(): boolean {
    return (
      this.type === ApiErrorType.NETWORK_ERROR ||
      this.type === ApiErrorType.TIMEOUT_ERROR
    );
  }

  /**
   * 获取开发者调试信息
   */
  getDebugInfo(): string {
    return JSON.stringify(
      {
        name: this.name,
        type: this.type,
        message: this.message,
        statusCode: this.statusCode,
        requestUrl: this.requestUrl,
        canRetry: this.canRetry,
        originalError: this.originalError?.message,
        stack: this.stack,
      },
      null,
      2
    );
  }
}

/**
 * 判断错误是否为ApiError
 */
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError;
}
