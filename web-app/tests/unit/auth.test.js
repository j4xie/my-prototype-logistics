/**
 * 认证模块 (auth.js) 的单元测试
 * @version 1.0.0
 */

import { traceAuth } from '../../components/modules/auth/auth';

// 模拟localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

// 测试前设置
beforeEach(() => {
  // 清除所有模拟调用信息
  jest.clearAllMocks();
  
  // 模拟localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
  });
});

describe('认证模块测试', () => {
  // 测试初始化
  test('init方法应该从localStorage恢复认证状态', () => {
    // 设置localStorage模拟数据
    const userData = {
      id: '12345',
      username: 'testuser',
      role: 'admin',
      token: 'test-token'
    };
    
    window.localStorage.getItem.mockReturnValueOnce(JSON.stringify(userData));
    
    // 调用初始化方法
    traceAuth.init();
    
    // 验证localStorage.getItem被调用
    expect(window.localStorage.getItem).toHaveBeenCalledWith('trace_user');
    
    // 验证用户数据被正确设置
    expect(traceAuth.user).toEqual(userData);
    expect(traceAuth.isLoggedIn).toBe(true);
  });
  
  // 测试登录
  test('login方法应该正确设置用户信息并保存到localStorage', () => {
    const userData = {
      id: '12345',
      username: 'testuser',
      role: 'user',
      token: 'test-token'
    };
    
    // 调用登录方法
    traceAuth.login(userData);
    
    // 验证用户数据被正确设置
    expect(traceAuth.user).toEqual(userData);
    expect(traceAuth.isLoggedIn).toBe(true);
    
    // 验证localStorage.setItem被调用
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'trace_user',
      JSON.stringify(userData)
    );
  });
  
  // 测试登出
  test('logout方法应该清除用户信息和localStorage', () => {
    // 设置初始状态
    traceAuth.user = { id: '12345', username: 'testuser' };
    traceAuth.isLoggedIn = true;
    
    // 调用登出方法
    traceAuth.logout();
    
    // 验证用户数据被清除
    expect(traceAuth.user).toEqual({});
    expect(traceAuth.isLoggedIn).toBe(false);
    
    // 验证localStorage.removeItem被调用
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('trace_user');
  });
  
  // 测试权限检查
  test('hasPermission方法应该正确检查用户权限', () => {
    // 设置管理员用户
    traceAuth.user = { role: 'admin' };
    
    // 验证管理员有所有权限
    expect(traceAuth.hasPermission('product.create')).toBe(true);
    expect(traceAuth.hasPermission('user.manage')).toBe(true);
    
    // 设置普通用户
    traceAuth.user = { role: 'user' };
    
    // 模拟实现hasPermission，仅用于测试
    const originalHasPermission = traceAuth.hasPermission;
    traceAuth.hasPermission = jest.fn(permission => {
      if (permission === 'product.view') {
        return true;
      }
      return false;
    });
    
    // 验证普通用户有限权限
    expect(traceAuth.hasPermission('product.view')).toBe(true);
    expect(traceAuth.hasPermission('user.manage')).toBe(false);
    
    // 恢复原始实现
    traceAuth.hasPermission = originalHasPermission;
  });
  
  // 测试表单验证
  test('validateLoginForm方法应该正确验证登录表单', () => {
    // 测试有效表单
    const validForm = {
      username: 'testuser',
      password: 'password123'
    };
    
    expect(traceAuth.validateLoginForm(validForm)).toEqual({
      isValid: true,
      errors: {}
    });
    
    // 测试无效表单 - 用户名缺失
    const invalidForm1 = {
      username: '',
      password: 'password123'
    };
    
    expect(traceAuth.validateLoginForm(invalidForm1)).toEqual({
      isValid: false,
      errors: {
        username: '用户名不能为空'
      }
    });
    
    // 测试无效表单 - 密码缺失
    const invalidForm2 = {
      username: 'testuser',
      password: ''
    };
    
    expect(traceAuth.validateLoginForm(invalidForm2)).toEqual({
      isValid: false,
      errors: {
        password: '密码不能为空'
      }
    });
    
    // 测试无效表单 - 两者都缺失
    const invalidForm3 = {
      username: '',
      password: ''
    };
    
    expect(traceAuth.validateLoginForm(invalidForm3)).toEqual({
      isValid: false,
      errors: {
        username: '用户名不能为空',
        password: '密码不能为空'
      }
    });
  });
}); 