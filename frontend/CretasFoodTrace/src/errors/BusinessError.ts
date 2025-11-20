/**
 * 业务逻辑错误类
 * 用于处理后端返回的业务错误
 */
export class BusinessError extends Error {
  public readonly isBusinessError: boolean = true;
  public readonly code: number;
  public readonly data: any;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: number,
    data?: any
  ) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.data = data;
    this.timestamp = new Date().toISOString();

    // 维护正确的原型链
    Object.setPrototypeOf(this, BusinessError.prototype);
  }

  /**
   * 从后端响应创建BusinessError
   */
  static fromResponse(response: any): BusinessError {
    return new BusinessError(
      response.message || response.msg || 'Business logic error',
      response.code || response.status || 500,
      response.data
    );
  }

  /**
   * 判断错误是否为业务错误
   */
  static isBusinessError(error: any): error is BusinessError {
    return error?.isBusinessError === true;
  }
}
