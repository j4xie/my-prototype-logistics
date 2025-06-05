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
 * - 管理模块 (admin)
 * - 产品溯源 (trace)
 */

import { authHandlers } from './auth'
import { usersHandlers } from './users'
import { farmingHandlers } from './farming'
import { processingHandlers } from './processing'
import { logisticsHandlers } from './logistics'
import { adminHandlers } from './admin'
import { traceHandlers } from './trace'
import { productsHandlers } from './products'
import { middlewares } from '../config/middleware'
import { http, HttpResponse } from 'msw'
import { wrapError } from '../../types/api-response'

// 通用404处理器 - 必须放在最后，用于捕获所有未匹配的请求
const fallbackHandler = http.all('*', ({ request }) => {
  console.log(`🚫 Unhandled request: ${request.method} ${request.url}`)
  return HttpResponse.json(
    wrapError('API端点不存在', 404),
    { status: 404 }
  )
})

// 聚合所有API处理器（中间件优先）
export const handlers = [
  ...middlewares,          // 中间件handlers优先处理
  ...authHandlers,
  ...usersHandlers,
  ...farmingHandlers,
  ...processingHandlers,
  ...logisticsHandlers,
  ...adminHandlers,
  ...traceHandlers,
  ...productsHandlers,
  fallbackHandler          // 通用404处理器放在最后
]

// 按模块导出
export {
  authHandlers,
  usersHandlers,
  farmingHandlers,
  processingHandlers,
  logisticsHandlers,
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
    admin: adminHandlers.length,
    trace: traceHandlers.length,
    products: productsHandlers.length
  }
}

console.log(`📋 MSW Handlers loaded: ${handlerStats.total} total handlers`)
console.log(`📊 By module:`, handlerStats.byModule)
