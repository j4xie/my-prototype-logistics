/**
 * 食品溯源系统 - 工具模块索引文件
 * 版本: 1.0.0
 * 
 * 此文件为工具模块的主入口，导出所有工具相关功能
 */

// 导入工具模块
const { traceUtils } = require('./utils');

// CommonJS导出
module.exports = traceUtils;

// 同时导出所有工具函数
Object.assign(module.exports, {
  traceUtils
});
