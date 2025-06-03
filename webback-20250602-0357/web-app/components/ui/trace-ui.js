/**
 * 食品溯源系统 - UI组件模块
 * 此文件为向后兼容文件，重定向到模块化版本
 * 版本: 1.0.0
 */

// 导入模块化UI
import { traceUI as modulesTraceUI } from '../modules/ui/index.js';

// 为了向后兼容，使用相同的变量名
const traceUI = modulesTraceUI;

// 页面加载时自动初始化
document.addEventListener('DOMContentLoaded', () => {
  traceUI.init();
});

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { traceUI };
} else {
  window.traceUI = traceUI;
}

// 输出重定向信息
console.log('UI组件(ui/trace-ui.js)已重定向到模块化版本'); 