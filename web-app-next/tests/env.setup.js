/**
 * Jest测试环境变量设置
 * 实现P1方案：通过环境变量注入API基址
 *
 * 解决MSW在Node.js环境下相对URL问题的架构级方案
 */

// 为测试环境设置API基址
process.env.API_BASE = 'http://localhost:3001';

// 其他测试环境变量
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api';

console.log('🔧 Jest环境变量已设置: API_BASE =', process.env.API_BASE);
