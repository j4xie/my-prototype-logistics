import { ttsService } from '../voice/TextToSpeechService';
import { smartDefaults } from '../smartDefaults';

export type FeedbackType = 'success' | 'error' | 'warning';

class FeedbackSoundsService {
  private enabled: boolean | null = null;

  async isEnabled(userRole?: string): Promise<boolean> {
    if (this.enabled !== null) return this.enabled;
    const stored = await smartDefaults.getAudioFeedbackEnabled();
    if (stored !== null) {
      this.enabled = stored;
      return stored;
    }
    // Default: ON for workshop_supervisor and warehouse_manager, OFF for factory_super_admin
    const defaultOn = userRole === 'workshop_supervisor' || userRole === 'warehouse_manager';
    this.enabled = defaultOn;
    return defaultOn;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    smartDefaults.setAudioFeedbackEnabled(enabled);
  }

  async playFeedback(type: FeedbackType, message?: string, userRole?: string): Promise<void> {
    const enabled = await this.isEnabled(userRole);
    if (!enabled) return;

    // TTS feedback for success/error with message
    if (message) {
      try {
        await ttsService.speak(message, { language: 'zh-CN', rate: 1.1 });
      } catch (err) {
        console.warn('[FeedbackSounds] TTS failed:', err);
      }
    }
  }

  async onWriteSuccess(summary: string, userRole?: string): Promise<void> {
    await this.playFeedback('success', summary, userRole);
  }

  async onError(userRole?: string): Promise<void> {
    await this.playFeedback('error', '操作失败，请重试', userRole);
  }

  async onNeedMoreInfo(userRole?: string): Promise<void> {
    // No TTS for info requests, just a brief indication
    // Could add a short beep here later
  }
}

export const feedbackSounds = new FeedbackSoundsService();
