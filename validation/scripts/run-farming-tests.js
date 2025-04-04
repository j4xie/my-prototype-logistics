/**
 * 养殖管理模块交互性与可用性测试启动脚本
 */

const { runTest } = require('./farming-interaction-test');

console.log('启动养殖管理模块交互性与可用性测试...');
runTest().catch(console.error); 