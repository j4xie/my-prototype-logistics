import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';

/**
 * 自定义错误类
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

/**
 * 认证错误类
 */
export class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * 权限错误类
 */
export class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * 资源不存在错误类
 */
export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 冲突错误类
 */
export class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 业务逻辑错误类
 */
export class BusinessLogicError extends AppError {
  constructor(message, errorCode = 'BUSINESS_LOGIC_ERROR') {
    super(message, 422, errorCode);
  }
}

/**
 * 处理Prisma错误
 */
const handlePrismaError = (error) => {
  switch (error.code) {
    case 'P2002':
      // 唯一约束违反
      const field = error.meta?.target?.[0] || 'field';
      return new ConflictError(`${field} 已存在`);
    
    case 'P2003':
      // 外键约束违反
      return new ValidationError('关联数据不存在');
    
    case 'P2025':
      // 记录不存在
      return new NotFoundError('记录不存在');
    
    case 'P2014':
      // 关系约束违反
      return new ValidationError('数据关系违反约束');
    
    default:
      return new AppError('数据库操作失败', 500, 'DATABASE_ERROR');
  }
};

/**
 * 处理JWT错误
 */
const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('无效的令牌');
  } else if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('令牌已过期');
  } else if (error.name === 'NotBeforeError') {
    return new AuthenticationError('令牌尚未生效');
  }
  
  return new AuthenticationError('令牌验证失败');
};

/**
 * 错误处理中间件
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // 处理特定类型的错误
  if (err instanceof PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else if (err.name && err.name.includes('JsonWebToken')) {
    error = handleJWTError(err);
  } else if (err.name === 'ValidationError') {
    // Zod验证错误
    const validationErrors = err.errors?.map(e => ({
      field: e.path?.join('.'),
      message: e.message,
    })) || [];
    
    error = new ValidationError('数据验证失败', validationErrors);
  } else if (err.name === 'CastError') {
    error = new ValidationError('数据格式错误');
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ValidationError('文件大小超过限制');
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new ValidationError('意外的文件字段');
  }

  // 如果不是操作错误，创建一个通用错误
  if (!error.isOperational) {
    error = new AppError(
      process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
      500,
      'INTERNAL_ERROR'
    );
  }

  // 记录错误日志
  if (error.statusCode >= 500) {
    console.error('Server Error:', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  } else {
    console.warn('Client Error:', {
      message: error.message,
      errorCode: error.errorCode,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  }

  // 构建响应
  const response = {
    success: false,
    message: error.message,
    errorCode: error.errorCode,
    timestamp: new Date().toISOString(),
  };

  // 在开发环境中添加更多调试信息
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  // 添加验证错误详情
  if (error instanceof ValidationError && error.errors) {
    response.errors = error.errors;
  }

  res.status(error.statusCode).json(response);
};

/**
 * 404错误处理中间件
 */
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`路由 ${req.originalUrl} 不存在`);
  next(error);
};

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获错误
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 创建错误响应的工具函数
 */
export const createErrorResponse = (message, statusCode = 500, errorCode = 'INTERNAL_ERROR') => {
  return {
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
  };
};

/**
 * 创建成功响应的工具函数
 */
export const createSuccessResponse = (data, message = '操作成功') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};