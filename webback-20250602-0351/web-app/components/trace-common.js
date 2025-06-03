/**
 * 食品溯源系统 - 通用JavaScript工具函数
 * 此文件为向后兼容文件，重定向到模块化版本
 * 版本: 1.0.0
 */

// 导入模块化版本
import { traceCommon as modulesTraceCommon } from './modules/trace-common.js';

// 为了向后兼容，使用相同的对象名
const traceLoader = modulesTraceCommon.traceLoader;
const traceAuth = modulesTraceCommon.traceAuth;

// 暴露给全局对象
window.traceLoader = traceLoader;
window.traceAuth = traceAuth;

// 向后兼容性
window.traceCommon = { ...traceLoader, ...traceAuth };

// 输出重定向信息
console.log('通用工具(trace-common.js)已重定向到模块化版本'); 