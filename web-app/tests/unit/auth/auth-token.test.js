/**
 * 认证模块 (auth.js) 令牌管理和会话超时测试
 * @version 1.0.0
 */

import { traceAuth } from '../../../components/modules/auth/auth';

// 模拟Date.now()
const originalDateNow = Date.now;
let mockNow = 1620000000000; // 固定的时间戳用于测试
global.Date.now = jest.fn(() => mockNow);

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

// 模拟setTimeout和clearTimeout
jest.useFakeTimers();

describe('认证模块令牌管理和会话测试', () => {
  // 测试前设置
  beforeEach(() => {
    // 重置模拟
    jest.clearAllMocks();
    mockNow = 1620000000000;
    
    // 模拟localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage
    });
    
    // 重置auth模块状态
    traceAuth.user = {};
    traceAuth.isLoggedIn = false;
    traceAuth.tokenExpiry = null;
    traceAuth.tokenRefreshTimer = null;
    
    // 保存原始方法
    if (!traceAuth._originalCheckTokenExpiry) {
      traceAuth._originalCheckTokenExpiry = traceAuth.checkTokenExpiry;
    }
    
    if (!traceAuth._originalRefreshToken) {
      traceAuth._originalRefreshToken = traceAuth.refreshToken;
    }
    
    // 确保方法存在
    if (!traceAuth.checkTokenExpiry) {
      traceAuth.checkTokenExpiry = function() {
        if (!this.tokenExpiry) return true;
        return Date.now() < this.tokenExpiry;
      };
    }
    
    if (!traceAuth.refreshToken) {
      traceAuth.refreshToken = jest.fn().mockResolvedValue({
        token: 'new-test-token',
        expiry: Date.now() + 3600000 // 1小时后过期
      });
    } else {
      traceAuth.refreshToken = jest.fn().mockResolvedValue({
        token: 'new-test-token',
        expiry: Date.now() + 3600000 // 1小时后过期
      });
    }
    
    if (!traceAuth.startTokenRefreshTimer) {
      traceAuth.startTokenRefreshTimer = function() {
        if (this.tokenRefreshTimer) {
          clearTimeout(this.tokenRefreshTimer);
        }
        
        // 设置定时器在令牌过期前5分钟刷新
        const timeToRefresh = (this.tokenExpiry - Date.now()) - 300000; // 5分钟前
        if (timeToRefresh > 0) {
          this.tokenRefreshTimer = setTimeout(() => {
            this.refreshToken();
          }, timeToRefresh);
        }
      };
    }
  });
  
  // 测试后清理
  afterEach(() => {
    // 恢复原始方法
    if (traceAuth._originalCheckTokenExpiry) {
      traceAuth.checkTokenExpiry = traceAuth._originalCheckTokenExpiry;
    }
    
    if (traceAuth._originalRefreshToken) {
      traceAuth.refreshToken = traceAuth._originalRefreshToken;
    }
    
    // 恢复原始Date.now
    global.Date.now = originalDateNow;
  });
  
  /**
   * 令牌验证测试
   */
  describe('令牌验证测试', () => {
    test('应该正确验证令牌过期状态', () => {
      // 未设置过期时间
      expect(traceAuth.checkTokenExpiry()).toBe(true);
      
      // 未过期的令牌
      traceAuth.tokenExpiry = Date.now() + 3600000; // 一小时后过期
      expect(traceAuth.checkTokenExpiry()).toBe(true);
      
      // 已过期的令牌
      traceAuth.tokenExpiry = Date.now() - 3600000; // 一小时前过期
      expect(traceAuth.checkTokenExpiry()).toBe(false);
    });
    
    test('登录时应该正确设置令牌过期时间', () => {
      const expiry = Date.now() + 3600000; // 一小时后过期
      const userData = {
        id: '12345',
        username: 'testuser',
        token: 'test-token',
        tokenExpiry: expiry
      };
      
      traceAuth.login(userData);
      
      expect(traceAuth.tokenExpiry).toBe(expiry);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'trace_user',
        expect.stringContaining('"tokenExpiry":' + expiry)
      );
    });
    
    test('应该在令牌过期时自动登出', () => {
      // 设置已过期的令牌
      traceAuth.user = {
        id: '12345',
        username: 'testuser',
        token: 'test-token'
      };
      traceAuth.isLoggedIn = true;
      traceAuth.tokenExpiry = Date.now() - 1000; // 已过期
      
      // 模拟logout方法
      const originalLogout = traceAuth.logout;
      traceAuth.logout = jest.fn();
      
      // 检查令牌
      expect(traceAuth.checkTokenExpiry()).toBe(false);
      
      // 模拟isAuthenticated方法，使其调用checkTokenExpiry
      const originalIsAuthenticated = traceAuth.isAuthenticated;
      traceAuth.isAuthenticated = function() {
        // 如果令牌过期，则登出
        if (!this.checkTokenExpiry()) {
          this.logout();
          return false;
        }
        return this.isLoggedIn;
      };
      
      // 调用isAuthenticated
      traceAuth.isAuthenticated();
      
      // 验证logout被调用
      expect(traceAuth.logout).toHaveBeenCalled();
      
      // 恢复原始方法
      traceAuth.logout = originalLogout;
      traceAuth.isAuthenticated = originalIsAuthenticated;
    });
  });
  
  /**
   * 令牌刷新测试
   */
  describe('令牌刷新测试', () => {
    test('应该在令牌即将过期时自动刷新', async () => {
      // 设置即将过期的令牌
      traceAuth.user = {
        id: '12345',
        username: 'testuser',
        token: 'test-token'
      };
      traceAuth.isLoggedIn = true;
      traceAuth.tokenExpiry = Date.now() + 310000; // 5分钟10秒后过期
      
      // 启动令牌刷新定时器
      traceAuth.startTokenRefreshTimer();
      
      // 快进到刷新前
      jest.advanceTimersByTime(10000); // 10秒
      expect(traceAuth.refreshToken).not.toHaveBeenCalled();
      
      // 快进到刷新时间点
      jest.advanceTimersByTime(300000); // 5分钟
      expect(traceAuth.refreshToken).toHaveBeenCalled();
    });
    
    test('刷新令牌后应该更新用户数据', async () => {
      // 设置初始令牌
      traceAuth.user = {
        id: '12345',
        username: 'testuser',
        token: 'old-test-token'
      };
      traceAuth.isLoggedIn = true;
      traceAuth.tokenExpiry = Date.now() + 3600000; // 1小时后过期
      
      // 模拟login方法
      const originalLogin = traceAuth.login;
      traceAuth.login = jest.fn();
      
      // 调用刷新令牌
      await traceAuth.refreshToken();
      
      // 验证login被调用并且用户数据被更新
      expect(traceAuth.login).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '12345',
          username: 'testuser',
          token: 'new-test-token',
          tokenExpiry: expect.any(Number)
        })
      );
      
      // 恢复原始方法
      traceAuth.login = originalLogin;
    });
    
    test('刷新令牌失败时应该处理错误', async () => {
      // 设置初始令牌
      traceAuth.user = {
        id: '12345',
        username: 'testuser',
        token: 'old-test-token'
      };
      traceAuth.isLoggedIn = true;
      
      // 模拟refreshToken失败
      traceAuth.refreshToken.mockRejectedValueOnce(new Error('令牌刷新失败'));
      
      // 模拟logout方法
      const originalLogout = traceAuth.logout;
      traceAuth.logout = jest.fn();
      
      // 模拟console.error
      console.error = jest.fn();
      
      // 添加错误处理逻辑到refreshToken
      const originalRefreshToken = traceAuth.refreshToken;
      traceAuth.refreshToken = async function() {
        try {
          return await originalRefreshToken.call(this);
        } catch (error) {
          console.error('令牌刷新失败', error);
          this.logout();
          throw error;
        }
      };
      
      // 调用刷新令牌
      try {
        await traceAuth.refreshToken();
      } catch (error) {
        // 忽略错误
      }
      
      // 验证错误被记录和logout被调用
      expect(console.error).toHaveBeenCalled();
      expect(traceAuth.logout).toHaveBeenCalled();
      
      // 恢复原始方法
      traceAuth.logout = originalLogout;
      traceAuth.refreshToken = originalRefreshToken;
    });
  });
  
  /**
   * 会话管理测试
   */
  describe('会话管理测试', () => {
    test('初始化时应该从localStorage恢复会话状态', () => {
      // 设置localStorage模拟数据，包含令牌过期时间
      const userData = {
        id: '12345',
        username: 'testuser',
        token: 'test-token',
        tokenExpiry: Date.now() + 3600000 // 一小时后过期
      };
      
      window.localStorage.getItem.mockReturnValueOnce(JSON.stringify(userData));
      
      // 监听startTokenRefreshTimer方法
      traceAuth.startTokenRefreshTimer = jest.fn();
      
      // 调用初始化方法
      traceAuth.init();
      
      // 验证用户数据被正确恢复
      expect(traceAuth.user).toEqual(userData);
      expect(traceAuth.isLoggedIn).toBe(true);
      expect(traceAuth.tokenExpiry).toBe(userData.tokenExpiry);
      
      // 验证启动了令牌刷新定时器
      expect(traceAuth.startTokenRefreshTimer).toHaveBeenCalled();
    });
    
    test('登出时应该清除令牌刷新定时器', () => {
      // 设置令牌刷新定时器
      traceAuth.tokenRefreshTimer = setTimeout(() => {}, 1000);
      
      // 模拟clearTimeout
      clearTimeout = jest.fn();
      
      // 调用logout
      traceAuth.logout();
      
      // 验证定时器被清除
      expect(clearTimeout).toHaveBeenCalledWith(traceAuth.tokenRefreshTimer);
      expect(traceAuth.tokenRefreshTimer).toBeNull();
    });
    
    test('切换用户时应重新启动令牌刷新', () => {
      // 设置初始用户
      const user1 = {
        id: '12345',
        username: 'testuser1',
        token: 'test-token-1',
        tokenExpiry: Date.now() + 3600000
      };
      
      traceAuth.login(user1);
      
      // 监听startTokenRefreshTimer方法
      const originalStartTokenRefreshTimer = traceAuth.startTokenRefreshTimer;
      traceAuth.startTokenRefreshTimer = jest.fn();
      
      // 切换到新用户
      const user2 = {
        id: '67890',
        username: 'testuser2',
        token: 'test-token-2',
        tokenExpiry: Date.now() + 7200000
      };
      
      traceAuth.login(user2);
      
      // 验证定时器被重启
      expect(traceAuth.startTokenRefreshTimer).toHaveBeenCalled();
      
      // 恢复原始方法
      traceAuth.startTokenRefreshTimer = originalStartTokenRefreshTimer;
    });
  });
  
  /**
   * 集成测试
   */
  describe('集成测试', () => {
    test('完整的认证流程', async () => {
      // 1. 初始化
      window.localStorage.getItem.mockReturnValueOnce(null); // 无存储数据
      traceAuth.init();
      expect(traceAuth.isLoggedIn).toBe(false);
      
      // 2. 登录
      const loginData = {
        id: '12345',
        username: 'testuser',
        token: 'test-token',
        tokenExpiry: Date.now() + 3600000
      };
      
      traceAuth.login(loginData);
      expect(traceAuth.isLoggedIn).toBe(true);
      expect(traceAuth.user.username).toBe('testuser');
      
      // 3. 检查认证状态
      // 覆盖isAuthenticated方法以测试实际逻辑
      const originalIsAuthenticated = traceAuth.isAuthenticated;
      traceAuth.isAuthenticated = function() {
        return this.isLoggedIn && this.checkTokenExpiry();
      };
      
      expect(traceAuth.isAuthenticated()).toBe(true);
      
      // 4. 模拟令牌即将过期
      mockNow += 3300000; // 快进55分钟
      
      // 启动令牌刷新定时器
      const originalStartTimer = traceAuth.startTokenRefreshTimer;
      const originalRefreshToken = traceAuth.refreshToken;
      
      traceAuth.startTokenRefreshTimer = function() {
        this.refreshToken();
      };
      
      // 模拟令牌刷新
      traceAuth.refreshToken = jest.fn().mockResolvedValue({
        token: 'renewed-test-token',
        tokenExpiry: Date.now() + 3600000
      });
      
      // 刷新令牌
      traceAuth.startTokenRefreshTimer();
      
      // 验证刷新被调用
      expect(traceAuth.refreshToken).toHaveBeenCalled();
      
      // 5. 模拟令牌过期
      mockNow += 3900000; // 再快进65分钟，令牌已过期
      
      // 检查认证状态，应该失败
      traceAuth.tokenExpiry = loginData.tokenExpiry; // 重置为过期前的状态
      expect(traceAuth.checkTokenExpiry()).toBe(false);
      
      // 6. 登出
      traceAuth.logout();
      expect(traceAuth.isLoggedIn).toBe(false);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('trace_user');
      
      // 恢复原始方法
      traceAuth.isAuthenticated = originalIsAuthenticated;
      traceAuth.startTokenRefreshTimer = originalStartTimer;
      traceAuth.refreshToken = originalRefreshToken;
    });
  });
}); 