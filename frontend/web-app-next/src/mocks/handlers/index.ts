/**
 * MSW API Handlers 统一入口
 * 基于TASK-P3-017B架构设计和TASK-P3-018权威Schema
 *
 * 包含所有业务模块的API Handler：
 * - 认证模块 (auth)
 * - 用户管理 (users)
 * - 农业模块 (farming)
 * - 加工模块 (processing)
 * - 物流模块 (logistics)
 * - 销售模块 (sales) - TASK-P3-025新增
 * - 管理模块 (admin)
 * - 产品溯源 (trace)
 */

// 已删除：authHandlers, usersHandlers, platformHandlers - 使用真实后端API
// import { authHandlers } from './auth'
// import { usersHandlers } from './users'
// import { platformHandlers } from './platform'

// 保留的Mock APIs - 还没有真实后端实现
import { farmingHandlers } from './farming'
import { processingHandlers } from './processing'
import { logisticsHandlers } from './logistics'
import { salesHandlers } from './sales'
import { adminHandlers } from './admin'
import { traceHandlers } from './trace'
import { productsHandlers } from './products'
import { middlewares } from '../config/middleware'
import { http, HttpResponse, RequestHandler } from 'msw'
import { wrapError } from '../../types/api-response'

/**
 * Mock健康检查端点
 * 提供Mock服务状态和handlers信息
 */
const mockStatusHandler: RequestHandler = http.get('/api/mock-status', () => {
  // 只包含仍在使用Mock的handlers
  const allHandlers: RequestHandler[] = [
    ...middlewares,
    ...farmingHandlers,
    ...processingHandlers,
    ...logisticsHandlers,
    ...salesHandlers,
    ...adminHandlers,
    ...traceHandlers,
    ...productsHandlers,
  ];

  const totalHandlers: number = allHandlers.length + 2; // +2 for mockStatusHandler and notFoundHandler

  return HttpResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    handlersCount: totalHandlers,
    version: '1.0.0-mixed-api', // 混合API模式
    environment: process.env.NODE_ENV || 'development',
    message: `Mock API is running with ${totalHandlers} handlers (Mixed Mode: Real API + Mock)`,
    realApis: ['auth', 'users', 'platform'], // 使用真实后端的API
    mockApis: ['farming', 'processing', 'logistics', 'sales', 'admin', 'trace', 'products'], // 仍使用Mock的API
    handlers: {
      farming: farmingHandlers.length,
      processing: processingHandlers.length,
      logistics: logisticsHandlers.length,
      sales: salesHandlers.length,
      admin: adminHandlers.length,
      trace: traceHandlers.length,
      products: productsHandlers.length,
      middlewares: middlewares.length,
    }
  }, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Mock-Status': 'mixed-mode',
      'X-Real-APIs': 'auth,users,platform',
      'X-Mock-APIs': 'farming,processing,logistics,sales,admin,trace,products'
    }
  });
});

/**
 * 通用404处理器 - 用于捕获未定义的API路由
 */
const notFoundHandler: RequestHandler = http.all('/api/*', ({ request }) => {
  console.warn(`🚫 Mock API: Unhandled request to ${request.url}`);

  return HttpResponse.json({
    error: 'Not Found',
    message: `API endpoint ${new URL(request.url).pathname} not implemented in Mock`,
    timestamp: new Date().toISOString(),
    suggestion: 'Check if the API handler is registered in the appropriate module'
  }, {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'X-Mock-Handler': 'not-found'
    }
  });
});

/**
 * 合并所有处理器 - 混合API模式
 * 优先级：健康检查 > 中间件 > 业务handlers > 404处理器
 * 
 * 🚫 已移除：authHandlers, usersHandlers, platformHandlers (使用真实后端API)
 * ✅ 保留：farming, processing, logistics, sales, admin, trace, products (继续使用Mock)
 */
export const handlers: RequestHandler[] = [
  // 健康检查端点（最高优先级）
  mockStatusHandler,

  // 中间件handlers优先处理
  ...middlewares,

  // 业务模块处理器 (仅包含还没有真实后端的模块)
  ...farmingHandlers,
  ...processingHandlers,
  ...logisticsHandlers,
  ...salesHandlers,        // TASK-P3-025新增销售模块
  ...adminHandlers,
  ...traceHandlers,
  ...productsHandlers,

  // 404处理器（最低优先级，捕获所有未匹配的请求）
  notFoundHandler,
];

// 按模块导出 (仅保留Mock APIs)
export {
  // authHandlers,         // 已移除：使用真实后端API
  // usersHandlers,        // 已移除：使用真实后端API
  // platformHandlers,     // 已移除：使用真实后端API
  
  // 保留的Mock APIs
  farmingHandlers,
  processingHandlers,
  logisticsHandlers,
  salesHandlers,           // TASK-P3-025新增销售模块导出
  adminHandlers,
  traceHandlers,
  productsHandlers,
}

// 导出Handler数量统计 (混合API模式)
export const handlerStats = {
  total: handlers.length,
  realApis: ['auth', 'users', 'platform'],
  mockApis: ['farming', 'processing', 'logistics', 'sales', 'admin', 'trace', 'products'],
  byModule: {
    // auth: 0,              // 使用真实后端API
    // users: 0,             // 使用真实后端API
    // platform: 0,          // 使用真实后端API
    farming: farmingHandlers.length,
    processing: processingHandlers.length,
    logistics: logisticsHandlers.length,
    sales: salesHandlers.length,        // TASK-P3-025新增销售模块统计
    admin: adminHandlers.length,
    trace: traceHandlers.length,
    products: productsHandlers.length,
  }
}

console.log(`📋 MSW Handlers loaded: ${handlerStats.total} total handlers`)
console.log(`📊 By module:`, handlerStats.byModule)
