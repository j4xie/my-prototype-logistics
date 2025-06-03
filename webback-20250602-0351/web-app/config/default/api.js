/**
 * @module config/default/api
 * @description API相关配置
 */

/**
 * API配置
 * @typedef {Object} ApiConfig
 * @property {string} endpoint - API根端点
 * @property {string} version - API版本
 * @property {number} timeout - 请求超时(毫秒)
 * @property {number} retryAttempts - 失败重试次数
 * @property {number} retryDelay - 重试延迟(毫秒)
 * @property {number} batchSize - 批量请求大小
 * @property {boolean} useCache - 是否使用缓存
 * @property {number} cacheTime - 缓存时间(秒)
 */

/**
 * API配置
 * @type {ApiConfig}
 */
module.exports = {
  endpoint: "/api",
  version: "v1",
  timeout: 30000, // 毫秒
  retryAttempts: 3,
  retryDelay: 1000, // 毫秒
  batchSize: 100, // 批量请求大小
  useCache: true,
  cacheTime: 300 // 秒
};