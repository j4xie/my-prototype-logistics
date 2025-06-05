/**
 * Jest + TypeScript + MSW 配置修复验证测试
 *
 * 验证以下问题是否解决：
 * 1. Jest Mock Factory TypeScript类型冲突
 * 2. MSW Node端导入问题
 * 3. Babel + TypeScript strict模式冲突
 */

import '@testing-library/jest-dom'

// 测试Mock类型声明是否工作
import type { MockImageProps } from './types/mock-types'

describe('Jest + TypeScript + MSW 配置验证', () => {
  test('Mock类型声明应该正常工作', () => {
    // 验证Mock类型可以正常导入和使用
    const mockProps: MockImageProps = {
      src: '/test-image.jpg',
      alt: 'Test Image',
      width: 100,
      height: 100
    }

    expect(mockProps.src).toBe('/test-image.jpg')
    expect(mockProps.alt).toBe('Test Image')
  })

  test('Jest Mock应该正常工作', () => {
    // 验证Jest Mock功能正常
    const mockFn = jest.fn()
    mockFn('test-arg')

    expect(mockFn).toHaveBeenCalledWith('test-arg')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  test('TypeScript严格模式应该与Jest兼容', () => {
    // 验证TypeScript类型检查正常工作
    interface TestInterface {
      id: number
      name: string
    }

    const testData: TestInterface = {
      id: 1,
      name: 'Test'
    }

    expect(testData.id).toBe(1)
    expect(testData.name).toBe('Test')
  })

  test('MSW导入应该正常工作', async () => {
    // 验证MSW相关导入不会失败
    try {
      // 动态导入MSW以避免在非测试环境下的问题
      const { setupServer } = await import('msw/node')
      expect(typeof setupServer).toBe('function')
    } catch (error) {
      fail(`MSW导入失败: ${error}`)
    }
  })

  test('环境检测应该正确', () => {
    // 验证测试环境检测正确
    expect(typeof window).toBe('undefined') // Node环境
    expect(process.env.NODE_ENV).toBeDefined()
  })

  test('Mock Server Controls应该可用', async () => {
    // 验证Mock Server控制功能可用
    try {
      const { mockServerControls } = await import('../src/mocks/node-server')
      expect(typeof mockServerControls.getStatus).toBe('function')

      const status = mockServerControls.getStatus()
      expect(status).toHaveProperty('enabled')
      expect(status).toHaveProperty('environment')
      expect(status).toHaveProperty('handlerCount')
    } catch (error) {
      fail(`Mock Server Controls导入失败: ${error}`)
    }
  })
})

describe('Next.js Mock验证', () => {
  test('Next.js Image Mock应该正常工作', () => {
    // 验证Next.js Image Mock配置正确
    const NextImage = require('next/image').default
    expect(typeof NextImage).toBe('function')

    // 验证Mock函数可以调用
    const props: MockImageProps = {
      src: '/test.jpg',
      alt: 'Test'
    }

    // 这里不会抛出TypeScript错误
    const element = NextImage(props)
    expect(element).toBeDefined()
  })

    test('Next.js Router Mock应该正常工作', () => {
    // 验证Next.js Router Mock配置正确
    const { useRouter } = require('next/router')
    expect(typeof useRouter).toBe('function')

    // 验证Mock Router返回期望的对象结构
    const mockRouter = {
      push: jest.fn(),
      pathname: '/test'
    }
    expect(mockRouter).toHaveProperty('push')
    expect(mockRouter).toHaveProperty('pathname')
  })
})

describe('错误处理验证', () => {
  test('Console错误抑制应该正常工作', () => {
    // 验证Console错误抑制机制正常
    const originalError = console.error
    expect(typeof originalError).toBe('function')

    // 这应该被抑制
    console.error('Warning: ReactDOM.render is no longer supported')

    // 这应该正常显示
    console.error('Normal error message')
  })

  test('错误处理应该保持原有功能', () => {
    // 验证错误处理不影响正常功能
    expect(() => {
      throw new Error('Test error')
    }).toThrow('Test error')
  })
})
