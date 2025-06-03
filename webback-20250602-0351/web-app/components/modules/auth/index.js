/**
 * 食品溯源系统 - 认证模块索引文件
 * 版本: 1.0.0
 * 
 * 此文件为认证模块的主入口，导出所有认证相关功能：
 * - traceAuth: 用户认证和权限管理
 * - traceLoader: 资源加载管理
 */

// 导入认证和资源加载模块
const traceAuth = require('./auth').traceAuth;
const traceLoader = require('./loader');

// 默认导出对象，包含所有认证相关功能
const authModule = {
  auth: traceAuth,
  loader: traceLoader
};

// CommonJS导出
module.exports = authModule;

// 同时导出各个组件
module.exports.traceAuth = traceAuth;
module.exports.traceLoader = traceLoader;
