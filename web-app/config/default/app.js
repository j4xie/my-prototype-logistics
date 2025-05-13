/**
 * @module config/default/app
 * @description 应用基本配置
 */

/**
 * 应用基本配置
 * @typedef {Object} AppConfig
 * @property {string} name - 应用名称
 * @property {string} version - 应用版本
 * @property {string} environment - 运行环境 (production, development, testing)
 * @property {boolean} debugMode - 是否开启调试模式
 * @property {string} theme - 主题 (light, dark, auto)
 * @property {string} language - 默认语言
 */

/**
 * 应用基本配置
 * @type {AppConfig}
 */
module.exports = {
  // 应用基本信息
  name: "食品溯源系统",
  version: "1.0.0",
  environment: "production", // production, development, testing
  debugMode: false,
  theme: "light", // light, dark, auto
  language: "zh-CN"
}; 