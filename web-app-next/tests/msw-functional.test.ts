/**
 * MSW Functional Test - Node端功能验证
 * 验证MSW在Jest环境下的真实网络拦截功能
 */

import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'

// MSW应该拦截所有网络请求，不需要实际的服务器
// 使用配置的API基础URL或默认值
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'

// 直接创建MSW服务器，不依赖mockServerControls
const server = setupServer(...handlers)

describe('MSW Node端功能测试', () => {
  beforeAll(() => {
    // 直接启动MSW服务器
    server.listen({
      onUnhandledRequest: 'warn'
    })
    console.log('🚀 MSW server started for functional tests')
  })

  afterEach(() => {
    // 每个测试后重置handlers
    server.resetHandlers()
  })

  afterAll(() => {
    // 停止MSW服务器
    server.close()
    console.log('🛑 MSW server stopped')
  })

  test('网络拦截功能验证 - fetch请求', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/status`)

    expect(response.status).toBe(200)
    const data = await response.json() as any
    console.log('🔍 Auth Status Response:', JSON.stringify(data, null, 2))
    expect(data.data).toHaveProperty('authenticated')
  })

  test('API响应格式验证', async () => {
    const response = await fetch(`${API_BASE_URL}/users`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')

    const data = await response.json() as any
    expect(Array.isArray(data.data.users)).toBe(true)
  })

  test('POST请求处理', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json() as any
    expect(data).toMatchObject({
      success: true,
      data: expect.objectContaining({
        user: expect.objectContaining({
          username: 'admin'
        }),
        token: expect.any(String)
      })
    })
  })

  test('错误处理验证', async () => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'wrongpassword'
      })
    })

    expect(response.status).toBe(401)
    const data = await response.json() as any
    expect(data).toMatchObject({
      success: false,
      message: expect.any(String)
    })
  })

  test('HTTP方法支持验证', async () => {
    // GET请求
    const getResponse = await fetch(`${API_BASE_URL}/users`)
    expect(getResponse.status).toBe(200)

    // POST请求
    const postResponse = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '测试产品',
        category: '农产品',
        price: 25.80,
        unit: '公斤',
        stock: 100,
        description: '测试用产品',
        origin: '测试农场'
      })
    })
    expect(postResponse.status).toBe(201)
  })

  test('URL参数处理', async () => {
    const response = await fetch(`${API_BASE_URL}/trace/12345`)

    expect(response.status).toBe(200)
    const data = await response.json() as any
    expect(data.data.id).toBe('12345') // 修正: traceId在data对象中作为id字段
  })

  test('请求头处理', async () => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TestAgent/1.0'
      }
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  describe('环境变量和配置', () => {
    test('环境变量正确设置', () => {
      expect(process.env.NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:3001/api')
    })

    test('Mock服务器状态检查', () => {
      // 检查handlers数量
      expect(handlers.length).toBeGreaterThan(0)
    })
  })

  describe('错误边界测试', () => {
    test('不存在的API端点', async () => {
      const response = await fetch(`${API_BASE_URL}/nonexistent`)
      expect(response.status).toBe(404)
    })

    test('无效的JSON数据', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    test('不支持的HTTP方法', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'DELETE'
      })

      expect(response.status).toBe(405)
    })
  })

  describe('性能和延迟', () => {
    test('响应时间测试', async () => {
      const startTime = Date.now()
      const response = await fetch(`${API_BASE_URL}/auth/status`)
      const endTime = Date.now()

      expect(response.status).toBe(200)

      const duration = endTime - startTime
      // 基本的响应时间检查（应该很快，但要留一些余量）
      expect(duration).toBeLessThan(1000) // 1秒内响应
    })
  })

  // 验证MSW Jest环境是否正确提供polyfills
  test('Web APIs可用性检查', () => {
    expect(typeof fetch).toBe('function')
    expect(typeof Response).toBe('function')
    expect(typeof TextEncoder).toBe('function')
    expect(typeof ReadableStream).toBe('function')

    console.log('✅ Web APIs正常工作')
  })
})
