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
import { productTypeApiClient, ProductType } from '../../services/api/productTypeApiClient';
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
 * 产品类型 Schema 缓存项
 */
interface ProductTypeCacheEntry {
  schema: FormSchema | null;
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
  /** 工厂级 Schema 缓存 */
  private cache = new Map<string, CacheEntry>();

  /** 产品类型 Schema 缓存 */
  private productTypeCache = new Map<string, ProductTypeCacheEntry>();

  /** 缓存过期时间 (5分钟) */
  private readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * 获取合并后的 Schema
   *
   * 三层合并优先级:
   * 1. 第1层：代码中的默认 Schema (最低优先级)
   * 2. 第2层：工厂级别的 FormTemplate
   * 3. 第3层：产品类型的 customSchemaOverrides (最高优先级)
   *
   * @param entityType 实体类型 (如 QUALITY_CHECK, MATERIAL_BATCH)
   * @param defaultSchema 默认 Schema (代码中定义)
   * @param factoryId 工厂ID (可选，默认从 authStore 获取)
   * @param productTypeId 产品类型ID (可选，用于产品类型级别的 Schema 覆盖)
   * @returns 合并后的 Schema 结果
   */
  async getMergedSchema(
    entityType: EntityType,
    defaultSchema: FormSchema,
    factoryId?: string,
    productTypeId?: string
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

    // 第1层：默认 Schema (已传入)
    let mergedSchema: FormSchema = { ...defaultSchema };
    let source: string | null = null;
    let version: number | null = null;

    // 第2层：工厂级别的 FormTemplate
    const factoryCacheKey = `${currentFactoryId}:${entityType}`;
    const factorySchema = await this.getFactorySchema(entityType, currentFactoryId, factoryCacheKey);
    if (factorySchema) {
      mergedSchema = this.deepMergeSchemas(mergedSchema, factorySchema.schema);
      source = factorySchema.source;
      version = factorySchema.version;
      console.log(`[SchemaService] 应用工厂级 Schema: ${factoryCacheKey}, version=${version}`);
    }

    // 第3层：产品类型的 customSchemaOverrides (最高优先级)
    if (productTypeId) {
      const productTypeSchema = await this.getProductTypeSchema(productTypeId, entityType, currentFactoryId);
      if (productTypeSchema) {
        mergedSchema = this.deepMergeSchemas(mergedSchema, productTypeSchema);
        // 产品类型覆盖时，标记来源为 PRODUCT_TYPE_OVERRIDE
        source = 'PRODUCT_TYPE_OVERRIDE';
        console.log(`[SchemaService] 应用产品类型 Schema 覆盖: productTypeId=${productTypeId}`);
      }
    }

    // 计算自定义字段
    const defaultFieldNames = Object.keys(defaultSchema.properties || {});
    const customFieldNames = Object.keys(mergedSchema.properties || {}).filter(
      (name) => !defaultFieldNames.includes(name)
    );

    return {
      schema: mergedSchema,
      isCustomized: customFieldNames.length > 0 || source !== null,
      customFieldCount: customFieldNames.length,
      customFieldNames,
      source,
      version,
    };
  }

  /**
   * 获取工厂级别的 Schema
   * @private
   */
  private async getFactorySchema(
    entityType: EntityType,
    factoryId: string,
    cacheKey: string
  ): Promise<{ schema: FormSchema; source: string | null; version: number | null } | null> {
    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      const schema = this.parseSchemaJson(cached.schemaJson);
      if (schema) {
        return { schema, source: cached.source, version: cached.version };
      }
    }

    // 查询后端自定义 Schema
    try {
      const response = await formTemplateApiClient.getByEntityType(entityType, factoryId);

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

        const schema = this.parseSchemaJson(customSchemaJson);
        if (schema) {
          return { schema, source: template.source, version: template.version };
        }
      }
    } catch (error) {
      console.warn('[SchemaService] 获取工厂级 Schema 失败:', error);
    }

    return null;
  }

  /**
   * 获取产品类型的自定义 Schema
   *
   * @param productTypeId 产品类型ID
   * @param entityType 实体类型 (如 QUALITY_CHECK, MATERIAL_BATCH)
   * @param factoryId 工厂ID (可选)
   * @returns 产品类型的自定义 Schema，如果不存在则返回 null
   */
  async getProductTypeSchema(
    productTypeId: string,
    entityType: EntityType | string,
    factoryId?: string
  ): Promise<FormSchema | null> {
    const currentFactoryId = factoryId || getCurrentFactoryId();
    const cacheKey = `productType:${productTypeId}:${entityType}`;

    // 检查缓存
    const cached = this.productTypeCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`[SchemaService] 使用产品类型 Schema 缓存: ${cacheKey}`);
      return cached.schema;
    }

    try {
      // 获取产品类型详情
      const productType = await productTypeApiClient.getProductTypeById(productTypeId, currentFactoryId);

      if (productType?.customSchemaOverrides) {
        // customSchemaOverrides 格式: { "QUALITY_CHECK": { properties: {...} }, "MATERIAL_BATCH": {...} }
        const overrides = productType.customSchemaOverrides as Record<string, unknown>;
        const entityOverride = overrides[entityType];

        if (entityOverride && typeof entityOverride === 'object') {
          const schema = this.normalizeToFormSchema(entityOverride);

          // 缓存结果
          this.productTypeCache.set(cacheKey, {
            schema,
            expiry: Date.now() + this.CACHE_TTL,
          });

          return schema;
        }
      }

      // 无覆盖配置，缓存 null 结果避免重复请求
      this.productTypeCache.set(cacheKey, {
        schema: null,
        expiry: Date.now() + this.CACHE_TTL,
      });

      return null;
    } catch (error) {
      console.warn(`[SchemaService] 获取产品类型 Schema 失败: productTypeId=${productTypeId}`, error);
      return null;
    }
  }

  /**
   * 将任意对象规范化为 FormSchema 格式
   * @private
   */
  private normalizeToFormSchema(obj: unknown): FormSchema | null {
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    const data = obj as Record<string, unknown>;

    // 如果已经是标准 FormSchema 格式
    if (data.type === 'object' && data.properties) {
      return data as unknown as FormSchema;
    }

    // 如果只提供了 properties
    if (data.properties && typeof data.properties === 'object') {
      return {
        type: 'object',
        properties: data.properties as Record<string, FieldSchema>,
      };
    }

    // 如果直接是字段定义 (假设传入的是 properties 内容)
    const keys = Object.keys(data);
    if (keys.length > 0 && !data.type && !data.properties) {
      // 检查是否看起来像字段定义
      const firstKey = keys[0];
      if (firstKey) {
        const firstValue = data[firstKey];
        if (firstValue && typeof firstValue === 'object' && 'type' in (firstValue as object)) {
          return {
            type: 'object',
            properties: data as unknown as Record<string, FieldSchema>,
          };
        }
      }
    }

    return null;
  }

  /**
   * 深度合并两个 Schema
   * 后者的相同字段覆盖前者
   * @private
   */
  private deepMergeSchemas(base: FormSchema, override: FormSchema): FormSchema {
    const mergedProperties: Record<string, FieldSchema> = { ...base.properties };

    // 合并 properties
    if (override.properties) {
      for (const [key, field] of Object.entries(override.properties)) {
        if (mergedProperties[key]) {
          // 深度合并已存在的字段
          mergedProperties[key] = this.deepMergeField(mergedProperties[key], field);
        } else {
          // 添加新字段
          mergedProperties[key] = field;
        }
      }
    }

    return {
      type: 'object',
      properties: mergedProperties,
    };
  }

  /**
   * 深度合并单个字段定义
   * @private
   */
  private deepMergeField(base: FieldSchema, override: FieldSchema): FieldSchema {
    const result: FieldSchema = { ...base };
    const resultRecord = result as unknown as Record<string, unknown>;
    const baseRecord = base as unknown as Record<string, unknown>;

    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) {
        continue;
      }

      const baseValue = baseRecord[key];

      // 特殊处理对象类型的属性 (如 x-component-props, x-decorator-props)
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        baseValue !== null &&
        typeof baseValue === 'object' &&
        !Array.isArray(baseValue)
      ) {
        resultRecord[key] = {
          ...(baseValue as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        };
      } else {
        // 直接覆盖
        resultRecord[key] = value;
      }
    }

    return result;
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
      this.productTypeCache.clear();
      console.log('[SchemaService] 清除所有缓存');
    }
  }

  /**
   * 清除产品类型 Schema 缓存
   *
   * @param productTypeId 产品类型ID (可选，不提供则清除所有产品类型缓存)
   * @param entityType 实体类型 (可选，需配合 productTypeId 使用)
   */
  clearProductTypeCache(productTypeId?: string, entityType?: string): void {
    if (productTypeId && entityType) {
      // 清除特定产品类型的特定实体类型缓存
      const cacheKey = `productType:${productTypeId}:${entityType}`;
      this.productTypeCache.delete(cacheKey);
      console.log(`[SchemaService] 清除产品类型缓存: ${cacheKey}`);
    } else if (productTypeId) {
      // 清除特定产品类型的所有缓存
      for (const key of this.productTypeCache.keys()) {
        if (key.startsWith(`productType:${productTypeId}:`)) {
          this.productTypeCache.delete(key);
        }
      }
      console.log(`[SchemaService] 清除产品类型缓存: productTypeId=${productTypeId}`);
    } else {
      // 清除所有产品类型缓存
      this.productTypeCache.clear();
      console.log('[SchemaService] 清除所有产品类型缓存');
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
  getCacheStats(): {
    factoryCache: { size: number; keys: string[] };
    productTypeCache: { size: number; keys: string[] };
    totalSize: number;
  } {
    return {
      factoryCache: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys()),
      },
      productTypeCache: {
        size: this.productTypeCache.size,
        keys: Array.from(this.productTypeCache.keys()),
      },
      totalSize: this.cache.size + this.productTypeCache.size,
    };
  }
}

export const schemaService = new SchemaService();
export default schemaService;
