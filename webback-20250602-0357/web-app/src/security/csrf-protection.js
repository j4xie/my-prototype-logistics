/**
 * @file CSRF保护
 * @description 提供CSRF令牌生成和验证功能，防止跨站请求伪造攻击
 * @version 1.0.0
 * @created 2025-07-22
 */

// 使用加密安全的随机数生成器
const generateRandomString = (length = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charset = characters.split('');
  let result = '';
  
  // 在浏览器环境中，使用window.crypto生成安全随机数
  // 在Node.js环境中，应使用crypto模块
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
  } else {
    // 简单的后备方法，在实际生产环境中不应使用
    for (let i = 0; i < length; i++) {
      result += charset[Math.floor(Math.random() * charset.length)];
    }
  }
  
  return result;
};

// 存储当前会话的CSRF令牌
let currentToken = null;
let tokenExpiry = null;
const tokenLifetime = 2 * 60 * 60 * 1000; // 2小时，单位：毫秒

/**
 * 生成CSRF令牌，存储在Cookie中
 * @param {Object} options 配置选项
 * @param {string} options.cookieName CSRF令牌Cookie名称
 * @param {boolean} options.secure 是否仅通过HTTPS发送Cookie
 * @param {boolean} options.httpOnly 是否阻止JavaScript访问Cookie
 * @param {string} options.sameSite Cookie的SameSite属性 ('strict', 'lax', 'none')
 * @returns {string} 生成的CSRF令牌
 */
function generateCSRFToken(options = {}) {
  const {
    cookieName = 'csrf_token',
    secure = true,
    httpOnly = true,
    sameSite = 'strict'
  } = options;
  
  // 检查现有令牌是否仍然有效
  const now = Date.now();
  if (currentToken && tokenExpiry && tokenExpiry > now) {
    return currentToken;
  }
  
  // 生成新令牌
  currentToken = generateRandomString(32);
  tokenExpiry = now + tokenLifetime;
  
  // 设置令牌过期时间
  const expires = new Date(tokenExpiry);
  
  // 存储令牌到Cookie
  if (typeof document !== 'undefined') {
    let cookieString = `${cookieName}=${currentToken}; expires=${expires.toUTCString()}; path=/`;
    
    if (secure) {
      cookieString += '; Secure';
    }
    
    if (httpOnly) {
      cookieString += '; HttpOnly';
    }
    
    cookieString += `; SameSite=${sameSite}`;
    
    document.cookie = cookieString;
  }
  
  // 如果支持sessionStorage，也存储令牌供JavaScript使用
  // 因为httpOnly cookie无法被JavaScript访问
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(cookieName, currentToken);
    } catch (error) {
      console.error('无法将CSRF令牌存储到sessionStorage', error);
    }
  }
  
  return currentToken;
}

/**
 * 验证CSRF令牌是否有效
 * @param {string} token 要验证的CSRF令牌
 * @param {Object} options 配置选项
 * @param {string} options.cookieName CSRF令牌Cookie名称
 * @param {boolean} options.headerCheck 是否检查HTTP请求头中的令牌
 * @param {string} options.headerName 请求头名称，用于检查CSRF令牌
 * @returns {boolean} 令牌是否有效
 */
function validateCSRFToken(token, options = {}) {
  const {
    cookieName = 'csrf_token',
    headerCheck = false,
    headerName = 'X-CSRF-Token'
  } = options;
  
  if (!token) {
    return false;
  }
  
  // 检查令牌是否过期
  if (!currentToken || !tokenExpiry || tokenExpiry < Date.now()) {
    return false;
  }
  
  // 与当前令牌比较
  if (token !== currentToken) {
    return false;
  }
  
  // 如果需要，检查请求头中的令牌
  if (headerCheck && typeof window !== 'undefined') {
    // 这需要在实际HTTP请求处理中实现
    // 这里仅作示例
    const headerToken = getRequestHeader(headerName);
    if (!headerToken || headerToken !== currentToken) {
      return false;
    }
  }
  
  return true;
}

/**
 * 刷新CSRF令牌，生成一个新的
 * @param {Object} options 配置选项，与generateCSRFToken相同
 * @returns {string} 新的CSRF令牌
 */
function refreshCSRFToken(options = {}) {
  // 强制生成新令牌
  currentToken = null;
  tokenExpiry = null;
  return generateCSRFToken(options);
}

/**
 * 获取当前CSRF令牌
 * @param {string} cookieName CSRF令牌Cookie名称
 * @returns {string|null} 当前CSRF令牌，如果不存在则返回null
 */
function getCurrentCSRFToken(cookieName = 'csrf_token') {
  // 首先检查内存中的令牌
  if (currentToken && tokenExpiry && tokenExpiry > Date.now()) {
    return currentToken;
  }
  
  // 尝试从sessionStorage恢复令牌
  if (typeof sessionStorage !== 'undefined') {
    try {
      const token = sessionStorage.getItem(cookieName);
      if (token) {
        currentToken = token;
        // 默认设置为1小时过期（不知道原始过期时间）
        tokenExpiry = Date.now() + 60 * 60 * 1000;
        return token;
      }
    } catch (error) {
      console.error('从sessionStorage获取CSRF令牌失败', error);
    }
  }
  
  // 尝试从cookie恢复令牌
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(`${cookieName}=`)) {
        const token = cookie.substring(cookieName.length + 1);
        currentToken = token;
        // 默认设置为1小时过期（不知道原始过期时间）
        tokenExpiry = Date.now() + 60 * 60 * 1000;
        return token;
      }
    }
  }
  
  return null;
}

/**
 * 工具函数：获取HTTP请求头（这是示例函数，在实际请求处理中需要替换）
 * @param {string} headerName 请求头名称
 * @returns {string|null} 请求头值
 */
function getRequestHeader(headerName) {
  // 在实际API请求处理中，应替换为真实的请求头获取逻辑
  // 这里只是一个模拟实现
  return null;
}

/**
 * 在请求中包含CSRF令牌
 * @param {Object} requestConfig 请求配置
 * @param {string} cookieName CSRF令牌Cookie名称
 * @param {string} headerName 请求头名称
 * @returns {Object} 更新后的请求配置
 */
function includeCSRFToken(requestConfig = {}, cookieName = 'csrf_token', headerName = 'X-CSRF-Token') {
  const token = getCurrentCSRFToken(cookieName);
  
  if (!token) {
    return requestConfig;
  }
  
  // 创建修改后的配置副本
  const updatedConfig = { ...requestConfig };
  
  // 确保headers对象存在
  if (!updatedConfig.headers) {
    updatedConfig.headers = {};
  }
  
  // 添加CSRF令牌请求头
  updatedConfig.headers[headerName] = token;
  
  return updatedConfig;
}

module.exports = {
  generateCSRFToken,
  validateCSRFToken,
  refreshCSRFToken,
  getCurrentCSRFToken,
  includeCSRFToken
}; 