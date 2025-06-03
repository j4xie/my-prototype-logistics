/**
 * @module config/default/performance
 * @description 性能相关配置
 */

/**
 * 性能配置
 * @typedef {Object} PerformanceConfig
 * @property {boolean} monitoring - 是否启用性能监控
 * @property {boolean} reportToServer - 是否将性能数据报告给服务器
 * @property {string} reportEndpoint - 性能数据报告接口
 * @property {number} sampleRate - 性能数据采样率 (0-1)
 * @property {string} minLogLevel - 最小日志级别 (debug, info, warning, error)
 */

/**
 * 性能配置
 * @type {PerformanceConfig}
 */
module.exports = {
  monitoring: true,
  reportToServer: false,
  reportEndpoint: "/api/performance/report",
  sampleRate: 0.1, // 0-1之间的值，表示采样率
  minLogLevel: "warning" // debug, info, warning, error
}; 