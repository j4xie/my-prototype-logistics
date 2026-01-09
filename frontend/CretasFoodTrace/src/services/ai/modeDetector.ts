/**
 * AI 分析模式检测器
 * 根据用户问题内容自动判断使用快速模式还是深度分析模式
 *
 * 迁移自: src/utils/aiAnalysisMode.ts
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */

import { AnalysisMode, AnalysisModeResult } from './types';

/** 深度分析关键词配置 */
const DEEP_ANALYSIS_KEYWORDS: Record<string, string[]> = {
  // 原因追溯类 - 需要深度推理
  reason: ['为什么', '原因', '导致', '造成', '怎么回事', '问题出在'],

  // 分析对比类 - 需要数据分析
  analysis: ['分析', '对比', '比较', '趋势', '变化', '差异', '异常'],

  // 建议优化类 - 需要推理建议
  suggestion: ['建议', '优化', '改进', '如何降低', '怎么提升', '措施', '方案'],

  // 预测评估类 - 需要推理预测
  prediction: ['预测', '预估', '未来', '下个月', '下周', '明年'],

  // 深度询问类 - 明确要求详细分析
  deepInquiry: ['详细', '深入', '全面', '仔细', '深度'],
};

/** 快速模式关键词 - 简单数据查询 */
const QUICK_MODE_KEYWORDS: string[] = [
  '多少',
  '总计',
  '合计',
  '数量',
  '金额',
  '今天',
  '今日',
  '本周',
  '本月',
  '概况',
  '概览',
  '汇总',
  '统计',
  '查看',
  '显示',
  '列出',
];

/**
 * 智能检测分析模式
 *
 * @param question 用户问题
 * @param dimension 分析维度
 * @returns 分析模式配置
 *
 * @example
 * // 快速模式
 * detectAnalysisMode('成本概况') // { enableThinking: false, mode: 'quick' }
 *
 * // 深度分析
 * detectAnalysisMode('为什么这个月成本上升了？') // { enableThinking: true, mode: 'deep' }
 */
export function detectAnalysisMode(
  question?: string,
  dimension?: string
): AnalysisModeResult {
  // 默认快速模式
  const defaultResult: AnalysisModeResult = {
    enableThinking: false,
    thinkingBudget: 20,
    mode: 'quick',
    matchedKeywords: [],
    reason: '默认快速模式',
  };

  // 无问题时使用快速模式
  if (!question || question.trim().length === 0) {
    return {
      ...defaultResult,
      reason: '无具体问题，使用快速模式展示数据概况',
    };
  }

  const normalizedQuestion = question.toLowerCase().trim();
  const matchedKeywords: string[] = [];

  // 1. 检查是否匹配快速模式关键词
  const quickKeywordMatched = QUICK_MODE_KEYWORDS.some((keyword) => {
    if (normalizedQuestion.includes(keyword)) {
      matchedKeywords.push(keyword);
      return true;
    }
    return false;
  });

  // 2. 检查是否匹配深度分析关键词
  let deepAnalysisScore = 0;
  const deepKeywordsMatched: string[] = [];

  for (const [category, keywords] of Object.entries(DEEP_ANALYSIS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedQuestion.includes(keyword)) {
        deepAnalysisScore += 1;
        deepKeywordsMatched.push(`${category}:${keyword}`);
      }
    }
  }

  // 3. 问题长度因素 - 长问题通常需要更深入的分析
  const questionLength = normalizedQuestion.length;
  if (questionLength > 30) {
    deepAnalysisScore += 0.5;
  }
  if (questionLength > 50) {
    deepAnalysisScore += 0.5;
  }

  // 4. 问号数量 - 多个问题可能需要深度分析
  const questionMarkCount = (normalizedQuestion.match(/[？?]/g) || []).length;
  if (questionMarkCount > 1) {
    deepAnalysisScore += 0.5;
  }

  // 5. 维度因素 - daily/weekly 维度可能需要更多分析
  if (dimension === 'daily' || dimension === 'weekly') {
    deepAnalysisScore += 0.3;
  }

  // 判断逻辑：
  // - 深度分析分数 >= 1.5 且没有明确的快速关键词 → 深度分析
  // - 有明确快速关键词且分数 < 2 → 快速模式
  // - 其他情况根据分数判断

  if (deepAnalysisScore >= 1.5 && !quickKeywordMatched) {
    // 根据分数调整思考预算
    const thinkingBudget = Math.min(
      100,
      Math.max(30, Math.round(deepAnalysisScore * 20))
    );

    return {
      enableThinking: true,
      thinkingBudget,
      mode: 'deep',
      matchedKeywords: deepKeywordsMatched,
      reason: `检测到深度分析需求 (score: ${deepAnalysisScore.toFixed(1)})`,
    };
  }

  if (quickKeywordMatched && deepAnalysisScore < 2) {
    return {
      enableThinking: false,
      thinkingBudget: 20,
      mode: 'quick',
      matchedKeywords,
      reason: `简单查询模式 (快速关键词: ${matchedKeywords.join(', ')})`,
    };
  }

  // 边界情况：有深度关键词但分数不高
  if (deepAnalysisScore > 0 && deepAnalysisScore < 1.5) {
    return {
      enableThinking: false,
      thinkingBudget: 20,
      mode: 'quick',
      matchedKeywords: deepKeywordsMatched,
      reason: `轻度分析需求，使用快速模式 (score: ${deepAnalysisScore.toFixed(1)})`,
    };
  }

  return defaultResult;
}

/**
 * 获取模式描述文本（用于 UI 显示）
 */
export function getModeDescription(mode: AnalysisMode): string {
  return mode === 'quick' ? '快速模式 · 即时响应' : '深度分析 · AI 思考中';
}

/**
 * 获取模式简短标签（用于紧凑 UI）
 */
export function getModeLabel(mode: AnalysisMode): string {
  return mode === 'quick' ? '快速' : '深度';
}

/**
 * 获取预估响应时间（用于 UI 提示）
 */
export function getEstimatedTime(mode: AnalysisMode): string {
  return mode === 'quick' ? '< 1 秒' : '15-25 秒';
}

/**
 * 获取模式图标 (用于 UI 显示)
 */
export function getModeIcon(mode: AnalysisMode): string {
  return mode === 'quick' ? '⚡' : '🧠';
}

/**
 * 强制指定模式的配置生成器
 *
 * @param mode 指定的模式
 * @param customBudget 自定义思考预算 (仅深度模式有效)
 */
export function createModeConfig(
  mode: AnalysisMode,
  customBudget?: number
): Pick<AnalysisModeResult, 'enableThinking' | 'thinkingBudget' | 'mode'> {
  if (mode === 'deep') {
    return {
      enableThinking: true,
      thinkingBudget: customBudget ?? 50,
      mode: 'deep',
    };
  }
  return {
    enableThinking: false,
    thinkingBudget: 20,
    mode: 'quick',
  };
}
