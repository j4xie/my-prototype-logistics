/**
 * 安全错误类
 * 当安全相关操作失败时抛出此错误
 */
export class SecurityError extends Error {
  public readonly code: string;
  public readonly severity: 'critical' | 'high' | 'medium';

  constructor(
    message: string,
    code: string = 'SECURITY_ERROR',
    severity: 'critical' | 'high' | 'medium' = 'critical'
  ) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.severity = severity;

    // 维护正确的原型链
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

/**
 * 安全存储不可用错误
 */
export class SecureStorageUnavailableError extends SecurityError {
  constructor(message?: string) {
    super(
      message || '您的设备不支持安全存储。登录凭证无法安全保存，建议使用支持安全存储的设备。',
      'SECURE_STORAGE_UNAVAILABLE',
      'critical'
    );
    this.name = 'SecureStorageUnavailableError';
  }
}

/**
 * 令牌存储失败错误
 */
export class TokenStorageError extends SecurityError {
  constructor(message?: string, originalError?: Error) {
    super(
      message || '令牌存储失败，请重新登录。',
      'TOKEN_STORAGE_FAILED',
      'high'
    );
    this.name = 'TokenStorageError';
    if (originalError) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}
