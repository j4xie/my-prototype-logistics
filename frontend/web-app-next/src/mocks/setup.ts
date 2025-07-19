/**
 * MSW 统一初始化接口
 * 基于TASK-P3-017B架构设计
 *
 * 提供环境感知的Mock服务初始化：
 * - Node环境 -> 使用setupServer (Jest测试、API路由)
 * - 浏览器环境 -> 使用setupWorker (开发环境)
 */

import { initializeMockWorker } from './browser'
import { mockMiddleware, getCurrentMockConfig, type MockEnvironment } from './config/environments'
import { initializeVersionManagement, getVersionManagementStatus } from './setup-version-management'

/**
 * 统一Mock服务初始化
 * 根据环境自动选择Node端或浏览器端配置
 * Day 5: 集成版本管理系统
 */
export const initializeMockService = async (
  environment: string = process.env.NODE_ENV || 'development',
  customConfig?: Partial<MockEnvironment>
) => {
  const config = {
    ...getCurrentMockConfig(),
    ...customConfig
  }

  if (!config.enabled) {
    console.log('🚫 Mock service disabled for', environment)
    return false
  }

  try {
    // Step 1: 初始化版本管理系统 (Day 5 新增)
    console.log('🔧 Initializing version management system...')
    const versionResult = await initializeVersionManagement()

    if (!versionResult.success) {
      console.warn('⚠️ Version management initialization had issues:', versionResult.errors)
    } else {
      console.log(`✅ Version management initialized: ${versionResult.version} (${versionResult.schemas} schemas, ${versionResult.migrations} migrations)`)
    }

    // Step 2: 初始化MSW服务
    if (typeof window === 'undefined') {
      // Node环境（服务器端、测试环境）
      // 动态导入避免在客户端打包时引入node模块
      const { initializeMockServer } = await import('./node-server')

      initializeMockServer({
        quiet: environment === 'test',
        onUnhandledRequest: config.onUnhandledRequest
      })

      console.log(`🚀 MSW Mock Server initialized for ${environment} environment`)
    } else {
      // 浏览器环境（客户端）
      await initializeMockWorker({
        quiet: environment === 'test',
        onUnhandledRequest: config.onUnhandledRequest
      })

      console.log(`🚀 MSW Mock Worker initialized for ${environment} environment`)
    }

    // Step 3: 输出版本管理状态 (Day 5 新增)
    const versionStatus = getVersionManagementStatus()
    console.log(`📊 Version Management Status: ${versionStatus.systemHealth} | Current: ${versionStatus.currentVersion}`)

    if (versionStatus.issues) {
      console.warn('⚠️ Version management issues detected:', versionStatus.issues)
    }

    return true
  } catch (error) {
    console.error(`❌ Failed to initialize Mock service for ${environment}:`, error)
    return false
  }
}

/**
 * 开发环境自动初始化
 * 在开发模式下自动启动Mock服务
 */
export const autoInitializeForDevelopment = async () => {
  if (process.env.NODE_ENV === 'development') {
    return await initializeMockService('development')
  }
  return false
}

/**
 * 测试环境自动初始化
 * 在测试模式下自动启动Mock服务
 */
export const autoInitializeForTesting = async () => {
  if (process.env.NODE_ENV === 'test') {
    return await initializeMockService('test')
  }
  return false
}

// 导出配置供外部使用
export { getCurrentMockConfig, mockMiddleware }

// 导出子模块 - 使用动态导入避免打包问题
export const getMockServerControls = async () => {
  if (typeof window === 'undefined') {
    const { mockServer, mockServerControls } = await import('./node-server')
    return { mockServer, mockServerControls }
  }
  return null
}

export { mockWorker, mockWorkerControls } from './browser'
export { handlers, handlerStats } from './handlers'
