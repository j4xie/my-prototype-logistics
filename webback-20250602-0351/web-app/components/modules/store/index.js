/**
 * 食品溯源系统 - 状态管理模块索引
 * @module modules/store
 * @version 1.0.0
 * @author Heiniu食品溯源系统团队
 * @description 此文件是状态管理模块的主入口，导出状态管理相关的组件和功能
 */

// 导入状态管理模块
const traceStoreInstance = require('./store.js');
const { createStore } = require('./store.js');

// CommonJS导出
module.exports = traceStoreInstance;
module.exports.createStore = createStore;
