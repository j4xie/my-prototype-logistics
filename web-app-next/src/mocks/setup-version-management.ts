// src/mocks/setup-version-management.ts
// Mock API版本管理系统初始化
// Day 5实施：版本管理系统集成

import { mockVersionManager } from './data/version-manager'
import { registerAllSchemas } from './data/schemas'
import { registerAllMigrations } from './data/migrations'

/**
 * 初始化版本管理系统
 * 这是Day 5的核心初始化入口
 */
export async function initializeVersionManagement(): Promise<{
  success: boolean
  version: string
  schemas: number
  migrations: number
  errors?: string[]
}> {
  console.log('[VersionManagement] 开始初始化版本管理系统...')

  const errors: string[] = []

  try {
    // Step 1: 注册所有Schema版本
    console.log('[VersionManagement] Step 1: 注册Schema版本...')
    registerAllSchemas()

    // Step 2: 注册所有迁移脚本
    console.log('[VersionManagement] Step 2: 注册迁移脚本...')
    registerAllMigrations()

    // Step 3: 验证系统完整性
    console.log('[VersionManagement] Step 3: 验证系统完整性...')
    const integrity = mockVersionManager.validateManagerIntegrity()
    if (!integrity.valid) {
      errors.push(...integrity.issues)
    }

    // Step 4: 获取初始化状态
    const status = mockVersionManager.getManagerStatus()

    console.log('[VersionManagement] 版本管理系统初始化完成')
    console.log(`[VersionManagement] 当前版本: ${status.currentVersion}`)
    console.log(`[VersionManagement] 总版本数: ${status.totalVersions}`)
    console.log(`[VersionManagement] 冻结版本: ${status.frozenVersions}`)
    console.log(`[VersionManagement] 迁移脚本: ${status.totalMigrations}`)

    return {
      success: errors.length === 0,
      version: status.currentVersion,
      schemas: status.totalVersions,
      migrations: status.totalMigrations,
      errors: errors.length > 0 ? errors : undefined
    }

  } catch (error) {
    console.error('[VersionManagement] 初始化失败:', error)
    errors.push(`初始化异常: ${error}`)

    return {
      success: false,
      version: mockVersionManager.getCurrentVersion(),
      schemas: 0,
      migrations: 0,
      errors
    }
  }
}

/**
 * 获取版本管理系统状态
 */
export function getVersionManagementStatus(): {
  isInitialized: boolean
  currentVersion: string
  systemHealth: 'healthy' | 'warning' | 'error'
  details: {
    totalVersions: number
    frozenVersions: number
    totalMigrations: number
    checkpoints: number
  }
  issues?: string[]
} {
  try {
    const status = mockVersionManager.getManagerStatus()
    const integrity = mockVersionManager.validateManagerIntegrity()

    let systemHealth: 'healthy' | 'warning' | 'error' = 'healthy'

    if (!integrity.valid) {
      systemHealth = 'error'
    } else if (status.totalVersions === 0 || status.totalMigrations === 0) {
      systemHealth = 'warning'
    }

    return {
      isInitialized: status.totalVersions > 0,
      currentVersion: status.currentVersion,
      systemHealth,
      details: {
        totalVersions: status.totalVersions,
        frozenVersions: status.frozenVersions,
        totalMigrations: status.totalMigrations,
        checkpoints: status.checkpoints
      },
      issues: integrity.valid ? undefined : integrity.issues
    }
  } catch (error) {
    return {
      isInitialized: false,
      currentVersion: 'unknown',
      systemHealth: 'error',
      details: {
        totalVersions: 0,
        frozenVersions: 0,
        totalMigrations: 0,
        checkpoints: 0
      },
      issues: [`系统状态检查失败: ${error}`]
    }
  }
}

/**
 * 版本管理开发工具
 */
export const VersionManagementDevTools = {
  /**
   * 显示所有可用版本
   */
  listVersions: (): void => {
    console.log('=== 版本管理系统 - 可用版本 ===')
    const versions = mockVersionManager.getVersions()
    const currentVersion = mockVersionManager.getCurrentVersion()

    versions.forEach(version => {
      const metadata = mockVersionManager.getVersionMetadata(version)
      const isCurrent = version === currentVersion
      const marker = isCurrent ? ' <- CURRENT' : ''

      console.log(`${version}${marker}`)
      if (metadata) {
        console.log(`  描述: ${metadata.description}`)
        console.log(`  作者: ${metadata.author}`)
        console.log(`  时间: ${new Date(metadata.timestamp).toLocaleString()}`)
        console.log(`  破坏性变更: ${metadata.breakingChanges ? '是' : '否'}`)
        console.log(`  兼容版本: ${metadata.compatibleVersions.join(', ')}`)
        console.log('---')
      }
    })
  },

  /**
   * 测试数据迁移
   */
  testMigration: (fromVersion: string, toVersion: string, testData?: any): void => {
    console.log(`=== 测试数据迁移: ${fromVersion} -> ${toVersion} ===`)

    const sampleData = testData || {
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        department: 'IT',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: ['read:profile', 'update:profile']
      }
    }

    try {
      console.log('原始数据:', JSON.stringify(sampleData, null, 2))

      const migratedData = mockVersionManager.migrateData(fromVersion, toVersion, sampleData)
      console.log('迁移后数据:', JSON.stringify(migratedData, null, 2))

      // 验证迁移后数据
      const validation = mockVersionManager.validateSchema(toVersion, migratedData)
      console.log('验证结果:', validation.success ? '通过' : '失败')

      if (!validation.success) {
        console.error('验证错误:', validation.errors)
      }

    } catch (error) {
      console.error('迁移测试失败:', error)
    }
  },

  /**
   * 系统健康检查
   */
  healthCheck: (): void => {
    console.log('=== 版本管理系统健康检查 ===')

    const status = getVersionManagementStatus()
    console.log(`初始化状态: ${status.isInitialized ? '已初始化' : '未初始化'}`)
    console.log(`当前版本: ${status.currentVersion}`)
    console.log(`系统健康: ${status.systemHealth}`)
    console.log(`总版本数: ${status.details.totalVersions}`)
    console.log(`冻结版本数: ${status.details.frozenVersions}`)
    console.log(`迁移脚本数: ${status.details.totalMigrations}`)
    console.log(`检查点数: ${status.details.checkpoints}`)

    if (status.issues && status.issues.length > 0) {
      console.warn('发现问题:')
      status.issues.forEach(issue => console.warn(`  - ${issue}`))
    }
  },

  /**
   * 重置到基线版本
   */
  resetToBaseline: (): void => {
    console.log('=== 重置到基线版本 ===')
    try {
      mockVersionManager.setCurrentVersion('1.0.0-baseline')
      console.log('已重置到基线版本: 1.0.0-baseline')
    } catch (error) {
      console.error('重置失败:', error)
    }
  }
}

/**
 * 在浏览器环境中暴露开发工具
 */
if (typeof window !== 'undefined') {
  (window as any).VersionManagementDevTools = VersionManagementDevTools
  console.log('[VersionManagement] 开发工具已暴露到 window.VersionManagementDevTools')
}
