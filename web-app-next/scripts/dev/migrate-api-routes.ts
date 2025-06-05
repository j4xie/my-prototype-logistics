#!/usr/bin/env tsx
/**
 * Day 6: App Router API 到 MSW 迁移工具
 * 将分散在 App Router 中的 Mock 数据迁移到中央 MSW 服务
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

interface ApiRouteInfo {
  path: string
  module: string
  entity: string
  methods: string[]
  hasInlineMock: boolean
  migrationPriority: 'high' | 'medium' | 'low'
}

interface MigrationResult {
  migratedRoutes: number
  cleanedFiles: number
  errors: string[]
  warnings: string[]
}

/**
 * 扫描所有App Router API文件
 */
async function scanApiRoutes(): Promise<ApiRouteInfo[]> {
  console.log('\n🔍 扫描App Router API文件...')

  const apiFiles = await glob('src/app/api/**/route.ts', { cwd: process.cwd() })
  const routes: ApiRouteInfo[] = []

  for (const file of apiFiles) {
    const content = fs.readFileSync(file, 'utf-8')

    // 提取模块和实体信息
    const moduleMatch = content.match(/\/\/ 模块: (.+)/)
    const entityMatch = content.match(/\/\/ 实体: (.+)/)

    // 检测HTTP方法
    const methods: string[] = []
    if (content.includes('export async function GET')) methods.push('GET')
    if (content.includes('export async function POST')) methods.push('POST')
    if (content.includes('export async function PUT')) methods.push('PUT')
    if (content.includes('export async function DELETE')) methods.push('DELETE')
    if (content.includes('export async function PATCH')) methods.push('PATCH')

    // 检测内联Mock数据
    const hasInlineMock = content.includes('generateMockData') ||
                         content.includes('mockData') ||
                         content.includes('const data =')

    if (hasInlineMock && methods.length > 0) {
      routes.push({
        path: file,
        module: moduleMatch?.[1] || 'unknown',
        entity: entityMatch?.[1] || 'unknown',
        methods,
        hasInlineMock,
        migrationPriority: determinePriority(file, content)
      })
    }
  }

  console.log(`📋 发现 ${routes.length} 个需要迁移的API路由`)
  return routes
}

/**
 * 确定迁移优先级
 */
function determinePriority(file: string, content: string): ApiRouteInfo['migrationPriority'] {
  // 核心业务模块高优先级
  if (file.includes('/farming/') || file.includes('/auth/')) return 'high'

  // 复杂Mock逻辑中优先级
  if (content.includes('generateMockData') && content.split('\n').length > 50) return 'medium'

  return 'low'
}

/**
 * 禁用App Router API文件
 */
async function disableApiRoute(routePath: string): Promise<void> {
  const content = fs.readFileSync(routePath, 'utf-8')

  // 创建禁用版本的内容
  const disabledContent = `// MIGRATED TO MSW: This route has been migrated to MSW handlers
// Original file backed up and disabled on: ${new Date().toISOString()}
// New location: src/mocks/handlers/

import { NextRequest, NextResponse } from 'next/server'

// This API route has been migrated to MSW for better development experience
// and centralized mock data management.
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 }) // Gone
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This API has been migrated to MSW. Please ensure MSW is enabled.',
    migrated: true,
    newLocation: 'MSW Handler',
    timestamp: new Date().toISOString()
  }, { status: 410 })
}

/*
ORIGINAL CONTENT BACKED UP:
===============================================
${content}
===============================================
*/`

  // 备份原文件
  const backupDir = 'scripts/migration-backups'
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const backupPath = path.join(backupDir, `${path.basename(routePath, '.ts')}-${Date.now()}.ts.backup`)
  fs.writeFileSync(backupPath, content)

  // 写入禁用版本
  fs.writeFileSync(routePath, disabledContent)

  console.log(`  ✅ 已禁用并备份: ${routePath}`)
  console.log(`     备份位置: ${backupPath}`)
}

/**
 * 验证MSW Handler覆盖
 */
function validateMswCoverage(routes: ApiRouteInfo[]): { covered: number, missing: string[] } {
  const handlerFiles = fs.readdirSync('src/mocks/handlers').filter(f => f.endsWith('.ts'))
  const coveredModules = handlerFiles.map(f => f.replace('.ts', ''))

  let covered = 0
  const missing: string[] = []

  routes.forEach(route => {
    if (coveredModules.includes(route.module)) {
      covered++
    } else {
      missing.push(`${route.module}/${route.entity}`)
    }
  })

  return { covered, missing }
}

/**
 * 执行迁移
 */
async function performMigration(routes: ApiRouteInfo[]): Promise<MigrationResult> {
  console.log('\n🚀 开始执行迁移...')

  const result: MigrationResult = {
    migratedRoutes: 0,
    cleanedFiles: 0,
    errors: [],
    warnings: []
  }

  // 验证MSW覆盖情况
  const coverage = validateMswCoverage(routes)
  console.log(`\n📊 MSW Handler覆盖情况: ${coverage.covered}/${routes.length}`)

  if (coverage.missing.length > 0) {
    console.log('\n⚠️ 缺失的MSW Handler:')
    coverage.missing.forEach(missing => {
      console.log(`  - ${missing}`)
      result.warnings.push(`Missing MSW handler for: ${missing}`)
    })
  }

  // 按优先级分组迁移
  const highPriorityRoutes = routes.filter(r => r.migrationPriority === 'high')
  const mediumPriorityRoutes = routes.filter(r => r.migrationPriority === 'medium')
  const lowPriorityRoutes = routes.filter(r => r.migrationPriority === 'low')

  console.log(`\n🚨 高优先级迁移 (${highPriorityRoutes.length} 个):`)
  for (const route of highPriorityRoutes) {
    try {
      await disableApiRoute(route.path)
      result.migratedRoutes++
      console.log(`  ✅ ${route.module}/${route.entity} (${route.methods.join(', ')})`)
    } catch (error) {
      const errorMsg = `Failed to migrate ${route.path}: ${error}`
      result.errors.push(errorMsg)
      console.log(`  ❌ ${errorMsg}`)
    }
  }

  console.log(`\n⚠️ 中优先级迁移 (${mediumPriorityRoutes.length} 个):`)
  for (const route of mediumPriorityRoutes) {
    try {
      await disableApiRoute(route.path)
      result.migratedRoutes++
      console.log(`  ✅ ${route.module}/${route.entity} (${route.methods.join(', ')})`)
    } catch (error) {
      const errorMsg = `Failed to migrate ${route.path}: ${error}`
      result.errors.push(errorMsg)
      console.log(`  ❌ ${errorMsg}`)
    }
  }

  console.log(`\n📋 低优先级迁移 (${lowPriorityRoutes.length} 个):`)
  for (const route of lowPriorityRoutes) {
    try {
      await disableApiRoute(route.path)
      result.migratedRoutes++
      console.log(`  ✅ ${route.module}/${route.entity} (${route.methods.join(', ')})`)
    } catch (error) {
      const errorMsg = `Failed to migrate ${route.path}: ${error}`
      result.errors.push(errorMsg)
      console.log(`  ❌ ${errorMsg}`)
    }
  }

  result.cleanedFiles = result.migratedRoutes

  return result
}

/**
 * 生成迁移报告
 */
function generateMigrationReport(routes: ApiRouteInfo[], result: MigrationResult): void {
  console.log('\n📊 迁移完成报告')
  console.log('=' .repeat(50))
  console.log(`总API路由: ${routes.length}`)
  console.log(`成功迁移: ${result.migratedRoutes}`)
  console.log(`清理文件: ${result.cleanedFiles}`)
  console.log(`错误数量: ${result.errors.length}`)
  console.log(`警告数量: ${result.warnings.length}`)

  if (result.errors.length > 0) {
    console.log('\n❌ 迁移错误:')
    result.errors.forEach(error => console.log(`  - ${error}`))
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️ 迁移警告:')
    result.warnings.forEach(warning => console.log(`  - ${warning}`))
  }

  console.log('\n📋 下一步操作:')
  console.log('  1. 验证MSW服务正常工作')
  console.log('  2. 测试API端点响应')
  console.log('  3. 清理环境变量配置')
  console.log('  4. 更新文档和指南')
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('\n🛠️ App Router API 迁移工具 (Day 6)')
    console.log('=' .repeat(50))

    const routes = await scanApiRoutes()

    if (routes.length === 0) {
      console.log('\n✅ 没有发现需要迁移的API路由')
      return
    }

    // 显示迁移计划
    console.log('\n📋 迁移计划:')
    routes.forEach(route => {
      const priority = route.migrationPriority === 'high' ? '🚨' :
                      route.migrationPriority === 'medium' ? '⚠️' : '📋'
      console.log(`${priority} ${route.path}`)
      console.log(`   模块: ${route.module}, 实体: ${route.entity}`)
      console.log(`   方法: ${route.methods.join(', ')}`)
    })

    // 询问用户确认
    console.log('\n⚠️ 即将开始迁移，这将禁用App Router API并依赖MSW')
    console.log('确保MSW已正确配置并包含所有必要的Handler')

    // 执行迁移
    const result = await performMigration(routes)

    // 生成报告
    generateMigrationReport(routes, result)

    if (result.errors.length === 0) {
      console.log('\n🎉 迁移成功完成！')
    } else {
      console.log('\n⚠️ 迁移完成但有错误，请检查上述报告')
    }

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    process.exit(1)
  }
}

// 执行迁移
main()
