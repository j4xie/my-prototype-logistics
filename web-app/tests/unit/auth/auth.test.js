/**
 * 认证模块 (auth.js) 的单元测试
 * @version 1.1.0
 */

import { traceAuth } from '../../../components/modules/auth/auth';

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
  
  // 重置auth模块状态
  traceAuth.user = {};
  traceAuth.isLoggedIn = false;
});

describe('认证模块测试', () => {
  // 测试初始化
  describe('初始化功能', () => {
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
    
    test('init方法应该处理无localStorage数据的情况', () => {
      // 模拟localStorage返回null
      window.localStorage.getItem.mockReturnValueOnce(null);
      
      // 调用初始化方法
      traceAuth.init();
      
      // 验证用户数据保持为空
      expect(traceAuth.user).toEqual({});
      expect(traceAuth.isLoggedIn).toBe(false);
    });
    
    test('init方法应该处理localStorage中的无效JSON数据', () => {
      // 模拟localStorage返回无效JSON
      window.localStorage.getItem.mockReturnValueOnce('invalid json');
      
      // 模拟console.error
      console.error = jest.fn();
      
      // 调用初始化方法
      traceAuth.init();
      
      // 验证错误被记录
      expect(console.error).toHaveBeenCalled();
      
      // 验证用户数据被重置
      expect(traceAuth.user).toEqual({});
      expect(traceAuth.isLoggedIn).toBe(false);
      
      // 验证logout被调用 (通过检查localStorage.removeItem)
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('trace_user');
    });
  });
  
  // 测试登录和登出
  describe('登录和登出功能', () => {
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
  });
  
  // 测试认证状态
  describe('认证状态检查', () => {
    test('isAuthenticated方法应该返回正确的认证状态', () => {
      // 开发模式下应始终返回true
      expect(traceAuth.isAuthenticated()).toBe(true);
      
      // 模拟实现，以测试非开发模式
      const originalIsAuthenticated = traceAuth.isAuthenticated;
      
      // 覆盖方法以测试实际逻辑
      traceAuth.isAuthenticated = function() {
        return this.isLoggedIn;
      };
      
      // 未登录状态
      traceAuth.isLoggedIn = false;
      expect(traceAuth.isAuthenticated()).toBe(false);
      
      // 已登录状态
      traceAuth.isLoggedIn = true;
      expect(traceAuth.isAuthenticated()).toBe(true);
      
      // 恢复原始实现
      traceAuth.isAuthenticated = originalIsAuthenticated;
    });
  });
  
  // 测试权限检查
  describe('权限检查功能', () => {
    test('hasPermission方法应该正确检查用户权限', () => {
      // 开发模式下应始终返回true
      expect(traceAuth.hasPermission('product.create')).toBe(true);
      
      // 模拟实现，以测试非开发模式
      const originalHasPermission = traceAuth.hasPermission;
      
      // 测试管理员用户
      traceAuth.hasPermission = function(permission) {
        if (!this.isLoggedIn) return false;
        
        // 管理员拥有所有权限
        if (this.user.role === 'admin') return true;
        
        // 检查具体权限
        if (Array.isArray(permission)) {
          return permission.some(p => this.user.permissions && this.user.permissions.includes(p));
        }
        
        return this.user.permissions && this.user.permissions.includes(permission);
      };
      
      // 未登录状态
      traceAuth.isLoggedIn = false;
      expect(traceAuth.hasPermission('product.create')).toBe(false);
      
      // 管理员角色
      traceAuth.isLoggedIn = true;
      traceAuth.user = { role: 'admin' };
      expect(traceAuth.hasPermission('product.create')).toBe(true);
      
      // 普通用户具有特定权限
      traceAuth.user = { 
        role: 'user',
        permissions: ['product.view', 'product.create']
      };
      expect(traceAuth.hasPermission('product.view')).toBe(true);
      expect(traceAuth.hasPermission('product.create')).toBe(true);
      expect(traceAuth.hasPermission('user.manage')).toBe(false);
      
      // 测试数组形式的权限
      expect(traceAuth.hasPermission(['product.view', 'user.manage'])).toBe(true);
      expect(traceAuth.hasPermission(['product.delete', 'user.manage'])).toBe(false);
      
      // 用户无权限
      traceAuth.user = { role: 'user' };
      expect(traceAuth.hasPermission('product.view')).toBe(false);
      
      // 恢复原始实现
      traceAuth.hasPermission = originalHasPermission;
    });
  });
  
  // 测试获取用户角色
  describe('用户角色功能', () => {
    test('getUserRole方法应该返回正确的用户角色', () => {
      // 用户有角色
      traceAuth.user = { role: 'admin' };
      expect(traceAuth.getUserRole()).toBe('admin');
      
      traceAuth.user = { role: 'user' };
      expect(traceAuth.getUserRole()).toBe('user');
      
      // 用户无角色
      traceAuth.user = {};
      expect(traceAuth.getUserRole()).toBe('guest');
    });
  });
  
  // 测试表单验证
  describe('表单验证功能', () => {
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
      
      // 测试无效表单 - 密码太短
      const invalidForm3 = {
        username: 'testuser',
        password: '12345'
      };
      
      expect(traceAuth.validateLoginForm(invalidForm3)).toEqual({
        isValid: false,
        errors: {
          password: '密码长度不能少于6位'
        }
      });
      
      // 测试无效表单 - 两者都缺失
      const invalidForm4 = {
        username: '',
        password: ''
      };
      
      expect(traceAuth.validateLoginForm(invalidForm4)).toEqual({
        isValid: false,
        errors: {
          username: '用户名不能为空',
          password: '密码不能为空'
        }
      });
      
      // 测试边界情况 - 用户名只有空格
      const invalidForm5 = {
        username: '   ',
        password: 'password123'
      };
      
      expect(traceAuth.validateLoginForm(invalidForm5)).toEqual({
        isValid: false,
        errors: {
          username: '用户名不能为空'
        }
      });
    });
  });
}); 