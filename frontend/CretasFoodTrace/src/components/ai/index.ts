/**
 * AI 组件导出
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

export { IntentCandidateSelector } from './IntentCandidateSelector';
export type { IntentCandidateSelectorProps } from './IntentCandidateSelector';

// Re-export intent types for convenience
export type {
  IntentMatchMethod,
  CandidateIntent,
  IntentMatchResult,
  AIIntentConfig,
  IntentRecognizeRequest,
  IntentRecognizeResponse,
  IntentSelectionCallbacks,
  IntentExecuteResponse,
} from '../../types/intent';

export {
  needsCandidateSelection,
  hasIntentMatch,
  needsLlmFallback,
} from '../../types/intent';
