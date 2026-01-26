/**
 * 语音助手状态管理
 * Voice Assistant State Management (Zustand)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VoiceAssistantConfig,
  VoiceAssistantStatus,
  InspectionBatch,
  InspectionData,
  ChatMessage,
} from '../services/voice/types';
import { DEFAULT_VOICE_ASSISTANT_CONFIG } from '../services/voice/config';
import { voiceAssistantService } from '../services/voice/VoiceAssistantService';

interface VoiceAssistantState {
  // 配置
  config: VoiceAssistantConfig;

  // 状态
  status: VoiceAssistantStatus;
  isSessionActive: boolean;

  // 当前质检数据
  currentBatch: InspectionBatch | null;
  inspectionData: Partial<InspectionData>;
  chatHistory: ChatMessage[];

  // 错误状态
  error: Error | null;

  // Actions - 配置
  setConfig: (config: Partial<VoiceAssistantConfig>) => void;
  resetConfig: () => void;

  // Actions - 会话管理
  startSession: (batch: InspectionBatch) => Promise<void>;
  endSession: () => Promise<void>;
  resetSession: () => Promise<void>;

  // Actions - 语音交互
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  processTextInput: (text: string) => Promise<void>;

  // Actions - 质检操作
  confirmSubmit: () => Promise<InspectionData>;

  // Actions - 状态更新
  updateStatus: (status: VoiceAssistantStatus) => void;
  addMessage: (message: ChatMessage) => void;
  updateInspectionData: (data: Partial<InspectionData>) => void;
  setError: (error: Error | null) => void;
  clearError: () => void;
}

// P1 Fix: Track listener cleanup functions to prevent memory leaks
let listenerCleanupFns: Array<() => void> = [];
let listenersInitialized = false;

// P1 Fix: Export cleanup function for memory leak prevention
export const cleanupVoiceAssistantListeners = () => {
  listenerCleanupFns.forEach((cleanup) => cleanup());
  listenerCleanupFns = [];
  listenersInitialized = false;
};

export const useVoiceAssistantStore = create<VoiceAssistantState>()(
  persist(
    (set, get) => {
      // P1 Fix: Initialize listeners only once and track cleanup functions
      const initializeListeners = () => {
        if (listenersInitialized) return;
        listenersInitialized = true;

        // 状态监听 - addStatusListener returns cleanup function
        const cleanupStatus = voiceAssistantService.addStatusListener((status) => {
          set({ status });
        });
        listenerCleanupFns.push(cleanupStatus);

        // 消息监听
        const cleanupMessage = voiceAssistantService.addMessageListener((message) => {
          set((state) => ({
            chatHistory: [...state.chatHistory, message],
          }));
        });
        listenerCleanupFns.push(cleanupMessage);

        // 数据监听
        const cleanupData = voiceAssistantService.addDataListener((data) => {
          set((state) => ({
            inspectionData: { ...state.inspectionData, ...data },
          }));
        });
        listenerCleanupFns.push(cleanupData);

        // 错误监听
        const cleanupError = voiceAssistantService.addErrorListener((error) => {
          set({ error, status: 'error' });
        });
        listenerCleanupFns.push(cleanupError);
      };

      // 延迟初始化监听器
      setTimeout(initializeListeners, 0);

      return {
        // 初始状态
        config: DEFAULT_VOICE_ASSISTANT_CONFIG,
        status: 'idle',
        isSessionActive: false,
        currentBatch: null,
        inspectionData: {},
        chatHistory: [],
        error: null,

        // 配置管理
        setConfig: (newConfig) => {
          const mergedConfig = { ...get().config, ...newConfig };
          set({ config: mergedConfig });
          voiceAssistantService.setConfig(mergedConfig);
        },

        resetConfig: () => {
          set({ config: DEFAULT_VOICE_ASSISTANT_CONFIG });
          voiceAssistantService.setConfig(DEFAULT_VOICE_ASSISTANT_CONFIG);
        },

        // 会话管理
        startSession: async (batch) => {
          try {
            set({
              currentBatch: batch,
              inspectionData: {},
              chatHistory: [],
              error: null,
              isSessionActive: true,
            });

            // 同步配置到服务
            voiceAssistantService.setConfig(get().config);

            // 开始质检会话
            await voiceAssistantService.startInspection(batch);

            set({ status: 'idle' });
          } catch (error) {
            set({
              error: error instanceof Error ? error : new Error('启动会话失败'),
              isSessionActive: false,
            });
            throw error;
          }
        },

        endSession: async () => {
          try {
            await voiceAssistantService.cancel();
            set({
              isSessionActive: false,
              status: 'idle',
              currentBatch: null,
              inspectionData: {},
              chatHistory: [],
              error: null,
            });
          } catch (error) {
            console.error('结束会话失败:', error);
          }
        },

        resetSession: async () => {
          const { currentBatch } = get();
          if (currentBatch) {
            try {
              await voiceAssistantService.resetInspection();
              set({
                inspectionData: {},
                chatHistory: [],
                error: null,
                status: 'idle',
              });
            } catch (error) {
              set({
                error: error instanceof Error ? error : new Error('重置会话失败'),
              });
              throw error;
            }
          }
        },

        // 语音交互
        startListening: async () => {
          try {
            set({ error: null });
            await voiceAssistantService.startListening();
          } catch (error) {
            set({
              error: error instanceof Error ? error : new Error('启动录音失败'),
              status: 'error',
            });
            throw error;
          }
        },

        stopListening: async () => {
          try {
            await voiceAssistantService.stopListening();
          } catch (error) {
            set({
              error: error instanceof Error ? error : new Error('停止录音失败'),
              status: 'error',
            });
            throw error;
          }
        },

        processTextInput: async (text) => {
          try {
            set({ error: null });
            await voiceAssistantService.processTextInput(text);
          } catch (error) {
            set({
              error: error instanceof Error ? error : new Error('处理输入失败'),
              status: 'error',
            });
            throw error;
          }
        },

        // 质检操作
        confirmSubmit: async () => {
          try {
            const result = await voiceAssistantService.confirmSubmit();
            set({
              status: 'idle',
              isSessionActive: false,
            });
            return result;
          } catch (error) {
            set({
              error: error instanceof Error ? error : new Error('提交失败'),
            });
            throw error;
          }
        },

        // 状态更新
        updateStatus: (status) => {
          set({ status });
        },

        addMessage: (message) => {
          set((state) => ({
            chatHistory: [...state.chatHistory, message],
          }));
        },

        updateInspectionData: (data) => {
          set((state) => ({
            inspectionData: { ...state.inspectionData, ...data },
          }));
        },

        setError: (error) => {
          set({ error });
        },

        clearError: () => {
          set({ error: null });
        },
      };
    },
    {
      name: 'voice-assistant-config',
      storage: createJSONStorage(() => AsyncStorage),
      // 只持久化配置，不持久化会话数据
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);

// 便捷 hooks
export const useVoiceConfig = () => useVoiceAssistantStore((state) => state.config);
export const useVoiceStatus = () => useVoiceAssistantStore((state) => state.status);
// P1 Fix: Use useShallow to prevent unnecessary re-renders when object reference changes
export const useVoiceSession = () =>
  useVoiceAssistantStore(
    useShallow((state) => ({
      isActive: state.isSessionActive,
      batch: state.currentBatch,
      data: state.inspectionData,
      history: state.chatHistory,
    }))
  );
export const useVoiceError = () => useVoiceAssistantStore((state) => state.error);

// 计算属性 hooks
export const useInspectionProgress = () => {
  const data = useVoiceAssistantStore((state) => state.inspectionData);

  const items = ['appearance', 'smell', 'specification', 'weight', 'packaging'] as const;
  const completed = items.filter((key) => data[key]?.score !== undefined).length;
  const total = items.length;
  const percentage = Math.round((completed / total) * 100);

  return { completed, total, percentage };
};

export const useTotalScore = () => {
  const data = useVoiceAssistantStore((state) => state.inspectionData);

  let total = 0;
  if (data.appearance?.score) total += data.appearance.score;
  if (data.smell?.score) total += data.smell.score;
  if (data.specification?.score) total += data.specification.score;
  if (data.weight?.score) total += data.weight.score;
  if (data.packaging?.score) total += data.packaging.score;

  return total;
};

export default useVoiceAssistantStore;
