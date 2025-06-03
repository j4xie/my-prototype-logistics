/**
 * @file tests/setup.js
 * @description 测试环境通用设置
 */

// 引入测试环境模拟工具
require('./utils/test-environment-mocks.js');

// 设置测试环境
const environment = process.env.NODE_ENV || 'test';

// 导入和配置测试工具
require('jest-environment-jsdom');

// 全局模拟对象
global.testHelpers = {
  // 模拟fetch请求
  mockFetch: (response) => {
    global.fetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response)),
        ok: true,
        status: 200,
        headers: new Map()
      })
    );
    return global.fetch;
  },
  
  // 模拟LocalStorage
  mockLocalStorage: () => {
    const storage = {};
    return {
      getItem: jest.fn(key => storage[key] || null),
      setItem: jest.fn((key, value) => { storage[key] = value.toString(); }),
      removeItem: jest.fn(key => { delete storage[key]; }),
      clear: jest.fn(() => { Object.keys(storage).forEach(key => { delete storage[key]; }); })
    };
  },
  
  // 模拟控制台日志
  mockConsole: () => {
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };
  },
  
  // 通用断言助手
  assert: {
    isTrue: (value) => expect(value).toBe(true),
    isFalse: (value) => expect(value).toBe(false),
    isEqual: (actual, expected) => expect(actual).toEqual(expected),
    isNotEqual: (actual, expected) => expect(actual).not.toEqual(expected),
    contains: (array, item) => expect(array).toContain(item),
    throws: (fn) => expect(fn).toThrow()
  }
};

// 模拟浏览器环境变量
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 扩展Jest匹配器
expect.extend({
  // 自定义匹配器：数组排序无关比较
  toEqualUnordered(received, expected) {
    const pass = this.equals(
      received.sort(), 
      expected.sort()
    );
    
    return {
      pass,
      message: () => `Expected ${received} to equal ${expected} (order irrelevant)`
    };
  }
});

// 在测试前执行
beforeAll(() => {
  console.log(`测试环境初始化完成: ${environment}`);
});

// 测试完成后执行
afterAll(() => {
  console.log('测试完成');
}); 