/**
 * Mock API请求中间件
 * 基于docs/architecture/mock-api-architecture.md第6节版本感知机制
 */

import { http, HttpResponse } from 'msw'
import { mockMiddleware } from './environments'

/**
 * 版本兼容性配置
 */
export const schemaCompatibility = {
  '1.0.0': {
    deprecated: [],
    breaking: false
  },
  '1.1.0': {
    deprecated: ['old-field'],
    breaking: false,
    migrations: {
      'old-field': 'new-field'
    }
  }
} as const

/**
 * 检查API版本是否支持
 */
export const isVersionSupported = (version: string): boolean => {
  return Object.keys(schemaCompatibility).includes(version)
}

/**
 * 获取当前Schema版本
 */
export const getCurrentSchemaVersion = (): string => {
  return '1.0.0-baseline' // 基于TASK-P3-018冻结的基线版本
}

/**
 * 版本Header中间件
 * 处理API版本兼容性检查和响应头注入
 */
export const versionMiddleware = http.all('*', ({ request }) => {
  // 跳过非API请求
  if (!request.url.includes('/api/')) {
    return
  }

  const apiVersion = request.headers.get('x-api-version') || '1.0.0'

  // 版本兼容性检查
  if (!isVersionSupported(apiVersion)) {
    return HttpResponse.json({
      success: false,
      error: 'Unsupported API version',
      message: `API version ${apiVersion} is not supported`,
      supportedVersions: Object.keys(schemaCompatibility),
      currentVersion: getCurrentSchemaVersion()
    }, {
      status: 400,
      headers: {
        'x-api-version': getCurrentSchemaVersion(),
        'x-schema-version': getCurrentSchemaVersion()
      }
    })
  }

  // 继续处理请求，注入版本信息到响应头
  return undefined // 让其他handlers处理
})

/**
 * 请求日志中间件
 * 开发环境下记录API请求日志
 */
export const loggingMiddleware = http.all('*', ({ request }) => {
  if (process.env.NODE_ENV === 'development' && request.url.includes('/api/')) {
    const timestamp = new Date().toISOString()
    const method = request.method
    const url = new URL(request.url).pathname

    console.log(`🔔 MSW [${timestamp}] ${method} ${url}`)
  }

  return undefined // 让其他handlers处理
})

/**
 * Mock启停控制中间件
 * 根据环境配置动态启停Mock功能
 */
export const mockControlMiddleware = http.all('*', ({ request }) => {
  if (!mockMiddleware.shouldMock()) {
    // Mock被禁用，透传到真实API
    console.log('🚫 Mock disabled, bypassing to real API:', request.url)
    return undefined
  }

  return undefined // 让其他handlers处理
})

/**
 * 响应头增强中间件
 * 为所有Mock响应添加统一的元数据头
 */
export const responseHeadersMiddleware = {
  enhance: (response: Response): Response => {
    const headers = new Headers(response.headers)

    // 添加Mock标识
    headers.set('x-mock-enabled', 'true')
    headers.set('x-mock-version', '1.0.0')
    headers.set('x-api-version', getCurrentSchemaVersion())
    headers.set('x-schema-version', getCurrentSchemaVersion())

    // 添加CORS头（开发环境）
    if (process.env.NODE_ENV === 'development') {
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-version')
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }
}

/**
 * 导出所有中间件
 */
export const middlewares = [
  mockControlMiddleware,
  versionMiddleware,
  loggingMiddleware
]
