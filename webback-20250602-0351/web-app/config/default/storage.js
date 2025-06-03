/**
 * @module config/default/storage
 * @description 存储相关配置
 */

/**
 * 存储配置
 * @typedef {Object} StorageConfig
 * @property {string} type - 存储类型 (indexeddb, localstorage, server)
 * @property {string} dbName - 数据库名称
 * @property {number} dbVersion - 数据库版本
 * @property {boolean} syncEnabled - 是否启用同步
 * @property {number} syncInterval - 同步间隔(秒)
 * @property {number} maxCacheSize - 最大缓存大小(字节)
 * @property {boolean} compression - 是否启用压缩
 */

/**
 * 存储配置
 * @type {StorageConfig}
 */
module.exports = {
  type: "indexeddb", // indexeddb, localstorage, server
  dbName: "trace_db",
  dbVersion: 1,
  syncEnabled: true,
  syncInterval: 300, // 秒
  maxCacheSize: 10485760, // 10MB
  compression: true
}; 