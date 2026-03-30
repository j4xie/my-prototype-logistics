/**
 * FeedbackSoundsService 单元测试
 * 测试音频反馈服务的启用/禁用逻辑和 TTS 调用
 */

jest.mock('../../../services/voice/TextToSpeechService', () => ({
  ttsService: {
    speak: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../services/smartDefaults', () => ({
  smartDefaults: {
    getAudioFeedbackEnabled: jest.fn().mockResolvedValue(null),
    setAudioFeedbackEnabled: jest.fn().mockResolvedValue(undefined),
  },
}));

import { ttsService } from '../../../services/voice/TextToSpeechService';
import { smartDefaults } from '../../../services/smartDefaults';

// We need to access the class directly to create fresh instances per test.
// The module exports a singleton, but we re-require to get the class.
// Alternative: use the exported singleton and reset its state via setEnabled.

describe('FeedbackSoundsService', () => {
  // We'll dynamically require to get a fresh module each test
  let feedbackSounds: typeof import('../../../services/audio/feedbackSounds').feedbackSounds;

  beforeEach(() => {
    jest.clearAllMocks();
    (smartDefaults.getAudioFeedbackEnabled as jest.Mock).mockResolvedValue(null);

    // Reset module to get fresh singleton with enabled=null
    jest.resetModules();

    // Re-apply mocks after resetModules
    jest.doMock('../../../services/voice/TextToSpeechService', () => ({
      ttsService: {
        speak: jest.fn().mockResolvedValue(undefined),
      },
    }));
    jest.doMock('../../../services/smartDefaults', () => ({
      smartDefaults: {
        getAudioFeedbackEnabled: jest.fn().mockResolvedValue(null),
        setAudioFeedbackEnabled: jest.fn().mockResolvedValue(undefined),
      },
    }));

    const mod = require('../../../services/audio/feedbackSounds');
    feedbackSounds = mod.feedbackSounds;
  });

  describe('isEnabled', () => {
    it('defaults to true for workshop_supervisor when no stored value', async () => {
      const result = await feedbackSounds.isEnabled('workshop_supervisor');
      expect(result).toBe(true);
    });

    it('defaults to true for warehouse_manager when no stored value', async () => {
      const result = await feedbackSounds.isEnabled('warehouse_manager');
      expect(result).toBe(true);
    });

    it('defaults to false for factory_super_admin when no stored value', async () => {
      const result = await feedbackSounds.isEnabled('factory_super_admin');
      expect(result).toBe(false);
    });

    it('returns stored value from AsyncStorage when available', async () => {
      const { smartDefaults: sd } = require('../../../services/smartDefaults');
      (sd.getAudioFeedbackEnabled as jest.Mock).mockResolvedValue(true);

      const result = await feedbackSounds.isEnabled('factory_super_admin');
      expect(result).toBe(true);
    });

    it('caches the value after first call', async () => {
      await feedbackSounds.isEnabled('workshop_supervisor');
      // Second call should not re-read from storage
      const { smartDefaults: sd } = require('../../../services/smartDefaults');
      const result = await feedbackSounds.isEnabled('factory_super_admin');
      // Should still be true (cached from first call as workshop_supervisor)
      expect(result).toBe(true);
      // getAudioFeedbackEnabled called only once
      expect(sd.getAudioFeedbackEnabled).toHaveBeenCalledTimes(1);
    });
  });

  describe('setEnabled', () => {
    it('updates internal state and persists to smartDefaults', () => {
      const { smartDefaults: sd } = require('../../../services/smartDefaults');
      feedbackSounds.setEnabled(false);
      expect(sd.setAudioFeedbackEnabled).toHaveBeenCalledWith(false);
    });

    it('affects subsequent isEnabled calls', async () => {
      feedbackSounds.setEnabled(true);
      const result = await feedbackSounds.isEnabled();
      expect(result).toBe(true);

      feedbackSounds.setEnabled(false);
      const result2 = await feedbackSounds.isEnabled();
      expect(result2).toBe(false);
    });
  });

  describe('onWriteSuccess', () => {
    it('calls ttsService.speak with summary when enabled', async () => {
      const { ttsService: tts } = require('../../../services/voice/TextToSpeechService');
      feedbackSounds.setEnabled(true);

      await feedbackSounds.onWriteSuccess('入库成功 500kg');
      expect(tts.speak).toHaveBeenCalledWith('入库成功 500kg', { language: 'zh-CN', rate: 1.1 });
    });

    it('does NOT call ttsService.speak when disabled', async () => {
      const { ttsService: tts } = require('../../../services/voice/TextToSpeechService');
      feedbackSounds.setEnabled(false);

      await feedbackSounds.onWriteSuccess('入库成功 500kg');
      expect(tts.speak).not.toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('calls ttsService.speak with error message when enabled', async () => {
      const { ttsService: tts } = require('../../../services/voice/TextToSpeechService');
      feedbackSounds.setEnabled(true);

      await feedbackSounds.onError();
      expect(tts.speak).toHaveBeenCalledWith('操作失败，请重试', { language: 'zh-CN', rate: 1.1 });
    });

    it('does NOT call ttsService.speak when disabled', async () => {
      const { ttsService: tts } = require('../../../services/voice/TextToSpeechService');
      feedbackSounds.setEnabled(false);

      await feedbackSounds.onError();
      expect(tts.speak).not.toHaveBeenCalled();
    });
  });

  describe('onNeedMoreInfo', () => {
    it('does nothing (no TTS call)', async () => {
      const { ttsService: tts } = require('../../../services/voice/TextToSpeechService');
      feedbackSounds.setEnabled(true);

      await feedbackSounds.onNeedMoreInfo();
      expect(tts.speak).not.toHaveBeenCalled();
    });
  });
});
