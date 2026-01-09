/**
 * SKU 配置行业标准模板
 *
 * 模板信息来源:
 * - GB/T 23586-2022《酱卤肉制品质量通则》
 * - GB 19295-2021《速冻面米与调制食品》
 * - T/CIFST《预制菜生产通用技术规范》团体标准
 * - 《鲜切蔬菜行业标准》农业部2011
 * - HACCP体系认证实施规则 CNCA-N-001:2021
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { ProcessingStep, SkillRequirement } from '../services/api/productTypeApiClient';

// ==================== 类型定义 ====================

/**
 * SKU 模板配置
 */
export interface SkuTemplate {
  /** 模板ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 图标名称 (react-native-paper Icon) */
  icon: string;
  /** 主题色 */
  color: string;
  /** 适用产品类型示例 */
  examples: string[];
  /** 参考标准 */
  standardReference: string;

  /** 工时范围 (小时) */
  workHoursRange: { min: number; max: number };
  /** 默认工时 */
  defaultWorkHours: number;
  /** 复杂度评分 (1-5) */
  complexityScore: number;

  /** 加工步骤 */
  processingSteps: ProcessingStep[];
  /** 技能要求 */
  skillRequirements: SkillRequirement;

  /** 关键控制点 (CCP) 说明 */
  criticalControlPoints: CriticalControlPoint[];
}

/**
 * 关键控制点 (HACCP CCP)
 */
export interface CriticalControlPoint {
  /** CCP 编号 */
  id: string;
  /** 控制点名称 */
  name: string;
  /** 关联步骤索引 */
  stepIndex: number;
  /** 控制标准 */
  standard: string;
  /** 监控方法 */
  monitoringMethod: string;
}

// ==================== ProcessingStageType 枚举值 ====================

/**
 * 加工环节类型 (与后端 ProcessingStageType 枚举对应)
 */
export const ProcessingStageType = {
  // 收货类
  RECEIVING: 'RECEIVING',

  // 温控类
  THAWING: 'THAWING',         // 解冻
  COOLING: 'COOLING',         // 冷却
  FREEZING: 'FREEZING',       // 速冻
  CHILLING: 'CHILLING',       // 冷藏

  // 预处理类
  TRIMMING: 'TRIMMING',       // 修整
  WASHING: 'WASHING',         // 清洗
  DRAINING: 'DRAINING',       // 沥水

  // 切割类
  SLICING: 'SLICING',         // 切片
  DICING: 'DICING',           // 切丁
  MINCING: 'MINCING',         // 绞碎

  // 调味类
  MARINATING: 'MARINATING',   // 腌制
  SEASONING: 'SEASONING',     // 调味

  // 熟制类
  COOKING: 'COOKING',         // 蒸煮
  FRYING: 'FRYING',           // 油炸
  BAKING: 'BAKING',           // 烘烤
  STEAMING: 'STEAMING',       // 蒸制

  // 包装类
  PACKAGING: 'PACKAGING',     // 包装
  LABELING: 'LABELING',       // 标签
  BOXING: 'BOXING',           // 装箱

  // 质检类
  QUALITY_CHECK: 'QUALITY_CHECK',       // 质检
  METAL_DETECTION: 'METAL_DETECTION',   // 金属检测
  WEIGHT_CHECK: 'WEIGHT_CHECK',         // 称重

  // 其他
  CLEANING: 'CLEANING',       // 清洁
  LINE_CHANGE: 'LINE_CHANGE', // 换线
  OTHER: 'OTHER',             // 其他
} as const;

// ==================== 6 个行业标准模板 ====================

/**
 * 模板1: 水产品预制菜 (海鲜类)
 * 参考: HACCP体系认证实施规则 + T/CIFST预制菜团标
 */
const SEAFOOD_TEMPLATE: SkuTemplate = {
  id: 'SEAFOOD_PREFAB',
  name: '水产品预制菜',
  description: '适用于海鲜类预制菜生产，包含完整HACCP控制点',
  icon: 'fish',
  color: '#1890ff',
  examples: ['鱼香虾仁', '蒜蓉扇贝', '清蒸鲈鱼', '红烧带鱼'],
  standardReference: 'HACCP体系 + T/CIFST预制菜团标',

  workHoursRange: { min: 4.0, max: 6.0 },
  defaultWorkHours: 5.0,
  complexityScore: 4,

  processingSteps: [
    { stageType: ProcessingStageType.RECEIVING, orderIndex: 1, requiredSkillLevel: 2, estimatedMinutes: 30, notes: 'CCP1: 原料温度≤4℃，感官合格' },
    { stageType: ProcessingStageType.CHILLING, orderIndex: 2, requiredSkillLevel: 2, estimatedMinutes: 60, notes: '冷藏暂存0-4℃' },
    { stageType: ProcessingStageType.THAWING, orderIndex: 3, requiredSkillLevel: 3, estimatedMinutes: 120, notes: '低温解冻0-4℃' },
    { stageType: ProcessingStageType.WASHING, orderIndex: 4, requiredSkillLevel: 2, estimatedMinutes: 30, notes: '清洗3次' },
    { stageType: ProcessingStageType.TRIMMING, orderIndex: 5, requiredSkillLevel: 4, estimatedMinutes: 45, notes: '去皮/剥壳/去内脏' },
    { stageType: ProcessingStageType.SLICING, orderIndex: 6, requiredSkillLevel: 3, estimatedMinutes: 30, notes: '切割分级' },
    { stageType: ProcessingStageType.MARINATING, orderIndex: 7, requiredSkillLevel: 3, estimatedMinutes: 60, notes: '调味/腌制' },
    { stageType: ProcessingStageType.COOKING, orderIndex: 8, requiredSkillLevel: 4, estimatedMinutes: 30, notes: 'CCP2: 中心温度≥70℃保持2分钟' },
    { stageType: ProcessingStageType.COOLING, orderIndex: 9, requiredSkillLevel: 3, estimatedMinutes: 120, notes: '快速冷却，2h内降至10℃以下' },
    { stageType: ProcessingStageType.PACKAGING, orderIndex: 10, requiredSkillLevel: 3, estimatedMinutes: 20, notes: 'CCP3: 包装间温度≤15℃，操作≤45分钟' },
    { stageType: ProcessingStageType.FREEZING, orderIndex: 11, requiredSkillLevel: 2, estimatedMinutes: 240, notes: '速冻-25℃以下' },
    { stageType: ProcessingStageType.METAL_DETECTION, orderIndex: 12, requiredSkillLevel: 2, estimatedMinutes: 10, notes: 'CCP4: Fe≤2.0mm, SUS≤2.5mm' },
  ],

  skillRequirements: {
    minLevel: 3,
    preferredLevel: 4,
    specialSkills: ['水产处理', '温控操作', 'HACCP认证'],
  },

  criticalControlPoints: [
    { id: 'CCP1', name: '原料验收', stepIndex: 0, standard: '温度≤4℃，感官合格', monitoringMethod: '温度计测量+感官检查' },
    { id: 'CCP2', name: '烹调杀菌', stepIndex: 7, standard: '中心温度≥70℃保持2分钟', monitoringMethod: '中心温度计' },
    { id: 'CCP3', name: '真空包装', stepIndex: 9, standard: '包装间温度≤15℃，操作≤45分钟', monitoringMethod: '环境温度计+计时器' },
    { id: 'CCP4', name: '金属检测', stepIndex: 11, standard: 'Fe≤2.0mm, SUS≤2.5mm', monitoringMethod: '金属检测仪' },
  ],
};

/**
 * 模板2: 肉类调理制品 (猪牛禽类)
 * 参考: GB/T 23586-2022 + HACCP
 */
const MEAT_TEMPLATE: SkuTemplate = {
  id: 'MEAT_PREPARED',
  name: '肉类调理制品',
  description: '适用于猪牛禽类调理制品生产',
  icon: 'food-steak',
  color: '#eb2f96',
  examples: ['红烧肉', '糖醋排骨', '宫保鸡丁', '牛腩块'],
  standardReference: 'GB/T 23586-2022《酱卤肉制品质量通则》',

  workHoursRange: { min: 3.0, max: 5.0 },
  defaultWorkHours: 4.0,
  complexityScore: 3,

  processingSteps: [
    { stageType: ProcessingStageType.RECEIVING, orderIndex: 1, requiredSkillLevel: 2, estimatedMinutes: 30, notes: 'CCP1: 肉品新鲜度、兽医检疫合格' },
    { stageType: ProcessingStageType.CHILLING, orderIndex: 2, requiredSkillLevel: 2, estimatedMinutes: 60, notes: '冷藏暂存0-4℃' },
    { stageType: ProcessingStageType.THAWING, orderIndex: 3, requiredSkillLevel: 2, estimatedMinutes: 90, notes: '流水或低温解冻' },
    { stageType: ProcessingStageType.TRIMMING, orderIndex: 4, requiredSkillLevel: 3, estimatedMinutes: 40, notes: '分割切块300-500g' },
    { stageType: ProcessingStageType.MARINATING, orderIndex: 5, requiredSkillLevel: 3, estimatedMinutes: 180, notes: '盐水注射8-12%，腌制0-4℃' },
    { stageType: ProcessingStageType.SEASONING, orderIndex: 6, requiredSkillLevel: 3, estimatedMinutes: 30, notes: '滚揉(真空, 2-5℃)' },
    { stageType: ProcessingStageType.COOKING, orderIndex: 7, requiredSkillLevel: 4, estimatedMinutes: 60, notes: 'CCP2: 中心温度≥72℃保持15秒' },
    { stageType: ProcessingStageType.COOLING, orderIndex: 8, requiredSkillLevel: 3, estimatedMinutes: 120, notes: '冷却成熟2-4℃' },
    { stageType: ProcessingStageType.SLICING, orderIndex: 9, requiredSkillLevel: 3, estimatedMinutes: 30, notes: '切片/分装' },
    { stageType: ProcessingStageType.PACKAGING, orderIndex: 10, requiredSkillLevel: 2, estimatedMinutes: 20, notes: '真空包装' },
    { stageType: ProcessingStageType.METAL_DETECTION, orderIndex: 11, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '金属检测' },
  ],

  skillRequirements: {
    minLevel: 2,
    preferredLevel: 3,
    specialSkills: ['肉品分割', '腌制滚揉', '熟制操作'],
  },

  criticalControlPoints: [
    { id: 'CCP1', name: '原料验收', stepIndex: 0, standard: '兽医检疫合格，新鲜度达标', monitoringMethod: '检疫证明+感官检查' },
    { id: 'CCP2', name: '蒸煮杀菌', stepIndex: 6, standard: '中心温度≥72℃保持15秒', monitoringMethod: '中心温度计' },
  ],
};

/**
 * 模板3: 酱卤肉制品 (卤制熟食)
 * 参考: GB/T 23586-2022《酱卤肉制品质量通则》
 */
const BRAISED_MEAT_TEMPLATE: SkuTemplate = {
  id: 'BRAISED_MEAT',
  name: '酱卤肉制品',
  description: '适用于卤制熟食类产品生产',
  icon: 'pot-steam',
  color: '#fa8c16',
  examples: ['卤牛肉', '酱鸭', '卤猪蹄', '五香牛腱'],
  standardReference: 'GB/T 23586-2022《酱卤肉制品质量通则》',

  workHoursRange: { min: 3.0, max: 4.0 },
  defaultWorkHours: 3.5,
  complexityScore: 3,

  processingSteps: [
    { stageType: ProcessingStageType.RECEIVING, orderIndex: 1, requiredSkillLevel: 2, estimatedMinutes: 30, notes: '原料验收' },
    { stageType: ProcessingStageType.THAWING, orderIndex: 2, requiredSkillLevel: 2, estimatedMinutes: 60, notes: '解冻/清洗' },
    { stageType: ProcessingStageType.TRIMMING, orderIndex: 3, requiredSkillLevel: 3, estimatedMinutes: 45, notes: '修整(剔骨、切块0.7-0.8kg)' },
    { stageType: ProcessingStageType.COOKING, orderIndex: 4, requiredSkillLevel: 3, estimatedMinutes: 15, notes: '焯水(沸水15分钟, 撇血污)' },
    { stageType: ProcessingStageType.WASHING, orderIndex: 5, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '清洗' },
    { stageType: ProcessingStageType.SEASONING, orderIndex: 6, requiredSkillLevel: 4, estimatedMinutes: 60, notes: '卤汁配制(香辛料纱布包, 小火1h)' },
    { stageType: ProcessingStageType.COOKING, orderIndex: 7, requiredSkillLevel: 4, estimatedMinutes: 60, notes: 'CCP: 卤制(旺火开后中火40-60分钟，翻锅2-3次)' },
    { stageType: ProcessingStageType.COOLING, orderIndex: 8, requiredSkillLevel: 2, estimatedMinutes: 60, notes: '出锅晾凉' },
    { stageType: ProcessingStageType.SLICING, orderIndex: 9, requiredSkillLevel: 3, estimatedMinutes: 20, notes: '切分' },
    { stageType: ProcessingStageType.PACKAGING, orderIndex: 10, requiredSkillLevel: 2, estimatedMinutes: 15, notes: '真空包装' },
    { stageType: ProcessingStageType.CHILLING, orderIndex: 11, requiredSkillLevel: 2, estimatedMinutes: 30, notes: '冷藏(0-4℃)/速冻(-18℃)' },
  ],

  skillRequirements: {
    minLevel: 3,
    preferredLevel: 4,
    specialSkills: ['卤汤调配', '焯水去腥', '火候控制'],
  },

  criticalControlPoints: [
    { id: 'CCP1', name: '焯水', stepIndex: 3, standard: '沸水15分钟，彻底去血污', monitoringMethod: '计时器+感官检查' },
    { id: 'CCP2', name: '卤制', stepIndex: 6, standard: '中心温度≥85℃', monitoringMethod: '中心温度计' },
  ],
};

/**
 * 模板4: 速冻面米制品 (饺子/包子/点心)
 * 参考: GB 19295-2021《速冻面米与调制食品》
 */
const FROZEN_DUMPLING_TEMPLATE: SkuTemplate = {
  id: 'FROZEN_DUMPLING',
  name: '速冻面米制品',
  description: '适用于饺子、包子、点心等速冻面米食品',
  icon: 'food-croissant',
  color: '#722ed1',
  examples: ['速冻水饺', '速冻包子', '速冻汤圆', '速冻馄饨'],
  standardReference: 'GB 19295-2021《速冻面米与调制食品》',

  workHoursRange: { min: 2.0, max: 3.0 },
  defaultWorkHours: 2.5,
  complexityScore: 2,

  processingSteps: [
    { stageType: ProcessingStageType.RECEIVING, orderIndex: 1, requiredSkillLevel: 2, estimatedMinutes: 20, notes: '原料验收' },
    // 面皮线
    { stageType: ProcessingStageType.SEASONING, orderIndex: 2, requiredSkillLevel: 3, estimatedMinutes: 20, notes: '和面(计量准确, 加水定量)' },
    { stageType: ProcessingStageType.OTHER, orderIndex: 3, requiredSkillLevel: 2, estimatedMinutes: 5, notes: '静置5分钟' },
    { stageType: ProcessingStageType.SLICING, orderIndex: 4, requiredSkillLevel: 3, estimatedMinutes: 30, notes: '制皮' },
    // 馅料线
    { stageType: ProcessingStageType.MINCING, orderIndex: 5, requiredSkillLevel: 3, estimatedMinutes: 20, notes: '原料切碎/绞制' },
    { stageType: ProcessingStageType.SEASONING, orderIndex: 6, requiredSkillLevel: 3, estimatedMinutes: 15, notes: '调味拌馅' },
    // 成型
    { stageType: ProcessingStageType.OTHER, orderIndex: 7, requiredSkillLevel: 3, estimatedMinutes: 60, notes: '包馅成型' },
    { stageType: ProcessingStageType.FREEZING, orderIndex: 8, requiredSkillLevel: 2, estimatedMinutes: 240, notes: 'CCP: 速冻(-24℃以下, 4h)' },
    { stageType: ProcessingStageType.METAL_DETECTION, orderIndex: 9, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '金属检测' },
    { stageType: ProcessingStageType.WEIGHT_CHECK, orderIndex: 10, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '计量' },
    { stageType: ProcessingStageType.PACKAGING, orderIndex: 11, requiredSkillLevel: 2, estimatedMinutes: 15, notes: '包装入库(-18℃以下)' },
  ],

  skillRequirements: {
    minLevel: 2,
    preferredLevel: 3,
    specialSkills: ['面团调制', '馅料制作', '速冻操作'],
  },

  criticalControlPoints: [
    { id: 'CCP1', name: '速冻', stepIndex: 7, standard: '-24℃以下，产品中心4h内达-25℃', monitoringMethod: '速冻隧道温度计' },
  ],
};

/**
 * 模板5: 净菜加工 (蔬菜切配)
 * 参考: 《鲜切蔬菜行业标准》农业部2011
 */
const FRESH_CUT_VEGETABLE_TEMPLATE: SkuTemplate = {
  id: 'FRESH_CUT_VEG',
  name: '净菜加工',
  description: '适用于鲜切蔬菜、沙拉配菜等净菜加工',
  icon: 'leaf',
  color: '#52c41a',
  examples: ['沙拉配菜', '火锅蔬菜拼盘', '预切葱姜蒜', '蔬菜丝/片'],
  standardReference: '《鲜切蔬菜行业标准》农业部2011',

  workHoursRange: { min: 1.0, max: 2.0 },
  defaultWorkHours: 1.5,
  complexityScore: 2,

  processingSteps: [
    { stageType: ProcessingStageType.RECEIVING, orderIndex: 1, requiredSkillLevel: 2, estimatedMinutes: 15, notes: '原料分级挑选' },
    { stageType: ProcessingStageType.WASHING, orderIndex: 2, requiredSkillLevel: 2, estimatedMinutes: 30, notes: '浸泡(≤2h)' },
    { stageType: ProcessingStageType.WASHING, orderIndex: 3, requiredSkillLevel: 2, estimatedMinutes: 20, notes: '气泡/涡流清洗(3次)' },
    { stageType: ProcessingStageType.OTHER, orderIndex: 4, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '消毒(次氯酸钠或臭氧)' },
    { stageType: ProcessingStageType.DRAINING, orderIndex: 5, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '沥水' },
    { stageType: ProcessingStageType.SLICING, orderIndex: 6, requiredSkillLevel: 3, estimatedMinutes: 30, notes: '切分(丝/片/块/末)' },
    { stageType: ProcessingStageType.WASHING, orderIndex: 7, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '二次冲洗' },
    { stageType: ProcessingStageType.OTHER, orderIndex: 8, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '护色处理(可选)' },
    { stageType: ProcessingStageType.DRAINING, orderIndex: 9, requiredSkillLevel: 2, estimatedMinutes: 15, notes: '离心脱水' },
    { stageType: ProcessingStageType.OTHER, orderIndex: 10, requiredSkillLevel: 2, estimatedMinutes: 10, notes: '紫外/臭氧灭菌' },
    { stageType: ProcessingStageType.PACKAGING, orderIndex: 11, requiredSkillLevel: 2, estimatedMinutes: 15, notes: '气调/真空包装' },
    { stageType: ProcessingStageType.CHILLING, orderIndex: 12, requiredSkillLevel: 2, estimatedMinutes: 20, notes: '冷藏(4-8℃)入库' },
  ],

  skillRequirements: {
    minLevel: 2,
    preferredLevel: 3,
    specialSkills: ['蔬菜分级', '消毒护色', '气调包装'],
  },

  criticalControlPoints: [
    { id: 'CCP1', name: '浸泡时间', stepIndex: 1, standard: '≤2小时', monitoringMethod: '计时器' },
    { id: 'CCP2', name: '切分操作', stepIndex: 5, standard: '锋利不锈钢刀，减少切割次数', monitoringMethod: '感官检查' },
    { id: 'CCP3', name: '冷藏温度', stepIndex: 11, standard: '4-8℃，避免冷害', monitoringMethod: '冷库温度计' },
  ],
};

/**
 * 模板6: 代加工/OEM定制 (自定义)
 * 完全由用户自定义，系统提供标准工序库供选择
 */
const OEM_CUSTOM_TEMPLATE: SkuTemplate = {
  id: 'OEM_CUSTOM',
  name: '代加工/OEM定制',
  description: '适用于代加工厂定制生产，用户可完全自定义工艺流程',
  icon: 'cog-outline',
  color: '#8c8c8c',
  examples: ['客户定制产品', '代工生产', '贴牌产品', '新品研发'],
  standardReference: '用户自定义，参考HACCP体系',

  workHoursRange: { min: 0.5, max: 24.0 },
  defaultWorkHours: 3.0,
  complexityScore: 3,

  // OEM 模板默认为空，用户自行添加
  processingSteps: [],

  skillRequirements: {
    minLevel: 2,
    preferredLevel: 3,
    specialSkills: [],
  },

  criticalControlPoints: [],
};

// ==================== 导出 ====================

/**
 * 所有可用的 SKU 模板列表
 */
export const SKU_TEMPLATES: SkuTemplate[] = [
  SEAFOOD_TEMPLATE,
  MEAT_TEMPLATE,
  BRAISED_MEAT_TEMPLATE,
  FROZEN_DUMPLING_TEMPLATE,
  FRESH_CUT_VEGETABLE_TEMPLATE,
  OEM_CUSTOM_TEMPLATE,
];

/**
 * 按模板ID获取模板
 */
export function getSkuTemplateById(templateId: string): SkuTemplate | undefined {
  return SKU_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * 获取模板的简化信息 (用于选择器显示)
 */
export interface SkuTemplateSimple {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  complexityScore: number;
}

export function getSimpleTemplates(): SkuTemplateSimple[] {
  return SKU_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    color: t.color,
    description: t.description,
    complexityScore: t.complexityScore,
  }));
}

/**
 * 可用的加工环节类型列表 (用于OEM自定义)
 */
export const AVAILABLE_STAGE_TYPES = Object.entries(ProcessingStageType).map(([key, value]) => ({
  key,
  value,
  label: getStageTypeLabel(value),
}));

/**
 * 获取加工环节类型的中文标签
 */
export function getStageTypeLabel(stageType: string): string {
  const labels: Record<string, string> = {
    RECEIVING: '收货验收',
    THAWING: '解冻',
    COOLING: '冷却',
    FREEZING: '速冻',
    CHILLING: '冷藏',
    TRIMMING: '修整',
    WASHING: '清洗',
    DRAINING: '沥水',
    SLICING: '切片',
    DICING: '切丁',
    MINCING: '绞碎',
    MARINATING: '腌制',
    SEASONING: '调味',
    COOKING: '蒸煮',
    FRYING: '油炸',
    BAKING: '烘烤',
    STEAMING: '蒸制',
    PACKAGING: '包装',
    LABELING: '标签',
    BOXING: '装箱',
    QUALITY_CHECK: '质检',
    METAL_DETECTION: '金属检测',
    WEIGHT_CHECK: '称重',
    CLEANING: '清洁',
    LINE_CHANGE: '换线',
    OTHER: '其他',
  };
  return labels[stageType] || stageType;
}

export default SKU_TEMPLATES;
