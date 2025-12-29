/**
 * 语音合成服务 (Text-to-Speech)
 * 使用 expo-speech 实现
 */

import * as Speech from 'expo-speech';
import { TextToSpeechConfig, TextToSpeechStatus } from './types';
import { TTS_DEFAULT_CONFIG, TTS_RATE_MAP } from './config';

type TTSStatusCallback = (status: TextToSpeechStatus) => void;
type TTSErrorCallback = (error: Error) => void;

class TextToSpeechService {
  private status: TextToSpeechStatus = 'idle';
  private statusListeners: TTSStatusCallback[] = [];
  private errorListeners: TTSErrorCallback[] = [];
  private currentConfig: TextToSpeechConfig = TTS_DEFAULT_CONFIG;

  /**
   * 设置语音配置
   */
  setConfig(config: Partial<TextToSpeechConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...config };
  }

  /**
   * 设置语音速度
   */
  setRate(rate: 'slow' | 'normal' | 'fast'): void {
    this.currentConfig.rate = TTS_RATE_MAP[rate];
  }

  /**
   * 朗读文本
   */
  async speak(text: string, config?: Partial<TextToSpeechConfig>): Promise<void> {
    try {
      // 如果正在播放，先停止
      if (this.status === 'speaking') {
        await this.stop();
      }

      const mergedConfig = { ...this.currentConfig, ...config };

      this.updateStatus('speaking');

      await Speech.speak(text, {
        language: mergedConfig.language || 'zh-CN',
        pitch: mergedConfig.pitch || 1.0,
        rate: mergedConfig.rate || 1.0,
        voice: mergedConfig.voice,
        onStart: () => {
          this.updateStatus('speaking');
        },
        onDone: () => {
          this.updateStatus('idle');
        },
        onStopped: () => {
          this.updateStatus('idle');
        },
        onError: (error) => {
          this.updateStatus('error');
          this.notifyError(new Error(error.message || '语音播放失败'));
        },
      });
    } catch (error) {
      this.updateStatus('error');
      this.notifyError(error instanceof Error ? error : new Error('语音播放失败'));
      throw error;
    }
  }

  /**
   * 停止播放
   */
  async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.updateStatus('idle');
    } catch (error) {
      console.error('停止语音失败:', error);
    }
  }

  /**
   * 暂停播放 (仅 iOS 支持)
   */
  async pause(): Promise<void> {
    try {
      await Speech.pause();
      this.updateStatus('paused');
    } catch (error) {
      console.error('暂停语音失败:', error);
    }
  }

  /**
   * 恢复播放 (仅 iOS 支持)
   */
  async resume(): Promise<void> {
    try {
      await Speech.resume();
      this.updateStatus('speaking');
    } catch (error) {
      console.error('恢复语音失败:', error);
    }
  }

  /**
   * 检查是否正在播放
   */
  async isSpeaking(): Promise<boolean> {
    return await Speech.isSpeakingAsync();
  }

  /**
   * 获取可用的语音列表
   */
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch (error) {
      console.error('获取语音列表失败:', error);
      return [];
    }
  }

  /**
   * 获取中文语音
   */
  async getChineseVoices(): Promise<Speech.Voice[]> {
    const voices = await this.getAvailableVoices();
    return voices.filter(
      (voice) =>
        voice.language.startsWith('zh') ||
        voice.language.includes('CN') ||
        voice.language.includes('TW')
    );
  }

  /**
   * 获取当前状态
   */
  getStatus(): TextToSpeechStatus {
    return this.status;
  }

  /**
   * 添加状态监听器
   */
  addStatusListener(callback: TTSStatusCallback): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 添加错误监听器
   */
  addErrorListener(callback: TTSErrorCallback): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 更新状态并通知监听器
   */
  private updateStatus(status: TextToSpeechStatus): void {
    this.status = status;
    this.statusListeners.forEach((callback) => callback(status));
  }

  /**
   * 通知错误
   */
  private notifyError(error: Error): void {
    this.errorListeners.forEach((callback) => callback(error));
  }
}

// 导出单例
export const ttsService = new TextToSpeechService();
export default ttsService;
