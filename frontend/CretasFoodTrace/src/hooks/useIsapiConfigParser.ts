/**
 * ISAPI 摄像头配置解析 Hook
 *
 * 用于 ISAPI 设备创建时，通过拍照或选择图片识别设备配置
 * 自动提取 IP 地址、端口、用户名、设备型号等参数
 */
import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { formAssistantApiClient } from '../services/api/formAssistantApiClient';

// ========== 类型定义 ==========

/**
 * ISAPI 设备配置解析结果
 */
export interface IsapiConfigResult {
  /** 设备名称 */
  deviceName?: string;
  /** IP 地址 */
  ipAddress?: string;
  /** HTTP 端口 */
  port?: number;
  /** RTSP 端口 */
  rtspPort?: number;
  /** 用户名 */
  username?: string;
  /** 密码 */
  password?: string;
  /** 设备型号 */
  deviceModel?: string;
  /** 序列号 */
  serialNumber?: string;
  /** 安装位置 */
  locationDescription?: string;
  /** 原始提取文本 */
  extractedText?: string;
  /** 识别置信度 */
  confidence: number;
}

/**
 * Hook 返回类型
 */
export interface UseIsapiConfigParserReturn {
  /** 是否正在解析 */
  loading: boolean;
  /** 解析结果 */
  result: IsapiConfigResult | null;
  /** 错误信息 */
  error: string | null;
  /** 从相机拍照解析 */
  parseFromCamera: () => Promise<IsapiConfigResult | null>;
  /** 从相册选择解析 */
  parseFromGallery: () => Promise<IsapiConfigResult | null>;
  /** 从文本解析 */
  parseFromText: (text: string) => Promise<IsapiConfigResult | null>;
  /** 清除结果 */
  clearResult: () => void;
}

// ========== Hook 实现 ==========

export function useIsapiConfigParser(): UseIsapiConfigParserReturn {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IsapiConfigResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 请求相机权限
   */
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('权限不足', '需要相机权限才能拍照识别设备配置');
      return false;
    }
    return true;
  };

  /**
   * 请求相册权限
   */
  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('权限不足', '需要相册权限才能选择设备配置图片');
      return false;
    }
    return true;
  };

  /**
   * 图片转 Base64
   */
  const imageToBase64 = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // 移除 data:image/xxx;base64, 前缀
        const base64Data = base64.split(',')[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  /**
   * 从 OCR 结果解析设备配置
   */
  const parseOCRResult = (
    fieldValues: Record<string, unknown>,
    extractedText?: string,
    confidence?: number
  ): IsapiConfigResult => {
    const parseResult: IsapiConfigResult = {
      confidence: confidence || 0,
      extractedText,
    };

    // 解析设备名称
    if (fieldValues.deviceName) {
      parseResult.deviceName = String(fieldValues.deviceName);
    }

    // 解析 IP 地址
    if (fieldValues.ipAddress) {
      parseResult.ipAddress = String(fieldValues.ipAddress);
    }

    // 解析 HTTP 端口
    if (fieldValues.port) {
      const portNum = parseInt(String(fieldValues.port), 10);
      parseResult.port = isNaN(portNum) ? 80 : portNum;
    }

    // 解析 RTSP 端口
    if (fieldValues.rtspPort) {
      const rtspPortNum = parseInt(String(fieldValues.rtspPort), 10);
      parseResult.rtspPort = isNaN(rtspPortNum) ? 554 : rtspPortNum;
    }

    // 解析用户名
    if (fieldValues.username) {
      parseResult.username = String(fieldValues.username);
    }

    // 解析密码
    if (fieldValues.password) {
      parseResult.password = String(fieldValues.password);
    }

    // 解析设备型号
    if (fieldValues.deviceModel) {
      parseResult.deviceModel = String(fieldValues.deviceModel);
    }

    // 解析序列号
    if (fieldValues.serialNumber) {
      parseResult.serialNumber = String(fieldValues.serialNumber);
    }

    // 解析安装位置
    if (fieldValues.locationDescription) {
      parseResult.locationDescription = String(fieldValues.locationDescription);
    }

    return parseResult;
  };

  /**
   * 执行 OCR 解析
   */
  const performOCRParse = async (imageBase64: string): Promise<IsapiConfigResult | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await formAssistantApiClient.parseFormOCR({
        imageBase64,
        entityType: 'ISAPI_DEVICE',
        formFields: [
          { name: 'deviceName', type: 'string', title: '设备名称', description: '摄像头名称或标识' },
          { name: 'ipAddress', type: 'string', title: 'IP地址', description: '设备IP地址，如192.168.1.100' },
          { name: 'port', type: 'number', title: 'HTTP端口', description: 'HTTP服务端口，默认80' },
          { name: 'rtspPort', type: 'number', title: 'RTSP端口', description: 'RTSP视频流端口，默认554' },
          { name: 'username', type: 'string', title: '用户名', description: '设备登录用户名' },
          { name: 'password', type: 'string', title: '密码', description: '设备登录密码' },
          { name: 'deviceModel', type: 'string', title: '设备型号', description: '如DS-2CD2T45FWD-I5' },
          { name: 'serialNumber', type: 'string', title: '序列号', description: '设备序列号' },
          { name: 'locationDescription', type: 'string', title: '安装位置', description: '设备安装位置描述' },
        ],
      });

      if (!response.success) {
        throw new Error(response.message || '设备配置解析失败');
      }

      const parseResult = parseOCRResult(
        response.fieldValues,
        response.extractedText,
        response.confidence
      );

      setResult(parseResult);
      return parseResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '设备配置解析失败';
      setError(errorMsg);
      console.error('[useIsapiConfigParser] OCR parse error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 执行文本解析
   */
  const performTextParse = async (text: string): Promise<IsapiConfigResult | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await formAssistantApiClient.parseFormInput({
        userInput: text,
        entityType: 'ISAPI_DEVICE',
        formFields: [
          { name: 'deviceName', type: 'string', title: '设备名称', description: '摄像头名称或标识' },
          { name: 'ipAddress', type: 'string', title: 'IP地址', description: '设备IP地址，如192.168.1.100' },
          { name: 'port', type: 'number', title: 'HTTP端口', description: 'HTTP服务端口，默认80' },
          { name: 'rtspPort', type: 'number', title: 'RTSP端口', description: 'RTSP视频流端口，默认554' },
          { name: 'username', type: 'string', title: '用户名', description: '设备登录用户名' },
          { name: 'password', type: 'string', title: '密码', description: '设备登录密码' },
          { name: 'deviceModel', type: 'string', title: '设备型号', description: '如DS-2CD2T45FWD-I5' },
          { name: 'serialNumber', type: 'string', title: '序列号', description: '设备序列号' },
          { name: 'locationDescription', type: 'string', title: '安装位置', description: '设备安装位置描述' },
        ],
      });

      if (!response.success) {
        throw new Error(response.message || '设备配置解析失败');
      }

      const parseResult = parseOCRResult(
        response.fieldValues,
        text,
        response.confidence
      );

      setResult(parseResult);
      return parseResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '设备配置解析失败';
      setError(errorMsg);
      console.error('[useIsapiConfigParser] Text parse error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 从相机拍照解析
   */
  const parseFromCamera = useCallback(async (): Promise<IsapiConfigResult | null> => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return null;

    try {
      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
        return null;
      }

      const base64 = await imageToBase64(pickerResult.assets[0].uri);
      return performOCRParse(base64);
    } catch (err) {
      const errorMsg = '拍照失败，请重试';
      setError(errorMsg);
      console.error('[useIsapiConfigParser] Camera error:', err);
      return null;
    }
  }, []);

  /**
   * 从相册选择解析
   */
  const parseFromGallery = useCallback(async (): Promise<IsapiConfigResult | null> => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return null;

    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
        return null;
      }

      const base64 = await imageToBase64(pickerResult.assets[0].uri);
      return performOCRParse(base64);
    } catch (err) {
      const errorMsg = '选择图片失败，请重试';
      setError(errorMsg);
      console.error('[useIsapiConfigParser] Gallery error:', err);
      return null;
    }
  }, []);

  /**
   * 从文本解析
   */
  const parseFromText = useCallback(async (text: string): Promise<IsapiConfigResult | null> => {
    if (!text.trim()) {
      setError('请输入设备配置信息');
      return null;
    }
    return performTextParse(text);
  }, []);

  /**
   * 清除结果
   */
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    loading,
    result,
    error,
    parseFromCamera,
    parseFromGallery,
    parseFromText,
    clearResult,
  };
}

export default useIsapiConfigParser;
