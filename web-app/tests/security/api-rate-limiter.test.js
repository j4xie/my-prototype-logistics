/**
 * @file API限速器测试
 * @description 测试API请求限速、节流和防抖功能
 * @version 1.0.0
 * @created 2025-07-22
 */

const { RateLimiter, limitApiRequest, throttle, debounce, clearAllLimiters } = require('../../src/security/api-rate-limiter');

// 为所有测试设置更长的超时时间
jest.setTimeout(10000);

describe('RateLimiter类', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      timeWindowMs: 1000,
      tokensPerInterval: 1,
      intervalMs: 200
    });
  });

  test('初始状态应该有最大数量的令牌', () => {
    const result = limiter.checkAndConsume();
    expect(result.remaining).toBe(4); // 消耗一个后剩余4个
    expect(result.limit).toBe(5);
    expect(result.allowed).toBe(true);
  });

  test('连续请求应该逐渐减少可用令牌', () => {
    // 第一次请求
    let result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);

    // 第二次请求
    result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);

    // 第三次请求
    result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);

    // 第四次请求
    result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);

    // 第五次请求
    result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);

    // 第六次请求应该被拒绝
    result = limiter.checkAndConsume();
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('应该能够手动添加令牌', () => {
    // 消耗所有令牌
    for (let i = 0; i < 5; i++) {
      limiter.checkAndConsume();
    }

    // 手动添加令牌
    const remaining = limiter.addTokens(2);
    expect(remaining).toBe(2);

    // 应该可以再次请求
    const result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  test('令牌应该随时间自动添加', async () => {
    // 消耗所有令牌
    for (let i = 0; i < 5; i++) {
      limiter.checkAndConsume();
    }

    // 等待令牌自动添加
    await new Promise(resolve => setTimeout(resolve, 300));

    // 应该有一个新令牌
    const result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
  });

  test('时间窗口过后应该完全重置令牌', async () => {
    // 消耗所有令牌
    for (let i = 0; i < 5; i++) {
      limiter.checkAndConsume();
    }

    // 等待超过时间窗口
    await new Promise(resolve => setTimeout(resolve, 1100));

    // 应该完全重置令牌
    const result = limiter.checkAndConsume();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 消耗一个后剩余4个
  });

  test('停止周期性添加令牌后不应再自动添加令牌', async () => {
    // 消耗所有令牌
    for (let i = 0; i < 5; i++) {
      limiter.checkAndConsume();
    }

    // 停止周期性添加
    limiter.stopPeriodicRefill();

    // 等待足够长的时间
    await new Promise(resolve => setTimeout(resolve, 300));

    // 不应该有新令牌
    const result = limiter.checkAndConsume();
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('limitApiRequest函数', () => {
  beforeEach(() => {
    clearAllLimiters();
  });

  test('不同端点应有独立的限制', () => {
    // 端点1
    const options = { maxRequests: 3, timeWindowMs: 1000 };
    let result1 = limitApiRequest('endpoint1', 'user1', options);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    // 端点2
    let result2 = limitApiRequest('endpoint2', 'user1', options);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(2);

    // 消耗端点1的所有令牌
    limitApiRequest('endpoint1', 'user1', options);
    limitApiRequest('endpoint1', 'user1', options);
    result1 = limitApiRequest('endpoint1', 'user1', options);
    expect(result1.allowed).toBe(false);
    expect(result1.remaining).toBe(0);

    // 端点2应该不受影响
    result2 = limitApiRequest('endpoint2', 'user1', options);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
  });

  test('不同标识符应有独立的限制', () => {
    const options = { maxRequests: 2, timeWindowMs: 1000 };
    
    // 用户1
    let result1 = limitApiRequest('endpoint', 'user1', options);
    expect(result1.allowed).toBe(true);
    result1 = limitApiRequest('endpoint', 'user1', options);
    expect(result1.allowed).toBe(true);
    result1 = limitApiRequest('endpoint', 'user1', options);
    expect(result1.allowed).toBe(false);

    // 用户2应不受影响
    let result2 = limitApiRequest('endpoint', 'user2', options);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
  });

  test('限速器应在时间窗口后重置', async () => {
    const options = { maxRequests: 1, timeWindowMs: 500 };
    
    // 消耗令牌
    let result = limitApiRequest('endpoint', 'user', options);
    expect(result.allowed).toBe(true);
    result = limitApiRequest('endpoint', 'user', options);
    expect(result.allowed).toBe(false);

    // 等待时间窗口过后
    await new Promise(resolve => setTimeout(resolve, 600));

    // 应该重置
    result = limitApiRequest('endpoint', 'user', options);
    expect(result.allowed).toBe(true);
  });
});

describe('throttle函数', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('应该限制函数在指定时间内最多执行一次', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 1000);

    // 立即执行一次
    throttled();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 在等待时间内多次调用不应增加执行次数
    throttled();
    throttled();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 前进时间
    jest.advanceTimersByTime(1000);
    
    // 应该执行最后一次调用
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  test('leading选项为false时，应该延迟首次执行', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 1000, { leading: false });

    // 立即调用不应执行
    throttled();
    expect(mockFn).not.toHaveBeenCalled();

    // 前进时间
    jest.advanceTimersByTime(1000);
    
    // 应该执行
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('trailing选项为false时，应该不执行尾随调用', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 1000, { trailing: false });

    // 立即执行一次
    throttled();
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 在等待时间内多次调用
    throttled();
    throttled();

    // 前进时间
    jest.advanceTimersByTime(1000);
    
    // 不应该有额外执行
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('debounce函数', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('应该延迟函数执行，直到指定时间内没有更多调用', () => {
    const mockFn = jest.fn();
    const debounced = debounce(mockFn, 1000);

    // 调用多次
    debounced();
    expect(mockFn).not.toHaveBeenCalled();
    
    debounced();
    debounced();
    expect(mockFn).not.toHaveBeenCalled();

    // 前进时间小于等待时间，不应执行
    jest.advanceTimersByTime(500);
    expect(mockFn).not.toHaveBeenCalled();
    
    // 再次调用，重置计时器
    debounced();
    
    // 前进时间小于等待时间，不应执行
    jest.advanceTimersByTime(900);
    expect(mockFn).not.toHaveBeenCalled();
    
    // 前进剩余时间，应该执行一次
    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('leading选项为true时，应该立即执行第一次调用', () => {
    const mockFn = jest.fn();
    const debounced = debounce(mockFn, 1000, { leading: true });

    // 第一次调用应立即执行
    debounced();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // 短时间内再次调用不应执行
    debounced();
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // 前进时间
    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  test('maxWait选项应限制最大等待时间', () => {
    const mockFn = jest.fn();
    const debounced = debounce(mockFn, 1000, { maxWait: 2000 });

    // 初始调用
    debounced();
    expect(mockFn).not.toHaveBeenCalled();
    
    // 持续调用以保持防抖
    jest.advanceTimersByTime(900);
    debounced();
    
    jest.advanceTimersByTime(900);
    debounced();
    
    // 尽管不断调用，但超过maxWait应强制执行
    jest.advanceTimersByTime(200);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
}); 