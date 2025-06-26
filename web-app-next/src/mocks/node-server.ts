import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { getCurrentMockConfig } from './config/environments'

/**
 * MSW 服务器端配置
 * 用于Node环境（测试、API路由）的Mock服务
 *
 * 基于TASK-P3-017B架构设计 + Day 2环境配置增强：
 * - MSW v2.0+ 服务器端配置
 * - Jest测试环境支持
 * - API路由中间件支持
 * - 环境感知的智能启停控制
 */

// 创建MSW Server实例
export const server = setupServer(...handlers)

// Node环境下的MSW初始化（环境感知版）
export const initializeMockServer = (options?: {
  quiet?: boolean
  onUnhandledRequest?: 'bypass' | 'warn' | 'error'
}) => {
  // 获取当前环境配置
  const config = getCurrentMockConfig()
  const { quiet = false, onUnhandledRequest = config.onUnhandledRequest } = options || {}

  try {
    // 启动Server with环境配置
        server.listen({
      onUnhandledRequest
    })

    if (!quiet) {
      console.log(`🚀 MSW Mock Server initialized for ${config.name} environment`)
      console.log(`📋 Registered ${handlers.length} API handlers`)
      console.log(`⚙️ Config: handlers=${config.handlers.join(',')}, dataSet=${config.dataSet}`)
      console.log(`🌐 Network delay: ${config.delay[0]}-${config.delay[1]}ms`)
      console.log('🔧 Ready to intercept server requests')
    }
  } catch (error) {
    if (!quiet) {
      console.error('❌ Failed to initialize MSW Mock Server:', error)
    }
    throw error
  }
}

// Server控制方法
export const mockServerControls = {
  start: (options?: any) => {
    server.listen(options)
  },

  stop: () => {
      server.close()
  },

  reset: () => {
    server.resetHandlers()
  },

  use: (...newHandlers: any[]) => {
    server.use(...newHandlers)
  },

  // 清理方法（用于测试环境）
  cleanup: () => {
    server.resetHandlers()
    server.close()
    }
}

// 测试环境自动初始化
export const autoInitializeInTesting = () => {
  if (process.env.NODE_ENV === 'test') {
    try {
      initializeMockServer({ quiet: true })
    } catch (error) {
      console.warn('⚠️ MSW Mock Server auto-initialization failed:', error)
    }
  }
}

// 导出供其他模块使用
export { server as mockServer }
export default server
