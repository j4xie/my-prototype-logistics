// Test Setup Configuration
import '@testing-library/jest-dom'
// 引入Mock类型声明
import type { MockImageProps, MockRouter } from './types/mock-types'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Next.js image - 使用类型声明解决Jest Mock Factory类型问题
jest.mock('next/image', () => {
  return {
    __esModule: true,
    default: function MockImage(props: MockImageProps) {
      // 使用require()解决Jest作用域限制，避免外部变量引用
      const React = require('react');
      return React.createElement('img', props);
    },
  };
})

// Mock environment variables
process.env.NEXT_PUBLIC_APP_NAME = '食品溯源系统'
process.env.NEXT_PUBLIC_APP_VERSION = '3.0.0'
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/api'

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia - 只在window对象存在时设置 (浏览器环境)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock localStorage - 环境感知
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
}

// 只在浏览器环境设置window.localStorage
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })
} else {
  // Node环境下设置全局localStorage
  global.localStorage = localStorageMock
}

// Mock sessionStorage - 环境感知
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  })
} else {
  // Node环境下设置全局sessionStorage
  global.sessionStorage = sessionStorageMock
}

// Suppress console errors in tests only for specific warnings
const originalError = console.error
beforeAll(() => {
  console.error = function(...args: any[]) {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('[HttpClient]') ||
       args[0].includes('[OperationExecutor]') ||
       args[0].includes('[ErrorHandler]'))
    ) {
      return
    }
    originalError.apply(console, args)
  }

      // 🔐 全局fetch认证头注入 - 正确处理Request对象
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    // 统一处理 URL 字符串 or 已有 Request 两种情况
    const req = typeof input === 'string' || input instanceof URL
      ? new Request(input, init)
      : input as Request  // 已是 Request 对象

    // 复制原 headers 再注入认证头
    const headers = new Headers(req.headers)

    if (!headers.has('Authorization')) {
      // 生成符合validateMockJWT格式的mock token
      const mockPayload = {
        sub: 'user_001',
        username: 'admin',
        role: 'admin',
        permissions: ['users:read', 'users:write', 'farming:read', 'farming:write', 'processing:read', 'processing:write', 'logistics:read', 'logistics:write', 'admin:read', 'admin:write', 'trace:read', 'trace:write'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时过期
        iss: 'heiniu-mock-api'
      }

      // Mock JWT格式 - 使用Buffer确保编码正确
      const headerStr = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
      const payloadBase64 = Buffer.from(JSON.stringify(mockPayload)).toString('base64')
      const signature = 'mock-signature-test'

      const mockToken = `${headerStr}.${payloadBase64}.${signature}`
      headers.set('Authorization', `Bearer ${mockToken}`)

      // 调试日志
      console.log(`🔐 Test Setup: Added auth header to ${req.url}`)
    }

    // 创建新的Request对象，包含正确的headers
    const newRequest = new Request(req, { headers })

    return originalFetch(newRequest)
  }) as typeof fetch
})

afterAll(() => {
  console.error = originalError
})

// MSW相关polyfills现在由jest-environment-msw.js处理
// 这里只保留非MSW相关的测试设置
console.log('📋 Test setup: Using MSW Jest Environment for Web API polyfills')

// 🌐 全局URL修剪：解决MSW绝对URL匹配问题
const originalFetchGlobal = global.fetch as any
global.fetch = (input: any, init: any = {}) => {
  // 修剪绝对URL为相对路径，让MSW能正确匹配handler
  if (typeof input === 'string' && input.startsWith('https://api.test.example')) {
    input = input.replace('https://api.test.example', '')
    console.log(`🔧 URL trimmed: ${input}`)
  }
  return originalFetchGlobal(input, init)
}
