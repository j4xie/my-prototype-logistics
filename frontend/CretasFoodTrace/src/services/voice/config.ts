/**
 * 语音服务配置
 * Voice Service Configuration
 *
 * 注意：正式使用前需要替换为真实的讯飞密钥
 */

import { SpeechRecognitionConfig, VoiceAssistantConfig } from './types';

// ============================================
// 讯飞配置
// ============================================

/**
 * 讯飞语音识别配置
 *
 * 获取密钥步骤:
 * 1. 访问 https://www.xfyun.cn/
 * 2. 注册并登录
 * 3. 创建应用
 * 4. 开通"语音听写"服务
 * 5. 在应用详情页获取 APPID、API Key、API Secret
 */
export const IFLYTEK_CONFIG: SpeechRecognitionConfig = {
  // TODO: 替换为真实的讯飞密钥
  appId: process.env.EXPO_PUBLIC_IFLYTEK_APP_ID || 'YOUR_APP_ID',
  apiKey: process.env.EXPO_PUBLIC_IFLYTEK_API_KEY || 'YOUR_API_KEY',
  apiSecret: process.env.EXPO_PUBLIC_IFLYTEK_API_SECRET || 'YOUR_API_SECRET',
  language: 'zh_cn',
  accent: 'mandarin',
  sampleRate: 16000,
};

/**
 * 讯飞 WebSocket 地址
 */
export const IFLYTEK_WSS_URL = 'wss://iat-api.xfyun.cn/v2/iat';

// ============================================
// 语音助手默认配置
// ============================================

export const DEFAULT_VOICE_ASSISTANT_CONFIG: VoiceAssistantConfig = {
  enabled: true,
  preInspectionGuide: true,
  autoNextBatch: false,
  speechRate: 'normal',
  repeatConfirmation: true,
};

// ============================================
// TTS 配置
// ============================================

export const TTS_RATE_MAP = {
  slow: 0.8,
  normal: 1.0,
  fast: 1.3,
} as const;

export const TTS_DEFAULT_CONFIG = {
  language: 'zh-CN',
  pitch: 1.0,
  rate: 1.0,
};

// ============================================
// 录音配置
// ============================================

export const AUDIO_RECORDING_CONFIG = {
  android: {
    extension: '.m4a',
    outputFormat: 4, // MPEG_4
    audioEncoder: 3, // AAC
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: 127, // MAX
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

// ============================================
// 质检项目配置
// ============================================

export const INSPECTION_ITEMS = [
  { name: '外观', key: 'appearance', maxScore: 20 },
  { name: '气味', key: 'smell', maxScore: 20 },
  { name: '规格', key: 'specification', maxScore: 20 },
  { name: '重量', key: 'weight', maxScore: 20 },
  { name: '包装', key: 'packaging', maxScore: 20 },
] as const;

export const GRADE_THRESHOLDS = {
  A: 90,  // >= 90 分
  B: 80,  // >= 80 分
  C: 60,  // >= 60 分
  D: 0,   // < 60 分
} as const;

/**
 * 根据总分计算等级
 */
export function calculateGrade(totalScore: number): 'A' | 'B' | 'C' | 'D' {
  if (totalScore >= GRADE_THRESHOLDS.A) return 'A';
  if (totalScore >= GRADE_THRESHOLDS.B) return 'B';
  if (totalScore >= GRADE_THRESHOLDS.C) return 'C';
  return 'D';
}
