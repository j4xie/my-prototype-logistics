/**
 * auth-handler.js - 认证处理器
 * 处理用户登录、登出和令牌过期等认证相关操作
 * @version 1.0.0
 */

import EventEmitter from '../utils/event-emitter';
import AuthCache from './AuthCache';
// 引入ResourceLoader单例，用于在登出时清理资源
import resourceLoader from '../network/resource-loader-instance';

/**
 * 认证处理器类
 * 提供认证相关的方法和事件处理
 */
class AuthHandler {
  /**
   * 创建认证处理器实例
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.options = {
      loginEndpoint: '/api/auth/login',
      logoutEndpoint: '/api/auth/logout',
      refreshEndpoint: '/api/auth/refresh',
      tokenExpiryCheckInterval: 60000, // 每分钟检查一次
      ...options
    };
    
    // 启动令牌过期检查
    this._startTokenExpiryCheck();
  }
  
  /**
   * 启动令牌过期检查
   * @private
   */
  _startTokenExpiryCheck() {
    this._tokenCheckInterval = setInterval(() => {
      if (AuthCache.isTokenExpired()) {
        this._handleTokenExpiry();
      }
    }, this.options.tokenExpiryCheckInterval);
  }
  
  /**
   * 处理令牌过期
   * @private
   */
  _handleTokenExpiry() {
    const refreshToken = AuthCache.getRefreshToken();
    
    if (refreshToken) {
      // 尝试刷新令牌
      this.refreshToken(refreshToken)
        .catch(error => {
          console.error('刷新令牌失败:', error);
          // 刷新失败，执行登出
          this.logout();
        });
    } else {
      // 没有刷新令牌，执行登出
      this.logout();
    }
    
    // 即使在令牌刷新过程中也清理AuthCache，防止内存泄漏 (INT-006)
    AuthCache.clear();
  }
  
  /**
   * 刷新认证令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<boolean>} 刷新结果
   */
  async refreshToken(refreshToken) {
    try {
      const response = await fetch(this.options.refreshEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });
      
      if (!response.ok) {
        throw new Error(`刷新令牌失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 更新令牌
      AuthCache.updateToken(
        data.token,
        data.expiresAt || Date.now() + 30 * 60 * 1000, // 默认30分钟
        data.refreshToken
      );
      
      // 触发令牌刷新事件
      EventEmitter.emit('auth:token-refreshed', { token: data.token });
      
      return true;
    } catch (error) {
      console.error('刷新令牌失败:', error);
      throw error;
    }
  }
  
  /**
   * 用户登录
   * @param {Object} credentials - 登录凭证
   * @returns {Promise<Object>} 登录结果
   */
  async login(credentials) {
    try {
      const response = await fetch(this.options.loginEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error(`登录失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 存储认证信息
      AuthCache.storeAuth(
        data.token,
        data.user,
        data.expiresAt || Date.now() + 30 * 60 * 1000, // 默认30分钟
        data.refreshToken
      );
      
      // 触发登录成功事件
      EventEmitter.emit('auth:login', { user: data.user });
      
      return data;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }
  
  /**
   * 用户登出
   * @returns {Promise<boolean>} 登出结果
   */
  async logout() {
    try {
      const token = AuthCache.getToken();
      
      if (token) {
        try {
          // 尝试调用登出API
          await fetch(this.options.logoutEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.warn('登出API调用失败:', error);
          // 即使API调用失败，仍然继续本地登出流程
        }
      }
      
      // 清除认证缓存
      AuthCache.clear();
      
      // 清理资源加载器，防止内存泄漏 (INT-006)
      if (resourceLoader) {
        try {
          // 清除缓存
          await resourceLoader.clearCache();
          console.info('ResourceLoader cache cleared during logout');
        } catch (error) {
          console.warn('Failed to clear ResourceLoader cache:', error);
        }
      }
      
      // 触发登出事件
      EventEmitter.emit('auth:logout', {});
      
      // 触发权限失效事件，使权限服务重新加载
      EventEmitter.emit('permission:invalidated', {});
      
      return true;
    } catch (error) {
      console.error('登出处理失败:', error);
      throw error;
    }
  }
  
  /**
   * 检查用户是否已认证
   * @returns {boolean} 认证状态
   */
  isAuthenticated() {
    return !!AuthCache.getToken() && !AuthCache.isTokenExpired();
  }
  
  /**
   * 销毁处理器
   */
  destroy() {
    clearInterval(this._tokenCheckInterval);
  }
}

// 导出单例实例
const authHandler = new AuthHandler();
export default authHandler; 