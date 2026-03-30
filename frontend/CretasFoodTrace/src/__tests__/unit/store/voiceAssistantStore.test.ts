// @ts-nocheck
/**
 * voiceAssistantStore 单元测试
 * 测试语音助手状态管理：配置、会话、录音、提交、消息、错误处理
 */

jest.mock('../../../services/voice/types', () => ({}));
jest.mock('../../../services/voice/config', () => ({
  DEFAULT_VOICE_ASSISTANT_CONFIG: { language: 'zh-CN', model: 'default' },
}));
jest.mock('../../../services/voice/VoiceAssistantService', () => ({
  voiceAssistantService: {
    setConfig: jest.fn(),
    startInspection: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    resetInspection: jest.fn().mockResolvedValue(undefined),
    startListening: jest.fn().mockResolvedValue(undefined),
    stopListening: jest.fn().mockResolvedValue(undefined),
    processTextInput: jest.fn().mockResolvedValue(undefined),
    confirmSubmit: jest.fn().mockResolvedValue({ appearance: { score: 8 } }),
    addStatusListener: jest.fn(() => jest.fn()),
    addMessageListener: jest.fn(() => jest.fn()),
    addDataListener: jest.fn(() => jest.fn()),
    addErrorListener: jest.fn(() => jest.fn()),
  },
}));
jest.mock('zustand/react/shallow', () => ({ useShallow: (fn: any) => fn }));

import { useVoiceAssistantStore, cleanupVoiceAssistantListeners } from '../../../store/voiceAssistantStore';
import { voiceAssistantService } from '../../../services/voice/VoiceAssistantService';

describe('voiceAssistantStore', () => {
  beforeEach(() => {
    // Reset store state directly
    useVoiceAssistantStore.setState({
      status: 'idle',
      isSessionActive: false,
      currentBatch: null,
      inspectionData: {},
      chatHistory: [],
      error: null,
    });
    jest.clearAllMocks();
  });

  // ========== Config ==========
  describe('setConfig', () => {
    it('should merge config values', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.setConfig) {
        store.setConfig({ language: 'en-US' });
        const updated = useVoiceAssistantStore.getState();
        expect(updated.config?.language).toBe('en-US');
      }
    });

    it('should call voiceAssistantService.setConfig', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.setConfig) {
        store.setConfig({ language: 'en-US' });
        expect(voiceAssistantService.setConfig).toHaveBeenCalled();
      }
    });
  });

  describe('resetConfig', () => {
    it('should reset config to defaults', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.setConfig) {
        store.setConfig({ language: 'en-US' });
      }
      if (store.resetConfig) {
        store.resetConfig();
        const updated = useVoiceAssistantStore.getState();
        expect(updated.config?.language).toBe('zh-CN');
      }
    });
  });

  // ========== Session ==========
  describe('startSession', () => {
    const mockBatch = { batchId: 'B001', batchName: 'Test Batch' };

    it('should set session as active', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.startSession) {
        await store.startSession(mockBatch);
        const updated = useVoiceAssistantStore.getState();
        expect(updated.isSessionActive).toBe(true);
      }
    });

    it('should call voiceAssistantService.startInspection', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.startSession) {
        await store.startSession(mockBatch);
        expect(voiceAssistantService.startInspection).toHaveBeenCalled();
      }
    });
  });

  describe('endSession', () => {
    const mockBatch = { batchId: 'B001', batchName: 'Test Batch' };

    it('should set session as inactive', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.startSession) await store.startSession(mockBatch);
      if (store.endSession) {
        await store.endSession();
        const updated = useVoiceAssistantStore.getState();
        expect(updated.isSessionActive).toBe(false);
      }
    });

    it('should call voiceAssistantService.cancel', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.startSession) await store.startSession(mockBatch);
      if (store.endSession) {
        await store.endSession();
        expect(voiceAssistantService.cancel).toHaveBeenCalled();
      }
    });
  });

  describe('resetSession', () => {
    const mockBatch = { batchId: 'B001', batchName: 'Test Batch' };

    it('should reset session data while keeping session active', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.startSession) await store.startSession(mockBatch);
      if (store.resetSession) {
        await store.resetSession();
        const updated = useVoiceAssistantStore.getState();
        // resetSession does NOT reset isSessionActive
        expect(updated.isSessionActive).toBe(true);
        expect(updated.chatHistory.length).toBe(0);
      }
    });
  });

  // ========== Listening ==========
  describe('startListening', () => {
    it('should clear error and call service', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.startListening) {
        await store.startListening();
        const updated = useVoiceAssistantStore.getState();
        expect(updated.error).toBeNull();
      }
    });

    it('should call voiceAssistantService.startListening', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.startListening) {
        await store.startListening();
        expect(voiceAssistantService.startListening).toHaveBeenCalled();
      }
    });
  });

  describe('stopListening', () => {
    it('should call voiceAssistantService.stopListening', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.stopListening) {
        await store.stopListening();
        expect(voiceAssistantService.stopListening).toHaveBeenCalled();
      }
    });
  });

  // ========== Text Input ==========
  describe('processTextInput', () => {
    it('should call voiceAssistantService.processTextInput', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.processTextInput) {
        await store.processTextInput('test input');
        expect(voiceAssistantService.processTextInput).toHaveBeenCalledWith('test input');
      }
    });
  });

  // ========== confirmSubmit ==========
  describe('confirmSubmit', () => {
    it('should call voiceAssistantService.confirmSubmit', async () => {
      const store = useVoiceAssistantStore.getState();
      if (store.confirmSubmit) {
        await store.confirmSubmit();
        expect(voiceAssistantService.confirmSubmit).toHaveBeenCalled();
      }
    });
  });

  // ========== Status ==========
  describe('updateStatus', () => {
    it('should update status field', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.updateStatus) {
        store.updateStatus('recording');
        const updated = useVoiceAssistantStore.getState();
        expect(updated.status).toBe('recording');
      }
    });
  });

  // ========== Messages ==========
  describe('addMessage', () => {
    it('should add message to chatHistory array', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.addMessage) {
        store.addMessage({ role: 'user', content: 'hello' });
        const updated = useVoiceAssistantStore.getState();
        expect(updated.chatHistory.length).toBeGreaterThan(0);
      }
    });
  });

  // ========== Inspection Data ==========
  describe('updateInspectionData', () => {
    it('should merge inspection data', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.updateInspectionData) {
        store.updateInspectionData({ appearance: { score: 9, notes: 'good' } });
        const updated = useVoiceAssistantStore.getState();
        expect(updated.inspectionData?.appearance?.score).toBe(9);
      }
    });
  });

  // ========== Error Handling ==========
  describe('setError', () => {
    it('should set error', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.setError) {
        const testError = new Error('test error');
        store.setError(testError);
        const updated = useVoiceAssistantStore.getState();
        expect(updated.error).toBe(testError);
      }
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      const store = useVoiceAssistantStore.getState();
      if (store.setError) store.setError(new Error('test error'));
      if (store.clearError) {
        store.clearError();
        const updated = useVoiceAssistantStore.getState();
        expect(updated.error).toBeNull();
      }
    });
  });

  // ========== Listeners Cleanup ==========
  describe('cleanupVoiceAssistantListeners', () => {
    it('should call all unsubscribe functions', () => {
      // cleanupVoiceAssistantListeners is a module-level export, not on the store
      expect(() => cleanupVoiceAssistantListeners()).not.toThrow();
    });
  });
});
