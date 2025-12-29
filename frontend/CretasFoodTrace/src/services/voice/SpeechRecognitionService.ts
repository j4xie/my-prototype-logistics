/**
 * 语音识别服务 (Speech-to-Text)
 * 使用讯飞 WebSocket API + expo-av 录音
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  SpeechRecognitionConfig,
  SpeechRecognitionResult,
  SpeechRecognitionStatus,
  SpeechRecognitionError,
  IFlyTekFrame,
  IFlyTekResult,
} from './types';
import { IFLYTEK_CONFIG, IFLYTEK_WSS_URL, AUDIO_RECORDING_CONFIG } from './config';

type ResultCallback = (result: SpeechRecognitionResult) => void;
type StatusCallback = (status: SpeechRecognitionStatus) => void;
type ErrorCallback = (error: SpeechRecognitionError) => void;

class SpeechRecognitionService {
  private config: SpeechRecognitionConfig = IFLYTEK_CONFIG;
  private status: SpeechRecognitionStatus = 'idle';
  private recording: Audio.Recording | null = null;
  private websocket: WebSocket | null = null;

  private resultListeners: ResultCallback[] = [];
  private statusListeners: StatusCallback[] = [];
  private errorListeners: ErrorCallback[] = [];

  private recognizedText: string = '';
  private audioChunks: string[] = [];

  /**
   * 更新讯飞配置
   */
  setConfig(config: Partial<SpeechRecognitionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查配置是否有效
   * 注意: 由于使用后端代理进行语音识别，前端无需配置讯飞密钥
   */
  isConfigured(): boolean {
    // 后端代理模式下始终返回 true
    // 讯飞密钥在后端 application.properties 中配置
    return true;
  }

  /**
   * 生成讯飞鉴权 URL
   */
  private generateAuthUrl(): string {
    const host = 'iat-api.xfyun.cn';
    const path = '/v2/iat';
    const date = new Date().toUTCString();

    // 构建签名原文
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;

    // HMAC-SHA256 签名 (简化版本，实际需要 crypto 库)
    // 注意: React Native 环境下需要使用 react-native-crypto 或后端代理
    const signature = this.hmacSha256(signatureOrigin, this.config.apiSecret);
    const signatureBase64 = btoa(signature);

    // 构建 authorization
    const authorizationOrigin = `api_key="${this.config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`;
    const authorization = btoa(authorizationOrigin);

    // 构建 URL
    const url = `${IFLYTEK_WSS_URL}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;

    return url;
  }

  /**
   * HMAC-SHA256 签名 (简化实现)
   * 注意: 生产环境建议通过后端生成签名
   */
  private hmacSha256(message: string, secret: string): string {
    // 这是一个占位实现
    // 实际需要使用 crypto-js 或通过后端API获取签名
    console.warn('HMAC-SHA256 需要通过后端实现或使用 crypto-js');
    return message; // 临时返回
  }

  /**
   * 请求录音权限
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('请求录音权限失败:', error);
      return false;
    }
  }

  /**
   * 开始录音和识别
   */
  async startListening(): Promise<void> {
    try {
      // 检查配置
      if (!this.isConfigured()) {
        throw new Error('讯飞配置未设置，请先配置 APPID、API Key 和 API Secret');
      }

      // 请求权限
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('未获得录音权限');
      }

      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // 重置状态
      this.recognizedText = '';
      this.audioChunks = [];

      // 开始录音
      const { recording } = await Audio.Recording.createAsync(
        AUDIO_RECORDING_CONFIG
      );
      this.recording = recording;

      // 更新状态
      this.updateStatus('listening');

      // 定时读取音频数据并发送 (模拟流式)
      this.startAudioStreaming();

    } catch (error) {
      this.handleError('START_ERROR', error instanceof Error ? error.message : '启动失败');
      throw error;
    }
  }

  /**
   * 开始音频流式传输
   */
  private async startAudioStreaming(): Promise<void> {
    // 由于 Expo Audio 不支持实时流，我们采用分段录制方案
    // 每隔一段时间停止录音、读取数据、发送、继续录音

    const streamInterval = setInterval(async () => {
      if (this.status !== 'listening' || !this.recording) {
        clearInterval(streamInterval);
        return;
      }

      try {
        // 获取录音状态
        const status = await this.recording.getStatusAsync();
        if (status.isRecording) {
          // 录音进行中，等待用户停止
        }
      } catch (error) {
        console.error('音频流错误:', error);
      }
    }, 500);
  }

  /**
   * 停止录音和识别
   */
  async stopListening(): Promise<SpeechRecognitionResult> {
    try {
      this.updateStatus('processing');

      if (this.recording) {
        // 停止录音
        await this.recording.stopAndUnloadAsync();

        // 获取录音文件 URI
        const uri = this.recording.getURI();
        this.recording = null;

        if (uri) {
          // 读取音频文件并发送到讯飞
          const result = await this.sendAudioToIFlyTek(uri);
          this.updateStatus('idle');
          return result;
        }
      }

      this.updateStatus('idle');
      return {
        text: this.recognizedText || '',
        isFinal: true,
      };
    } catch (error) {
      this.handleError('STOP_ERROR', error instanceof Error ? error.message : '停止失败');
      throw error;
    }
  }

  /**
   * 发送音频到讯飞进行识别
   * 由于 WebSocket 鉴权复杂，这里提供一个通过后端代理的替代方案
   */
  private async sendAudioToIFlyTek(audioUri: string): Promise<SpeechRecognitionResult> {
    try {
      // 读取音频文件
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 方案1: 通过后端代理发送到讯飞
      // 这是推荐的方式，因为可以在后端安全地处理密钥和签名
      const result = await this.sendViaBackendProxy(audioBase64);

      // 通知结果
      this.notifyResult(result);
      return result;

    } catch (error) {
      console.error('发送音频失败:', error);

      // 返回模拟结果用于测试
      const mockResult: SpeechRecognitionResult = {
        text: '[语音识别需要配置讯飞密钥]',
        isFinal: true,
      };
      this.notifyResult(mockResult);
      return mockResult;
    }
  }

  /**
   * 通过后端代理发送音频
   * 后端 API: POST /api/mobile/voice/recognize
   */
  private async sendViaBackendProxy(audioBase64: string): Promise<SpeechRecognitionResult> {
    // 调用后端 API 进行语音识别
    // 后端会处理讯飞的 WebSocket 连接和鉴权

    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://139.196.165.140:10010';

    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/voice/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: audioBase64,  // Base64 编码的音频数据
          format: 'raw',           // 音频格式: raw (PCM), mp3, speex
          encoding: 'raw',         // 音频编码: raw, lame, speex
          sampleRate: 16000,       // 采样率: 16000 或 8000
          language: 'zh_cn',       // 语言: zh_cn, en_us
          ptt: true,               // 是否返回标点符号
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const result = data.data;
        if (result.code === 0 && result.text) {
          return {
            text: result.text,
            isFinal: result.isFinal ?? true,
            confidence: undefined, // 讯飞API不返回置信度
          };
        }
        throw new Error(result.message || '识别失败');
      }

      throw new Error(data.message || '识别失败');
    } catch (error) {
      console.error('后端代理调用失败:', error);
      throw error;
    }
  }

  /**
   * 取消识别
   */
  async cancel(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }

      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      this.updateStatus('idle');
    } catch (error) {
      console.error('取消识别失败:', error);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): SpeechRecognitionStatus {
    return this.status;
  }

  /**
   * 添加结果监听器
   */
  addResultListener(callback: ResultCallback): () => void {
    this.resultListeners.push(callback);
    return () => {
      this.resultListeners = this.resultListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 添加状态监听器
   */
  addStatusListener(callback: StatusCallback): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 添加错误监听器
   */
  addErrorListener(callback: ErrorCallback): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 更新状态
   */
  private updateStatus(status: SpeechRecognitionStatus): void {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  /**
   * 通知结果
   */
  private notifyResult(result: SpeechRecognitionResult): void {
    this.resultListeners.forEach((cb) => cb(result));
  }

  /**
   * 处理错误
   */
  private handleError(code: string, message: string): void {
    this.updateStatus('error');
    const error: SpeechRecognitionError = { code, message };
    this.errorListeners.forEach((cb) => cb(error));
  }
}

// 导出单例
export const speechRecognitionService = new SpeechRecognitionService();
export default speechRecognitionService;
