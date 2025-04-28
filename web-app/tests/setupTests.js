/**
 * @file 测试设置文件
 * @description 为所有测试用例提供全局配置和模拟
 */

// 导入浏览器环境模拟
const { setupMocks } = require('./mocks/browser-env-mock');

// 设置浏览器环境模拟
setupMocks();

// 扩展 Jest 断言
expect.extend({
  toBeStorageItem(received, key, expectedValue) {
    const pass = received[key] === expectedValue;
    return {
      pass,
      message: () => `Expected ${key} to ${pass ? 'not ' : ''}be ${expectedValue}`
    };
  }
});

// 测试运行前执行的全局操作
beforeAll(() => {
  // 输出测试环境信息
  console.log('测试环境初始化完成');
});

// 每个测试用例前都会执行的操作
beforeEach(() => {
  // 重置所有模拟函数的调用信息
  jest.clearAllMocks();
  
  // 清除本地存储
  if (global.localStorage) {
    global.localStorage.clear();
  }
});

// 测试结束后执行的全局操作
afterAll(() => {
  console.log('测试环境清理完成');
}); 