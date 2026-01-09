/**
 * SKU 配置 AI Prompt 模板与解析器
 *
 * 用于语音配置 SKU 时的 AI 识别和参数提取
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { ProcessingStageType, getStageTypeLabel } from '../../config/skuTemplates';
import type { ProcessingStep, SkillRequirement } from '../api/productTypeApiClient';

// ==================== AI 响应类型 ====================

/**
 * AI 响应动作类型
 */
export type AIResponseAction =
  | 'extract'      // 提取到配置参数
  | 'confirm'      // 请求用户确认
  | 'prompt'       // 需要用户提供更多信息
  | 'complete'     // 配置完成
  | 'error';       // 识别错误

/**
 * AI 响应结构
 */
export interface SkuConfigAIResponse {
  /** 动作类型 */
  action: AIResponseAction;
  /** 提取的 SKU 配置 (action=extract/confirm/complete 时存在) */
  skuConfig?: ExtractedSkuConfig;
  /** AI 消息 (用于 TTS 播报) */
  message: string;
  /** 需要用户补充的字段 (action=prompt 时存在) */
  missingFields?: string[];
  /** 置信度 (0-1) */
  confidence?: number;
}

/**
 * 提取的 SKU 配置
 */
export interface ExtractedSkuConfig {
  /** 工时 (小时) */
  workHours?: number;
  /** 复杂度评分 (1-5) */
  complexityScore?: number;
  /** 加工步骤 */
  processingSteps?: ProcessingStep[];
  /** 技能要求 */
  skillRequirements?: SkillRequirement;
  /** 检测到的产品类型关键词 */
  detectedProductType?: string;
  /** 参考的模板ID */
  suggestedTemplateId?: string;
}

// ==================== Prompt 模板 ====================

/**
 * 获取所有加工环节类型的描述
 */
function getStageTypesDescription(): string {
  return Object.entries(ProcessingStageType)
    .map(([_, value]) => `  - ${value}: ${getStageTypeLabel(value)}`)
    .join('\n');
}

/**
 * SKU 配置识别 System Prompt
 */
export const SKU_CONFIG_SYSTEM_PROMPT = `你是一个食品加工行业的 SKU 配置助手。你的任务是从用户的语音输入中提取产品类型的加工配置参数。

## 可用的加工环节类型 (ProcessingStageType):
${getStageTypesDescription()}

## 行业参考标准:
- 水产品: HACCP体系，CCP包括原料验收、烹调杀菌、真空包装、金属检测
- 肉类: GB/T 23586-2022，中心温度≥72℃保持15秒
- 酱卤制品: GB/T 23586-2022，卤制中心温度≥85℃
- 速冻面米: GB 19295-2021，速冻温度-24℃以下
- 净菜: 农业部2011标准，浸泡≤2小时，冷藏4-8℃

## 输出格式要求:
必须返回有效的 JSON 对象，包含以下字段:
{
  "action": "extract" | "confirm" | "prompt" | "complete" | "error",
  "skuConfig": {
    "workHours": number,          // 工时(小时)，如4.5
    "complexityScore": number,    // 复杂度1-5
    "processingSteps": [          // 加工步骤数组
      {
        "stageType": "RECEIVING", // 必须是上面列出的类型之一
        "orderIndex": 1,          // 步骤序号，从1开始
        "requiredSkillLevel": 2,  // 技能等级1-5
        "estimatedMinutes": 30,   // 预估时间(分钟)
        "notes": "备注说明"
      }
    ],
    "skillRequirements": {
      "minLevel": 2,
      "preferredLevel": 3,
      "specialSkills": ["技能1", "技能2"]
    },
    "detectedProductType": "检测到的产品类型描述",
    "suggestedTemplateId": "SEAFOOD_PREFAB" // 可选的模板建议
  },
  "message": "给用户的回复消息，用于TTS播报",
  "missingFields": ["workHours"], // action=prompt 时，列出缺失的字段
  "confidence": 0.85              // 识别置信度
}

## 行为规则:
1. 如果用户提供了完整信息，action 为 "extract"
2. 如果信息不完整，action 为 "prompt"，并在 message 中询问缺失信息
3. 如果用户确认配置，action 为 "complete"
4. 如果无法理解用户意图，action 为 "error"
5. 根据用户描述的产品类型，推荐合适的模板 (suggestedTemplateId)

## 模板ID参考:
- SEAFOOD_PREFAB: 水产品预制菜(海鲜)
- MEAT_PREPARED: 肉类调理制品(猪牛禽)
- BRAISED_MEAT: 酱卤肉制品(卤味)
- FROZEN_DUMPLING: 速冻面米制品(饺子/包子)
- FRESH_CUT_VEG: 净菜加工(蔬菜切配)
- OEM_CUSTOM: 代加工/OEM定制`;

/**
 * 构建用户消息 Prompt
 */
export function buildUserPrompt(userInput: string, context?: string): string {
  let prompt = `用户输入: "${userInput}"`;

  if (context) {
    prompt += `\n\n当前上下文: ${context}`;
  }

  prompt += `\n\n请分析用户输入，提取SKU配置参数，返回JSON格式响应。`;

  return prompt;
}

// ==================== 响应解析器 ====================

/**
 * 解析 AI 响应为结构化配置
 */
export function parseAIResponse(responseText: string): SkuConfigAIResponse {
  try {
    // 尝试提取 JSON 部分
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        action: 'error',
        message: '无法解析AI响应，请重新描述您的需求',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as SkuConfigAIResponse;

    // 验证必要字段
    if (!parsed.action || !parsed.message) {
      return {
        action: 'error',
        message: 'AI响应格式不完整，请重试',
      };
    }

    // 验证 processingSteps 中的 stageType 是否合法
    if (parsed.skuConfig?.processingSteps) {
      const validTypes = Object.values(ProcessingStageType);
      parsed.skuConfig.processingSteps = parsed.skuConfig.processingSteps.filter(
        (step) => validTypes.includes(step.stageType as any)
      );
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return {
      action: 'error',
      message: '解析配置失败，请用更清晰的方式描述您的需求',
    };
  }
}

// ==================== 模糊匹配工具 ====================

/**
 * 工序关键词到 ProcessingStageType 的模糊映射
 */
const STAGE_KEYWORD_MAP: Record<string, string> = {
  // 收货类
  收货: 'RECEIVING', 验收: 'RECEIVING', 进货: 'RECEIVING', 原料: 'RECEIVING',

  // 温控类
  解冻: 'THAWING', 化冻: 'THAWING',
  冷却: 'COOLING', 降温: 'COOLING',
  速冻: 'FREEZING', 冷冻: 'FREEZING', 急冻: 'FREEZING',
  冷藏: 'CHILLING', 保鲜: 'CHILLING',

  // 预处理
  修整: 'TRIMMING', 去皮: 'TRIMMING', 剥壳: 'TRIMMING', 去内脏: 'TRIMMING',
  清洗: 'WASHING', 洗涤: 'WASHING', 浸泡: 'WASHING',
  沥水: 'DRAINING', 脱水: 'DRAINING',

  // 切割类
  切片: 'SLICING', 切块: 'SLICING',
  切丁: 'DICING',
  绞碎: 'MINCING', 绞肉: 'MINCING', 搅碎: 'MINCING',

  // 调味类
  腌制: 'MARINATING', 腌渍: 'MARINATING', 浸渍: 'MARINATING',
  调味: 'SEASONING', 拌料: 'SEASONING', 和面: 'SEASONING',

  // 熟制类
  蒸煮: 'COOKING', 煮制: 'COOKING', 烹饪: 'COOKING', 烹调: 'COOKING',
  油炸: 'FRYING', 炸制: 'FRYING',
  烘烤: 'BAKING', 烤制: 'BAKING',
  蒸制: 'STEAMING', 蒸: 'STEAMING',

  // 包装类
  包装: 'PACKAGING', 真空包装: 'PACKAGING', 气调包装: 'PACKAGING',
  贴标: 'LABELING', 标签: 'LABELING',
  装箱: 'BOXING', 入库: 'BOXING',

  // 质检类
  质检: 'QUALITY_CHECK', 检验: 'QUALITY_CHECK',
  金属检测: 'METAL_DETECTION', 金检: 'METAL_DETECTION',
  称重: 'WEIGHT_CHECK', 计量: 'WEIGHT_CHECK',

  // 其他
  清洁: 'CLEANING', 消毒: 'CLEANING',
  换线: 'LINE_CHANGE',
};

/**
 * 从用户输入中提取可能的工序类型
 */
export function extractStageTypesFromText(text: string): string[] {
  const result: string[] = [];
  const normalizedText = text.toLowerCase();

  for (const [keyword, stageType] of Object.entries(STAGE_KEYWORD_MAP)) {
    if (normalizedText.includes(keyword) && !result.includes(stageType)) {
      result.push(stageType);
    }
  }

  return result;
}

/**
 * 产品类型关键词到模板ID的映射
 */
const PRODUCT_TEMPLATE_MAP: Record<string, string> = {
  海鲜: 'SEAFOOD_PREFAB', 水产: 'SEAFOOD_PREFAB', 鱼: 'SEAFOOD_PREFAB', 虾: 'SEAFOOD_PREFAB',
  肉: 'MEAT_PREPARED', 猪: 'MEAT_PREPARED', 牛: 'MEAT_PREPARED', 鸡: 'MEAT_PREPARED', 禽: 'MEAT_PREPARED',
  卤: 'BRAISED_MEAT', 酱: 'BRAISED_MEAT', 熟食: 'BRAISED_MEAT',
  饺子: 'FROZEN_DUMPLING', 包子: 'FROZEN_DUMPLING', 点心: 'FROZEN_DUMPLING', 汤圆: 'FROZEN_DUMPLING', 馄饨: 'FROZEN_DUMPLING',
  蔬菜: 'FRESH_CUT_VEG', 净菜: 'FRESH_CUT_VEG', 沙拉: 'FRESH_CUT_VEG',
  代加工: 'OEM_CUSTOM', 定制: 'OEM_CUSTOM', oem: 'OEM_CUSTOM',
};

/**
 * 从用户输入中推断模板ID
 */
export function inferTemplateIdFromText(text: string): string | undefined {
  const normalizedText = text.toLowerCase();

  for (const [keyword, templateId] of Object.entries(PRODUCT_TEMPLATE_MAP)) {
    if (normalizedText.includes(keyword)) {
      return templateId;
    }
  }

  return undefined;
}

// ==================== 辅助函数 ====================

/**
 * 构建上下文字符串
 */
export function buildContext(options: {
  currentWorkHours?: number;
  currentComplexity?: number;
  currentStepsCount?: number;
  isEditMode?: boolean;
}): string {
  const parts: string[] = [];

  if (options.isEditMode) {
    parts.push('用户正在编辑现有产品配置');
    if (options.currentWorkHours) {
      parts.push(`当前工时: ${options.currentWorkHours}小时`);
    }
    if (options.currentComplexity) {
      parts.push(`当前复杂度: ${options.currentComplexity}`);
    }
    if (options.currentStepsCount) {
      parts.push(`当前工序数: ${options.currentStepsCount}`);
    }
  } else {
    parts.push('用户正在新建产品配置');
  }

  return parts.join(', ');
}

/**
 * 验证提取的配置是否完整
 */
export function validateExtractedConfig(config: ExtractedSkuConfig): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!config.workHours && config.workHours !== 0) {
    missingFields.push('工时');
  }

  if (!config.processingSteps || config.processingSteps.length === 0) {
    missingFields.push('加工步骤');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

export default {
  SKU_CONFIG_SYSTEM_PROMPT,
  buildUserPrompt,
  parseAIResponse,
  extractStageTypesFromText,
  inferTemplateIdFromText,
  buildContext,
  validateExtractedConfig,
};
