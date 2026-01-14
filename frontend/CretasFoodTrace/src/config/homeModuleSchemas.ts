/**
 * 首页模块属性 Schema 定义
 * Home Module Props Schema Definitions
 *
 * 为每个模块类型定义可配置属性的 JSON Schema 风格定义
 */

import type {
  HomeModuleType,
  ModuleConfig,
  StatCardConfig,
  QuickActionConfig,
} from '../types/decoration';

// ============================================
// Schema 类型定义
// ============================================

/**
 * 属性类型
 */
export type PropertyType = 'boolean' | 'number' | 'string' | 'array' | 'object';

/**
 * 属性定义
 */
export interface PropertySchema {
  /** 属性类型 */
  type: PropertyType;
  /** 中文标题 */
  title: string;
  /** 属性描述 */
  description?: string;
  /** 默认值 */
  default?: unknown;
  /** 枚举选项 (用于 string 类型) */
  enum?: string[];
  /** 枚举选项标签 (对应 enum 的中文名称) */
  enumLabels?: string[];
  /** 最小值 (用于 number 类型) */
  minimum?: number;
  /** 最大值 (用于 number 类型) */
  maximum?: number;
  /** 数组项定义 (用于 array 类型) */
  items?: PropertySchema | ObjectSchema;
  /** 是否必填 */
  required?: boolean;
  /** 属性分组 */
  group?: string;
  /** 排序权重 (越小越靠前) */
  order?: number;
  /** 是否在简洁模式下隐藏 */
  advanced?: boolean;
}

/**
 * 对象 Schema 定义
 */
export interface ObjectSchema {
  type: 'object';
  title: string;
  properties: Record<string, PropertySchema>;
  required?: string[];
}

/**
 * 模块 Schema 定义
 */
export interface ModuleSchema {
  /** 模块类型 */
  moduleType: HomeModuleType;
  /** 模块中文名称 */
  title: string;
  /** 模块描述 */
  description: string;
  /** 模块图标 */
  icon?: string;
  /** 属性定义 */
  properties: Record<string, PropertySchema>;
  /** 必填属性 */
  required?: string[];
  /** 属性分组定义 */
  groups?: PropertyGroup[];
}

/**
 * 属性分组
 */
export interface PropertyGroup {
  id: string;
  title: string;
  description?: string;
  order: number;
}

// ============================================
// 通用子 Schema 定义
// ============================================

/**
 * 统计卡片配置 Schema
 */
const StatCardConfigSchema: ObjectSchema = {
  type: 'object',
  title: '统计卡片',
  properties: {
    id: {
      type: 'string',
      title: '卡片ID',
      description: '统计卡片的唯一标识',
      required: true,
      order: 1,
    },
    visible: {
      type: 'boolean',
      title: '是否显示',
      default: true,
      order: 2,
    },
    icon: {
      type: 'string',
      title: '图标',
      description: '卡片图标名称',
      order: 3,
    },
    color: {
      type: 'string',
      title: '主题色',
      description: '卡片主题颜色 (HEX格式)',
      default: '#4CAF50',
      order: 4,
    },
    label: {
      type: 'string',
      title: '显示标签',
      description: '卡片显示的标题文字',
      order: 5,
    },
    dataKey: {
      type: 'string',
      title: '数据键',
      description: '关联的数据字段名',
      order: 6,
      advanced: true,
    },
  },
  required: ['id', 'visible'],
};

/**
 * 快捷操作配置 Schema
 */
const QuickActionConfigSchema: ObjectSchema = {
  type: 'object',
  title: '快捷操作',
  properties: {
    id: {
      type: 'string',
      title: '操作ID',
      description: '快捷操作的唯一标识',
      required: true,
      order: 1,
    },
    visible: {
      type: 'boolean',
      title: '是否显示',
      default: true,
      order: 2,
    },
    icon: {
      type: 'string',
      title: '图标',
      description: '操作按钮图标',
      order: 3,
    },
    label: {
      type: 'string',
      title: '按钮文字',
      description: '操作按钮显示的文字',
      order: 4,
    },
    route: {
      type: 'string',
      title: '目标路由',
      description: '点击后跳转的路由名称',
      enum: [
        'CreateBatch',
        'QualityInspection',
        'Reports',
        'Settings',
        'MaterialManagement',
        'ProductList',
        'OrderList',
        'AlertCenter',
      ],
      enumLabels: [
        '新建批次',
        '质量检测',
        '报表中心',
        '系统设置',
        '原料管理',
        '产品列表',
        '订单列表',
        '告警中心',
      ],
      order: 5,
    },
  },
  required: ['id', 'visible'],
};

// ============================================
// 各模块 Schema 定义
// ============================================

/**
 * 欢迎区模块 Schema
 */
const WelcomeModuleSchema: ModuleSchema = {
  moduleType: 'welcome',
  title: '欢迎区',
  description: '显示用户问候语、日期和天气信息',
  icon: 'hand-wave',
  groups: [
    { id: 'display', title: '显示设置', order: 1 },
  ],
  properties: {
    showGreeting: {
      type: 'boolean',
      title: '显示问候语',
      description: '根据时间显示"早上好/下午好/晚上好"等问候语',
      default: true,
      group: 'display',
      order: 1,
    },
    showDate: {
      type: 'boolean',
      title: '显示日期',
      description: '显示当前日期信息',
      default: true,
      group: 'display',
      order: 2,
    },
    showWeather: {
      type: 'boolean',
      title: '显示天气',
      description: '显示当前天气信息 (需要定位权限)',
      default: false,
      group: 'display',
      order: 3,
    },
  },
};

/**
 * AI洞察卡片模块 Schema
 */
const AIInsightModuleSchema: ModuleSchema = {
  moduleType: 'ai_insight',
  title: 'AI洞察',
  description: 'AI智能分析卡片，展示关键业务洞察和指标',
  icon: 'brain',
  groups: [
    { id: 'metrics', title: '指标配置', order: 1 },
  ],
  properties: {
    showMetrics: {
      type: 'boolean',
      title: '显示指标',
      description: '是否在AI洞察卡片中显示关键指标',
      default: true,
      group: 'metrics',
      order: 1,
    },
    metricsToShow: {
      type: 'array',
      title: '显示的指标',
      description: '选择要在卡片中展示的指标类型',
      default: ['qualityRate', 'unitCost', 'avgCycle'],
      items: {
        type: 'string',
        title: '指标',
        enum: ['qualityRate', 'unitCost', 'avgCycle'],
        enumLabels: ['质量合格率', '单位成本', '平均周期'],
      },
      group: 'metrics',
      order: 2,
    },
  },
};

/**
 * 统计网格模块 Schema
 */
const StatsGridModuleSchema: ModuleSchema = {
  moduleType: 'stats_grid',
  title: '统计网格',
  description: '以网格形式展示多个统计数据卡片',
  icon: 'grid-view',
  groups: [
    { id: 'layout', title: '布局设置', order: 1 },
    { id: 'cards', title: '卡片配置', order: 2 },
  ],
  properties: {
    columns: {
      type: 'number',
      title: '列数',
      description: '统计卡片的列数',
      default: 2,
      minimum: 2,
      maximum: 3,
      enum: ['2', '3'],
      enumLabels: ['2列', '3列'],
      group: 'layout',
      order: 1,
    },
    cards: {
      type: 'array',
      title: '统计卡片列表',
      description: '配置要显示的统计卡片',
      default: [
        { id: 'todayProduction', visible: true, color: '#4CAF50', label: '今日生产' },
        { id: 'qualityRate', visible: true, color: '#2196F3', label: '质量合格率' },
        { id: 'pendingTasks', visible: true, color: '#FF9800', label: '待处理任务' },
        { id: 'alerts', visible: true, color: '#F44336', label: '告警数量' },
      ],
      items: StatCardConfigSchema,
      group: 'cards',
      order: 2,
    },
  },
};

/**
 * 快捷操作模块 Schema
 */
const QuickActionsModuleSchema: ModuleSchema = {
  moduleType: 'quick_actions',
  title: '快捷操作',
  description: '提供常用功能的快捷入口按钮',
  icon: 'lightning-bolt',
  groups: [
    { id: 'display', title: '显示设置', order: 1 },
    { id: 'actions', title: '操作配置', order: 2 },
  ],
  properties: {
    maxItems: {
      type: 'number',
      title: '最大显示数量',
      description: '最多显示的快捷操作按钮数量',
      default: 4,
      minimum: 2,
      maximum: 8,
      group: 'display',
      order: 1,
    },
    actions: {
      type: 'array',
      title: '快捷操作列表',
      description: '配置快捷操作按钮',
      default: [
        { id: 'newBatch', visible: true, label: '新建批次', route: 'CreateBatch', icon: 'plus-circle' },
        { id: 'qualityCheck', visible: true, label: '质检', route: 'QualityInspection', icon: 'check-circle' },
        { id: 'reports', visible: true, label: '报表', route: 'Reports', icon: 'chart-bar' },
        { id: 'settings', visible: true, label: '设置', route: 'Settings', icon: 'cog' },
      ],
      items: QuickActionConfigSchema,
      group: 'actions',
      order: 2,
    },
  },
};

/**
 * 开发者工具模块 Schema
 */
const DevToolsModuleSchema: ModuleSchema = {
  moduleType: 'dev_tools',
  title: '开发者工具',
  description: '开发调试工具面板，仅在开发模式下可见',
  icon: 'code',
  groups: [
    { id: 'debug', title: '调试设置', order: 1 },
  ],
  properties: {
    enableDebugMode: {
      type: 'boolean',
      title: '启用调试模式',
      description: '开启详细的调试日志输出',
      default: false,
      group: 'debug',
      order: 1,
    },
    showPerformanceMetrics: {
      type: 'boolean',
      title: '显示性能指标',
      description: '显示FPS、内存使用等性能数据',
      default: false,
      group: 'debug',
      order: 2,
    },
  },
};

// ============================================
// Schema 注册表
// ============================================

/**
 * 所有模块 Schema 的映射表
 */
const MODULE_SCHEMAS: Record<HomeModuleType, ModuleSchema> = {
  welcome: WelcomeModuleSchema,
  ai_insight: AIInsightModuleSchema,
  stats_grid: StatsGridModuleSchema,
  quick_actions: QuickActionsModuleSchema,
  dev_tools: DevToolsModuleSchema,
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取指定模块类型的 Schema
 * @param moduleType 模块类型
 * @returns 模块 Schema 定义
 */
export function getSchemaForModule(moduleType: HomeModuleType): ModuleSchema {
  const schema = MODULE_SCHEMAS[moduleType];
  if (!schema) {
    throw new Error(`未找到模块类型 "${moduleType}" 的 Schema 定义`);
  }
  return schema;
}

/**
 * 获取指定模块类型的默认配置
 * @param moduleType 模块类型
 * @returns 模块默认配置
 */
export function getDefaultConfig(moduleType: HomeModuleType): ModuleConfig {
  const schema = getSchemaForModule(moduleType);
  const config: ModuleConfig = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (propSchema.default !== undefined) {
      (config as Record<string, unknown>)[key] = deepClone(propSchema.default);
    }
  }

  return config;
}

/**
 * 获取所有模块的 Schema 列表
 * @returns 所有模块 Schema 数组
 */
export function getAllModuleSchemas(): ModuleSchema[] {
  return Object.values(MODULE_SCHEMAS);
}

/**
 * 验证模块配置是否符合 Schema
 * @param moduleType 模块类型
 * @param config 待验证的配置
 * @returns 验证结果
 */
export function validateModuleConfig(
  moduleType: HomeModuleType,
  config: ModuleConfig
): { valid: boolean; errors: string[] } {
  const schema = getSchemaForModule(moduleType);
  const errors: string[] = [];

  // 检查必填属性
  if (schema.required) {
    for (const requiredKey of schema.required) {
      if ((config as Record<string, unknown>)[requiredKey] === undefined) {
        errors.push(`缺少必填属性: ${requiredKey}`);
      }
    }
  }

  // 检查属性类型
  for (const [key, value] of Object.entries(config)) {
    const propSchema = schema.properties[key];
    if (propSchema) {
      const typeError = validatePropertyType(value, propSchema, key);
      if (typeError) {
        errors.push(typeError);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证属性类型
 */
function validatePropertyType(
  value: unknown,
  schema: PropertySchema,
  propName: string
): string | null {
  switch (schema.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `属性 "${propName}" 应为布尔值`;
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        return `属性 "${propName}" 应为数字`;
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `属性 "${propName}" 不能小于 ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `属性 "${propName}" 不能大于 ${schema.maximum}`;
      }
      break;
    case 'string':
      if (typeof value !== 'string') {
        return `属性 "${propName}" 应为字符串`;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        return `属性 "${propName}" 的值不在允许范围内`;
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        return `属性 "${propName}" 应为数组`;
      }
      break;
  }
  return null;
}

/**
 * 合并用户配置与默认配置
 * @param moduleType 模块类型
 * @param userConfig 用户配置
 * @returns 合并后的配置
 */
export function mergeWithDefaults(
  moduleType: HomeModuleType,
  userConfig?: ModuleConfig
): ModuleConfig {
  const defaultConfig = getDefaultConfig(moduleType);

  if (!userConfig) {
    return defaultConfig;
  }

  return {
    ...defaultConfig,
    ...userConfig,
  };
}

/**
 * 获取属性的显示标签
 * @param moduleType 模块类型
 * @param propertyKey 属性键
 * @returns 中文标签
 */
export function getPropertyLabel(
  moduleType: HomeModuleType,
  propertyKey: string
): string {
  const schema = getSchemaForModule(moduleType);
  const propSchema = schema.properties[propertyKey];
  return propSchema?.title || propertyKey;
}

/**
 * 获取枚举值的显示标签
 * @param schema 属性 Schema
 * @param value 枚举值
 * @returns 中文标签
 */
export function getEnumLabel(schema: PropertySchema, value: string): string {
  if (!schema.enum || !schema.enumLabels) {
    return value;
  }
  const index = schema.enum.indexOf(value);
  return index >= 0 ? (schema.enumLabels[index] || value) : value;
}

/**
 * 按分组获取属性
 * @param moduleType 模块类型
 * @returns 按分组组织的属性
 */
export function getPropertiesByGroup(
  moduleType: HomeModuleType
): Map<string, Array<{ key: string; schema: PropertySchema }>> {
  const schema = getSchemaForModule(moduleType);
  const grouped = new Map<string, Array<{ key: string; schema: PropertySchema }>>();

  // 初始化分组
  if (schema.groups) {
    for (const group of schema.groups) {
      grouped.set(group.id, []);
    }
  }
  grouped.set('other', []); // 未分组的属性

  // 分配属性到分组
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const groupId = propSchema.group || 'other';
    const groupProps = grouped.get(groupId) || [];
    groupProps.push({ key, schema: propSchema });
    grouped.set(groupId, groupProps);
  }

  // 按 order 排序每个分组内的属性
  grouped.forEach((props) => {
    props.sort((a, b) => (a.schema.order || 999) - (b.schema.order || 999));
  });

  return grouped;
}

/**
 * 深拷贝工具函数
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepClone) as T;
  }
  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

// ============================================
// 预定义卡片和操作选项
// ============================================

/**
 * 预定义的统计卡片选项
 */
export const PREDEFINED_STAT_CARDS: StatCardConfig[] = [
  { id: 'todayProduction', visible: true, color: '#4CAF50', label: '今日生产', icon: 'package', dataKey: 'todayProduction' },
  { id: 'qualityRate', visible: true, color: '#2196F3', label: '质量合格率', icon: 'check-circle', dataKey: 'qualityRate' },
  { id: 'pendingTasks', visible: true, color: '#FF9800', label: '待处理任务', icon: 'clock', dataKey: 'pendingTasks' },
  { id: 'alerts', visible: true, color: '#F44336', label: '告警数量', icon: 'alert-triangle', dataKey: 'alerts' },
  { id: 'inventory', visible: false, color: '#9C27B0', label: '库存数量', icon: 'archive', dataKey: 'inventory' },
  { id: 'monthlyOutput', visible: false, color: '#00BCD4', label: '月产量', icon: 'trending-up', dataKey: 'monthlyOutput' },
  { id: 'efficiency', visible: false, color: '#795548', label: '生产效率', icon: 'zap', dataKey: 'efficiency' },
  { id: 'orders', visible: false, color: '#607D8B', label: '订单数', icon: 'shopping-cart', dataKey: 'orders' },
];

/**
 * 预定义的快捷操作选项
 */
export const PREDEFINED_QUICK_ACTIONS: QuickActionConfig[] = [
  { id: 'newBatch', visible: true, label: '新建批次', route: 'CreateBatch', icon: 'plus-circle' },
  { id: 'qualityCheck', visible: true, label: '质检', route: 'QualityInspection', icon: 'check-circle' },
  { id: 'reports', visible: true, label: '报表', route: 'Reports', icon: 'chart-bar' },
  { id: 'settings', visible: true, label: '设置', route: 'Settings', icon: 'cog' },
  { id: 'materials', visible: false, label: '原料管理', route: 'MaterialManagement', icon: 'box' },
  { id: 'products', visible: false, label: '产品列表', route: 'ProductList', icon: 'package' },
  { id: 'orders', visible: false, label: '订单列表', route: 'OrderList', icon: 'shopping-cart' },
  { id: 'alertCenter', visible: false, label: '告警中心', route: 'AlertCenter', icon: 'bell' },
  { id: 'scan', visible: false, label: '扫码', route: 'ScanCode', icon: 'camera' },
  { id: 'trace', visible: false, label: '溯源查询', route: 'TraceQuery', icon: 'search' },
];

/**
 * 指标类型定义
 */
export const METRIC_TYPES = {
  qualityRate: { label: '质量合格率', unit: '%', icon: 'check-circle' },
  unitCost: { label: '单位成本', unit: '元', icon: 'dollar-sign' },
  avgCycle: { label: '平均周期', unit: '天', icon: 'clock' },
} as const;

export type MetricType = keyof typeof METRIC_TYPES;

// ============================================
// 导出
// ============================================

export {
  MODULE_SCHEMAS,
  WelcomeModuleSchema,
  AIInsightModuleSchema,
  StatsGridModuleSchema,
  QuickActionsModuleSchema,
  DevToolsModuleSchema,
  StatCardConfigSchema,
  QuickActionConfigSchema,
};
