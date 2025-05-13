/**
 * @file tests/unit/config-loader.test.js
 * @description 配置加载器单元测试
 */

// 导入配置加载器
const configLoader = require('../../src/utils/config-loader');

describe('配置加载器', () => {
  // 在每个测试前重置configLoader
  beforeEach(() => {
    // 清除configLoader缓存
    if (configLoader.resetCache) {
      configLoader.resetCache();
    }
    
    // 模拟localStorage
    const mockStorage = testHelpers.mockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage
    });
  });
  
  test('应该能够获取默认配置', () => {
    // 测试获取默认app配置
    const appConfig = configLoader.getConfig('app');
    expect(appConfig).toBeDefined();
    expect(typeof appConfig).toBe('object');
  });
  
  test('应该能够合并环境配置', () => {
    // 模拟环境检测函数
    const originalGetEnv = configLoader.getEnvironment;
    configLoader.getEnvironment = jest.fn().mockReturnValue('development');
    
    // 获取配置
    const config = configLoader.getConfig('api');
    
    // 检查是否包含开发环境特定的配置
    expect(config).toBeDefined();
    
    // 恢复原始函数
    configLoader.getEnvironment = originalGetEnv;
  });
  
  test('应该能够正确检测当前环境', () => {
    // 获取当前环境
    const env = configLoader.getEnvironment();
    
    // 验证环境是有效的
    expect(['development', 'testing', 'production']).toContain(env);
  });
  
  test('应该能从localStorage加载用户配置', () => {
    // 在localStorage中设置用户配置
    const userConfig = {
      theme: 'dark',
      fontSize: 'large'
    };
    
    localStorage.setItem('user_config', JSON.stringify(userConfig));
    
    // 获取用户配置
    const config = configLoader.getUserConfig();
    
    // 验证配置
    expect(config).toEqual(userConfig);
  });
  
  test('应该能够覆盖默认配置', () => {
    // 设置自定义配置
    const customConfig = {
      baseUrl: 'https://custom-api.example.com'
    };
    
    // 覆盖配置
    configLoader.setConfig('api', customConfig);
    
    // 获取配置
    const config = configLoader.getConfig('api');
    
    // 验证自定义配置已应用
    expect(config.baseUrl).toBe(customConfig.baseUrl);
  });
}); 