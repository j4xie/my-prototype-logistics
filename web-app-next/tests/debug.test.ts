/**
 * MSW调试测试 - 查看实际响应内容
 */

import { mockServerControls } from '../src/mocks/node-server'

describe('MSW调试测试', () => {
  beforeAll(() => {
    const started = mockServerControls.start({
      quiet: false,
      onUnhandledRequest: 'warn'
    })

    if (!started) {
      throw new Error('Failed to start MSW server for debugging')
    }
  })

  afterAll(() => {
    mockServerControls.stop()
  })

  test('调试API响应详情', async () => {
    console.log('=== 开始调试测试 ===')

    // 测试users API
    const response = await fetch('/api/users')

    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    const text = await response.text()
    console.log('Response body (text):', text)

    // 尝试解析为JSON
    try {
      const data = JSON.parse(text)
      console.log('Response body (JSON):', data)
    } catch (error) {
      console.log('Failed to parse as JSON:', error instanceof Error ? error.message : String(error))
    }

    // 基础断言确保测试不为空
    expect(response).toBeDefined()
  })
})
