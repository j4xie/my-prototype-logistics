/**
 * 统一API响应格式规范
 * 解决P0问题：响应包格式不统一
 *
 * 基于TASK-P3-018B架构修复 - 契约级别解决方案
 */

export interface AppResponse<T = any> {
  /** 状态码：0/200 成功，4xx/5xx 错误 */
  code: number;
  /** 响应消息 */
  message: string;
  /** 响应数据 */
  data: T;
  /** 成功状态标识 */
  success: boolean;
}

/** 分页响应格式 */
export interface AppPaginatedResponse<T = any> extends AppResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** 错误响应格式 */
export interface AppErrorResponse extends AppResponse<null> {
  error?: {
    type: string;
    details?: Record<string, any>;
    stack?: string; // 仅开发环境
  };
}

/** 响应包装器 - Mock & Real Backend统一使用 */
export const wrapResponse = <T>(data: T, message = '请求成功', code = 200): AppResponse<T> => ({
  code,
  message,
  data,
  success: code >= 200 && code < 300
});

/** 错误响应包装器 */
export const wrapError = (
  message: string,
  code = 500,
  error?: AppErrorResponse['error']
): AppErrorResponse => ({
  code,
  message,
  data: null,
  success: false,
  error
});

/** 分页响应包装器 */
export const wrapPaginatedResponse = <T>(
  data: T[],
  pagination: AppPaginatedResponse<T>['pagination'],
  message = '请求成功'
): AppPaginatedResponse<T> => ({
  code: 200,
  message,
  data,
  success: true,
  pagination
});
