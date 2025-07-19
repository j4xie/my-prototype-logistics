import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { getCurrentMockConfig, mockMiddleware } from './config/environments'

/**
 * MSW 浏览器端Worker配置
 * 用于开发环境和浏览器端API Mock
 *
 * 基于TASK-P3-017B架构设计 + Day 2环境配置增强：
 * - MSW v2.0+ 浏览器端配置
 * - Service Worker注册和生命周期管理
 * - Next.js 14 App Router集成
 * - 环境感知的智能启停控制
 */

// 创建MSW Worker实例
export const worker = setupWorker(...handlers)

// 浏览器环境下的MSW初始化（环境感知版）
export const initializeMockWorker = async (options?: {
  quiet?: boolean
  onUnhandledRequest?: 'bypass' | 'warn' | 'error'
}) => {
  if (typeof window === 'undefined') return

  // 获取当前环境配置
  const config = getCurrentMockConfig()
  const { quiet = false, onUnhandledRequest = config.onUnhandledRequest } = options || {}

  // 检查是否应该启用Mock
  if (!mockMiddleware.shouldMock()) {
    if (!quiet) {
      console.log('🚫 MSW Mock Worker disabled by environment configuration')
    }
    return
  }

  try {
    // 启动Worker with环境配置
    await worker.start({
      onUnhandledRequest,
      quiet,
      serviceWorker: {
        url: '/mockServiceWorker.js'
      }
    })

    if (!quiet) {
      console.log(`🚀 MSW Mock Worker initialized for ${config.name} environment`)
      console.log(`📋 Registered ${handlers.length} API handlers`)
      console.log(`⚙️ Config: handlers=${config.handlers.join(',')}, dataSet=${config.dataSet}`)
      console.log(`🌐 Network delay: ${config.delay[0]}-${config.delay[1]}ms`)
      console.log('🔧 Ready to intercept network requests')
    }
  } catch (error) {
    if (!quiet) {
      console.error('❌ Failed to initialize MSW Mock Worker:', error)
    }
    throw error
  }
}

// Worker控制方法
export const mockWorkerControls = {
  start: async (options?: any) => {
    if (typeof window !== 'undefined') {
      return await worker.start(options)
    }
  },

  stop: () => {
    if (typeof window !== 'undefined') {
      worker.stop()
    }
  },

  reset: () => {
    if (typeof window !== 'undefined') {
      worker.resetHandlers()
    }
  },

  use: (...newHandlers: any[]) => {
    if (typeof window !== 'undefined') {
      worker.use(...newHandlers)
    }
  },

  // 热重载支持
  reload: async () => {
    if (typeof window !== 'undefined') {
      worker.stop()
      await worker.start({
        quiet: false,
        onUnhandledRequest: 'warn'
      })
    }
  }
}

// 开发环境自动初始化
export const autoInitializeInDevelopment = async () => {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    try {
      await initializeMockWorker({ quiet: false })
    } catch (error) {
      console.warn('⚠️ MSW Mock Worker auto-initialization failed:', error)
    }
  }
}

// 导出供其他模块使用
export { worker as mockWorker }
export default worker
