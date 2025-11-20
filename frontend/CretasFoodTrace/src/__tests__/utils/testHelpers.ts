/**
 * 通用测试辅助函数
 */

/**
 * 等待指定时间
 * @param ms 毫秒数
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建Mock函数并跟踪调用
 */
export function createMockFn<T extends (...args: any[]) => any>(): jest.MockedFunction<T> {
  return jest.fn() as jest.MockedFunction<T>;
}

/**
 * 重置所有Mock
 */
export function resetAllMocks(): void {
  jest.clearAllMocks();
  jest.resetAllMocks();
}

/**
 * 生成随机字符串
 * @param length 字符串长度
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * 生成随机整数
 * @param min 最小值
 * @param max 最大值
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成Mock日期字符串
 * @param daysOffset 相对于今天的天数偏移
 */
export function mockDate(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

/**
 * 生成Mock工厂ID
 */
export function mockFactoryId(): string {
  return `CRETAS_2024_${randomString(3).toUpperCase()}`;
}

/**
 * 生成Mock批次号
 */
export function mockBatchNumber(): string {
  return `BATCH_${new Date().getFullYear()}_${randomString(6).toUpperCase()}`;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 验证对象包含指定属性
 */
export function expectObjectToContain(obj: any, props: Record<string, any>): void {
  Object.keys(props).forEach((key) => {
    expect(obj).toHaveProperty(key, props[key]);
  });
}

/**
 * 验证数组包含符合条件的元素
 */
export function expectArrayToContain<T>(
  arr: T[],
  predicate: (item: T) => boolean
): void {
  expect(arr.some(predicate)).toBe(true);
}

/**
 * Mock延迟Promise
 * @param value 返回值
 * @param delay 延迟时间（毫秒）
 */
export function delayedPromise<T>(value: T, delay = 100): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delay);
  });
}

/**
 * Mock拒绝的Promise
 * @param error 错误信息
 * @param delay 延迟时间（毫秒）
 */
export function rejectedPromise(error: string, delay = 100): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(error)), delay);
  });
}

/**
 * 创建Mock GPS坐标
 */
export function mockGPSLocation() {
  return {
    latitude: 31.2304 + Math.random() * 0.01,
    longitude: 121.4737 + Math.random() * 0.01,
  };
}

/**
 * 创建Mock文件URI
 */
export function mockFileUri(filename = 'test.jpg'): string {
  return `file:///mock/path/${filename}`;
}

/**
 * 验证API错误响应格式
 */
export function expectApiError(error: any, expectedMessage?: string): void {
  expect(error).toBeDefined();
  if (expectedMessage) {
    expect(error.message || error).toContain(expectedMessage);
  }
}

/**
 * 验证分页响应格式
 */
export function expectPaginationResponse(response: any): void {
  expect(response).toHaveProperty('data');
  expect(response.data).toHaveProperty('items');
  expect(response.data).toHaveProperty('pagination');
  expect(response.data.pagination).toHaveProperty('page');
  expect(response.data.pagination).toHaveProperty('size');
  expect(response.data.pagination).toHaveProperty('total');
  expect(response.data.pagination).toHaveProperty('totalPages');
}

/**
 * 创建Mock分页参数
 */
export function mockPaginationParams(page = 1, size = 10) {
  return { page, size };
}

/**
 * 验证ISO日期字符串格式
 */
export function expectValidISODate(dateString: string): void {
  expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(new Date(dateString).toString()).not.toBe('Invalid Date');
}

/**
 * 创建Mock用户
 */
export function mockUser(overrides?: Record<string, any>) {
  return {
    id: randomInt(1, 1000),
    username: `user_${randomString(6)}`,
    realName: '测试用户',
    factoryId: mockFactoryId(),
    role: 'factory_user',
    ...overrides,
  };
}

/**
 * 验证响应成功
 */
export function expectSuccessResponse(response: any, expectedData?: any): void {
  expect(response).toHaveProperty('success', true);
  expect(response).toHaveProperty('data');
  if (expectedData) {
    expect(response.data).toMatchObject(expectedData);
  }
}
