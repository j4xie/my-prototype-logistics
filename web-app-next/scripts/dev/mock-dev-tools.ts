#!/usr/bin/env tsx
/**
 * Mock API开发工具
 * Day 2: 开发工具链集成
 *
 * 用法:
 * - npm run mock:dev -- --status     # 查看Mock状态
 * - npm run mock:dev -- --enable     # 启用Mock
 * - npm run mock:dev -- --disable    # 禁用Mock
 * - npm run mock:dev -- --handlers   # 列出所有handlers
 * - npm run mock:dev -- --validate   # 验证Schema
 */

import { handlers } from '../../src/mocks/handlers'
import { getCurrentMockConfig, mockMiddleware } from '../../src/mocks/config/environments'
import { getCurrentSchemaVersion } from '../../src/mocks/config/middleware'
import { getVersionManagementStatus, VersionManagementDevTools } from '../../src/mocks/setup-version-management'
import { getSchemaStats } from '../../src/mocks/data/schemas'

/**
 * 显示Mock服务状态 (Day 5更新: 集成版本管理系统)
 */
function showMockStatus() {
  const config = getCurrentMockConfig()
  const isEnabled = mockMiddleware.shouldMock()
  const versionStatus = getVersionManagementStatus()
  const schemaStats = getSchemaStats()

  console.log('\n🔍 Mock API Status Report')
  console.log('=' .repeat(50))
  console.log(`Environment: ${config.name}`)
  console.log(`Status: ${isEnabled ? '✅ ENABLED' : '❌ DISABLED'}`)
  console.log(`Base URL: ${config.baseUrl}`)
  console.log(`Schema Version: ${getCurrentSchemaVersion()}`)
  console.log(`Data Set: ${config.dataSet}`)
  console.log(`Network Delay: ${config.delay[0]}-${config.delay[1]}ms`)
  console.log(`Handlers Count: ${handlers.length}`)
  console.log(`Active Modules: ${config.handlers.join(', ')}`)

  // Day 5新增：版本管理状态
  console.log('\n📊 Version Management Status (Day 5)')
  console.log('-' .repeat(30))
  console.log(`System Health: ${versionStatus.systemHealth === 'healthy' ? '✅' : versionStatus.systemHealth === 'warning' ? '⚠️' : '❌'} ${versionStatus.systemHealth.toUpperCase()}`)
  console.log(`Current Version: ${versionStatus.currentVersion}`)
  console.log(`Initialized: ${versionStatus.isInitialized ? '✅ Yes' : '❌ No'}`)
  console.log(`Total Schemas: ${schemaStats.totalSchemas}`)
  console.log(`Frozen Versions: ${schemaStats.frozenVersions}`)
  console.log(`Available Versions: ${schemaStats.availableVersions.join(', ')}`)
  console.log(`Total Migrations: ${versionStatus.details.totalMigrations}`)
  console.log(`Checkpoints: ${versionStatus.details.checkpoints}`)

  if (versionStatus.issues && versionStatus.issues.length > 0) {
    console.log('\n⚠️ Version Management Issues:')
    versionStatus.issues.forEach(issue => console.log(`  - ${issue}`))
  }

  console.log('=' .repeat(50))
}

/**
 * 列出所有handlers
 */
function listHandlers() {
  console.log('\n📋 Registered Handlers')
  console.log('=' .repeat(50))

  // 按模块分组显示 (Day 4更新: 反映完整Handler实现)
  const moduleGroups = {
    auth: [
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'GET /api/auth/status',
      'POST /api/auth/verify',
      'POST /api/auth/refresh'
    ],
    users: [
      'GET /api/users',
      'GET /api/users/:id',
      'POST /api/users',
      'PUT /api/users/:id',
      'DELETE /api/users/:id',
      'GET /api/users/profile',
      'PUT /api/users/profile',
      'GET /api/users/stats'
    ],
    farming: [
      'GET /api/farming/overview',
      'GET /api/farming/fields',
      'GET /api/farming/fields/:id',
      'GET /api/farming/crops',
      'GET /api/farming/crops/:id',
      'GET /api/farming/plans',
      'GET /api/farming/activities',
      'GET /api/farming/harvests'
    ],
    processing: [
      'GET /api/processing/overview',
      'GET /api/processing/raw-materials',
      'GET /api/processing/raw-materials/:id',
      'GET /api/processing/batches',
      'GET /api/processing/quality-tests',
      'GET /api/processing/quality-tests/:id',
      'GET /api/processing/finished-products',
      'GET /api/processing/finished-products/:id'
    ],
    logistics: [
      'GET /api/logistics/overview',
      'GET /api/logistics/warehouses',
      'GET /api/logistics/warehouses/:id',
      'GET /api/logistics/transport-orders',
      'GET /api/logistics/transport-orders/:id',
      'GET /api/logistics/vehicles',
      'GET /api/logistics/vehicles/:id',
      'GET /api/logistics/drivers',
      'GET /api/logistics/drivers/:id'
    ],
    admin: [
      'GET /api/admin/overview',
      'GET /api/admin/configs',
      'GET /api/admin/configs/:id',
      'GET /api/admin/roles',
      'GET /api/admin/permissions',
      'GET /api/admin/audit-logs',
      'GET /api/admin/monitoring',
      'GET /api/admin/reports/stats'
    ],
    trace: ['GET /api/trace/:id']
  }

  Object.entries(moduleGroups).forEach(([module, apis]) => {
    console.log(`\n${module.toUpperCase()} Module:`)
    apis.forEach(api => console.log(`  - ${api}`))
  })

  console.log(`\nTotal: ${Object.values(moduleGroups).flat().length} API endpoints`)
  console.log('=' .repeat(50))
}

/**
 * 验证Mock配置
 */
function validateMockConfig() {
  console.log('\n🔧 Mock Configuration Validation')
  console.log('=' .repeat(50))

  const config = getCurrentMockConfig()
  const issues: string[] = []

  // 检查基本配置
  if (!config.baseUrl) issues.push('❌ Missing baseUrl')
  if (config.handlers.length === 0) issues.push('❌ No handlers enabled')
  if (config.delay[0] > config.delay[1]) issues.push('❌ Invalid delay range')

  // 检查handlers覆盖率
  const availableModules = ['auth', 'users', 'farming', 'processing', 'logistics', 'admin', 'trace']
  const missingModules = availableModules.filter(m => !config.handlers.includes(m))

  if (missingModules.length > 0) {
    issues.push(`⚠️ Missing modules: ${missingModules.join(', ')}`)
  }

  // 显示结果
  if (issues.length === 0) {
    console.log('✅ Configuration is valid')
    console.log('✅ All handlers are properly configured')
    console.log('✅ Environment settings are correct')
  } else {
    console.log('Issues found:')
    issues.forEach(issue => console.log(`  ${issue}`))
  }

  console.log('=' .repeat(50))
}

/**
 * 切换Mock状态
 */
function toggleMockStatus(enable: boolean) {
  const action = enable ? 'ENABLE' : 'DISABLE'
  console.log(`\n🔄 ${action} Mock API`)
  console.log('=' .repeat(50))

  if (enable) {
    console.log('To enable Mock API, set environment variable:')
    console.log('NEXT_PUBLIC_MOCK_ENABLED=true')
    console.log('\nOr run: npm run dev:mock')
  } else {
    console.log('To disable Mock API, set environment variable:')
    console.log('NEXT_PUBLIC_MOCK_ENABLED=false')
    console.log('\nOr run: npm run dev:real')
  }

  console.log('=' .repeat(50))
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.length === 0) {
    console.log('\n🛠️ Mock API Development Tools (Day 5 Enhanced)')
    console.log('=' .repeat(50))
    console.log('Available commands:')
    console.log('  --status     Show Mock service status (includes version management)')
    console.log('  --handlers   List all registered handlers')
    console.log('  --validate   Validate Mock configuration')
    console.log('  --enable     Show instructions to enable Mock')
    console.log('  --disable    Show instructions to disable Mock')
    console.log('  --versions   Show version management details (Day 5)')
    console.log('  --migration  Test data migration between versions (Day 5)')
    console.log('  --health     Run version management health check (Day 5)')
    console.log('  --help       Show this help message')
    console.log('=' .repeat(50))
    return
  }

  if (args.includes('--status')) {
    showMockStatus()
  }

  if (args.includes('--handlers')) {
    listHandlers()
  }

  if (args.includes('--validate')) {
    validateMockConfig()
  }

  if (args.includes('--enable')) {
    toggleMockStatus(true)
  }

  if (args.includes('--disable')) {
    toggleMockStatus(false)
  }

  // Day 5新增：版本管理命令
  if (args.includes('--versions')) {
    VersionManagementDevTools.listVersions()
  }

  if (args.includes('--migration')) {
    console.log('\n🔄 Testing Data Migration (Day 5)')
    console.log('=' .repeat(50))
    VersionManagementDevTools.testMigration('1.0.0-baseline', '1.1.0-enhanced')
  }

  if (args.includes('--health')) {
    VersionManagementDevTools.healthCheck()
  }
}

// 运行主函数
if (require.main === module) {
  main()
}

export { showMockStatus, listHandlers, validateMockConfig, toggleMockStatus }
