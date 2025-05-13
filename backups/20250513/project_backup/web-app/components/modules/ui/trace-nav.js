const traceUI = require('./ui.js').traceUI;

/**
 * 食品溯源系统 - 导航组件模块（向后兼容）
 * 此文件用于向后兼容，指向UI模块中的导航组件
 * 版本: 1.0.0
 */

// 从UI模块中导入导航部分
// import { traceUI } from './ui.js';

// 提取导航组件
const traceNav = traceUI.nav || {};

// 导出导航组件
// export { traceNav };

// 默认导出导航组件
// export default traceNav;

// 控制台提示信息
console.log('导航组件(trace-nav.js)已从UI模块中提取'); 
// CommonJS导出
module.exports = traceNav;
module.exports.traceNav = traceNav;
