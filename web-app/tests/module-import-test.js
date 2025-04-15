/**
 * 模块导入测试
 * 测试各模块的导入功能
 */

// 从主入口导入
console.log('--- 从主入口导入测试 ---');
const traceModules = require('../components/modules');
console.log('默认导出:', traceModules.default ? '存在' : '不存在');
console.log('auth 导出:', traceModules.auth ? '存在' : '不存在');
console.log('store 导出:', traceModules.store ? '存在' : '不存在');
console.log('data 导出:', traceModules.data ? '存在' : '不存在');
console.log('ui 导出:', traceModules.ui ? '存在' : '不存在');
console.log('utils 导出:', traceModules.utils ? '存在' : '不存在');

// 从各模块导入
console.log('\n--- 从各模块导入测试 ---');
const auth = require('../components/modules/auth');
const data = require('../components/modules/data');
const store = require('../components/modules/store');
const ui = require('../components/modules/ui');
const utils = require('../components/modules/utils');

console.log('auth 导入:', auth ? '成功' : '失败');
console.log('data 导入:', data ? '成功' : '失败');
console.log('store 导入:', store ? '成功' : '失败');
console.log('ui 导入:', ui ? '成功' : '失败');
console.log('utils 导入:', utils ? '成功' : '失败');

// 测试解构导入
console.log('\n--- 解构导入测试 ---');
const { auth: auth2, store: store2, data: data2, ui: ui2, utils: utils2 } = require('../components/modules');
console.log('auth 解构导入:', auth2 ? '成功' : '失败');
console.log('store 解构导入:', store2 ? '成功' : '失败');
console.log('data 解构导入:', data2 ? '成功' : '失败');
console.log('ui 解构导入:', ui2 ? '成功' : '失败');
console.log('utils 解构导入:', utils2 ? '成功' : '失败'); 