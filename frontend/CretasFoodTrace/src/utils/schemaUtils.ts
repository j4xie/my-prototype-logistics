/**
 * Schema 工具函数
 *
 * 提供 Formily Schema 相关的工具函数:
 * - 字段别名匹配
 * - Schema 合并
 * - 字段搜索
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */

import { SchemaFieldDefinition } from '../services/api/formAssistantApiClient';

// ========== 类型定义 ==========

/**
 * Schema 字段属性 (Formily 格式)
 */
export interface SchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  'x-component'?: string;
  'x-component-props'?: Record<string, unknown>;
  'x-decorator'?: string;
  'x-decorator-props'?: Record<string, unknown>;
  'x-validator'?: Array<Record<string, unknown>>;
  'x-reactions'?: Record<string, unknown>;
  'x-aliases'?: string[];
  enum?: Array<{ label: string; value: string }>;
  required?: boolean;
  default?: unknown;
}

/**
 * Formily Schema 结构
 */
export interface FormilySchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * 字段匹配结果
 */
export interface FieldMatchResult {
  /** 字段名 */
  fieldName: string;
  /** 匹配的标题或别名 */
  matchedText: string;
  /** 匹配类型: 'title' | 'alias' | 'name' */
  matchType: 'title' | 'alias' | 'name';
  /** 匹配分数 (0-1) */
  score: number;
  /** 原始字段定义 */
  field: SchemaProperty;
}

// ========== 别名相关函数 ==========

/**
 * 根据用户输入查找匹配的字段
 *
 * 优先级: 标题完全匹配 > 别名完全匹配 > 标题模糊匹配 > 别名模糊匹配
 *
 * @param schema Formily Schema
 * @param userInput 用户输入的字段名称
 * @returns 匹配结果列表 (按分数降序)
 *
 * @example
 * // 如果 schema 中有 { weight: { title: "重量", "x-aliases": ["投料重量", "净重"] } }
 * findFieldByAlias(schema, "投料重量") // => [{ fieldName: "weight", matchType: "alias", ... }]
 */
export function findFieldByAlias(
  schema: FormilySchema,
  userInput: string
): FieldMatchResult[] {
  const results: FieldMatchResult[] = [];
  const normalizedInput = normalizeText(userInput);

  if (!schema.properties) {
    return results;
  }

  for (const [fieldName, field] of Object.entries(schema.properties)) {
    // 1. 检查字段名完全匹配
    if (normalizeText(fieldName) === normalizedInput) {
      results.push({
        fieldName,
        matchedText: fieldName,
        matchType: 'name',
        score: 1.0,
        field,
      });
      continue;
    }

    // 2. 检查标题完全匹配
    const title = field.title || '';
    if (normalizeText(title) === normalizedInput) {
      results.push({
        fieldName,
        matchedText: title,
        matchType: 'title',
        score: 1.0,
        field,
      });
      continue;
    }

    // 3. 检查别名完全匹配
    const aliases = field['x-aliases'] || [];
    for (const alias of aliases) {
      if (normalizeText(alias) === normalizedInput) {
        results.push({
          fieldName,
          matchedText: alias,
          matchType: 'alias',
          score: 0.95,
          field,
        });
        break;
      }
    }

    // 4. 检查标题模糊匹配
    if (normalizedInput.length >= 2) {
      const titleScore = calculateSimilarity(normalizeText(title), normalizedInput);
      if (titleScore > 0.6) {
        results.push({
          fieldName,
          matchedText: title,
          matchType: 'title',
          score: titleScore * 0.8,
          field,
        });
        continue;
      }

      // 5. 检查别名模糊匹配
      for (const alias of aliases) {
        const aliasScore = calculateSimilarity(normalizeText(alias), normalizedInput);
        if (aliasScore > 0.6) {
          results.push({
            fieldName,
            matchedText: alias,
            matchType: 'alias',
            score: aliasScore * 0.7,
            field,
          });
          break;
        }
      }
    }
  }

  // 按分数降序排列
  return results.sort((a, b) => b.score - a.score);
}

/**
 * 获取字段的所有可用名称 (标题 + 别名)
 *
 * @param field 字段定义
 * @returns 所有名称列表
 */
export function getAllFieldNames(field: SchemaProperty): string[] {
  const names: string[] = [];

  if (field.title) {
    names.push(field.title);
  }

  if (field['x-aliases']) {
    names.push(...field['x-aliases']);
  }

  return names;
}

/**
 * 为字段添加别名
 *
 * @param field 字段定义
 * @param aliases 要添加的别名列表
 * @returns 更新后的字段定义
 */
export function addFieldAliases(
  field: SchemaProperty,
  aliases: string[]
): SchemaProperty {
  const existingAliases = field['x-aliases'] || [];
  const uniqueAliases = [...new Set([...existingAliases, ...aliases])];

  return {
    ...field,
    'x-aliases': uniqueAliases,
  };
}

/**
 * 从字段移除别名
 *
 * @param field 字段定义
 * @param aliasesToRemove 要移除的别名列表
 * @returns 更新后的字段定义
 */
export function removeFieldAliases(
  field: SchemaProperty,
  aliasesToRemove: string[]
): SchemaProperty {
  const existingAliases = field['x-aliases'] || [];
  const filteredAliases = existingAliases.filter(
    (alias) => !aliasesToRemove.includes(alias)
  );

  return {
    ...field,
    'x-aliases': filteredAliases.length > 0 ? filteredAliases : undefined,
  };
}

// ========== Schema 合并函数 ==========

/**
 * 合并两个 Schema
 *
 * 自定义 Schema 的字段会覆盖默认 Schema 的同名字段
 * 别名会合并而不是覆盖
 *
 * @param defaultSchema 默认 Schema
 * @param customSchema 自定义 Schema
 * @returns 合并后的 Schema
 */
export function mergeSchemas(
  defaultSchema: FormilySchema,
  customSchema: Partial<FormilySchema>
): FormilySchema {
  const mergedProperties: Record<string, SchemaProperty> = {
    ...defaultSchema.properties,
  };

  if (customSchema.properties) {
    for (const [fieldName, customField] of Object.entries(customSchema.properties)) {
      if (mergedProperties[fieldName]) {
        // 合并现有字段
        const defaultField = mergedProperties[fieldName];

        // 合并别名
        const mergedAliases = [
          ...(defaultField['x-aliases'] || []),
          ...(customField['x-aliases'] || []),
        ];
        const uniqueAliases = [...new Set(mergedAliases)];

        mergedProperties[fieldName] = {
          ...defaultField,
          ...customField,
          'x-aliases': uniqueAliases.length > 0 ? uniqueAliases : undefined,
        };
      } else {
        // 添加新字段
        mergedProperties[fieldName] = customField;
      }
    }
  }

  // 合并 required 数组
  const mergedRequired = [
    ...(defaultSchema.required || []),
    ...(customSchema.required || []),
  ];
  const uniqueRequired = [...new Set(mergedRequired)];

  return {
    type: 'object',
    properties: mergedProperties,
    required: uniqueRequired.length > 0 ? uniqueRequired : undefined,
  };
}

/**
 * 从 Schema 中提取字段列表
 *
 * @param schema Formily Schema
 * @returns 字段定义列表
 */
export function extractFieldsFromSchema(schema: FormilySchema): SchemaFieldDefinition[] {
  if (!schema.properties) {
    return [];
  }

  return Object.entries(schema.properties).map(([name, field]) => ({
    name,
    title: field.title || name,
    type: (field.type as SchemaFieldDefinition['type']) || 'string',
    'x-component': field['x-component'] || 'Input',
    'x-component-props': field['x-component-props'],
    'x-decorator': field['x-decorator'],
    'x-decorator-props': field['x-decorator-props'],
    'x-validator': field['x-validator'],
    'x-reactions': field['x-reactions'],
    'x-aliases': field['x-aliases'],
    enum: field.enum,
    required: field.required,
    description: field.description,
  }));
}

/**
 * 将字段列表转换为 Schema
 *
 * @param fields 字段定义列表
 * @returns Formily Schema
 */
export function fieldsToSchema(fields: SchemaFieldDefinition[]): FormilySchema {
  const properties: Record<string, SchemaProperty> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.name] = {
      type: field.type,
      title: field.title,
      description: field.description,
      'x-component': field['x-component'],
      'x-component-props': field['x-component-props'],
      'x-decorator': field['x-decorator'] || 'FormItem',
      'x-decorator-props': field['x-decorator-props'],
      'x-validator': field['x-validator'],
      'x-reactions': field['x-reactions'],
      'x-aliases': field['x-aliases'],
      enum: field.enum,
    };

    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

// ========== 辅助函数 ==========

/**
 * 文本标准化 (去除空格、转小写)
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * 计算两个字符串的相似度 (简单的编辑距离算法)
 *
 * @returns 0-1 之间的相似度分数
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // 包含关系检查
  if (str1.includes(str2) || str2.includes(str1)) {
    const shorter = Math.min(str1.length, str2.length);
    const longer = Math.max(str1.length, str2.length);
    return shorter / longer;
  }

  // 简单的 Levenshtein 距离
  const matrix: number[][] = Array.from({ length: str1.length + 1 }, () =>
    Array(str2.length + 1).fill(0)
  );

  for (let i = 0; i <= str1.length; i++) {
    matrix[i]![0] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  const maxLen = Math.max(str1.length, str2.length);
  return 1 - matrix[str1.length]![str2.length]! / maxLen;
}

// ========== 常用字段别名预设 ==========

/**
 * 常用字段别名预设
 * 可用于初始化新模板时的默认别名
 */
export const COMMON_FIELD_ALIASES: Record<string, string[]> = {
  // 重量相关
  weight: ['重量', '净重', '毛重', '实重', '称重'],
  quantity: ['数量', '数目', '个数', '件数', '总数'],

  // 温度相关
  temperature: ['温度', '温度值', '测温', '实测温度'],
  storageTemperature: ['储存温度', '库存温度', '冷库温度'],

  // 时间相关
  productionDate: ['生产日期', '生产时间', '制造日期'],
  expiryDate: ['过期日期', '保质期', '有效期', '失效日期'],
  receiveDate: ['收货日期', '入库日期', '到货日期'],

  // 批次相关
  batchNumber: ['批次号', '批号', '生产批次', '批次编号'],
  lotNumber: ['批号', '货号', '货物编号'],

  // 供应商相关
  supplierName: ['供应商', '供应商名称', '厂家', '厂商'],
  supplierCode: ['供应商编码', '供应商代码', '厂家编码'],

  // 质检相关
  inspector: ['检验员', '质检员', '检查员', '检验人'],
  inspectionResult: ['检验结果', '质检结果', '判定结果'],

  // 原料相关
  materialType: ['原料类型', '物料类型', '材料类型', '原材料'],
  materialName: ['原料名称', '物料名称', '材料名称'],

  // 备注
  remarks: ['备注', '说明', '注释', '其他说明'],
  notes: ['备注', '笔记', '记录'],
};

/**
 * 获取字段的预设别名
 *
 * @param fieldName 字段名
 * @returns 预设别名列表
 */
export function getPresetAliases(fieldName: string): string[] {
  return COMMON_FIELD_ALIASES[fieldName] || [];
}

export default {
  findFieldByAlias,
  getAllFieldNames,
  addFieldAliases,
  removeFieldAliases,
  mergeSchemas,
  extractFieldsFromSchema,
  fieldsToSchema,
  getPresetAliases,
  COMMON_FIELD_ALIASES,
};
