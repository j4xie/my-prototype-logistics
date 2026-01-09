/**
 * 协议文档解析 Hook
 *
 * 用于 IoT 设备创建时，通过拍照或选择图片识别协议文档
 * 自动提取波特率、数据位、校验位等参数
 */
import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { formAssistantApiClient } from '../services/api/formAssistantApiClient';
import {
  ConnectionType,
  ChecksumType,
  ReadMode,
  ScaleProtocol,
} from '../services/api/scaleApiClient';

// ========== 类型定义 ==========

/**
 * 串口配置（从协议文档解析）
 */
export interface SerialConfig {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'odd' | 'even';
}

/**
 * 协议解析结果
 */
export interface ProtocolParseResult {
  /** 协议名称 */
  protocolName?: string;
  /** 连接类型 */
  connectionType?: ConnectionType;
  /** 串口配置 */
  serialConfig?: SerialConfig;
  /** 帧格式描述 */
  frameFormat?: string;
  /** 校验类型 */
  checksumType?: ChecksumType;
  /** 读取模式 */
  readMode?: ReadMode;
  /** 稳定阈值(ms) */
  stableThresholdMs?: number;
  /** 原始提取文本 */
  extractedText?: string;
  /** 识别置信度 */
  confidence: number;
}

/**
 * Hook 返回类型
 */
export interface UseProtocolDocParserReturn {
  /** 是否正在解析 */
  loading: boolean;
  /** 解析结果 */
  result: ProtocolParseResult | null;
  /** 错误信息 */
  error: string | null;
  /** 从相机拍照解析 */
  parseFromCamera: () => Promise<ProtocolParseResult | null>;
  /** 从相册选择解析 */
  parseFromGallery: () => Promise<ProtocolParseResult | null>;
  /** 清除结果 */
  clearResult: () => void;
  /** 将结果转换为 ScaleProtocol 格式 */
  toScaleProtocol: (result: ProtocolParseResult) => Partial<ScaleProtocol>;
}

// ========== 常量映射 ==========

/** 波特率关键词映射 */
const BAUD_RATE_MAP: Record<string, number> = {
  '1200': 1200,
  '2400': 2400,
  '4800': 4800,
  '9600': 9600,
  '19200': 19200,
  '38400': 38400,
  '57600': 57600,
  '115200': 115200,
};

/** 校验类型关键词映射 */
const CHECKSUM_TYPE_MAP: Record<string, ChecksumType> = {
  '无': 'NONE',
  '无校验': 'NONE',
  'none': 'NONE',
  'no': 'NONE',
  'xor': 'XOR',
  '异或': 'XOR',
  '异或校验': 'XOR',
  'crc16': 'CRC16',
  'crc-16': 'CRC16',
  'crc32': 'CRC32',
  'crc-32': 'CRC32',
  'sum': 'SUM',
  '累加': 'SUM',
  '累加和': 'SUM',
  'modbus': 'MODBUS_CRC',
  'modbus_crc': 'MODBUS_CRC',
};

/** 校验位关键词映射 */
const PARITY_MAP: Record<string, 'none' | 'odd' | 'even'> = {
  '无': 'none',
  '无校验': 'none',
  'none': 'none',
  'no': 'none',
  'n': 'none',
  '奇': 'odd',
  '奇校验': 'odd',
  'odd': 'odd',
  'o': 'odd',
  '偶': 'even',
  '偶校验': 'even',
  'even': 'even',
  'e': 'even',
};

/** 连接类型关键词映射 */
const CONNECTION_TYPE_MAP: Record<string, ConnectionType> = {
  'rs232': 'RS232',
  'rs-232': 'RS232',
  '232': 'RS232',
  'rs485': 'RS485',
  'rs-485': 'RS485',
  '485': 'RS485',
  'tcp': 'TCP_SOCKET',
  'socket': 'TCP_SOCKET',
  'mqtt': 'MQTT',
  'modbus': 'MODBUS_RTU',
  'modbus_rtu': 'MODBUS_RTU',
  'modbus_tcp': 'MODBUS_TCP',
  'http': 'HTTP_API',
  'api': 'HTTP_API',
};

// ========== Hook 实现 ==========

export function useProtocolDocParser(): UseProtocolDocParserReturn {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProtocolParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 请求相机权限
   */
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('权限不足', '需要相机权限才能拍照识别协议文档');
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
      Alert.alert('权限不足', '需要相册权限才能选择协议文档图片');
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
   * 从 OCR 结果解析协议参数
   */
  const parseOCRResult = (
    fieldValues: Record<string, unknown>,
    extractedText?: string,
    confidence?: number
  ): ProtocolParseResult => {
    const result: ProtocolParseResult = {
      confidence: confidence || 0,
      extractedText,
    };

    // 解析协议名称
    if (fieldValues.protocolName) {
      result.protocolName = String(fieldValues.protocolName);
    }

    // 解析连接类型
    if (fieldValues.connectionType) {
      const connType = String(fieldValues.connectionType).toLowerCase();
      result.connectionType = CONNECTION_TYPE_MAP[connType] || 'RS232';
    }

    // 解析串口配置
    const serialConfig: SerialConfig = {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    };

    if (fieldValues.baudRate) {
      const baudStr = String(fieldValues.baudRate);
      serialConfig.baudRate = BAUD_RATE_MAP[baudStr] || parseInt(baudStr, 10) || 9600;
    }

    if (fieldValues.dataBits) {
      serialConfig.dataBits = parseInt(String(fieldValues.dataBits), 10) || 8;
    }

    if (fieldValues.stopBits) {
      serialConfig.stopBits = parseFloat(String(fieldValues.stopBits)) || 1;
    }

    if (fieldValues.parity) {
      const parityStr = String(fieldValues.parity).toLowerCase();
      serialConfig.parity = PARITY_MAP[parityStr] || 'none';
    }

    result.serialConfig = serialConfig;

    // 解析帧格式
    if (fieldValues.frameFormat) {
      result.frameFormat = String(fieldValues.frameFormat);
    }

    // 解析校验类型
    if (fieldValues.checksumType) {
      const checksumStr = String(fieldValues.checksumType).toLowerCase();
      result.checksumType = CHECKSUM_TYPE_MAP[checksumStr] || 'NONE';
    }

    // 解析读取模式
    if (fieldValues.readMode) {
      const modeStr = String(fieldValues.readMode).toLowerCase();
      if (modeStr.includes('continuous') || modeStr.includes('连续')) {
        result.readMode = 'CONTINUOUS';
      } else if (modeStr.includes('poll') || modeStr.includes('轮询')) {
        result.readMode = 'POLL';
      } else if (modeStr.includes('change') || modeStr.includes('变化')) {
        result.readMode = 'ON_CHANGE';
      }
    }

    // 解析稳定阈值
    if (fieldValues.stableThresholdMs) {
      result.stableThresholdMs = parseInt(String(fieldValues.stableThresholdMs), 10);
    }

    return result;
  };

  /**
   * 执行 OCR 解析
   */
  const performOCRParse = async (imageBase64: string): Promise<ProtocolParseResult | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await formAssistantApiClient.parseFormOCR({
        imageBase64,
        entityType: 'SCALE_PROTOCOL',
        formFields: [
          { name: 'protocolName', type: 'string', title: '协议名称' },
          { name: 'connectionType', type: 'enum', title: '连接类型' },
          { name: 'baudRate', type: 'number', title: '波特率' },
          { name: 'dataBits', type: 'number', title: '数据位' },
          { name: 'stopBits', type: 'number', title: '停止位' },
          { name: 'parity', type: 'enum', title: '校验位' },
          { name: 'checksumType', type: 'enum', title: '校验类型' },
          { name: 'frameFormat', type: 'string', title: '帧格式' },
          { name: 'readMode', type: 'enum', title: '读取模式' },
          { name: 'stableThresholdMs', type: 'number', title: '稳定阈值' },
        ],
      });

      if (!response.success) {
        throw new Error(response.message || '协议文档解析失败');
      }

      const parseResult = parseOCRResult(
        response.fieldValues,
        response.extractedText,
        response.confidence
      );

      setResult(parseResult);
      return parseResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '协议文档解析失败';
      setError(errorMsg);
      console.error('[useProtocolDocParser] OCR parse error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 从相机拍照解析
   */
  const parseFromCamera = useCallback(async (): Promise<ProtocolParseResult | null> => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return null;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return null;
      }

      const base64 = await imageToBase64(result.assets[0].uri);
      return performOCRParse(base64);
    } catch (err) {
      const errorMsg = '拍照失败，请重试';
      setError(errorMsg);
      console.error('[useProtocolDocParser] Camera error:', err);
      return null;
    }
  }, []);

  /**
   * 从相册选择解析
   */
  const parseFromGallery = useCallback(async (): Promise<ProtocolParseResult | null> => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return null;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return null;
      }

      const base64 = await imageToBase64(result.assets[0].uri);
      return performOCRParse(base64);
    } catch (err) {
      const errorMsg = '选择图片失败，请重试';
      setError(errorMsg);
      console.error('[useProtocolDocParser] Gallery error:', err);
      return null;
    }
  }, []);

  /**
   * 清除结果
   */
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  /**
   * 将解析结果转换为 ScaleProtocol 格式
   */
  const toScaleProtocol = useCallback(
    (parseResult: ProtocolParseResult): Partial<ScaleProtocol> => {
      return {
        protocolName: parseResult.protocolName || '未命名协议',
        connectionType: parseResult.connectionType || 'RS232',
        serialConfig: parseResult.serialConfig
          ? JSON.stringify(parseResult.serialConfig)
          : undefined,
        frameFormat: parseResult.frameFormat || '',
        checksumType: parseResult.checksumType || 'NONE',
        readMode: parseResult.readMode || 'CONTINUOUS',
        stableThresholdMs: parseResult.stableThresholdMs || 500,
      };
    },
    []
  );

  return {
    loading,
    result,
    error,
    parseFromCamera,
    parseFromGallery,
    clearResult,
    toScaleProtocol,
  };
}

export default useProtocolDocParser;
