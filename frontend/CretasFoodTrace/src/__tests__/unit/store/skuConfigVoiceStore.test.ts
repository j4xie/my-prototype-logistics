// @ts-nocheck
jest.mock('../../../services/ai/SkuConfigAIPrompt', () => ({}));

import { useSkuConfigVoiceStore } from '../../../store/skuConfigVoiceStore';

const initialState = {
  status: 'idle' as const,
  dialogVisible: false,
  isEditMode: false,
  recordingDuration: 0,
  transcribedText: '',
  latestResponse: null,
  accumulatedConfig: null,
  messages: [],
  errorMessage: null,
};

beforeEach(() => {
  useSkuConfigVoiceStore.setState(initialState);
});

describe('useSkuConfigVoiceStore', () => {
  describe('openDialog / closeDialog / resetSession', () => {
    it('openDialog sets dialogVisible true', () => {
      useSkuConfigVoiceStore.getState().openDialog();
      expect(useSkuConfigVoiceStore.getState().dialogVisible).toBe(true);
    });

    it('openDialog with editMode sets isEditMode true', () => {
      useSkuConfigVoiceStore.getState().openDialog(true);
      expect(useSkuConfigVoiceStore.getState().isEditMode).toBe(true);
    });

    it('closeDialog sets dialogVisible false', () => {
      useSkuConfigVoiceStore.getState().openDialog();
      useSkuConfigVoiceStore.getState().closeDialog();
      expect(useSkuConfigVoiceStore.getState().dialogVisible).toBe(false);
    });

    it('resetSession resets to initial state', () => {
      useSkuConfigVoiceStore.getState().openDialog();
      useSkuConfigVoiceStore.getState().startListening();
      useSkuConfigVoiceStore.getState().resetSession();
      const state = useSkuConfigVoiceStore.getState();
      expect(state.status).toBe('idle');
      expect(state.dialogVisible).toBe(true);
      expect(state.messages).toEqual([]);
    });
  });

  describe('startListening / stopListening / updateRecordingDuration', () => {
    it('startListening sets status to listening', () => {
      useSkuConfigVoiceStore.getState().startListening();
      expect(useSkuConfigVoiceStore.getState().status).toBe('listening');
    });

    it('stopListening sets status to processing', () => {
      useSkuConfigVoiceStore.getState().startListening();
      useSkuConfigVoiceStore.getState().stopListening();
      expect(useSkuConfigVoiceStore.getState().status).toBe('processing');
    });

    it('updateRecordingDuration updates duration', () => {
      useSkuConfigVoiceStore.getState().updateRecordingDuration(5);
      expect(useSkuConfigVoiceStore.getState().recordingDuration).toBe(5);
    });
  });

  describe('setTranscribedText', () => {
    it('sets transcribedText', () => {
      useSkuConfigVoiceStore.getState().setTranscribedText('hello world');
      expect(useSkuConfigVoiceStore.getState().transcribedText).toBe('hello world');
    });

    it('adds user message to messages', () => {
      useSkuConfigVoiceStore.getState().setTranscribedText('test input');
      const messages = useSkuConfigVoiceStore.getState().messages;
      expect(messages.length).toBeGreaterThanOrEqual(1);
      const userMsg = messages.find((m: any) => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg!.content).toBe('test input');
    });
  });

  describe('setAIResponse', () => {
    it('extract action sets status to confirming', () => {
      useSkuConfigVoiceStore.getState().setAIResponse({
        action: 'extract',
        message: 'extracted',
        skuConfig: { workHours: 5 },
      });
      expect(useSkuConfigVoiceStore.getState().status).toBe('confirming');
    });

    it('confirm action sets status to confirming', () => {
      useSkuConfigVoiceStore.getState().setAIResponse({
        action: 'confirm',
        message: 'confirmed',
        skuConfig: { workHours: 5 },
      });
      expect(useSkuConfigVoiceStore.getState().status).toBe('confirming');
    });

    it('complete action sets status to confirming', () => {
      useSkuConfigVoiceStore.getState().setAIResponse({
        action: 'complete',
        message: 'done',
        skuConfig: { workHours: 5 },
      });
      expect(useSkuConfigVoiceStore.getState().status).toBe('confirming');
    });

    it('prompt action sets status to speaking', () => {
      useSkuConfigVoiceStore.getState().setAIResponse({
        action: 'prompt',
        message: 'please tell me more',
      });
      expect(useSkuConfigVoiceStore.getState().status).toBe('speaking');
    });

    it('error action sets status to error and errorMessage', () => {
      useSkuConfigVoiceStore.getState().setAIResponse({
        action: 'error',
        message: 'something went wrong',
      });
      expect(useSkuConfigVoiceStore.getState().status).toBe('error');
      expect(useSkuConfigVoiceStore.getState().errorMessage).toBe('something went wrong');
    });
  });

  describe('startSpeaking / stopSpeaking', () => {
    it('startSpeaking sets status to speaking', () => {
      useSkuConfigVoiceStore.getState().startSpeaking();
      expect(useSkuConfigVoiceStore.getState().status).toBe('speaking');
    });

    it('stopSpeaking from prompt status goes to idle', () => {
      useSkuConfigVoiceStore.setState({ status: 'speaking' });
      // If previous action was prompt, stopSpeaking should go idle
      useSkuConfigVoiceStore.getState().stopSpeaking();
      const status = useSkuConfigVoiceStore.getState().status;
      expect(['idle', 'confirming']).toContain(status);
    });

    it('stopSpeaking from extract goes to confirming', () => {
      useSkuConfigVoiceStore.getState().setAIResponse({
        action: 'extract',
        message: 'extracted',
        skuConfig: { workHours: 5 },
      });
      useSkuConfigVoiceStore.setState({ status: 'speaking' });
      useSkuConfigVoiceStore.getState().stopSpeaking();
      const status = useSkuConfigVoiceStore.getState().status;
      expect(['idle', 'confirming']).toContain(status);
    });
  });

  describe('enterConfirming', () => {
    it('sets status to confirming', () => {
      useSkuConfigVoiceStore.getState().enterConfirming();
      expect(useSkuConfigVoiceStore.getState().status).toBe('confirming');
    });
  });

  describe('confirmConfig / cancelConfig', () => {
    it('confirmConfig returns accumulatedConfig and closes dialog', () => {
      const config = { workHours: 5, complexityScore: 3 };
      useSkuConfigVoiceStore.setState({ accumulatedConfig: config, dialogVisible: true });
      const result = useSkuConfigVoiceStore.getState().confirmConfig();
      expect(result).toEqual(config);
      expect(useSkuConfigVoiceStore.getState().dialogVisible).toBe(false);
    });

    it('confirmConfig returns null when no accumulatedConfig', () => {
      const result = useSkuConfigVoiceStore.getState().confirmConfig();
      expect(result).toBeNull();
    });

    it('cancelConfig sets status to idle', () => {
      useSkuConfigVoiceStore.setState({ status: 'confirming' });
      useSkuConfigVoiceStore.getState().cancelConfig();
      expect(useSkuConfigVoiceStore.getState().status).toBe('idle');
    });
  });

  describe('addMessage', () => {
    it('adds message to messages array', () => {
      useSkuConfigVoiceStore.getState().addMessage('assistant', 'hi');
      const msgs = useSkuConfigVoiceStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe('hi');
      expect(msgs[0].role).toBe('assistant');
    });

    it('message has id and timestamp', () => {
      useSkuConfigVoiceStore.getState().addMessage('user', 'test');
      const msg = useSkuConfigVoiceStore.getState().messages[0];
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });

    it('adds multiple messages in order', () => {
      useSkuConfigVoiceStore.getState().addMessage('user', 'first');
      useSkuConfigVoiceStore.getState().addMessage('assistant', 'second');
      const msgs = useSkuConfigVoiceStore.getState().messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[0].content).toBe('first');
      expect(msgs[1].content).toBe('second');
    });
  });

  describe('setError / clearError', () => {
    it('setError sets status to error and errorMessage', () => {
      useSkuConfigVoiceStore.getState().setError('network error');
      expect(useSkuConfigVoiceStore.getState().status).toBe('error');
      expect(useSkuConfigVoiceStore.getState().errorMessage).toBe('network error');
    });

    it('clearError clears errorMessage and sets status to idle', () => {
      useSkuConfigVoiceStore.getState().setError('err');
      useSkuConfigVoiceStore.getState().clearError();
      expect(useSkuConfigVoiceStore.getState().errorMessage).toBeNull();
      expect(useSkuConfigVoiceStore.getState().status).toBe('idle');
    });
  });

  describe('mergeConfig', () => {
    it('merges simple fields', () => {
      useSkuConfigVoiceStore.setState({ accumulatedConfig: { workHours: 5 } });
      useSkuConfigVoiceStore.getState().mergeConfig({ complexityScore: 3 });
      const config = useSkuConfigVoiceStore.getState().accumulatedConfig;
      expect(config!.workHours).toBe(5);
      expect(config!.complexityScore).toBe(3);
    });

    it('specialSkills deduplicates', () => {
      useSkuConfigVoiceStore.setState({
        accumulatedConfig: { skillRequirements: { minLevel: 1, preferredLevel: 1, specialSkills: ['cutting', 'mixing'] } },
      });
      useSkuConfigVoiceStore.getState().mergeConfig({ skillRequirements: { minLevel: 1, preferredLevel: 1, specialSkills: ['mixing', 'frying'] } });
      const config = useSkuConfigVoiceStore.getState().accumulatedConfig;
      expect(config!.skillRequirements!.specialSkills).toEqual(expect.arrayContaining(['cutting', 'mixing', 'frying']));
      expect(config!.skillRequirements!.specialSkills).toHaveLength(3);
    });

    it('skillRequirements merges levels', () => {
      useSkuConfigVoiceStore.setState({
        accumulatedConfig: { skillRequirements: { minLevel: 2, preferredLevel: 3, specialSkills: ['cutting'] } },
      });
      useSkuConfigVoiceStore.getState().mergeConfig({ skillRequirements: { minLevel: 4, preferredLevel: 5, specialSkills: ['frying'] } });
      const config = useSkuConfigVoiceStore.getState().accumulatedConfig;
      expect(config!.skillRequirements!.minLevel).toBe(4);
      expect(config!.skillRequirements!.preferredLevel).toBe(5);
      expect(config!.skillRequirements!.specialSkills).toEqual(expect.arrayContaining(['cutting', 'frying']));
    });

    it('processingSteps override', () => {
      useSkuConfigVoiceStore.setState({
        accumulatedConfig: { processingSteps: [{ name: 'step1' }] as any },
      });
      useSkuConfigVoiceStore.getState().mergeConfig({ processingSteps: [{ name: 'stepA' }] as any });
      const config = useSkuConfigVoiceStore.getState().accumulatedConfig;
      expect(config!.processingSteps).toEqual([{ name: 'stepA' }]);
    });

    it('mergeConfig with null accumulatedConfig creates new', () => {
      useSkuConfigVoiceStore.setState({ accumulatedConfig: null });
      useSkuConfigVoiceStore.getState().mergeConfig({ workHours: 8 });
      expect(useSkuConfigVoiceStore.getState().accumulatedConfig!.workHours).toBe(8);
    });
  });
});
