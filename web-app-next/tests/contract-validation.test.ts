/**
 * 契约验证测试 - TASK-P3-018B-PATCH修复验证
 *
 * 验证目标：
 * P0-1: 响应包格式统一 {code, message, data, success}
 * P0-2: 业务API补齐 /api/products, /api/trace/{id}
 * P1: 数据模型字段对齐
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { mockServerControls } from '../src/mocks/node-server'
import type { AppResponse } from '../src/types/api-response'

// 配置测试环境的base URL
const BASE_URL = 'http://localhost:3000'

beforeAll(async () => {
  const started = mockServerControls.start({
    quiet: true,
    onUnhandledRequest: 'warn'
  })
  if (!started) {
    throw new Error('Failed to start mock server for testing')
  }
})

afterAll(async () => {
  mockServerControls.stop()
})

describe('P0-1: 响应格式统一性验证', () => {
  it('登录API应返回统一AppResponse格式', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json() as AppResponse

    // 验证统一响应格式
    expect(data).toHaveProperty('code')
    expect(data).toHaveProperty('message')
    expect(data).toHaveProperty('data')
    expect(data).toHaveProperty('success')

    // 验证字段类型
    expect(typeof data.code).toBe('number')
    expect(typeof data.message).toBe('string')
    expect(typeof data.success).toBe('boolean')

    // 验证成功状态
    expect(data.success).toBe(true)
    expect(data.code).toBe(200)

    // 验证登录数据结构
    expect(data.data).toHaveProperty('user')
    expect(data.data).toHaveProperty('token')
    expect(data.data.user).toHaveProperty('username')
    expect(data.data.user.username).toBe('admin')

    console.log(`✅ Login API: 响应格式验证通过`, {
      code: data.code,
      success: data.success,
      message: data.message
    })
  })
})

describe('P0-2: 业务API可用性验证', () => {
  it('GET /api/products 应返回产品列表', async () => {
    const response = await fetch(`${BASE_URL}/api/products`)

    expect(response.status).toBe(200)

    const data = await response.json() as AppResponse
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('products')
    expect(Array.isArray(data.data.products)).toBe(true)
    expect(data.data).toHaveProperty('pagination')

    console.log(`✅ Products API: 返回 ${data.data.products.length} 个产品`)
  })

  it('GET /api/trace/trace_001 应返回溯源信息', async () => {
    const response = await fetch(`${BASE_URL}/api/trace/trace_001`)

    expect(response.status).toBe(200)

    const data = await response.json() as AppResponse
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('id')
    expect(data.data.id).toBe('trace_001')

    console.log(`✅ Trace API: 获取溯源信息成功`)
  })
})
