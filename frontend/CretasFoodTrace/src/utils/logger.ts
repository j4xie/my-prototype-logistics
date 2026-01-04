/**
 * 统一日志工具
 *
 * 功能:
 * - 日志级别管理 (DEBUG, INFO, WARN, ERROR)
 * - 环境区分 (开发/生产)
 * - 格式化输出
 * - 敏感信息脱敏
 * - 性能追踪
 * - 错误追踪集成预留接口
 *
 * @example
 * ```typescript
 * import { logger } from '@/utils/logger';
 *
 * logger.debug('调试信息', { userId: 123 });
 * logger.info('用户登录成功', { username: 'user123' });
 * logger.warn('Token即将过期');
 * logger.error('API调用失败', error);
 * ```
 */

import { Platform } from 'react-native';

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// 配置接口
interface LoggerConfig {
  /** 当前日志级别 */
  level: LogLevel;
  /** 是否启用时间戳 */
  enableTimestamp: boolean;
  /** 是否启用调用位置追踪 */
  enableStackTrace: boolean;
  /** 敏感字段列表（将被脱敏） */
  sensitiveFields: string[];
  /** 错误追踪服务集成（如 Sentry） */
  errorTracker?: (error: Error, context?: any) => void;
}

// 默认配置
const defaultConfig: LoggerConfig = {
  // 开发环境显示所有日志，生产环境只显示警告和错误
  level: __DEV__ ? LogLevel.DEBUG : LogLevel.WARN,
  enableTimestamp: true,
  enableStackTrace: false,
  sensitiveFields: [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'creditCard',
    'cvv',
    'ssn',
  ],
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 配置日志工具
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 集成错误追踪服务 (如 Sentry)
   */
  setErrorTracker(tracker: (error: Error, context?: any) => void): void {
    this.config.errorTracker = tracker;
  }

  /**
   * DEBUG级别日志 - 仅在开发环境输出
   */
  debug(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, ...args);
    }
  }

  /**
   * INFO级别日志 - 正常运行信息
   */
  info(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, ...args);
    }
  }

  /**
   * WARN级别日志 - 警告信息
   */
  warn(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, ...args);
    }
  }

  /**
   * ERROR级别日志 - 错误信息
   */
  error(message: string, error?: any, context?: any): void {
    if (this.config.level <= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, error, context);

      // 如果配置了错误追踪服务，自动上报
      if (this.config.errorTracker && error instanceof Error) {
        try {
          this.config.errorTracker(error, { message, ...context });
        } catch (trackerError) {
          console.error('[Logger] Error tracker failed:', trackerError);
        }
      }
    }
  }

  /**
   * 性能日志 - 记录操作耗时
   */
  performance(operation: string, durationMs: number, metadata?: any): void {
    if (this.config.level <= LogLevel.INFO) {
      const formattedDuration = durationMs < 1000
        ? `${durationMs.toFixed(0)}ms`
        : `${(durationMs / 1000).toFixed(2)}s`;

      this.info(
        `[PERF] ${operation}: ${formattedDuration}`,
        metadata ? this.sanitize(metadata) : undefined
      );
    }
  }

  /**
   * API日志 - 记录API调用
   */
  api(
    method: string,
    endpoint: string,
    status: number,
    durationMs?: number,
    error?: any
  ): void {
    const duration = durationMs ? ` (${durationMs}ms)` : '';
    const logMessage = `[API] ${method} ${endpoint} - ${status}${duration}`;

    if (status >= 500) {
      this.error(logMessage, error);
    } else if (status >= 400) {
      this.warn(logMessage, error);
    } else {
      this.debug(logMessage);
    }
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = this.config.enableTimestamp
      ? this.getTimestamp()
      : '';
    const levelStr = this.getLevelString(level);
    const platform = Platform.OS;

    // 格式化消息
    const formattedMessage = `${timestamp}[${levelStr}][${platform}] ${message}`;

    // 脱敏处理参数
    const sanitizedArgs = args.map(arg => this.sanitize(arg));

    // 根据级别选择输出方法
    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(formattedMessage, ...sanitizedArgs);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...sanitizedArgs);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, ...sanitizedArgs);
        break;
    }
  }

  /**
   * 获取时间戳
   */
  private getTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `[${hours}:${minutes}:${seconds}.${ms}]`;
  }

  /**
   * 获取日志级别字符串
   */
  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * 脱敏处理 - 移除敏感信息
   */
  private sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // 处理Error对象
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: __DEV__ ? data.stack : undefined,
      };
    }

    // 处理普通对象
    if (typeof data === 'object') {
      const sanitized: any = Array.isArray(data) ? [] : {};

      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          // 检查是否是敏感字段
          if (this.isSensitiveField(key)) {
            sanitized[key] = '***';
          } else if (typeof data[key] === 'object' && data[key] !== null) {
            // 递归处理嵌套对象
            sanitized[key] = this.sanitize(data[key]);
          } else {
            sanitized[key] = data[key];
          }
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * 检查是否是敏感字段
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.config.sensitiveFields.some(
      sensitive => lowerFieldName.includes(sensitive.toLowerCase())
    );
  }

  /**
   * 创建计时器 - 用于性能测量
   */
  createTimer(label: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.performance(label, duration);
    };
  }

  /**
   * 创建带上下文的logger - 用于特定模块
   */
  createContextLogger(context: string): ContextLogger {
    return new ContextLogger(this, context);
  }
}

/**
 * 带上下文的Logger - 用于特定模块
 */
class ContextLogger {
  constructor(private logger: Logger, private context: string) {}

  debug(message: string, ...args: any[]): void {
    this.logger.debug(`[${this.context}] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.logger.info(`[${this.context}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn(`[${this.context}] ${message}`, ...args);
  }

  error(message: string, error?: any, context?: any): void {
    this.logger.error(`[${this.context}] ${message}`, error, context);
  }

  performance(operation: string, durationMs: number, metadata?: any): void {
    this.logger.performance(`${this.context}.${operation}`, durationMs, metadata);
  }

  createTimer(label: string): () => void {
    return this.logger.createTimer(`${this.context}.${label}`);
  }
}

// 导出单例实例
export const logger = new Logger();

/**
 * 创建带上下文的 Logger
 * @param context - 上下文名称（如组件名、模块名）
 * @returns ContextLogger 实例
 * @example
 * const log = createLogger('MyScreen');
 * log.info('Screen loaded');
 */
export function createLogger(context: string): ContextLogger {
  return logger.createContextLogger(context);
}

// 导出类型
export type { LoggerConfig };
export { Logger, ContextLogger };

// 便捷导出
export default logger;
