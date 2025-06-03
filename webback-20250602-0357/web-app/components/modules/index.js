/**
 * 食品溯源系统 - 模块集合主入口
 * 此文件整合了所有核心模块，提供统一的导出接口
 * 版本: 1.0.0
 */

// 导入所有模块
const authModule = require('./auth');
const storeModule = require('./store');
const dataModule = require('./data');
const uiModule = require('./ui');
const utilsModule = require('./utils');

// 导出组合模块
const traceModules = {
  auth: authModule,
  store: storeModule,
  data: dataModule,
  ui: uiModule,
  utils: utilsModule
};

// 导出所有模块
module.exports = {
  default: traceModules,
  auth: authModule,
  store: storeModule,
  data: dataModule,
  ui: uiModule,
  utils: utilsModule
}; 