// src/mocks/data/migrations/index.ts
// Mock API数据迁移脚本系统
// 按照 docs/api/schema-version-management.md 第4节实施

import { mockVersionManager, MigrationScript } from '../version-manager'

/**
 * 基线到1.1.0的迁移脚本示例
 * 演示如何实现向前兼容的数据迁移
 */
const migration_1_0_0_to_1_1_0: MigrationScript = {
  fromVersion: '1.0.0-baseline',
  toVersion: '1.1.0-enhanced',

  migrate: (data: any) => {
    console.log('[Migration] 执行迁移: 1.0.0-baseline -> 1.1.0-enhanced')

    // 示例：为用户添加新的profile字段
    if (data.user) {
      data.user = {
        ...data.user,
        profile: {
          avatar: data.user.avatar || null,
          bio: data.user.bio || '',
          preferences: {
            theme: 'light',
            language: 'zh-CN',
            notifications: true
          }
        },
        // 新增字段
        lastActivityAt: data.user.lastLogin || data.user.updatedAt,
        isEmailVerified: true,
        twoFactorEnabled: false
      }
    }

    // 示例：为农田添加GPS精确坐标
    if (data.field) {
      data.field = {
        ...data.field,
        gpsCoordinates: {
          ...data.field.location.coordinates,
          accuracy: 5.0, // 精度(米)
          altitude: 0,
          heading: 0
        },
        // 新增智能农业字段
        sensors: [],
        automationLevel: 'manual'
      }
    }

    // 示例：为运输订单添加实时追踪
    if (data.transportOrder) {
      data.transportOrder = {
        ...data.transportOrder,
        realTimeTracking: {
          enabled: true,
          currentLocation: data.transportOrder.origin.coordinates,
          speed: 0,
          lastUpdateAt: new Date().toISOString()
        },
        // 新增字段
        estimatedDeliveryTime: data.transportOrder.scheduledDate,
        priority: 'normal'
      }
    }

    return data
  },

  rollback: (data: any) => {
    console.log('[Migration] 执行回滚: 1.1.0-enhanced -> 1.0.0-baseline')

    // 移除新增字段，保留基线版本字段
    if (data.user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { profile, lastActivityAt, isEmailVerified, twoFactorEnabled, ...baseUser } = data.user
      data.user = baseUser
    }

    if (data.field) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { gpsCoordinates, sensors, automationLevel, ...baseField } = data.field
      data.field = baseField
    }

    if (data.transportOrder) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { realTimeTracking, estimatedDeliveryTime, priority, ...baseOrder } = data.transportOrder
      data.transportOrder = baseOrder
    }

    return data
  },

  validate: (data: any) => {
    // 验证迁移后数据的完整性
    if (data.user && !data.user.profile) {
      return false
    }

    if (data.field && !data.field.gpsCoordinates) {
      return false
    }

    return true
  }
}

/**
 * 1.1.0到1.2.0的迁移脚本
 * 演示Breaking Changes的处理
 */
const migration_1_1_0_to_1_2_0: MigrationScript = {
  fromVersion: '1.1.0-enhanced',
  toVersion: '1.2.0-breaking',

  migrate: (data: any) => {
    console.log('[Migration] 执行Breaking Changes迁移: 1.1.0-enhanced -> 1.2.0-breaking')

    // Breaking Change: 重构用户权限系统
    if (data.user) {
      // 将旧的字符串权限数组转换为新的权限对象
      const oldPermissions = data.user.permissions || []
      data.user.permissions = {
        granted: oldPermissions.map((perm: string) => ({
          id: perm,
          name: perm,
          module: perm.split(':')[0] || 'general',
          level: 'read',
          grantedAt: new Date().toISOString(),
          grantedBy: 'system'
        })),
        inherited: [],
        denied: []
      }

      // Breaking Change: 重构角色系统
      if (typeof data.user.role === 'string') {
        data.user.roles = [{
          id: data.user.role,
          name: data.user.role,
          primary: true,
          assignedAt: data.user.createdAt
        }]
        delete data.user.role
      }
    }

    // Breaking Change: 重构物流状态系统
    if (data.transportOrder) {
      const statusMapping: Record<string, string> = {
        'pending': 'draft',
        'assigned': 'ready',
        'in_transit': 'active',
        'delivered': 'completed',
        'cancelled': 'cancelled'
      }

      data.transportOrder.status = {
        current: statusMapping[data.transportOrder.status] || 'draft',
        history: [{
          status: statusMapping[data.transportOrder.status] || 'draft',
          timestamp: data.transportOrder.updatedAt,
          operator: 'system',
          reason: 'migration'
        }]
      }
    }

    return data
  },

  rollback: (data: any) => {
    console.log('[Migration] 执行Breaking Changes回滚: 1.2.0-breaking -> 1.1.0-enhanced')

    // 回滚权限系统
    if (data.user && data.user.permissions.granted) {
      data.user.permissions = data.user.permissions.granted.map((perm: any) => perm.id)
    }

    // 回滚角色系统
    if (data.user && data.user.roles) {
      const primaryRole = data.user.roles.find((role: any) => role.primary)
      data.user.role = primaryRole ? primaryRole.id : 'user'
      delete data.user.roles
    }

    // 回滚状态系统
    if (data.transportOrder && data.transportOrder.status.current) {
      const statusMapping: Record<string, string> = {
        'draft': 'pending',
        'ready': 'assigned',
        'active': 'in_transit',
        'completed': 'delivered',
        'cancelled': 'cancelled'
      }

      data.transportOrder.status = statusMapping[data.transportOrder.status.current] || 'pending'
    }

    return data
  },

  validate: (data: any) => {
    // 验证Breaking Changes迁移
    if (data.user) {
      if (!data.user.permissions || !data.user.permissions.granted) {
        return false
      }

      if (!data.user.roles || !Array.isArray(data.user.roles)) {
        return false
      }
    }

    if (data.transportOrder) {
      if (!data.transportOrder.status || !data.transportOrder.status.current) {
        return false
      }
    }

    return true
  }
}

/**
 * 数据转换工具函数
 */
export const MigrationUtils = {
  /**
   * 深度合并对象
   */
  deepMerge: (target: any, source: any): any => {
    const result = { ...target }

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = MigrationUtils.deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }

    return result
  },

  /**
   * 安全字段重命名
   */
  renameField: (obj: any, oldKey: string, newKey: string): any => {
    if (obj && obj.hasOwnProperty(oldKey)) {
      obj[newKey] = obj[oldKey]
      delete obj[oldKey]
    }
    return obj
  },

  /**
   * 字段类型转换
   */
  convertFieldType: (obj: any, fieldPath: string, converter: (value: any) => any): any => {
    const keys = fieldPath.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return obj
      current = current[keys[i]]
    }

    const finalKey = keys[keys.length - 1]
    if (current[finalKey] !== undefined) {
      current[finalKey] = converter(current[finalKey])
    }

    return obj
  },

  /**
   * 添加默认字段
   */
  addDefaultFields: (obj: any, defaults: Record<string, any>): any => {
    return { ...defaults, ...obj }
  },

  /**
   * 移除废弃字段
   */
  removeDeprecatedFields: (obj: any, deprecatedFields: string[]): any => {
    const result = { ...obj }
    deprecatedFields.forEach(field => {
      delete result[field]
    })
    return result
  }
}

/**
 * 注册所有迁移脚本
 */
export function registerAllMigrations(): void {
  console.log('[MigrationRegistry] 开始注册所有迁移脚本...')

  // 注册迁移脚本
  mockVersionManager.registerMigration(migration_1_0_0_to_1_1_0)
  mockVersionManager.registerMigration(migration_1_1_0_to_1_2_0)

  console.log('[MigrationRegistry] 迁移脚本注册完成')

  // 输出迁移状态
  const status = mockVersionManager.getManagerStatus()
  console.log(`[MigrationRegistry] 已注册 ${status.totalMigrations} 个迁移脚本`)
}

/**
 * 批量数据迁移工具
 */
export class BatchMigrationTool {
  private versionManager = mockVersionManager

  /**
   * 批量迁移多个数据项
   */
  async batchMigrate(
    dataItems: any[],
    fromVersion: string,
    toVersion: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<any[]> {
    console.log(`[BatchMigration] 开始批量迁移: ${fromVersion} -> ${toVersion}`)
    console.log(`[BatchMigration] 数据项数量: ${dataItems.length}`)

    const results: any[] = []
    const errors: { index: number; error: any }[] = []

    for (let i = 0; i < dataItems.length; i++) {
      try {
        const migratedData = this.versionManager.migrateData(fromVersion, toVersion, dataItems[i])
        results.push(migratedData)

        if (onProgress) {
          onProgress(i + 1, dataItems.length)
        }
      } catch (error) {
        console.error(`[BatchMigration] 数据项 ${i} 迁移失败:`, error)
        errors.push({ index: i, error })
        results.push(null) // 占位
      }
    }

    console.log(`[BatchMigration] 批量迁移完成`)
    console.log(`[BatchMigration] 成功: ${results.filter(r => r !== null).length}`)
    console.log(`[BatchMigration] 失败: ${errors.length}`)

    if (errors.length > 0) {
      console.warn(`[BatchMigration] 失败的数据项索引:`, errors.map(e => e.index))
    }

    return results
  }

  /**
   * 验证迁移结果
   */
  async validateMigrationResults(
    migratedData: any[],
    targetVersion: string
  ): Promise<{ validCount: number; invalidCount: number; errors: any[] }> {
    console.log(`[BatchMigration] 开始验证迁移结果`)

    let validCount = 0
    let invalidCount = 0
    const errors: any[] = []

    for (let i = 0; i < migratedData.length; i++) {
      if (migratedData[i] === null) {
        invalidCount++
        continue
      }

      const validation = this.versionManager.validateSchema(targetVersion, migratedData[i])
      if (validation.success) {
        validCount++
      } else {
        invalidCount++
        errors.push({
          index: i,
          errors: validation.errors
        })
      }
    }

    console.log(`[BatchMigration] 验证完成 - 有效: ${validCount}, 无效: ${invalidCount}`)

    return { validCount, invalidCount, errors }
  }
}

/**
 * 创建批量迁移工具实例
 */
export function createBatchMigrationTool(): BatchMigrationTool {
  return new BatchMigrationTool()
}
