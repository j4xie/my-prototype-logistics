/**
 * Home Module Schemas - 首页模块配置Schema定义
 *
 * 定义每个模块类型的可配置属性及其UI表示
 */

import type { HomeModuleType } from '../../../../types/decoration';

/**
 * 字段类型
 */
export type FieldType = 'boolean' | 'number' | 'string' | 'enum' | 'multiSelect';

/**
 * 枚举选项
 */
export interface EnumOption {
  label: string;
  value: string | number;
}

/**
 * Schema字段定义
 */
export interface SchemaField {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  defaultValue?: unknown;
  // 数字类型的约束
  min?: number;
  max?: number;
  step?: number;
  // 枚举类型的选项
  options?: EnumOption[];
  // 是否必填
  required?: boolean;
}

/**
 * 模块Schema定义
 */
export interface ModuleSchema {
  type: HomeModuleType;
  name: string;
  description: string;
  fields: SchemaField[];
}

/**
 * 欢迎区模块Schema
 */
const welcomeSchema: ModuleSchema = {
  type: 'welcome',
  name: '欢迎区',
  description: '显示用户问候、日期和天气信息',
  fields: [
    {
      key: 'showGreeting',
      label: '显示问候语',
      type: 'boolean',
      description: '根据时间显示早上好/下午好等问候语',
      defaultValue: true,
    },
    {
      key: 'showDate',
      label: '显示日期',
      type: 'boolean',
      description: '显示当前日期',
      defaultValue: true,
    },
    {
      key: 'showWeather',
      label: '显示天气',
      type: 'boolean',
      description: '显示当前天气信息(需要位置权限)',
      defaultValue: false,
    },
  ],
};

/**
 * AI洞察模块Schema
 */
const aiInsightSchema: ModuleSchema = {
  type: 'ai_insight',
  name: 'AI洞察',
  description: 'AI分析和智能建议卡片',
  fields: [
    {
      key: 'showMetrics',
      label: '显示指标',
      type: 'boolean',
      description: '是否显示关键业务指标',
      defaultValue: true,
    },
    {
      key: 'metricsToShow',
      label: '显示指标项',
      type: 'multiSelect',
      description: '选择要显示的指标',
      defaultValue: ['qualityRate', 'unitCost', 'avgCycle'],
      options: [
        { label: '质量合格率', value: 'qualityRate' },
        { label: '单位成本', value: 'unitCost' },
        { label: '平均周期', value: 'avgCycle' },
      ],
    },
  ],
};

/**
 * 统计网格模块Schema
 */
const statsGridSchema: ModuleSchema = {
  type: 'stats_grid',
  name: '统计网格',
  description: '显示关键统计数据卡片',
  fields: [
    {
      key: 'columns',
      label: '列数',
      type: 'enum',
      description: '每行显示的卡片数量',
      defaultValue: 2,
      options: [
        { label: '2列', value: 2 },
        { label: '3列', value: 3 },
      ],
    },
  ],
};

/**
 * 快捷操作模块Schema
 */
const quickActionsSchema: ModuleSchema = {
  type: 'quick_actions',
  name: '快捷操作',
  description: '常用操作快捷入口',
  fields: [
    {
      key: 'maxItems',
      label: '最大显示数量',
      type: 'number',
      description: '最多显示的快捷操作数量',
      defaultValue: 4,
      min: 2,
      max: 8,
      step: 1,
    },
  ],
};

/**
 * 开发者工具模块Schema
 */
const devToolsSchema: ModuleSchema = {
  type: 'dev_tools',
  name: '开发者工具',
  description: '调试和性能监控工具',
  fields: [
    {
      key: 'enableDebugMode',
      label: '启用调试模式',
      type: 'boolean',
      description: '显示调试信息和日志',
      defaultValue: false,
    },
    {
      key: 'showPerformanceMetrics',
      label: '显示性能指标',
      type: 'boolean',
      description: '显示FPS、内存使用等性能数据',
      defaultValue: false,
    },
  ],
};

/**
 * 所有模块Schema映射
 */
export const HOME_MODULE_SCHEMAS: Record<HomeModuleType, ModuleSchema> = {
  welcome: welcomeSchema,
  ai_insight: aiInsightSchema,
  stats_grid: statsGridSchema,
  quick_actions: quickActionsSchema,
  dev_tools: devToolsSchema,
};

/**
 * 根据模块类型获取Schema
 */
export function getModuleSchema(type: HomeModuleType): ModuleSchema | undefined {
  return HOME_MODULE_SCHEMAS[type];
}

/**
 * 获取字段的默认值
 */
export function getFieldDefaultValue(schema: ModuleSchema, fieldKey: string): unknown {
  const field = schema.fields.find((f) => f.key === fieldKey);
  return field?.defaultValue;
}

/**
 * 获取模块配置的默认值
 */
export function getModuleDefaultConfig(type: HomeModuleType): Record<string, unknown> {
  const schema = getModuleSchema(type);
  if (!schema) return {};

  const defaults: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (field.defaultValue !== undefined) {
      defaults[field.key] = field.defaultValue;
    }
  }
  return defaults;
}
