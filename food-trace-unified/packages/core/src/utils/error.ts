// 错误处理工具
import { logger } from '../platform/logger';

// 自定义错误类
export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    status: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// API错误类
export class ApiError extends AppError {
  constructor(message: string, status: number = 500, code?: string) {
    super(message, code || `API_ERROR_${status}`, status);
    this.name = 'ApiError';
  }
}

// 认证错误类
export class AuthError extends AppError {
  constructor(message: string = '认证失败', code: string = 'AUTH_ERROR') {
    super(message, code, 401);
    this.name = 'AuthError';
  }
}

// 权限错误类
export class PermissionError extends AppError {
  constructor(message: string = '权限不足', code: string = 'PERMISSION_ERROR') {
    super(message, code, 403);
    this.name = 'PermissionError';
  }
}

// 验证错误类
export class ValidationError extends AppError {
  public readonly fields: Record<string, string[]>;

  constructor(
    message: string = '数据验证失败',
    fields: Record<string, string[]> = {},
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message, code, 400);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

// 网络错误类
export class NetworkError extends AppError {
  constructor(message: string = '网络连接失败', code: string = 'NETWORK_ERROR') {
    super(message, code, 0);
    this.name = 'NetworkError';
  }
}

// 错误码定义
export const ERROR_CODES = {
  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // 认证相关
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FAILED: 'AUTH_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // 权限相关
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ROLE_INSUFFICIENT: 'ROLE_INSUFFICIENT',
  
  // 数据验证
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // 业务逻辑
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // 系统相关
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const;

// 错误消息映射
export const ERROR_MESSAGES = {
  [ERROR_CODES.UNKNOWN_ERROR]: '发生未知错误',
  [ERROR_CODES.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
  [ERROR_CODES.SERVER_ERROR]: '服务器内部错误，请稍后重试',
  
  [ERROR_CODES.AUTH_REQUIRED]: '请先登录',
  [ERROR_CODES.AUTH_FAILED]: '用户名或密码错误',
  [ERROR_CODES.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [ERROR_CODES.TOKEN_INVALID]: '登录信息无效，请重新登录',
  
  [ERROR_CODES.PERMISSION_DENIED]: '权限不足，无法执行此操作',
  [ERROR_CODES.ROLE_INSUFFICIENT]: '您的角色权限不足',
  
  [ERROR_CODES.VALIDATION_FAILED]: '数据验证失败',
  [ERROR_CODES.REQUIRED_FIELD_MISSING]: '必填字段不能为空',
  [ERROR_CODES.INVALID_FORMAT]: '数据格式不正确',
  
  [ERROR_CODES.RESOURCE_NOT_FOUND]: '请求的资源不存在',
  [ERROR_CODES.RESOURCE_ALREADY_EXISTS]: '资源已存在',
  [ERROR_CODES.OPERATION_NOT_ALLOWED]: '当前状态不允许此操作',
  
  [ERROR_CODES.DATABASE_ERROR]: '数据库操作失败',
  [ERROR_CODES.FILE_UPLOAD_FAILED]: '文件上传失败',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: '外部服务调用失败'
} as const;

// 错误处理器
export class ErrorHandler {
  // 处理API错误响应
  static handleApiError(error: any): AppError {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || data?.error || '请求失败';
      const code = data?.code || `HTTP_${status}`;
      
      if (status === 401) {
        return new AuthError(message, code);
      }
      
      if (status === 403) {
        return new PermissionError(message, code);
      }
      
      if (status === 422 && data?.errors) {
        return new ValidationError(message, data.errors, code);
      }
      
      return new ApiError(message, status, code);
    }
    
    if (error.request) {
      return new NetworkError('网络请求失败');
    }
    
    return new AppError(error.message || '发生未知错误');
  }

  // 记录错误
  static logError(error: Error, context?: Record<string, any>): void {
    const errorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context
    };

    if (error instanceof AppError) {
      errorInfo.code = error.code;
      errorInfo.status = error.status;
      errorInfo.isOperational = error.isOperational;
    }

    logger.error('Error occurred:', errorInfo);
  }

  // 获取用户友好的错误消息
  static getUserMessage(error: Error): string {
    if (error instanceof AppError) {
      return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] || error.message;
    }
    
    return '发生未知错误，请稍后重试';
  }
}

// 异步错误包装器
export const asyncErrorWrapper = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = error instanceof AppError 
        ? error 
        : ErrorHandler.handleApiError(error);
      
      ErrorHandler.logError(appError, { 
        function: fn.name,
        arguments: args 
      });
      
      throw appError;
    }
  };
};

// 错误重试装饰器
export const withRetry = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number = 3,
  delay: number = 1000
) => {
  return async (...args: T): Promise<R> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // 只重试网络错误和服务器错误
        if (error instanceof NetworkError || 
            (error instanceof ApiError && error.status >= 500)) {
          logger.warn(`Retry attempt ${attempt}/${maxRetries} for ${fn.name}`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          continue;
        }
        
        // 其他错误不重试
        throw error;
      }
    }
    
    throw lastError!;
  };
};