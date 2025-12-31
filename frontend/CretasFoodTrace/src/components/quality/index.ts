/**
 * 质检组件导出
 * Quality Components Export
 */

export { DispositionSuggestion } from './DispositionSuggestion';
export { DispositionHistory } from './DispositionHistory';
export { DispositionActionPicker } from './DispositionActionPicker';

// 导出相关类型
export type {
  DispositionAction,
  DispositionEvaluation,
  DispositionResult,
  DispositionHistory as DispositionHistoryType,
  InspectionSummary,
  AlternativeAction,
} from '../../types/qualityDisposition';
