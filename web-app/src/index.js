/**
 * @file src/index.js
 * @description 应用程序入口文件
 */

// 引入核心功能
require('./trace-main.js');

// 输出应用版本信息
console.log(`食品溯源系统 v${process.env.VERSION || '1.0.0'}`);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  console.log('应用已初始化');
}); 