/**
 * API Mock工具
 * 用于在测试中模拟axios请求
 */

import MockAdapter from 'axios-mock-adapter';
import { AxiosInstance } from 'axios';
import { apiClient } from '../../services/api/apiClient';

/**
 * 创建Axios Mock实例
 * @param delayResponse 是否延迟响应（模拟网络延迟）
 * @returns MockAdapter实例
 */
export function createApiMock(delayResponse = false): MockAdapter {
  // Cast apiClient to AxiosInstance for MockAdapter compatibility
  const mock = new MockAdapter(apiClient as unknown as AxiosInstance, { delayResponse: delayResponse ? 100 : 0 });
  return mock;
}

/**
 * Mock成功响应
 * @param mock MockAdapter实例
 * @param method HTTP方法
 * @param url 请求URL (支持正则)
 * @param responseData 响应数据
 * @param status HTTP状态码
 */
export function mockSuccessResponse(
  mock: MockAdapter,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string | RegExp,
  responseData: any,
  status = 200
): void {
  const methodName = `on${method.charAt(0).toUpperCase()}${method.slice(1)}` as keyof MockAdapter;
  const handler = (mock[methodName] as (url: string | RegExp) => { reply: (status: number, data: any) => void }).bind(mock);
  handler(url).reply(status, responseData);
}

/**
 * Mock错误响应
 * @param mock MockAdapter实例
 * @param method HTTP方法
 * @param url 请求URL (支持正则)
 * @param errorMessage 错误消息
 * @param status HTTP状态码
 */
export function mockErrorResponse(
  mock: MockAdapter,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string | RegExp,
  errorMessage: string,
  status = 500
): void {
  const methodName = `on${method.charAt(0).toUpperCase()}${method.slice(1)}` as keyof MockAdapter;
  const handler = (mock[methodName] as (url: string | RegExp) => { reply: (status: number, data: any) => void }).bind(mock);
  handler(url).reply(status, {
    success: false,
    message: errorMessage,
    code: `HTTP_${status}`,
  });
}

/**
 * Mock网络错误
 * @param mock MockAdapter实例
 * @param method HTTP方法
 * @param url 请求URL (支持正则)
 */
export function mockNetworkError(
  mock: MockAdapter,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string | RegExp
): void {
  const methodName = `on${method.charAt(0).toUpperCase()}${method.slice(1)}` as keyof MockAdapter;
  const handler = (mock[methodName] as (url: string | RegExp) => { networkError: () => void }).bind(mock);
  handler(url).networkError();
}

/**
 * Mock超时错误
 * @param mock MockAdapter实例
 * @param method HTTP方法
 * @param url 请求URL (支持正则)
 */
export function mockTimeoutError(
  mock: MockAdapter,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string | RegExp
): void {
  const methodName = `on${method.charAt(0).toUpperCase()}${method.slice(1)}` as keyof MockAdapter;
  const handler = (mock[methodName] as (url: string | RegExp) => { timeout: () => void }).bind(mock);
  handler(url).timeout();
}

/**
 * 重置所有Mock
 * @param mock MockAdapter实例
 */
export function resetApiMock(mock: MockAdapter): void {
  mock.reset();
}

/**
 * 恢复Axios原始行为
 * @param mock MockAdapter实例
 */
export function restoreApiClient(mock: MockAdapter): void {
  mock.restore();
}

/**
 * 验证API调用
 * @param mock MockAdapter实例
 * @param method HTTP方法
 * @param url 期望的URL
 * @param data 期望的请求数据（可选）
 */
export function expectApiCall(
  mock: MockAdapter,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string | RegExp,
  data?: any
): void {
  const history = mock.history[method];
  const matchingCalls = history.filter((call) => {
    if (typeof url === 'string') {
      return call.url === url;
    } else {
      return url.test(call.url || '');
    }
  });

  expect(matchingCalls.length).toBeGreaterThan(0);

  if (data !== undefined) {
    const lastCall = matchingCalls[matchingCalls.length - 1];
    if (lastCall) {
      expect(JSON.parse(lastCall.data || '{}')).toEqual(data);
    }
  }
}

/**
 * 批量Mock API响应
 * @param mock MockAdapter实例
 * @param config Mock配置数组
 */
export function mockMultipleApis(
  mock: MockAdapter,
  config: Array<{
    method: 'get' | 'post' | 'put' | 'delete';
    url: string | RegExp;
    response?: any;
    error?: string;
    status?: number;
  }>
): void {
  config.forEach(({ method, url, response, error, status }) => {
    if (error) {
      mockErrorResponse(mock, method, url, error, status || 500);
    } else {
      mockSuccessResponse(mock, method, url, response, status || 200);
    }
  });
}
