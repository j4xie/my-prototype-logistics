/**
 * @module config/default/features
 * @description 功能特性配置
 */

/**
 * 功能特性配置
 * @typedef {Object} FeaturesConfig
 * @property {boolean} offlineMode - 是否启用离线模式
 * @property {boolean} exportData - 是否允许导出数据
 * @property {boolean} importData - 是否允许导入数据
 * @property {boolean} shareProduct - 是否允许分享产品
 * @property {boolean} printLabels - 是否允许打印标签
 * @property {boolean} batchOperations - 是否启用批量操作
 * @property {boolean} dataAnalytics - 是否启用数据分析
 * @property {boolean} notifications - 是否启用通知
 */

/**
 * 功能特性配置
 * @type {FeaturesConfig}
 */
module.exports = {
  offlineMode: true,
  exportData: true,
  importData: true,
  shareProduct: true,
  printLabels: true,
  batchOperations: true,
  dataAnalytics: true,
  notifications: true
}; 