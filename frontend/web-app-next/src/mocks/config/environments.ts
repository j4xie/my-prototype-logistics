/**
 * Mock环境配置管理
 * 基于docs/architecture/mock-api-architecture.md第5节环境隔离策略
 */

export interface MockEnvironment {
  name: string
  baseUrl: string
  enabled: boolean
  handlers: string[]  // 启用的handler模块
  dataSet: string     // 使用的数据集
  delay: [number, number] // [min, max] 网络延迟范围(ms)
  onUnhandledRequest: 'bypass' | 'warn' | 'error'
}

export const environments: Record<string, MockEnvironment> = {
  development: {
    name: 'development',
    baseUrl: 'http://localhost:3000/api',
    enabled: true,
    handlers: ['farming', 'processing', 'logistics', 'sales', 'admin', 'trace', 'products'],
    dataSet: 'full',
    delay: [100, 600],
    onUnhandledRequest: 'warn'
  },
  test: {
    name: 'test',
    baseUrl: 'http://localhost:3000/api',
    enabled: true,
    handlers: ['farming', 'processing', 'logistics', 'sales'],
    dataSet: 'minimal',
    delay: [0, 50],
    onUnhandledRequest: 'error'
  },
  production: {
    name: 'production',
    baseUrl: 'https://api.heiniu.com',
    enabled: false,  // 生产环境强制禁用Mock
    handlers: [],
    dataSet: 'none',
    delay: [0, 0],
    onUnhandledRequest: 'bypass'
  }
}

/**
 * 智能启停控制中间件
 */
export const mockMiddleware = {
  shouldMock: (): boolean => {
    const env = process.env.NODE_ENV || 'development'
    const config = environments[env]

    // 生产环境强制禁用
    if (env === 'production') return false

    // 混合API模式：检查MSW是否启用
    const mswEnabled = process.env.NEXT_PUBLIC_MSW_ENABLED !== 'false'

    return config.enabled && mswEnabled
  },

  getHandlers: (env: string = process.env.NODE_ENV || 'development'): string[] => {
    return environments[env]?.handlers || []
  },

  getConfig: (env: string = process.env.NODE_ENV || 'development'): MockEnvironment => {
    return environments[env] || environments.development
  }
}

/**
 * 获取当前环境的Mock配置
 */
export const getCurrentMockConfig = (): MockEnvironment => {
  const env = process.env.NODE_ENV || 'development'
  return environments[env] || environments.development
}

/**
 * 检查特定模块是否在当前环境中启用
 */
export const isModuleEnabled = (module: string): boolean => {
  const config = getCurrentMockConfig()
  return config.handlers.includes(module)
}

// 导出环境配置供其他模块使用
export { environments as mockEnvironments }
export default environments
