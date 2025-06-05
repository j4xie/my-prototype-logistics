import { setupServer } from 'msw/node'
import { handlers } from './handlers'
import { getCurrentMockConfig } from './config/environments'

/**
 * MSW Node端服务器配置
 * 基于 docs/architecture/mock-api-architecture.md 统一架构设计
 *
 * 支持场景：
 * - Jest测试环境完整网络拦截
 * - Next.js API Routes Mock
 * - Node.js后端服务集成
 *
 * 基于TASK-P3-018B完整复杂方案：
 * - 完整Web API polyfills支持
 * - 环境感知配置
 * - 生命周期管理
 * - 错误处理和日志
 */

// 创建MSW服务器实例
export const server = setupServer(...handlers)

// 测试环境配置
export const setupTestServer = () => {
  // 所有测试前启动服务器
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'warn'
    })
  })

  // 每个测试后重置handlers
  afterEach(() => {
    server.resetHandlers()
  })

  // 所有测试后关闭服务器
  afterAll(() => {
    server.close()
  })
}

// Node环境下的MSW初始化
export const initializeMockServer = (options?: {
  quiet?: boolean
  onUnhandledRequest?: 'bypass' | 'warn' | 'error'
}) => {
  const { quiet = false, onUnhandledRequest = 'warn' } = options || {}

  if (typeof window === 'undefined') {
    // Node环境
        server.listen({
      onUnhandledRequest
    })

    if (!quiet) {
      console.log('🚀 MSW Mock Server initialized for Node.js environment')
      console.log(`📋 Registered ${handlers.length} API handlers`)
    }
  }
}

// 服务器控制接口 - 完整的生命周期管理
export const mockServerControls = {
  /**
   * 启动MSW Node端服务器
   * 支持环境感知配置和完整错误处理
   */
  start: (options?: {
    quiet?: boolean
    onUnhandledRequest?: 'bypass' | 'warn' | 'error'
  }) => {
    const { quiet = false, onUnhandledRequest = 'warn' } = options || {}
    const config = getCurrentMockConfig()

    // 环境检查
    if (typeof window !== 'undefined') {
      if (!quiet) {
        console.warn('⚠️ MSW Node server should not be started in browser environment')
      }
      return false
    }

    // 配置检查
    if (!config.enabled) {
      if (!quiet) {
        console.log('🚫 MSW Mock Server disabled by environment configuration')
      }
      return false
    }

    try {
      // 启动服务器
      server.listen({
        onUnhandledRequest
      })

      if (!quiet) {
        console.log(`🚀 MSW Mock Server started for ${config.name} environment`)
        console.log(`📋 Registered ${handlers.length} API handlers`)
        console.log(`⚙️ Enabled modules: ${config.handlers.join(', ')}`)
        console.log(`📊 Data set: ${config.dataSet}`)
        console.log(`⚡ Network delay: ${config.delay[0]}-${config.delay[1]}ms`)
      }
      return true
    } catch (error) {
      if (!quiet) {
        console.error('❌ Failed to start MSW Mock Server:', error)
      }
      throw error
    }
  },

  /**
   * 停止MSW服务器
   */
  stop: () => {
    try {
      server.close()
      console.log('🛑 MSW Mock Server stopped')
    } catch (error) {
      console.error('❌ Error stopping MSW Mock Server:', error)
    }
  },

  /**
   * 重置handlers到初始状态
   */
  reset: () => {
    server.resetHandlers()
    console.log('🔄 MSW Mock Server handlers reset')
  },

  /**
   * 动态添加新的handlers
   */
  use: (...newHandlers: any[]) => {
    server.use(...newHandlers)
    console.log(`➕ Added ${newHandlers.length} new MSW handlers`)
  },

  /**
   * 获取当前服务器状态
   */
  getStatus: () => {
    const config = getCurrentMockConfig()
    return {
      enabled: config.enabled,
      environment: config.name,
      handlerCount: handlers.length,
      activeModules: config.handlers,
      dataSet: config.dataSet
    }
  },

  /**
   * 热重载支持 - 重启服务器
   */
  reload: async (options?: { quiet?: boolean }) => {
    const { quiet = false } = options || {}

    try {
      mockServerControls.stop()
      await new Promise(resolve => setTimeout(resolve, 100)) // 等待清理
      return mockServerControls.start({ quiet, onUnhandledRequest: 'warn' })
    } catch (error) {
      if (!quiet) {
        console.error('❌ Failed to reload MSW Mock Server:', error)
      }
      throw error
    }
  }
}

// 导出供其他模块使用
export { server as mockServer }
export default server
