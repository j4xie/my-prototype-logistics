/**
 * @module config/default/ui
 * @description UI相关配置
 */

/**
 * UI配置
 * @typedef {Object} UiConfig
 * @property {boolean} animationsEnabled - 是否启用动画
 * @property {Object} responsiveBreakpoints - 响应式断点
 * @property {number} toastDuration - 提示消息显示时间(毫秒)
 * @property {number} modalTransitionTime - 模态框过渡时间(毫秒)
 * @property {string} iconSet - 图标集 (material, fontawesome, custom)
 * @property {string} dateFormat - 日期格式
 * @property {string} timeFormat - 时间格式
 */

/**
 * UI配置
 * @type {UiConfig}
 */
module.exports = {
  animationsEnabled: true,
  responsiveBreakpoints: {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1400
  },
  toastDuration: 3000, // 毫秒
  modalTransitionTime: 300, // 毫秒
  iconSet: "material", // material, fontawesome, custom
  dateFormat: "YYYY-MM-DD",
  timeFormat: "HH:mm:ss"
};