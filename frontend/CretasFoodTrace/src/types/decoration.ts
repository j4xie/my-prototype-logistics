/**
 * 首页装饰系统类型定义
 * Home Decoration System Type Definitions
 */

/**
 * 首页模块类型
 */
export type HomeModuleType =
  | 'welcome'        // 欢迎区
  | 'ai_insight'     // AI洞察卡片
  | 'stats_grid'     // 统计网格
  | 'quick_actions'  // 快捷操作
  | 'dev_tools';     // 开发者工具

/**
 * 首页模块定义
 */
export interface HomeModule {
  id: string;
  type: HomeModuleType;
  name: string;
  visible: boolean;
  order: number;
  config?: ModuleConfig;

  // Bento Grid 位置和大小
  gridPosition: { x: number; y: number };
  gridSize: { w: 1 | 2; h: 1 | 2 };
}

/**
 * 模块配置
 */
export interface ModuleConfig {
  // AI洞察卡片配置
  showMetrics?: boolean;
  metricsToShow?: ('qualityRate' | 'unitCost' | 'avgCycle')[];

  // 统计网格配置
  cards?: StatCardConfig[];
  columns?: 2 | 3;

  // 快捷操作配置
  actions?: QuickActionConfig[];
  maxItems?: number;

  // 欢迎区配置
  showGreeting?: boolean;
  showWeather?: boolean;
  showDate?: boolean;

  // 开发者工具配置
  enableDebugMode?: boolean;
  showPerformanceMetrics?: boolean;
}

/**
 * 统计卡片配置
 */
export interface StatCardConfig {
  id: string;
  visible: boolean;
  icon?: string;
  color?: string;
  label?: string;
  dataKey?: string;
}

/**
 * 快捷操作配置
 */
export interface QuickActionConfig {
  id: string;
  visible: boolean;
  icon?: string;
  label?: string;
  route?: string;
  params?: Record<string, unknown>;
}

/**
 * 主题配置
 */
export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  cardBorderRadius: number;
  aiCardGradient?: [string, string];
  textColor?: string;
  cardBackgroundColor?: string;
}

/**
 * 时段类型
 */
export type TimeSlot = 'default' | 'morning' | 'afternoon' | 'evening';

/**
 * 布局状态
 */
export type LayoutStatus = 'draft' | 'published';

/**
 * 工厂首页布局配置
 */
export interface FactoryHomeLayout {
  factoryId: string;
  modules: HomeModule[];
  theme?: ThemeConfig;
  version: number;
  status: LayoutStatus;

  // 时段布局
  timeBasedEnabled: boolean;
  morningLayout?: HomeModule[];
  afternoonLayout?: HomeModule[];
  eveningLayout?: HomeModule[];

  // 网格配置
  gridColumns: number;

  // 元数据
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/**
 * UI语法定义 - 约束LLM生成
 */
export const UI_GRAMMAR = {
  required: ['stats_grid'] as const,
  optional: ['welcome', 'ai_insight', 'quick_actions', 'dev_tools'] as const,
  maxOccurrence: 5, // 允许同类型模块多次出现，支持更灵活的布局
  sizeConstraints: {
    welcome: { maxW: 2, maxH: 1 },
    ai_insight: { maxW: 2, maxH: 2 },
    stats_grid: { maxW: 2, maxH: 2 },
    quick_actions: { maxW: 2, maxH: 1 },
    dev_tools: { maxW: 1, maxH: 1 },
  },
  gridConfig: {
    minColumns: 2,
    maxColumns: 4,
    defaultColumns: 2,
  },
} as const;

/**
 * 默认主题配置
 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  primaryColor: '#2E7D32',
  secondaryColor: '#4CAF50',
  backgroundColor: '#F5F5F5',
  cardBorderRadius: 12,
  aiCardGradient: ['#1A237E', '#3949AB'],
  textColor: '#212121',
  cardBackgroundColor: '#FFFFFF',
};

/**
 * 默认布局配置
 */
export const DEFAULT_HOME_LAYOUT: HomeModule[] = [
  {
    id: 'welcome',
    type: 'welcome',
    name: '欢迎区',
    visible: true,
    order: 0,
    gridPosition: { x: 0, y: 0 },
    gridSize: { w: 2, h: 1 },
    config: {
      showGreeting: true,
      showDate: true,
    },
  },
  {
    id: 'ai_insight',
    type: 'ai_insight',
    name: 'AI洞察',
    visible: true,
    order: 1,
    gridPosition: { x: 0, y: 1 },
    gridSize: { w: 2, h: 1 },
    config: {
      showMetrics: true,
      metricsToShow: ['qualityRate', 'unitCost', 'avgCycle'],
    },
  },
  {
    id: 'stats_grid',
    type: 'stats_grid',
    name: '统计网格',
    visible: true,
    order: 2,
    gridPosition: { x: 0, y: 2 },
    gridSize: { w: 2, h: 2 },
    config: {
      columns: 2,
      cards: [
        { id: 'todayProduction', visible: true, color: '#4CAF50' },
        { id: 'qualityRate', visible: true, color: '#2196F3' },
        { id: 'pendingTasks', visible: true, color: '#FF9800' },
        { id: 'alerts', visible: true, color: '#F44336' },
      ],
    },
  },
  {
    id: 'quick_actions',
    type: 'quick_actions',
    name: '快捷操作',
    visible: true,
    order: 3,
    gridPosition: { x: 0, y: 4 },
    gridSize: { w: 2, h: 1 },
    config: {
      maxItems: 4,
      actions: [
        { id: 'newBatch', visible: true, label: '新建批次', route: 'CreateBatch' },
        { id: 'qualityCheck', visible: true, label: '质检', route: 'QualityInspection' },
        { id: 'reports', visible: true, label: '报表', route: 'Reports' },
        { id: 'settings', visible: true, label: '设置', route: 'Settings' },
      ],
    },
  },
  {
    id: 'dev_tools',
    type: 'dev_tools',
    name: '开发者工具',
    visible: false,
    order: 4,
    gridPosition: { x: 0, y: 5 },
    gridSize: { w: 1, h: 1 },
    config: {
      enableDebugMode: false,
      showPerformanceMetrics: false,
    },
  },
];

/**
 * 创建默认工厂布局
 */
export function createDefaultFactoryLayout(factoryId: string): FactoryHomeLayout {
  return {
    factoryId,
    modules: [...DEFAULT_HOME_LAYOUT],
    theme: { ...DEFAULT_THEME_CONFIG },
    version: 1,
    status: 'draft',
    timeBasedEnabled: false,
    gridColumns: 2,
  };
}

// ============================================
// API 相关类型
// ============================================

/**
 * AI操作类型
 */
export type AIOperationType = 'generate' | 'add_component' | 'update_style';

/**
 * AI建议操作
 */
export interface AISuggestedAction {
  actionCode: string;
  actionName: string;
  description: string;
}

/**
 * AI布局生成请求
 */
export interface AILayoutGenerateRequest {
  prompt: string;
  currentLayout?: HomeModule[];
  stylePreference?: string;
  factoryId?: string;
  /** 页面类型 */
  pageType?: string;
  /** 操作类型: generate, add_component, update_style */
  operationType?: AIOperationType;
  /** 当前主题配置 */
  currentTheme?: ThemeConfig;
}

/**
 * AI布局生成响应
 */
export interface AILayoutGenerateResponse {
  success: boolean;
  layout?: HomeModule[];
  /** 生成的模块列表（与 layout 同义，支持两种字段名） */
  modules?: HomeModule[];
  theme?: ThemeConfig;
  /** 主题配置（与 theme 同义，支持两种字段名） */
  themeConfig?: ThemeConfig;
  explanation?: string;
  /** AI生成的消息/说明 */
  aiMessage?: string;
  suggestions?: string[];
  /** AI建议的后续操作 */
  suggestedActions?: AISuggestedAction[];
  needsClarification?: boolean;
  clarificationQuestions?: string[];
}

/**
 * 保存布局请求
 */
export interface SaveLayoutRequest {
  modules: HomeModule[];
  theme?: ThemeConfig;
  timeBasedEnabled?: boolean;
  morningModules?: HomeModule[];
  afternoonModules?: HomeModule[];
  eveningModules?: HomeModule[];
  gridColumns?: number;
}

/**
 * 保存布局响应
 */
export interface SaveLayoutResponse {
  success: boolean;
  version: number;
  message: string;
  updatedAt?: string;
}

/**
 * 发布布局请求
 */
export interface PublishLayoutRequest {
  version: number;
}

/**
 * 发布布局响应
 */
export interface PublishLayoutResponse {
  success: boolean;
  publishedAt: string;
  message: string;
}

/**
 * 后端返回的首页布局DTO
 * 字段命名与后端Java DTO对应
 */
export interface BackendHomeLayoutDTO {
  factoryId: string;
  modules: HomeModule[];
  theme?: ThemeConfig;
  version?: number;
  status?: number; // 0=草稿, 1=已发布
  timeBasedEnabled?: boolean;
  morningModules?: HomeModule[];
  afternoonModules?: HomeModule[];
  eveningModules?: HomeModule[];
  gridColumns?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 获取布局响应
 */
export interface GetLayoutResponse {
  success: boolean;
  data: BackendHomeLayoutDTO | null;
  message?: string;
}

// ============================================
// 工具类型
// ============================================

/**
 * 模块移动操作
 */
export interface ModuleMoveOperation {
  moduleId: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
}

/**
 * 模块调整大小操作
 */
export interface ModuleResizeOperation {
  moduleId: string;
  fromSize: { w: 1 | 2; h: 1 | 2 };
  toSize: { w: 1 | 2; h: 1 | 2 };
}

/**
 * 布局历史记录项
 */
export interface LayoutHistoryItem {
  timestamp: number;
  action: 'move' | 'resize' | 'toggle' | 'reorder' | 'config' | 'ai_apply' | 'reset';
  moduleId?: string;
  previousState: HomeModule[];
  description: string;
}

/**
 * 验证布局结果
 */
export interface LayoutValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证布局是否符合UI语法规则
 */
export function validateLayout(modules: HomeModule[]): LayoutValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查必需模块
  const requiredTypes = UI_GRAMMAR.required;
  for (const requiredType of requiredTypes) {
    const found = modules.find((m) => m.type === requiredType && m.visible);
    if (!found) {
      errors.push(`缺少必需模块: ${requiredType}`);
    }
  }

  // 检查模块重复
  const typeCounts = new Map<HomeModuleType, number>();
  for (const module of modules) {
    const count = typeCounts.get(module.type) || 0;
    typeCounts.set(module.type, count + 1);
  }

  for (const [type, count] of typeCounts) {
    if (count > UI_GRAMMAR.maxOccurrence) {
      errors.push(`模块 ${type} 出现次数超过限制 (最多 ${UI_GRAMMAR.maxOccurrence} 次)`);
    }
  }

  // 检查尺寸约束
  for (const module of modules) {
    const constraint = UI_GRAMMAR.sizeConstraints[module.type];
    if (constraint) {
      if (module.gridSize.w > constraint.maxW) {
        warnings.push(`模块 ${module.name} 宽度超过建议值 (建议最大 ${constraint.maxW})`);
      }
      if (module.gridSize.h > constraint.maxH) {
        warnings.push(`模块 ${module.name} 高度超过建议值 (建议最大 ${constraint.maxH})`);
      }
    }
  }

  // 检查位置重叠
  const visibleModules = modules.filter((m) => m.visible);
  for (let i = 0; i < visibleModules.length; i++) {
    for (let j = i + 1; j < visibleModules.length; j++) {
      const a = visibleModules[i];
      const b = visibleModules[j];
      if (a && b && modulesOverlap(a, b)) {
        warnings.push(`模块 ${a.name} 和 ${b.name} 位置重叠`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 检查两个模块是否重叠
 */
function modulesOverlap(a: HomeModule, b: HomeModule): boolean {
  const aRight = a.gridPosition.x + a.gridSize.w;
  const aBottom = a.gridPosition.y + a.gridSize.h;
  const bRight = b.gridPosition.x + b.gridSize.w;
  const bBottom = b.gridPosition.y + b.gridSize.h;

  return !(
    aRight <= b.gridPosition.x ||
    bRight <= a.gridPosition.x ||
    aBottom <= b.gridPosition.y ||
    bBottom <= a.gridPosition.y
  );
}

/**
 * 根据当前时间获取时段
 */
export function getCurrentTimeSlot(): TimeSlot {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 18) {
    return 'afternoon';
  } else if (hour >= 18 && hour < 22) {
    return 'evening';
  }

  return 'default';
}

/**
 * 深拷贝模块数组
 */
export function cloneModules(modules: HomeModule[]): HomeModule[] {
  return modules.map((m) => ({
    ...m,
    gridPosition: { ...m.gridPosition },
    gridSize: { ...m.gridSize },
    config: m.config ? { ...m.config } : undefined,
  }));
}
