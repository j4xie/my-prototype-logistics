/**
 * @module config/default/auth
 * @description 认证相关配置
 */

/**
 * 认证配置
 * @typedef {Object} AuthConfig
 * @property {boolean} enabled - 是否启用认证
 * @property {string} tokenStorage - 令牌存储方式 (localStorage, sessionStorage, cookie)
 * @property {string} tokenName - 令牌名称
 * @property {number} sessionTimeout - 会话超时时间(秒)
 * @property {number} refreshThreshold - 令牌刷新阈值(秒)
 * @property {string} loginUrl - 登录页面URL
 * @property {string} logoutUrl - 登出接口URL
 * @property {string} authType - 认证类型 (jwt, oauth, basic)
 */

/**
 * 认证配置
 * @type {AuthConfig}
 */
module.exports = {
  enabled: true,
  tokenStorage: "localStorage", // localStorage, sessionStorage, cookie
  tokenName: "trace_token",
  sessionTimeout: 1800, // 秒
  refreshThreshold: 300, // 秒，token刷新阈值
  loginUrl: "/auth/login.html",
  logoutUrl: "/auth/logout",
  authType: "jwt" // jwt, oauth, basic
}; 