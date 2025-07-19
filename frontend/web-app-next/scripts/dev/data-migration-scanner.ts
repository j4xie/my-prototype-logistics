#!/usr/bin/env tsx
/**
 * Day 6: 分散Mock数据扫描和迁移工具
 * 扫描项目中所有分散的Mock数据并迁移到中央服务
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

interface MockDataSource {
  file: string
  type: 'api-route' | 'component' | 'service' | 'test'
  lines: Array<{
    lineNumber: number
    content: string
    mockData?: any
  }>
  migrationRequired: boolean
  priority: 'high' | 'medium' | 'low'
}

interface ScanResult {
  totalFiles: number
  mockSources: MockDataSource[]
  summary: {
    apiRoutes: number
    components: number
    services: number
    tests: number
    highPriority: number
  }
}

/**
 * 扫描项目中的分散Mock数据
 */
async function scanMockData(): Promise<ScanResult> {
  console.log('\n🔍 开始扫描分散的Mock数据源...')

  const patterns = [
    'src/app/api/**/*.{ts,tsx}',    // App Router API routes
    'src/lib/**/*.{ts,tsx}',        // 库文件
    'src/components/**/*.{ts,tsx}', // 组件
    'src/services/**/*.{ts,tsx}',   // 服务层
    'scripts/**/*.{ts,js}',         // 脚本文件
    '!src/mocks/**/*',              // 排除已有的Mock系统
    '!**/*.test.*',                 // 暂时排除测试文件
    '!**/node_modules/**'
  ]

  const files = await glob(patterns, { cwd: process.cwd() })
  const mockSources: MockDataSource[] = []

  console.log(`📁 扫描 ${files.length} 个文件...`)

  for (const file of files) {
    const fullPath = path.resolve(file)
    if (!fs.existsSync(fullPath)) continue

    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    const mockLines: MockDataSource['lines'] = []
    let hasMockData = false

    // 扫描Mock相关模式
    const mockPatterns = [
      /mock.*data|mockData/i,
      /generateMock/i,
      /MOCK_/,
      /mock.*delay|mockDelay/i,
      /mock.*response|mockResponse/i,
      /fake.*data|fakeData/i
    ]

    lines.forEach((line, index) => {
      if (mockPatterns.some(pattern => pattern.test(line))) {
        mockLines.push({
          lineNumber: index + 1,
          content: line.trim()
        })
        hasMockData = true
      }
    })

    if (hasMockData) {
      const source: MockDataSource = {
        file,
        type: determineFileType(file),
        lines: mockLines,
        migrationRequired: shouldMigrate(file, mockLines),
        priority: determinePriority(file, mockLines)
      }

      mockSources.push(source)
    }
  }

  // 生成统计
  const summary = {
    apiRoutes: mockSources.filter(s => s.type === 'api-route').length,
    components: mockSources.filter(s => s.type === 'component').length,
    services: mockSources.filter(s => s.type === 'service').length,
    tests: mockSources.filter(s => s.type === 'test').length,
    highPriority: mockSources.filter(s => s.priority === 'high').length
  }

  return {
    totalFiles: files.length,
    mockSources,
    summary
  }
}

/**
 * 确定文件类型
 */
function determineFileType(file: string): MockDataSource['type'] {
  if (file.includes('/app/api/')) return 'api-route'
  if (file.includes('/components/')) return 'component'
  if (file.includes('/lib/') || file.includes('/services/')) return 'service'
  if (file.includes('.test.') || file.includes('/tests/')) return 'test'
  return 'service' // 默认
}

/**
 * 判断是否需要迁移
 */
function shouldMigrate(file: string, lines: MockDataSource['lines']): boolean {
  // App Router API routes 需要迁移到MSW
  if (file.includes('/app/api/')) return true

  // 包含具体Mock数据定义的需要迁移
  const hasDataDefinition = lines.some(line =>
    line.content.includes('generateMock') ||
    line.content.includes('mockData = {') ||
    line.content.includes('const mock')
  )

  return hasDataDefinition
}

/**
 * 确定迁移优先级
 */
function determinePriority(file: string, lines: MockDataSource['lines']): MockDataSource['priority'] {
  // App Router API routes 是高优先级
  if (file.includes('/app/api/')) return 'high'

  // 有多处Mock数据的文件是中优先级
  if (lines.length > 3) return 'medium'

  return 'low'
}

/**
 * 生成迁移计划
 */
function generateMigrationPlan(scanResult: ScanResult): void {
  console.log('\n📋 迁移计划生成')
  console.log('=' .repeat(50))

  const highPriorityFiles = scanResult.mockSources.filter(s => s.priority === 'high')
  const mediumPriorityFiles = scanResult.mockSources.filter(s => s.priority === 'medium')

  console.log('\n🚨 高优先级迁移 (需要立即处理):')
  highPriorityFiles.forEach(source => {
    console.log(`  📄 ${source.file} (${source.type})`)
    console.log(`     - ${source.lines.length} 处Mock引用`)
    console.log(`     - 迁移目标: MSW Handler`)
  })

  console.log('\n⚠️ 中优先级迁移 (下一阶段处理):')
  mediumPriorityFiles.forEach(source => {
    console.log(`  📄 ${source.file} (${source.type})`)
    console.log(`     - ${source.lines.length} 处Mock引用`)
  })

  // 生成迁移步骤
  console.log('\n📋 迁移步骤建议:')
  console.log('  1. App Router API routes → MSW Handlers (立即)')
  console.log('  2. 更新环境变量和配置引用')
  console.log('  3. 清理分散的Mock函数和数据')
  console.log('  4. 更新文档和使用指南')
}

/**
 * 显示扫描结果
 */
function displayResults(scanResult: ScanResult): void {
  console.log('\n📊 Mock数据扫描结果')
  console.log('=' .repeat(50))
  console.log(`总扫描文件: ${scanResult.totalFiles}`)
  console.log(`发现Mock源: ${scanResult.mockSources.length}`)
  console.log('')
  console.log('按类型分布:')
  console.log(`  API路由: ${scanResult.summary.apiRoutes}`)
  console.log(`  组件: ${scanResult.summary.components}`)
  console.log(`  服务层: ${scanResult.summary.services}`)
  console.log(`  测试: ${scanResult.summary.tests}`)
  console.log('')
  console.log(`高优先级迁移: ${scanResult.summary.highPriority} 个`)

  // 详细列表
  console.log('\n📄 详细文件列表:')
  scanResult.mockSources.forEach(source => {
    const priority = source.priority === 'high' ? '🚨' :
                    source.priority === 'medium' ? '⚠️' : '📋'
    console.log(`${priority} ${source.file}`)
    console.log(`   类型: ${source.type}, 行数: ${source.lines.length}, 迁移: ${source.migrationRequired ? '是' : '否'}`)

    // 显示部分Mock内容
    const sampleLines = source.lines.slice(0, 2)
    sampleLines.forEach(line => {
      console.log(`   ${line.lineNumber}: ${line.content.slice(0, 60)}${line.content.length > 60 ? '...' : ''}`)
    })
  })
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('\n🛠️ Mock数据迁移扫描工具 (Day 6)')
    console.log('=' .repeat(50))

    const scanResult = await scanMockData()

    displayResults(scanResult)
    generateMigrationPlan(scanResult)

    console.log('\n✅ 扫描完成')
    console.log('=' .repeat(50))

  } catch (error) {
    console.error('\n❌ 扫描失败:', error)
    process.exit(1)
  }
}

// 执行扫描
main()
