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

import { authHandlers } from './auth'
import { usersHandlers } from './users'
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
  // 先定义handlers数组（不包括自己），避免循环引用
  const allHandlers: RequestHandler[] = [
    ...middlewares,
    ...authHandlers,
    ...usersHandlers,
    ...farmingHandlers,
    ...processingHandlers,
    ...logisticsHandlers,
    ...adminHandlers,
    ...traceHandlers,
    ...productsHandlers,
  ];

  const totalHandlers: number = allHandlers.length + 2; // +2 for mockStatusHandler and notFoundHandler

  return HttpResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    handlersCount: totalHandlers,
    version: '1.0.0-baseline',
    environment: process.env.NODE_ENV || 'development',
    message: `Mock API is running with ${totalHandlers} handlers`,
    handlers: {
      farming: farmingHandlers.length,
      processing: processingHandlers.length,
      logistics: logisticsHandlers.length,
      admin: adminHandlers.length,
      auth: authHandlers.length,
      users: usersHandlers.length,
      trace: traceHandlers.length,
      products: productsHandlers.length,
      middlewares: middlewares.length,
    }
  }, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Mock-Status': 'active'
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
 * 合并所有处理器
 * 优先级：健康检查 > 中间件 > 业务handlers > 404处理器
 */
export const handlers: RequestHandler[] = [
  // 健康检查端点（最高优先级）
  mockStatusHandler,

  // 中间件handlers优先处理
  ...middlewares,

  // 业务模块处理器
  ...authHandlers,
  ...usersHandlers,
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

// 按模块导出
export {
  authHandlers,
  usersHandlers,
  farmingHandlers,
  processingHandlers,
  logisticsHandlers,
  salesHandlers,           // TASK-P3-025新增销售模块导出
  adminHandlers,
  traceHandlers,
  productsHandlers
}

// 导出Handler数量统计
export const handlerStats = {
  total: handlers.length,
  byModule: {
    auth: authHandlers.length,
    users: usersHandlers.length,
    farming: farmingHandlers.length,
    processing: processingHandlers.length,
    logistics: logisticsHandlers.length,
    sales: salesHandlers.length,        // TASK-P3-025新增销售模块统计
    admin: adminHandlers.length,
    trace: traceHandlers.length,
    products: productsHandlers.length
  }
}

console.log(`📋 MSW Handlers loaded: ${handlerStats.total} total handlers`)
console.log(`📊 By module:`, handlerStats.byModule)
