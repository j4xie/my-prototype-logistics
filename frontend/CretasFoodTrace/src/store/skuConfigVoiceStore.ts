/**
 * SKU 配置语音状态管理 (Zustand)
 *
 * 管理 SKU 语音配置的会话状态、录音状态、AI 响应等
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { create } from 'zustand';
import type { SkuConfigAIResponse, ExtractedSkuConfig } from '../services/ai/SkuConfigAIPrompt';

// ==================== 状态类型 ====================

/**
 * 语音会话状态
 */
export type VoiceSessionStatus =
  | 'idle'           // 空闲
  | 'listening'      // 正在录音
  | 'processing'     // AI 处理中
  | 'speaking'       // TTS 播报中
  | 'confirming'     // 等待用户确认
  | 'error';         // 错误状态

/**
 * 会话历史记录
 */
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** 如果是 assistant 消息，可能包含提取的配置 */
  extractedConfig?: ExtractedSkuConfig;
}

/**
 * SKU 配置语音 Store 状态
 */
export interface SkuConfigVoiceState {
  // === 会话状态 ===
  /** 当前状态 */
  status: VoiceSessionStatus;
  /** 是否对话框可见 */
  dialogVisible: boolean;
  /** 是否为编辑模式 */
  isEditMode: boolean;

  // === 录音相关 ===
  /** 录音时长 (秒) */
  recordingDuration: number;
  /** 转写的文本 */
  transcribedText: string;

  // === AI 响应 ===
  /** 最新的 AI 响应 */
  latestResponse: SkuConfigAIResponse | null;
  /** 累积的配置 (多轮对话合并) */
  accumulatedConfig: ExtractedSkuConfig | null;

  // === 会话历史 ===
  /** 会话消息列表 */
  messages: SessionMessage[];

  // === 错误处理 ===
  /** 错误信息 */
  errorMessage: string | null;

  // === Actions ===
  /** 打开对话框 */
  openDialog: (isEditMode?: boolean) => void;
  /** 关闭对话框 */
  closeDialog: () => void;
  /** 重置会话 */
  resetSession: () => void;

  /** 开始录音 */
  startListening: () => void;
  /** 停止录音 */
  stopListening: () => void;
  /** 更新录音时长 */
  updateRecordingDuration: (duration: number) => void;

  /** 设置转写文本 */
  setTranscribedText: (text: string) => void;
  /** 开始 AI 处理 */
  startProcessing: () => void;
  /** 设置 AI 响应 */
  setAIResponse: (response: SkuConfigAIResponse) => void;

  /** 开始 TTS 播报 */
  startSpeaking: () => void;
  /** 停止 TTS 播报 */
  stopSpeaking: () => void;

  /** 进入确认状态 */
  enterConfirming: () => void;
  /** 用户确认配置 */
  confirmConfig: () => ExtractedSkuConfig | null;
  /** 用户取消配置 */
  cancelConfig: () => void;

  /** 添加消息 */
  addMessage: (role: 'user' | 'assistant', content: string, extractedConfig?: ExtractedSkuConfig) => void;

  /** 设置错误 */
  setError: (message: string) => void;
  /** 清除错误 */
  clearError: () => void;

  /** 合并配置 (多轮对话) */
  mergeConfig: (newConfig: ExtractedSkuConfig) => void;
}

// ==================== 初始状态 ====================

const initialState = {
  status: 'idle' as VoiceSessionStatus,
  dialogVisible: false,
  isEditMode: false,
  recordingDuration: 0,
  transcribedText: '',
  latestResponse: null,
  accumulatedConfig: null,
  messages: [] as SessionMessage[],
  errorMessage: null,
};

// ==================== Store 实现 ====================

export const useSkuConfigVoiceStore = create<SkuConfigVoiceState>((set, get) => ({
  ...initialState,

  // === 对话框控制 ===
  openDialog: (isEditMode = false) => {
    set({
      dialogVisible: true,
      isEditMode,
      status: 'idle',
      messages: [],
      accumulatedConfig: null,
      errorMessage: null,
    });
  },

  closeDialog: () => {
    set({
      dialogVisible: false,
      status: 'idle',
    });
  },

  resetSession: () => {
    set({
      ...initialState,
      dialogVisible: get().dialogVisible,
      isEditMode: get().isEditMode,
    });
  },

  // === 录音控制 ===
  startListening: () => {
    set({
      status: 'listening',
      recordingDuration: 0,
      transcribedText: '',
      errorMessage: null,
    });
  },

  stopListening: () => {
    set({ status: 'processing' });
  },

  updateRecordingDuration: (duration) => {
    set({ recordingDuration: duration });
  },

  // === 转写与 AI 处理 ===
  setTranscribedText: (text) => {
    set({ transcribedText: text });
    // 添加用户消息
    get().addMessage('user', text);
  },

  startProcessing: () => {
    set({ status: 'processing' });
  },

  setAIResponse: (response) => {
    set({ latestResponse: response });

    // 添加 AI 消息
    get().addMessage('assistant', response.message, response.skuConfig);

    // 如果有配置，合并到累积配置
    if (response.skuConfig) {
      get().mergeConfig(response.skuConfig);
    }

    // 根据 action 决定下一状态
    switch (response.action) {
      case 'extract':
      case 'confirm':
        set({ status: 'confirming' });
        break;
      case 'complete':
        set({ status: 'confirming' });
        break;
      case 'prompt':
        set({ status: 'speaking' });
        break;
      case 'error':
        set({ status: 'error', errorMessage: response.message });
        break;
      default:
        set({ status: 'idle' });
    }
  },

  // === TTS 控制 ===
  startSpeaking: () => {
    set({ status: 'speaking' });
  },

  stopSpeaking: () => {
    const { latestResponse } = get();
    // TTS 完成后，根据 AI 响应决定状态
    if (latestResponse?.action === 'prompt') {
      set({ status: 'idle' }); // 等待用户继续输入
    } else if (latestResponse?.action === 'extract' || latestResponse?.action === 'confirm') {
      set({ status: 'confirming' });
    } else {
      set({ status: 'idle' });
    }
  },

  // === 确认流程 ===
  enterConfirming: () => {
    set({ status: 'confirming' });
  },

  confirmConfig: () => {
    const config = get().accumulatedConfig;
    set({
      status: 'idle',
      dialogVisible: false,
    });
    return config;
  },

  cancelConfig: () => {
    set({ status: 'idle' });
  },

  // === 消息管理 ===
  addMessage: (role, content, extractedConfig) => {
    const newMessage: SessionMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: Date.now(),
      extractedConfig,
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  // === 错误处理 ===
  setError: (message) => {
    set({ status: 'error', errorMessage: message });
  },

  clearError: () => {
    set({ status: 'idle', errorMessage: null });
  },

  // === 配置合并 ===
  mergeConfig: (newConfig) => {
    set((state) => {
      const current = state.accumulatedConfig || {};

      // 深度合并配置
      const merged: ExtractedSkuConfig = {
        ...current,
        ...newConfig,
        // 特殊处理数组和对象
        processingSteps: newConfig.processingSteps || current.processingSteps,
        skillRequirements: {
          minLevel: newConfig.skillRequirements?.minLevel ?? current.skillRequirements?.minLevel ?? 1,
          preferredLevel: newConfig.skillRequirements?.preferredLevel ?? current.skillRequirements?.preferredLevel ?? 1,
          specialSkills: [
            ...(current.skillRequirements?.specialSkills || []),
            ...(newConfig.skillRequirements?.specialSkills || []),
          ].filter((v, i, a) => a.indexOf(v) === i), // 去重
        },
      };

      return { accumulatedConfig: merged };
    });
  },
}));

// ==================== Selector Hooks ====================

/**
 * 获取当前是否正在录音
 */
export const useIsListening = () =>
  useSkuConfigVoiceStore((state) => state.status === 'listening');

/**
 * 获取当前是否正在处理
 */
export const useIsProcessing = () =>
  useSkuConfigVoiceStore((state) => state.status === 'processing');

/**
 * 获取当前是否在等待确认
 */
export const useIsConfirming = () =>
  useSkuConfigVoiceStore((state) => state.status === 'confirming');

/**
 * 获取累积的配置
 */
export const useAccumulatedConfig = () =>
  useSkuConfigVoiceStore((state) => state.accumulatedConfig);

/**
 * 获取会话消息
 */
export const useMessages = () =>
  useSkuConfigVoiceStore((state) => state.messages);

/**
 * 获取错误消息
 */
export const useErrorMessage = () =>
  useSkuConfigVoiceStore((state) => state.errorMessage);

export default useSkuConfigVoiceStore;
