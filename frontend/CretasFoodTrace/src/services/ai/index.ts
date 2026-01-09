/**
 * 集中式 AI 服务 - 统一导出
 *
 * 使用方式:
 * ```typescript
 * import { aiService, detectAnalysisMode } from '@/services/ai';
 *
 * // 意图执行 (自动检测模式)
 * const result = await aiService.executeIntent('查询原料库存');
 *
 * // 成本分析 (自动检测模式)
 * const analysis = await aiService.analyzeCost({
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-07',
 *   question: '为什么成本上升？'
 * });
 *
 * // 手动检测模式 (用于 UI 预览)
 * const mode = detectAnalysisMode('为什么成本上升？');
 * console.log(mode.mode); // 'deep'
 * ```
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */

// ============ 核心服务 ============
export { AIService, aiService } from './AIService';

// ============ 模式检测 ============
export {
  detectAnalysisMode,
  getModeDescription,
  getModeLabel,
  getModeIcon,
  getEstimatedTime,
  createModeConfig,
} from './modeDetector';

// ============ 类型定义 ============
export type {
  // 分析模式
  AnalysisMode,
  AnalysisModeResult,

  // 统一响应
  AIResult,

  // 意图执行
  IntentExecuteOptions,
  IntentExecuteRequest,
  IntentExecuteResponse,

  // 成本分析
  CostAnalysisDimension,
  CostAnalysisRequest,
  CostAnalysisResponse,
  BatchCostAnalysisRequest,
  BatchComparisonRequest,

  // SSE 流式
  SSEEventType,
  SSEEvent,
  SSECallbacks,

  // 表单助手
  FormEntityType,
  FormAssistRequest,
  FormFieldSuggestion,
  FormAssistResponse,

  // 配置
  AIServiceConfig,
} from './types';
