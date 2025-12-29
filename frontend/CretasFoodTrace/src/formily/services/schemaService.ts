/**
 * Schema 服务
 *
 * 提供:
 * - 默认 Schema 与自定义 Schema 的合并
 * - Schema 缓存管理
 * - 自定义字段检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { FormSchema, FieldSchema } from '../core/DynamicForm';
import { formTemplateApiClient, EntityType } from '../../services/api/formTemplateApiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * Schema 合并结果
 */
export interface MergedSchemaResult {
  /** 合并后的 Schema */
  schema: FormSchema;
  /** 是否有自定义字段 */
  isCustomized: boolean;
  /** 自定义字段数量 */
  customFieldCount: number;
  /** 自定义字段名称列表 */
  customFieldNames: string[];
  /** 模板来源 (MANUAL | AI_ASSISTANT | null) */
  source: string | null;
  /** 模板版本 */
  version: number | null;
}

/**
 * 缓存项
 */
interface CacheEntry {
  schemaJson: string;
  source: string | null;
  version: number | null;
  expiry: number;
}

/**
 * Schema 服务类
 *
 * 混合模式 Schema 管理:
 * - 代码中定义默认 Schema (类型安全)
 * - 数据库存储自定义 Schema (动态配置)
 * - 运行时合并两者
 */
class SchemaService {
  /** Schema 缓存 */
  private cache = new Map<string, CacheEntry>();

  /** 缓存过期时间 (5分钟) */
  private readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * 获取合并后的 Schema
   *
   * 流程:
   * 1. 加载默认 Schema (前端代码)
   * 2. 查询自定义 Schema (后端 API)
   * 3. 深度合并两者
   * 4. 返回合并结果
   *
   * @param entityType 实体类型 (如 QUALITY_CHECK, MATERIAL_BATCH)
   * @param defaultSchema 默认 Schema (代码中定义)
   * @param factoryId 工厂ID (可选，默认从 authStore 获取)
   * @returns 合并后的 Schema 结果
   */
  async getMergedSchema(
    entityType: EntityType,
    defaultSchema: FormSchema,
    factoryId?: string
  ): Promise<MergedSchemaResult> {
    const currentFactoryId = factoryId || getCurrentFactoryId();
    if (!currentFactoryId) {
      // 无 factoryId 时直接返回默认 Schema
      console.log('[SchemaService] 无 factoryId，使用默认 Schema');
      return {
        schema: defaultSchema,
        isCustomized: false,
        customFieldCount: 0,
        customFieldNames: [],
        source: null,
        version: null,
      };
    }

    const cacheKey = `${currentFactoryId}:${entityType}`;

    // 1. 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`[SchemaService] 使用缓存 Schema: ${cacheKey}`);
      return this.mergeSchemas(
        defaultSchema,
        this.parseSchemaJson(cached.schemaJson),
        cached.source,
        cached.version
      );
    }

    // 2. 查询后端自定义 Schema
    try {
      const response = await formTemplateApiClient.getByEntityType(
        entityType,
        currentFactoryId
      );

      if (response.success && response.data?.schemaJson) {
        const template = response.data;
        const customSchemaJson = template.schemaJson;

        // 缓存自定义 Schema
        this.cache.set(cacheKey, {
          schemaJson: customSchemaJson,
          source: template.source,
          version: template.version,
          expiry: Date.now() + this.CACHE_TTL,
        });

        console.log(`[SchemaService] 加载自定义 Schema: ${cacheKey}, version=${template.version}`);
        return this.mergeSchemas(
          defaultSchema,
          this.parseSchemaJson(customSchemaJson),
          template.source,
          template.version
        );
      }
    } catch (error) {
      console.warn('[SchemaService] 获取自定义 Schema 失败，使用默认 Schema:', error);
    }

    // 3. 无自定义 Schema，返回默认
    return {
      schema: defaultSchema,
      isCustomized: false,
      customFieldCount: 0,
      customFieldNames: [],
      source: null,
      version: null,
    };
  }

  /**
   * 合并默认 Schema 和自定义 Schema
   *
   * 合并规则:
   * - 自定义字段添加到 properties 末尾
   * - 同名字段优先使用自定义配置
   * - x-reactions 联动保留
   */
  private mergeSchemas(
    defaultSchema: FormSchema,
    customSchema: FormSchema | null,
    source: string | null,
    version: number | null
  ): MergedSchemaResult {
    if (!customSchema || !customSchema.properties) {
      return {
        schema: defaultSchema,
        isCustomized: false,
        customFieldCount: 0,
        customFieldNames: [],
        source: null,
        version: null,
      };
    }

    // 找出自定义字段 (不在默认 Schema 中的字段)
    const defaultFieldNames = Object.keys(defaultSchema.properties || {});
    const customFieldNames = Object.keys(customSchema.properties).filter(
      (name) => !defaultFieldNames.includes(name)
    );

    // 合并 properties
    const mergedProperties: Record<string, FieldSchema> = {
      ...defaultSchema.properties,
      ...customSchema.properties,
    };

    return {
      schema: {
        type: 'object',
        properties: mergedProperties,
      },
      isCustomized: customFieldNames.length > 0,
      customFieldCount: customFieldNames.length,
      customFieldNames,
      source,
      version,
    };
  }

  /**
   * 解析 Schema JSON 字符串
   */
  private parseSchemaJson(jsonString: string): FormSchema | null {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.type === 'object' && parsed.properties) {
        return parsed as FormSchema;
      }
      console.warn('[SchemaService] Schema JSON 格式无效');
      return null;
    } catch (error) {
      console.error('[SchemaService] Schema JSON 解析失败:', error);
      return null;
    }
  }

  /**
   * 清除缓存
   *
   * @param factoryId 工厂ID (可选，不提供则清除所有)
   * @param entityType 实体类型 (可选，需配合 factoryId 使用)
   */
  clearCache(factoryId?: string, entityType?: EntityType): void {
    if (factoryId && entityType) {
      // 清除特定缓存
      const cacheKey = `${factoryId}:${entityType}`;
      this.cache.delete(cacheKey);
      console.log(`[SchemaService] 清除缓存: ${cacheKey}`);
    } else if (factoryId) {
      // 清除工厂的所有缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${factoryId}:`)) {
          this.cache.delete(key);
        }
      }
      console.log(`[SchemaService] 清除工厂缓存: ${factoryId}`);
    } else {
      // 清除所有缓存
      this.cache.clear();
      console.log('[SchemaService] 清除所有缓存');
    }
  }

  /**
   * 预加载 Schema
   *
   * 在页面加载时调用，提前缓存 Schema
   */
  async preloadSchema(
    entityType: EntityType,
    defaultSchema: FormSchema,
    factoryId?: string
  ): Promise<void> {
    try {
      await this.getMergedSchema(entityType, defaultSchema, factoryId);
    } catch (error) {
      console.warn(`[SchemaService] 预加载 Schema 失败: ${entityType}`, error);
    }
  }

  /**
   * 检查是否有自定义 Schema
   */
  async hasCustomSchema(
    entityType: EntityType,
    factoryId?: string
  ): Promise<boolean> {
    const currentFactoryId = factoryId || getCurrentFactoryId();
    if (!currentFactoryId) {
      return false;
    }

    try {
      return await formTemplateApiClient.hasCustomTemplate(entityType, currentFactoryId);
    } catch (error) {
      console.warn(`[SchemaService] 检查自定义 Schema 失败: ${entityType}`, error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const schemaService = new SchemaService();
export default schemaService;
