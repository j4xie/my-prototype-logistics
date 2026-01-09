/**
 * AI 组件导出
 *
 * @version 1.1.0
 * @since 2026-01-02
 * @updated 2026-01-08
 */

export { IntentCandidateSelector } from './IntentCandidateSelector';
export type { IntentCandidateSelectorProps } from './IntentCandidateSelector';

export { ClarificationDialog } from './ClarificationDialog';
export type { ClarificationDialogProps } from './ClarificationDialog';

export { ClarificationDialogIntegrationExample } from './ClarificationDialogIntegrationExample';

export { AIModeIndicator } from './AIModeIndicator';
export type { AIModeIndicatorProps } from './AIModeIndicator';

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
  MissingParameter,
} from '../../types/intent';

export {
  needsCandidateSelection,
  hasIntentMatch,
  needsLlmFallback,
} from '../../types/intent';
