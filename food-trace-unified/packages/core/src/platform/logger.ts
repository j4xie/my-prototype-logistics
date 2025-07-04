// 跨平台日志系统
import type { LoggerAdapter } from '../types/platform';
import { isDebug, getPlatformInfo } from './platform';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class ConsoleLoggerAdapter implements LoggerAdapter {
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = 'info') {
    this.logLevel = logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const platform = getPlatformInfo().platform;
    const prefix = `[${timestamp}] [${platform.toUpperCase()}] [${level.toUpperCase()}]`;
    
    if (args.length > 0) {
      return `${prefix} ${message} ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`;
    }
    
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug') && isDebug()) {
      console.debug(this.formatMessage('debug', message, args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, args));
    }
  }
}

class RemoteLoggerAdapter implements LoggerAdapter {
  private consoleLogger: ConsoleLoggerAdapter;
  private endpoint: string;
  private bufferSize: number = 100;
  private logBuffer: Array<{ level: LogLevel; message: string; timestamp: Date; args: any[] }> = [];

  constructor(endpoint: string, logLevel: LogLevel = 'info') {
    this.endpoint = endpoint;
    this.consoleLogger = new ConsoleLoggerAdapter(logLevel);
  }

  private async sendLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const logs = [...this.logBuffer];
      this.logBuffer = [];

      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs })
      });
    } catch (error) {
      // 如果发送失败，将日志重新加入缓冲区
      console.error('Failed to send logs to remote endpoint:', error);
    }
  }

  private addToBuffer(level: LogLevel, message: string, args: any[]): void {
    this.logBuffer.push({
      level,
      message,
      timestamp: new Date(),
      args
    });

    if (this.logBuffer.length >= this.bufferSize) {
      this.sendLogs();
    }
  }

  debug(message: string, ...args: any[]): void {
    this.consoleLogger.debug(message, ...args);
    this.addToBuffer('debug', message, args);
  }

  info(message: string, ...args: any[]): void {
    this.consoleLogger.info(message, ...args);
    this.addToBuffer('info', message, args);
  }

  warn(message: string, ...args: any[]): void {
    this.consoleLogger.warn(message, ...args);
    this.addToBuffer('warn', message, args);
  }

  error(message: string, ...args: any[]): void {
    this.consoleLogger.error(message, ...args);
    this.addToBuffer('error', message, args);
  }
}

// React Native专用日志适配器
class ReactNativeLoggerAdapter implements LoggerAdapter {
  private consoleLogger: ConsoleLoggerAdapter;

  constructor(logLevel: LogLevel = 'info') {
    this.consoleLogger = new ConsoleLoggerAdapter(logLevel);
  }

  debug(message: string, ...args: any[]): void {
    this.consoleLogger.debug(message, ...args);
    
    // 在React Native环境中，可以集成Flipper或其他调试工具
    try {
      if (typeof global !== 'undefined' && global.__flipperLogger) {
        global.__flipperLogger.debug(message, ...args);
      }
    } catch {
      // 忽略Flipper集成错误
    }
  }

  info(message: string, ...args: any[]): void {
    this.consoleLogger.info(message, ...args);
    
    try {
      if (typeof global !== 'undefined' && global.__flipperLogger) {
        global.__flipperLogger.info(message, ...args);
      }
    } catch {
      // 忽略Flipper集成错误
    }
  }

  warn(message: string, ...args: any[]): void {
    this.consoleLogger.warn(message, ...args);
    
    try {
      if (typeof global !== 'undefined' && global.__flipperLogger) {
        global.__flipperLogger.warn(message, ...args);
      }
    } catch {
      // 忽略Flipper集成错误
    }
  }

  error(message: string, ...args: any[]): void {
    this.consoleLogger.error(message, ...args);
    
    try {
      if (typeof global !== 'undefined' && global.__flipperLogger) {
        global.__flipperLogger.error(message, ...args);
      }
      
      // 在生产环境中，可以集成Crashlytics等错误收集服务
      if (typeof global !== 'undefined' && global.__crashlytics) {
        global.__crashlytics.recordError(new Error(message));
      }
    } catch {
      // 忽略第三方集成错误
    }
  }
}

export function createLogger(
  platform: 'web' | 'mobile' | 'auto' = 'auto',
  options: {
    logLevel?: LogLevel;
    remoteEndpoint?: string;
  } = {}
): LoggerAdapter {
  const { logLevel = 'info', remoteEndpoint } = options;
  const detectedPlatform = platform === 'auto' ? getPlatformInfo().platform : platform;

  if (remoteEndpoint) {
    return new RemoteLoggerAdapter(remoteEndpoint, logLevel);
  }

  if (detectedPlatform === 'mobile') {
    return new ReactNativeLoggerAdapter(logLevel);
  }

  return new ConsoleLoggerAdapter(logLevel);
}

// 默认日志实例
export const logger = createLogger('auto', {
  logLevel: isDebug() ? 'debug' : 'info'
});