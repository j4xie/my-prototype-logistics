/**
 * NFC 工具函数
 *
 * 提供 NFC 标签读取、解析、写入相关的工具方法。
 * 所有 NFC 操作使用条件导入，如果 react-native-nfc-manager 未安装则安全降级。
 *
 * NFC 标签数据格式 (NDEF Text Record):
 *   "CRETAS:EMP:{employeeId}:{factoryId}"
 *   例如: "CRETAS:EMP:42:F001"
 */

// 条件导入 react-native-nfc-manager
let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;
let NfcEvents: any = null;

try {
  const nfcModule = require('react-native-nfc-manager');
  NfcManager = nfcModule.default;
  NfcTech = nfcModule.NfcTech;
  Ndef = nfcModule.Ndef;
  NfcEvents = nfcModule.NfcEvents;
} catch (_e) {
  // react-native-nfc-manager 未安装，NFC 功能不可用
}

/** NFC 标签解析结果 */
export interface NfcTagData {
  employeeId: string;
  factoryId: string;
}

/** NFC 可用性状态 */
export interface NfcAvailability {
  /** NFC 模块是否已安装 */
  moduleInstalled: boolean;
  /** 设备硬件是否支持 NFC */
  hardwareSupported: boolean;
  /** NFC 是否已启用 */
  enabled: boolean;
}

/** NFC 标签前缀 */
const NFC_TAG_PREFIX = 'CRETAS:EMP:';

/**
 * 检查 NFC 模块是否已安装
 */
export function isNfcModuleInstalled(): boolean {
  return NfcManager !== null;
}

/**
 * 检测 NFC 完整可用性
 * 包括: 模块安装状态、硬件支持、是否启用
 */
export async function checkNfcAvailability(): Promise<NfcAvailability> {
  if (!NfcManager) {
    return {
      moduleInstalled: false,
      hardwareSupported: false,
      enabled: false,
    };
  }

  try {
    const supported = await NfcManager.isSupported();
    if (!supported) {
      return {
        moduleInstalled: true,
        hardwareSupported: false,
        enabled: false,
      };
    }

    await NfcManager.start();
    const enabled = await NfcManager.isEnabled();

    return {
      moduleInstalled: true,
      hardwareSupported: true,
      enabled,
    };
  } catch (_error) {
    return {
      moduleInstalled: true,
      hardwareSupported: false,
      enabled: false,
    };
  }
}

/**
 * 检测 NFC 是否可用 (简化版)
 * 返回 true 表示 NFC 模块已安装、硬件支持且已启用
 */
export async function isNfcAvailable(): Promise<boolean> {
  const availability = await checkNfcAvailability();
  return availability.moduleInstalled && availability.hardwareSupported && availability.enabled;
}

/**
 * 解析 NFC 标签中的 NDEF 消息
 *
 * 预期格式: "CRETAS:EMP:{employeeId}:{factoryId}"
 *
 * @param tag NFC 标签对象 (来自 react-native-nfc-manager)
 * @returns 解析结果，如果格式不正确返回 null
 */
export function parseNfcTag(tag: any): NfcTagData | null {
  if (!tag) return null;

  try {
    // 尝试从 NDEF 消息中提取文本
    const ndefRecords = tag.ndefMessage;
    if (!ndefRecords || !Array.isArray(ndefRecords) || ndefRecords.length === 0) {
      return null;
    }

    // 读取第一条 NDEF 记录
    const record = ndefRecords[0];
    let text = '';

    if (Ndef && record.payload) {
      // 使用 Ndef 模块解析
      if (record.tnf === 1 && record.type) {
        // TNF_WELL_KNOWN, type = 'T' (Text)
        text = Ndef.text.decodePayload(new Uint8Array(record.payload));
      } else {
        // 尝试直接解码
        text = String.fromCharCode(...record.payload);
      }
    } else if (record.payload) {
      // Ndef 模块不可用，手动解码
      const payload = record.payload;
      if (Array.isArray(payload)) {
        // Text record: 第一字节是语言代码长度
        const langCodeLength = payload[0] & 0x3f;
        text = String.fromCharCode(...payload.slice(1 + langCodeLength));
      }
    }

    return parseNfcPayload(text);
  } catch (_error) {
    return null;
  }
}

/**
 * 解析 NFC 标签文本内容
 *
 * @param payload 标签文本内容，格式: "CRETAS:EMP:{employeeId}:{factoryId}"
 * @returns 解析结果
 */
export function parseNfcPayload(payload: string): NfcTagData | null {
  if (!payload || typeof payload !== 'string') return null;

  const trimmed = payload.trim();
  if (!trimmed.startsWith(NFC_TAG_PREFIX)) return null;

  const remainder = trimmed.substring(NFC_TAG_PREFIX.length);
  const parts = remainder.split(':');

  if (parts.length < 2) return null;

  const employeeId = parts[0];
  const factoryId = parts[1];

  if (!employeeId || !factoryId) return null;

  // employeeId 应为数字
  if (isNaN(Number(employeeId))) return null;

  return { employeeId, factoryId };
}

/**
 * 格式化 NFC 标签写入数据
 *
 * @param employeeId 员工ID
 * @param factoryId 工厂ID
 * @returns 格式化的标签文本
 */
export function formatNfcPayload(employeeId: string, factoryId: string): string {
  return `${NFC_TAG_PREFIX}${employeeId}:${factoryId}`;
}

/**
 * 启动 NFC 标签扫描
 *
 * @returns Promise<any> 读取到的 NFC 标签
 * @throws 如果 NFC 不可用或读取失败
 */
export async function startNfcScan(): Promise<any> {
  if (!NfcManager || !NfcTech) {
    throw new Error('NFC 模块未安装');
  }

  await NfcManager.requestTechnology(NfcTech.Ndef);
  const tag = await NfcManager.getTag();
  return tag;
}

/**
 * 停止 NFC 扫描并清理资源
 */
export async function stopNfcScan(): Promise<void> {
  if (!NfcManager) return;

  try {
    await NfcManager.cancelTechnologyRequest();
  } catch (_error) {
    // 忽略取消扫描时的错误
  }
}

/**
 * 向 NFC 标签写入 NDEF 消息
 *
 * @param employeeId 员工ID
 * @param factoryId 工厂ID
 * @throws 如果写入失败
 */
export async function writeNfcTag(employeeId: string, factoryId: string): Promise<void> {
  if (!NfcManager || !NfcTech || !Ndef) {
    throw new Error('NFC 模块未安装');
  }

  const payload = formatNfcPayload(employeeId, factoryId);

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);

    const bytes = Ndef.encodeMessage([
      Ndef.textRecord(payload),
    ]);

    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {
    await stopNfcScan();
  }
}

// 导出底层模块引用 (供高级用法)
export { NfcManager, NfcTech, Ndef, NfcEvents };
