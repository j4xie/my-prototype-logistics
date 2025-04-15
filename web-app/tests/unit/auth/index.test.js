/**
 * 认证模块索引文件 (index.js) 的单元测试
 * @version 1.0.0
 */

const authModule = require('../../../components/modules/auth');
const authDefault = authModule;
const traceAuth = authModule.traceAuth;
const traceLoader = authModule.traceLoader;

const authDirect = require('../../../components/modules/auth/auth').traceAuth;
const loaderDirect = require('../../../components/modules/auth/loader');

describe('认证模块索引测试', () => {
  // 测试默认导出
  test('应该正确导出默认模块', () => {
    // 默认导出应为authModule对象，而不是直接对应authDirect
    expect(authDefault).toHaveProperty('traceAuth');
    expect(typeof authDefault.traceAuth.init).toBe('function');
    expect(typeof authDefault.traceAuth.login).toBe('function');
    expect(typeof authDefault.traceAuth.logout).toBe('function');
  });
  
  // 测试命名导出 - traceAuth
  test('应该正确导出traceAuth模块', () => {
    expect(traceAuth).toBeDefined();
    expect(typeof traceAuth.init).toBe('function');
    expect(typeof traceAuth.login).toBe('function');
    expect(typeof traceAuth.logout).toBe('function');
    expect(typeof traceAuth.isAuthenticated).toBe('function');
    expect(typeof traceAuth.hasPermission).toBe('function');
    expect(typeof traceAuth.getUserRole).toBe('function');
    expect(typeof traceAuth.validateLoginForm).toBe('function');
  });
  
  // 测试命名导出 - traceLoader
  test('应该正确导出traceLoader模块', () => {
    expect(traceLoader).toBeDefined();
    expect(typeof traceLoader.init).toBe('function');
    expect(typeof traceLoader.preloadIcons).toBe('function');
    expect(typeof traceLoader.preloadImage).toBe('function');
    expect(typeof traceLoader.loadScript).toBe('function');
    expect(typeof traceLoader.loadStylesheet).toBe('function');
    expect(typeof traceLoader.loadResources).toBe('function');
  });
}); 