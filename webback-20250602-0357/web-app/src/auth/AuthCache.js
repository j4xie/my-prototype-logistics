/**
 * AuthCache.js - 认证缓存
 * 用于管理用户认证状态和令牌缓存
 * @version 1.1.0
 */

/**
 * 认证缓存类
 * 负责存储和管理认证相关信息
 */
class AuthCache {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.options = {
      tokenKey: 'auth_token',
      userKey: 'auth_user',
      expiryKey: 'auth_expiry',
      refreshTokenKey: 'auth_refresh',
      ...options
    };
  }

  /**
   * 存储认证令牌
   * @param {string} token - 认证令牌
   * @param {Object} user - 用户数据
   * @param {number} expiry - 过期时间戳
   * @param {string} refreshToken - 刷新令牌
   */
  storeAuth(token, user, expiry, refreshToken) {
    // 存储令牌
    localStorage.setItem(this.options.tokenKey, token);
    
    // 存储用户数据
    if (user) {
      localStorage.setItem(this.options.userKey, JSON.stringify(user));
    }
    
    // 存储过期时间
    if (expiry) {
      localStorage.setItem(this.options.expiryKey, expiry.toString());
    }
    
    // 存储刷新令牌
    if (refreshToken) {
      localStorage.setItem(this.options.refreshTokenKey, refreshToken);
    }
  }

  /**
   * 获取认证令牌
   * @returns {string|null} 认证令牌
   */
  getToken() {
    return localStorage.getItem(this.options.tokenKey);
  }

  /**
   * 获取刷新令牌
   * @returns {string|null} 刷新令牌
   */
  getRefreshToken() {
    return localStorage.getItem(this.options.refreshTokenKey);
  }

  /**
   * 获取用户数据
   * @returns {Object|null} 用户数据
   */
  getUser() {
    const userData = localStorage.getItem(this.options.userKey);
    if (!userData) return null;
    
    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('解析用户数据失败:', error);
      return null;
    }
  }

  /**
   * 获取令牌过期时间
   * @returns {number|null} 过期时间戳
   */
  getExpiry() {
    const expiry = localStorage.getItem(this.options.expiryKey);
    return expiry ? parseInt(expiry, 10) : null;
  }

  /**
   * 检查令牌是否已过期
   * @returns {boolean} 是否已过期
   */
  isTokenExpired() {
    const expiry = this.getExpiry();
    if (!expiry) return true;
    
    // 提前5分钟判定过期，便于刷新
    const safetyMargin = 5 * 60 * 1000;
    return Date.now() > (expiry - safetyMargin);
  }

  /**
   * 清除所有认证数据
   */
  clear() {
    localStorage.removeItem(this.options.tokenKey);
    localStorage.removeItem(this.options.userKey);
    localStorage.removeItem(this.options.expiryKey);
    localStorage.removeItem(this.options.refreshTokenKey);
  }

  /**
   * 更新令牌
   * @param {string} token - 新令牌
   * @param {number} expiry - 新的过期时间
   * @param {string} refreshToken - 新的刷新令牌
   */
  updateToken(token, expiry, refreshToken) {
    if (token) {
      localStorage.setItem(this.options.tokenKey, token);
    }
    
    if (expiry) {
      localStorage.setItem(this.options.expiryKey, expiry.toString());
    }
    
    if (refreshToken) {
      localStorage.setItem(this.options.refreshTokenKey, refreshToken);
    }
  }
}

// 创建单例实例
const authCache = new AuthCache();

export default authCache; 