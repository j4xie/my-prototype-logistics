const traceUI = require('./ui.js').traceUI;

/**
 * 食品溯源系统 - UI组件模块（向后兼容）
 * 此文件用于向后兼容，重定向到ui.js
 * 版本: 1.0.0
 */

// 导入真正的UI模块
// import { traceUI } from './ui.js';

// 导出UI模块
// export { traceUI };

// 默认导出UI模块
// export default traceUI;

// 控制台提示信息
console.log('UI组件(trace-ui.js)已重定向到ui.js模块化版本'); 
// CommonJS导出
module.exports = traceUI;
module.exports.traceUI = traceUI;
