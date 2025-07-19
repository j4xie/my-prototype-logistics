// src/mocks/data/version-manager.ts
// Mock API Version Management System
// 按照 docs/api/schema-version-management.md 第3-5节实施

import { z } from 'zod'

/**
 * 版本元数据接口
 */
export interface VersionMetadata {
  version: string
  timestamp: number
  description: string
  author: string
  breakingChanges: boolean
  migrationRequired: boolean
  compatibleVersions: string[]
  deprecated?: boolean
  deprecationDate?: number
}

/**
 * Schema注册信息
 */
export interface SchemaRegistration {
  schema: z.ZodSchema<any>
  metadata: VersionMetadata
  examples?: any[]
  validationRules?: Record<string, any>
}

/**
 * 数据迁移脚本接口
 */
export interface MigrationScript {
  fromVersion: string
  toVersion: string
  migrate: (data: any) => any
  rollback?: (data: any) => any
  validate?: (data: any) => boolean
}

/**
 * 版本检查点接口
 */
export interface VersionCheckpoint {
  version: string
  timestamp: number
  frozen: boolean
  dataSnapshot?: any
  schemaSnapshot?: z.ZodSchema<any>
}

/**
 * Mock版本管理器核心实现
 * 基于 docs/api/schema-version-management.md 第3节版本元数据管理
 */
export class MockVersionManager {
  private currentVersion: string
  private schemaRegistry: Map<string, SchemaRegistration> = new Map()
  private migrationScripts: Map<string, MigrationScript> = new Map()
  private checkpoints: Map<string, VersionCheckpoint> = new Map()
  private frozen: Set<string> = new Set()

  constructor(initialVersion: string = '1.0.0-baseline') {
    this.currentVersion = initialVersion
    this.initializeBaselineVersion()
  }

  /**
   * 初始化基线版本
   * 按照 TASK-P3-018 基线Schema建立要求
   */
  private initializeBaselineVersion(): void {
    // 注册基线版本检查点
    this.createCheckpoint('1.0.0-baseline', true)
  }

  /**
   * 注册Schema版本
   * @param version 版本号
   * @param schema Zod Schema
   * @param metadata 版本元数据
   */
  registerSchema(version: string, schema: z.ZodSchema<any>, metadata: Omit<VersionMetadata, 'version'>): void {
    if (this.frozen.has(version)) {
      throw new Error(`版本 ${version} 已冻结，无法修改`)
    }

    const fullMetadata: VersionMetadata = {
      ...metadata,
      version
    }

    this.schemaRegistry.set(version, {
      schema,
      metadata: fullMetadata,
      examples: [],
      validationRules: {}
    })

    console.log(`[MockVersionManager] 注册Schema版本: ${version}`)
  }

  /**
   * 验证数据是否符合指定版本Schema
   * @param version 版本号
   * @param data 待验证数据
   * @returns 验证结果
   */
  validateSchema(version: string, data: any): { success: boolean; errors?: any[] } {
    const registration = this.schemaRegistry.get(version)
    if (!registration) {
      return { success: false, errors: [`未找到版本 ${version} 的Schema`] }
    }

    try {
      registration.schema.parse(data)
      return { success: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, errors: error.errors }
      }
      return { success: false, errors: [error] }
    }
  }

  /**
   * 注册数据迁移脚本
   * @param migration 迁移脚本
   */
  registerMigration(migration: MigrationScript): void {
    const key = `${migration.fromVersion}->${migration.toVersion}`
    this.migrationScripts.set(key, migration)
    console.log(`[MockVersionManager] 注册迁移脚本: ${key}`)
  }

  /**
   * 执行数据迁移
   * @param fromVersion 源版本
   * @param toVersion 目标版本
   * @param data 源数据
   * @returns 迁移后数据
   */
  migrateData(fromVersion: string, toVersion: string, data: any): any {
    if (fromVersion === toVersion) {
      return data
    }

    const migrationPath = this.findMigrationPath(fromVersion, toVersion)
    if (!migrationPath.length) {
      throw new Error(`未找到从 ${fromVersion} 到 ${toVersion} 的迁移路径`)
    }

    let currentData = data
    let currentVersion = fromVersion

    for (const nextVersion of migrationPath) {
      const key = `${currentVersion}->${nextVersion}`
      const migration = this.migrationScripts.get(key)

      if (!migration) {
        throw new Error(`缺少迁移脚本: ${key}`)
      }

      console.log(`[MockVersionManager] 执行迁移: ${currentVersion} -> ${nextVersion}`)
      currentData = migration.migrate(currentData)

      // 验证迁移后数据
      if (migration.validate && !migration.validate(currentData)) {
        throw new Error(`迁移验证失败: ${key}`)
      }

      currentVersion = nextVersion
    }

    return currentData
  }

  /**
   * 寻找迁移路径
   * @param fromVersion 源版本
   * @param toVersion 目标版本
   * @returns 迁移路径
   */
  private findMigrationPath(fromVersion: string, toVersion: string): string[] {
    // 简化实现：假设版本按顺序递增
    // 实际项目中可能需要更复杂的图算法
    const versions = Array.from(this.schemaRegistry.keys()).sort()
    const fromIndex = versions.indexOf(fromVersion)
    const toIndex = versions.indexOf(toVersion)

    if (fromIndex === -1 || toIndex === -1) {
      return []
    }

    if (fromIndex < toIndex) {
      return versions.slice(fromIndex + 1, toIndex + 1)
    } else {
      return versions.slice(toIndex, fromIndex).reverse()
    }
  }

  /**
   * 冻结版本
   * @param version 版本号
   * @param createSnapshot 是否创建数据快照
   */
  freezeVersion(version: string, createSnapshot: boolean = true): void {
    if (!this.schemaRegistry.has(version)) {
      throw new Error(`版本 ${version} 不存在`)
    }

    this.frozen.add(version)

    if (createSnapshot) {
      this.createCheckpoint(version, true)
    }

    console.log(`[MockVersionManager] 冻结版本: ${version}`)
  }

  /**
   * 创建版本检查点
   * @param version 版本号
   * @param frozen 是否冻结
   * @param metadata 元数据
   */
  private createCheckpoint(version: string, frozen: boolean = false): void {
    const registration = this.schemaRegistry.get(version)

    const checkpoint: VersionCheckpoint = {
      version,
      timestamp: Date.now(),
      frozen,
      schemaSnapshot: registration?.schema
    }

    this.checkpoints.set(version, checkpoint)
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string {
    return this.currentVersion
  }

  /**
   * 设置当前版本
   * @param version 版本号
   */
  setCurrentVersion(version: string): void {
    if (!this.schemaRegistry.has(version)) {
      throw new Error(`版本 ${version} 不存在`)
    }

    this.currentVersion = version
    console.log(`[MockVersionManager] 切换到版本: ${version}`)
  }

  /**
   * 获取版本列表
   */
  getVersions(): string[] {
    return Array.from(this.schemaRegistry.keys())
  }

  /**
   * 获取版本元数据
   * @param version 版本号
   */
  getVersionMetadata(version: string): VersionMetadata | undefined {
    const registration = this.schemaRegistry.get(version)
    return registration?.metadata
  }

  /**
   * 检查版本兼容性
   * @param version1 版本1
   * @param version2 版本2
   * @returns 是否兼容
   */
  isCompatible(version1: string, version2: string): boolean {
    const metadata1 = this.getVersionMetadata(version1)
    const metadata2 = this.getVersionMetadata(version2)

    if (!metadata1 || !metadata2) {
      return false
    }

    return metadata1.compatibleVersions.includes(version2) ||
           metadata2.compatibleVersions.includes(version1)
  }

  /**
   * 获取管理器状态
   */
  getManagerStatus(): {
    currentVersion: string
    totalVersions: number
    frozenVersions: number
    totalMigrations: number
    checkpoints: number
  } {
    return {
      currentVersion: this.currentVersion,
      totalVersions: this.schemaRegistry.size,
      frozenVersions: this.frozen.size,
      totalMigrations: this.migrationScripts.size,
      checkpoints: this.checkpoints.size
    }
  }

  /**
   * 验证管理器完整性
   */
  validateManagerIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    // 检查基线版本
    if (!this.schemaRegistry.has('1.0.0-baseline')) {
      issues.push('缺少基线版本 1.0.0-baseline')
    }

    // 检查当前版本有效性
    if (!this.schemaRegistry.has(this.currentVersion)) {
      issues.push(`当前版本 ${this.currentVersion} 不存在`)
    }

    // 检查冻结版本
    for (const frozenVersion of this.frozen) {
      if (!this.schemaRegistry.has(frozenVersion)) {
        issues.push(`冻结版本 ${frozenVersion} 不存在`)
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * 公开访问器，供外部模块使用
   */
  public getSchemaRegistry(): Map<string, SchemaRegistration> {
    return this.schemaRegistry
  }
}

/**
 * 全局版本管理器实例
 */
export const mockVersionManager = new MockVersionManager()

/**
 * 版本感知API客户端适配器
 */
export class VersionAwareApiClient {
  private versionManager: MockVersionManager
  private preferredVersion: string

  constructor(versionManager: MockVersionManager, preferredVersion?: string) {
    this.versionManager = versionManager
    this.preferredVersion = preferredVersion || versionManager.getCurrentVersion()
  }

  /**
   * 版本感知请求
   * @param endpoint API端点
   * @param data 请求数据
   * @param targetVersion 目标版本
   */
  async versionAwareRequest(endpoint: string, data: any, targetVersion?: string): Promise<any> {
    const version = targetVersion || this.preferredVersion
    const currentVersion = this.versionManager.getCurrentVersion()

    // 如果版本不匹配，执行数据迁移
    if (version !== currentVersion) {
      const migratedData = this.versionManager.migrateData(currentVersion, version, data)
      console.log(`[VersionAwareApiClient] 数据迁移: ${currentVersion} -> ${version}`)
      return migratedData
    }

    return data
  }

  /**
   * 向后兼容请求
   * @param endpoint API端点
   * @param data 请求数据
   */
  async backwardCompatibleRequest(endpoint: string, data: any): Promise<any> {
    const currentVersion = this.versionManager.getCurrentVersion()
    const metadata = this.versionManager.getVersionMetadata(currentVersion)

    if (!metadata) {
      throw new Error(`未找到版本 ${currentVersion} 的元数据`)
    }

    // 尝试使用兼容版本
    for (const compatibleVersion of metadata.compatibleVersions) {
      try {
        const validation = this.versionManager.validateSchema(compatibleVersion, data)
        if (validation.success) {
          console.log(`[VersionAwareApiClient] 使用兼容版本: ${compatibleVersion}`)
          return data
        }
      } catch (error) {
        console.warn(`[VersionAwareApiClient] 兼容版本 ${compatibleVersion} 验证失败:`, error)
      }
    }

    throw new Error(`数据无法与任何兼容版本匹配`)
  }
}

/**
 * 创建版本感知API客户端
 * @param preferredVersion 偏好版本
 */
export function createVersionAwareClient(preferredVersion?: string): VersionAwareApiClient {
  return new VersionAwareApiClient(mockVersionManager, preferredVersion)
}
