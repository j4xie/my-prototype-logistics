/**
 * 语音服务模块导出
 * Voice Services Module Exports
 */

// 类型定义
export * from './types';

// 配置
export * from './config';

// 服务
export { ttsService, default as TextToSpeechService } from './TextToSpeechService';
export {
  speechRecognitionService,
  default as SpeechRecognitionService,
} from './SpeechRecognitionService';
export {
  voiceAssistantService,
  default as VoiceAssistantService,
} from './VoiceAssistantService';

// AI Prompt 工具
export {
  QUALITY_INSPECTION_SYSTEM_PROMPT,
  generateStartPrompt,
  generateUserContext,
  getCompletedItems,
  getMissingItems,
  calculateTotalScore,
  isInspectionComplete,
  generateCompletionSummary,
  parseAIResponse,
  generateErrorResponse,
} from './QualityInspectionAIPrompt';
