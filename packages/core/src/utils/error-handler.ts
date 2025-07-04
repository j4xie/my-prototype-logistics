/**
 * 错误处理工具
 */

import { logger } from './logger';

/**
 * 应用错误类型
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly timestamp: Date;
  public readonly userId?: string;
  public readonly context?: string;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    code: string = 'UNKNOWN_ERROR',
    statusCode?: number,
    details?: any,
    context?: string,
    userId?: string
  ) {
    super(message);
    
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    this.userId = userId;

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * 转换为JSON对象
   */
  toJSON(): object {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      userId: this.userId,
      stack: this.stack
    };
  }

  /**
   * 转换为用户友好的消息
   */
  toUserMessage(locale: string = 'zh-CN'): string {
    const messages = {
      'zh-CN': {
        [ErrorType.NETWORK]: '网络连接失败，请检查网络设置',
        [ErrorType.API]: 'API请求失败，请稍后重试',
        [ErrorType.VALIDATION]: '输入数据验证失败',
        [ErrorType.AUTHENTICATION]: '登录已过期，请重新登录',
        [ErrorType.AUTHORIZATION]: '权限不足，无法访问此资源',
        [ErrorType.NOT_FOUND]: '请求的资源不存在',
        [ErrorType.SERVER_ERROR]: '服务器内部错误，请稍后重试',
        [ErrorType.CLIENT_ERROR]: '请求参数错误',
        [ErrorType.TIMEOUT]: '请求超时，请稍后重试',
        [ErrorType.UNKNOWN]: '发生未知错误，请稍后重试'
      },
      'en-US': {
        [ErrorType.NETWORK]: 'Network connection failed, please check your network settings',
        [ErrorType.API]: 'API request failed, please try again later',
        [ErrorType.VALIDATION]: 'Input data validation failed',
        [ErrorType.AUTHENTICATION]: 'Login expired, please log in again',
        [ErrorType.AUTHORIZATION]: 'Insufficient permissions to access this resource',
        [ErrorType.NOT_FOUND]: 'The requested resource does not exist',
        [ErrorType.SERVER_ERROR]: 'Internal server error, please try again later',
        [ErrorType.CLIENT_ERROR]: 'Invalid request parameters',
        [ErrorType.TIMEOUT]: 'Request timeout, please try again later',
        [ErrorType.UNKNOWN]: 'An unknown error occurred, please try again later'
      }
    };

    const localeMessages = messages[locale as keyof typeof messages] || messages['en-US'];
    return localeMessages[this.type] || this.message;
  }
}

/**
 * 网络错误
 */
export class NetworkError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, ErrorType.NETWORK, 'NETWORK_ERROR', undefined, details, context);
  }
}

/**
 * API错误
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code: string = 'API_ERROR',
    details?: any,
    context?: string
  ) {
    super(message, ErrorType.API, code, statusCode, details, context);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any, context?: string) {
    super(message, ErrorType.VALIDATION, 'VALIDATION_ERROR', 400, details, context);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends AppError {
  constructor(message: string = '认证失败', details?: any, context?: string) {
    super(message, ErrorType.AUTHENTICATION, 'AUTHENTICATION_ERROR', 401, details, context);
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends AppError {
  constructor(message: string = '权限不足', details?: any, context?: string) {
    super(message, ErrorType.AUTHORIZATION, 'AUTHORIZATION_ERROR', 403, details, context);
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(message: string = '资源未找到', details?: any, context?: string) {
    super(message, ErrorType.NOT_FOUND, 'NOT_FOUND_ERROR', 404, details, context);
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends AppError {
  constructor(message: string = '请求超时', details?: any, context?: string) {
    super(message, ErrorType.TIMEOUT, 'TIMEOUT_ERROR', 408, details, context);
  }
}

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  /** 是否自动记录错误日志 */
  autoLog: boolean;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** 是否显示用户友好的错误消息 */
  showUserFriendlyMessage: boolean;
  /** 默认语言 */
  defaultLocale: string;
  /** 错误回调函数 */
  onError?: (error: AppError) => void;
  /** 重试配置 */
  retry?: {
    maxAttempts: number;
    delay: number;
    backoff: boolean;
  };
}

/**
 * 全局错误处理器
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private config: ErrorHandlerConfig;

  private constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      autoLog: true,
      logLevel: 'error',
      showUserFriendlyMessage: true,
      defaultLocale: 'zh-CN',
      retry: {
        maxAttempts: 3,
        delay: 1000,
        backoff: true
      },
      ...config
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }
    return ErrorHandler.instance;
  }

  /**
   * 更新配置
   */
  configure(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 处理错误
   */
  handle(error: Error | AppError, context?: string): AppError {
    const appError = this.normalizeError(error, context);

    // 记录日志
    if (this.config.autoLog) {
      this.logError(appError);
    }

    // 执行回调
    if (this.config.onError) {
      this.config.onError(appError);
    }

    return appError;
  }

  /**
   * 异步错误处理
   */
  async handleAsync<T>(
    operation: () => Promise<T>,
    context?: string,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.config.retry?.maxAttempts ?? 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const appError = this.normalizeError(lastError, context);
        
        // 如果是最后一次尝试或者错误不应该重试
        if (attempt === retries || !this.shouldRetry(appError)) {
          throw this.handle(appError, context);
        }

        // 计算延迟时间
        const delay = this.config.retry?.backoff 
          ? (this.config.retry?.delay ?? 1000) * Math.pow(2, attempt - 1)
          : (this.config.retry?.delay ?? 1000);

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw this.handle(lastError!, context);
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: Error | AppError, context?: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // 网络错误
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new NetworkError(error.message, { originalError: error }, context);
    }

    // 超时错误
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return new TimeoutError(error.message, { originalError: error }, context);
    }

    // 默认转换为应用错误
    return new AppError(
      error.message,
      ErrorType.UNKNOWN,
      'UNKNOWN_ERROR',
      undefined,
      { originalError: error },
      context
    );
  }

  /**
   * 记录错误日志
   */
  private logError(error: AppError): void {
    const logData = {
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      userId: error.userId,
      stack: error.stack
    };

    switch (this.config.logLevel) {
      case 'debug':
        logger.debug(error.message, error.context, logData);
        break;
      case 'info':
        logger.info(error.message, error.context, logData);
        break;
      case 'warn':
        logger.warn(error.message, error.context, logData);
        break;
      case 'error':
      default:
        logger.error(error.message, error.context, logData);
        break;
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: AppError): boolean {
    // 网络错误和服务器错误可以重试
    if (error.type === ErrorType.NETWORK || error.type === ErrorType.SERVER_ERROR) {
      return true;
    }

    // 超时错误可以重试
    if (error.type === ErrorType.TIMEOUT) {
      return true;
    }

    // 5xx状态码可以重试
    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  /**
   * 创建错误工厂函数
   */
  createErrorFactory(type: ErrorType, defaultCode: string) {
    return (message: string, details?: any, context?: string) => {
      return new AppError(message, type, defaultCode, undefined, details, context);
    };
  }
}

/**
 * 错误工厂函数
 */
export const ErrorFactory = {
  network: (message: string, details?: any) => new NetworkError(message, details),
  api: (message: string, statusCode: number, code?: string, details?: any) => 
    new ApiError(message, statusCode, code, details),
  validation: (message: string, details?: any) => new ValidationError(message, details),
  authentication: (message?: string, details?: any) => new AuthenticationError(message, details),
  authorization: (message?: string, details?: any) => new AuthorizationError(message, details),
  notFound: (message?: string, details?: any) => new NotFoundError(message, details),
  timeout: (message?: string, details?: any) => new TimeoutError(message, details)
};

/**
 * 错误边界组件辅助函数
 */
export const createErrorBoundary = (
  fallbackComponent: React.ComponentType<{ error: AppError; retry: () => void }>,
  onError?: (error: AppError) => void
) => {
  return class extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: AppError | null }
  > {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): { hasError: boolean; error: AppError } {
      const errorHandler = ErrorHandler.getInstance();
      const appError = errorHandler.handle(error, 'ErrorBoundary');
      
      return {
        hasError: true,
        error: appError
      };
    }

    componentDidCatch(error: Error, errorInfo: any) {
      if (onError && this.state.error) {
        onError(this.state.error);
      }
    }

    render() {
      if (this.state.hasError && this.state.error) {
        const FallbackComponent = fallbackComponent;
        return (
          <FallbackComponent
            error={this.state.error}
            retry={() => this.setState({ hasError: false, error: null })}
          />
        );
      }

      return this.props.children;
    }
  };
};

// 全局错误处理器实例
export const errorHandler = ErrorHandler.getInstance();

// 默认导出
export default ErrorHandler;