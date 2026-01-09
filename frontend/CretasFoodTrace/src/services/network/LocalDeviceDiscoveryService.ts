/**
 * 本地设备发现服务
 * 在前端直接扫描局域网中的海康威视摄像头
 *
 * 解决架构问题：云端后端无法扫描用户本地局域网
 * 方案：前端使用 HTTP 直接探测本地设备
 */

import NetInfo from '@react-native-community/netinfo';

// ========== 类型定义 ==========

export interface DiscoveredDevice {
  ipAddress: string;
  port: number;
  deviceType: string;
  deviceModel?: string;
  serialNumber?: string;
  deviceName?: string;
  firmwareVersion?: string;
  macAddress?: string;
  manufacturer: string;
  isapiSupported: boolean;
  authRequired: boolean;
  httpStatus?: number;
  probeTimeMs?: number;
}

export interface DiscoveryOptions {
  networkCIDR?: string;       // 网段 CIDR，如 192.168.1.0/24
  timeout?: number;           // 单个设备超时时间 (ms)
  ports?: number[];           // 要扫描的端口
  maxConcurrent?: number;     // 最大并发数
  onProgress?: (progress: DiscoveryProgress) => void;
}

export interface DiscoveryProgress {
  scannedCount: number;
  totalCount: number;
  currentIp?: string;
  foundCount: number;
  percentage: number;
}

interface NetworkInfo {
  localIp: string;
  subnet: string;
  cidr: string;
}

// ========== 常量定义 ==========

const MANUFACTURER_HIKVISION = 'HIKVISION';
const MANUFACTURER_DAHUA = 'DAHUA';
const MANUFACTURER_UNIVIEW = 'UNIVIEW';
const MANUFACTURER_OTHER = 'OTHER';

const DEFAULT_PORTS = [80, 443, 8000, 8080];
const DEFAULT_TIMEOUT = 3000;
const DEFAULT_MAX_CONCURRENT = 20;

// ISAPI 端点
const ISAPI_DEVICE_INFO = '/ISAPI/System/deviceInfo';

// XML 解析正则
const PATTERN_DEVICE_NAME = /<deviceName>([^<]+)<\/deviceName>/i;
const PATTERN_DEVICE_TYPE = /<deviceType>([^<]+)<\/deviceType>/i;
const PATTERN_MODEL = /<model>([^<]+)<\/model>/i;
const PATTERN_SERIAL_NUMBER = /<serialNumber>([^<]+)<\/serialNumber>/i;
const PATTERN_FIRMWARE_VERSION = /<firmwareVersion>([^<]+)<\/firmwareVersion>/i;
const PATTERN_MAC_ADDRESS = /<macAddress>([^<]+)<\/macAddress>/i;

// ========== 工具函数 ==========

/**
 * 解析 CIDR 获取 IP 列表
 */
function parseCIDR(cidr: string): string[] {
  const ipList: string[] = [];

  if (!cidr || !cidr.includes('/')) {
    return ipList;
  }

  try {
    const parts = cidr.split('/');
    const baseIp = parts[0];
    const prefixStr = parts[1];

    if (!baseIp || !prefixStr) {
      return ipList;
    }

    const prefix = parseInt(prefixStr, 10);

    // 验证前缀长度 (限制扫描范围)
    if (prefix < 20 || prefix > 30) {
      console.warn(`CIDR 前缀长度超出范围 (20-30): ${prefix}`);
      return ipList;
    }

    const octets = baseIp.split('.').map(Number);
    if (octets.length !== 4 || octets.some(o => o < 0 || o > 255)) {
      return ipList;
    }

    // 计算主机数
    const hostBits = 32 - prefix;
    const hostCount = (1 << hostBits) - 2;  // 排除网络地址和广播地址

    // 转换为长整数
    let baseIpLong = 0;
    for (let i = 0; i < 4; i++) {
      const octet = octets[i];
      if (octet === undefined) continue;
      baseIpLong = (baseIpLong << 8) | octet;
    }

    // 计算网络地址
    const mask = (0xFFFFFFFF << hostBits) >>> 0;
    const networkAddress = (baseIpLong & mask) >>> 0;

    // 生成有效主机 IP 列表
    for (let i = 1; i <= hostCount; i++) {
      const hostIp = (networkAddress + i) >>> 0;
      const ip = [
        (hostIp >> 24) & 0xFF,
        (hostIp >> 16) & 0xFF,
        (hostIp >> 8) & 0xFF,
        hostIp & 0xFF,
      ].join('.');
      ipList.push(ip);
    }
  } catch (error) {
    console.error('解析 CIDR 失败:', cidr, error);
  }

  return ipList;
}

/**
 * 获取本机网络信息
 */
async function getNetworkInfo(): Promise<NetworkInfo | null> {
  try {
    const state = await NetInfo.fetch();

    if (state.type === 'wifi' && state.isConnected && state.details) {
      const details = state.details as { ipAddress?: string; subnet?: string };
      const localIp = details.ipAddress;
      const subnet = details.subnet;

      if (localIp && subnet) {
        // 根据子网掩码计算 CIDR
        const prefix = subnetToPrefix(subnet);
        const networkPart = localIp.split('.').slice(0, 3).join('.');
        const cidr = `${networkPart}.0/${prefix}`;

        return { localIp, subnet, cidr };
      }
    }
  } catch (error) {
    console.error('获取网络信息失败:', error);
  }

  return null;
}

/**
 * 子网掩码转 CIDR 前缀
 */
function subnetToPrefix(subnet: string): number {
  const octets = subnet.split('.').map(Number);
  let prefix = 0;
  for (const octet of octets) {
    prefix += (octet >>> 0).toString(2).replace(/0/g, '').length;
  }
  return prefix || 24;  // 默认 /24
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  timeout: number
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/xml, text/xml, */*',
      },
    });
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 识别制造商
 */
function identifyManufacturer(content: string): string {
  if (!content) return MANUFACTURER_OTHER;

  const lower = content.toLowerCase();

  if (lower.includes('hikvision') ||
      lower.includes('hikdigital') ||
      lower.includes('hik-connect') ||
      (lower.includes('<devicename>') && lower.includes('<serialnumber>'))) {
    return MANUFACTURER_HIKVISION;
  }

  if (lower.includes('dahua') ||
      lower.includes('dh-') ||
      lower.includes('imou')) {
    return MANUFACTURER_DAHUA;
  }

  if (lower.includes('uniview') || lower.includes('unv')) {
    return MANUFACTURER_UNIVIEW;
  }

  return MANUFACTURER_OTHER;
}

/**
 * 映射设备类型
 */
function mapDeviceType(rawType: string): string {
  if (!rawType) return 'UNKNOWN';

  const upper = rawType.toUpperCase();
  if (upper.includes('IPC') || upper.includes('IP CAMERA') || upper.includes('NETWORK CAMERA')) {
    return 'IPC';
  } else if (upper.includes('NVR')) {
    return 'NVR';
  } else if (upper.includes('DVR')) {
    return 'DVR';
  } else if (upper.includes('ENCODER') || upper.includes('VIDEO SERVER')) {
    return 'ENCODER';
  }

  return 'UNKNOWN';
}

/**
 * 解析 ISAPI 设备信息 XML
 */
function parseIsapiDeviceInfo(
  ip: string,
  port: number,
  httpStatus: number,
  xml: string
): DiscoveredDevice {
  let deviceName: string | undefined;
  let deviceType = 'IPC';
  let deviceModel: string | undefined;
  let serialNumber: string | undefined;
  let firmwareVersion: string | undefined;
  let macAddress: string | undefined;

  let match = PATTERN_DEVICE_NAME.exec(xml);
  if (match && match[1]) deviceName = match[1];

  match = PATTERN_DEVICE_TYPE.exec(xml);
  if (match && match[1]) deviceType = mapDeviceType(match[1]);

  match = PATTERN_MODEL.exec(xml);
  if (match && match[1]) deviceModel = match[1];

  match = PATTERN_SERIAL_NUMBER.exec(xml);
  if (match && match[1]) serialNumber = match[1];

  match = PATTERN_FIRMWARE_VERSION.exec(xml);
  if (match && match[1]) firmwareVersion = match[1];

  match = PATTERN_MAC_ADDRESS.exec(xml);
  if (match && match[1]) macAddress = match[1];

  return {
    ipAddress: ip,
    port,
    httpStatus,
    deviceName,
    deviceType,
    deviceModel,
    serialNumber,
    firmwareVersion,
    macAddress,
    manufacturer: MANUFACTURER_HIKVISION,
    isapiSupported: true,
    authRequired: false,
  };
}

// ========== 核心扫描函数 ==========

/**
 * 探测单个设备
 */
async function probeDevice(
  ip: string,
  port: number,
  timeout: number
): Promise<DiscoveredDevice | null> {
  const startTime = Date.now();
  const protocol = port === 443 ? 'https' : 'http';
  const url = `${protocol}://${ip}:${port}${ISAPI_DEVICE_INFO}`;

  try {
    const response = await fetchWithTimeout(url, timeout);

    if (!response) return null;

    const httpStatus = response.status;

    // 401 表示需要认证，但确认是 ISAPI 设备
    if (httpStatus === 401) {
      const authHeader = response.headers.get('WWW-Authenticate');
      if (authHeader && authHeader.toLowerCase().includes('digest')) {
        return {
          ipAddress: ip,
          port,
          httpStatus,
          manufacturer: MANUFACTURER_HIKVISION,
          deviceType: 'UNKNOWN',
          isapiSupported: true,
          authRequired: true,
          probeTimeMs: Date.now() - startTime,
        };
      }
    }

    // 200 表示可访问
    if (httpStatus === 200) {
      const content = await response.text();
      const device = parseIsapiDeviceInfo(ip, port, httpStatus, content);
      device.probeTimeMs = Date.now() - startTime;
      return device;
    }

    // 其他状态码，尝试判断是否是摄像头
    const content = await response.text().catch(() => '');
    const manufacturer = identifyManufacturer(content);

    if (manufacturer !== MANUFACTURER_OTHER || httpStatus === 403) {
      return {
        ipAddress: ip,
        port,
        httpStatus,
        manufacturer,
        deviceType: 'UNKNOWN',
        isapiSupported: manufacturer === MANUFACTURER_HIKVISION,
        authRequired: httpStatus === 401 || httpStatus === 403,
        probeTimeMs: Date.now() - startTime,
      };
    }
  } catch {
    // 忽略连接错误
  }

  return null;
}

/**
 * 扫描 IP 的多个端口
 */
async function scanHostPorts(
  ip: string,
  ports: number[],
  timeout: number
): Promise<DiscoveredDevice | null> {
  for (const port of ports) {
    const device = await probeDevice(ip, port, timeout);
    if (device) {
      return device;
    }
  }
  return null;
}

/**
 * 并发扫描控制器
 */
async function scanWithConcurrency<T, R>(
  items: T[],
  maxConcurrent: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number, current?: T) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;
  let running = 0;
  let index = 0;

  return new Promise((resolve) => {
    const runNext = () => {
      while (running < maxConcurrent && index < items.length) {
        const currentIndex = index;
        const item = items[currentIndex];
        if (item === undefined) {
          index++;
          continue;
        }
        index++;
        running++;

        fn(item, currentIndex)
          .then((result) => {
            results.push(result);
          })
          .catch(() => {
            // 忽略错误
          })
          .finally(() => {
            completed++;
            running--;
            onProgress?.(completed, items.length, item);

            if (completed === items.length) {
              resolve(results);
            } else {
              runNext();
            }
          });
      }
    };

    runNext();
  });
}

// ========== 主要导出函数 ==========

/**
 * 发现局域网设备
 */
export async function discoverDevices(
  options: DiscoveryOptions = {}
): Promise<DiscoveredDevice[]> {
  const {
    networkCIDR,
    timeout = DEFAULT_TIMEOUT,
    ports = DEFAULT_PORTS,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    onProgress,
  } = options;

  // 获取要扫描的网段
  let cidr = networkCIDR;
  if (!cidr) {
    const networkInfo = await getNetworkInfo();
    if (!networkInfo) {
      console.warn('无法获取本机网络信息，请手动指定网段');
      return [];
    }
    cidr = networkInfo.cidr;
  }

  console.log(`开始扫描网段: ${cidr}`);

  // 解析 IP 列表
  const ipList = parseCIDR(cidr);
  if (ipList.length === 0) {
    console.warn('无法解析网段或网段为空');
    return [];
  }

  console.log(`解析得到 ${ipList.length} 个 IP`);

  const devices: DiscoveredDevice[] = [];

  // 并发扫描
  await scanWithConcurrency(
    ipList,
    maxConcurrent,
    async (ip) => {
      const device = await scanHostPorts(ip, ports, timeout);
      if (device) {
        devices.push(device);
      }
      return device;
    },
    (completed, total, currentIp) => {
      onProgress?.({
        scannedCount: completed,
        totalCount: total,
        currentIp: currentIp as string,
        foundCount: devices.length,
        percentage: Math.round((completed / total) * 100),
      });
    }
  );

  console.log(`扫描完成，发现 ${devices.length} 个设备`);

  return devices;
}

/**
 * 快速扫描 - 使用默认参数
 */
export async function quickScan(
  onProgress?: (progress: DiscoveryProgress) => void
): Promise<DiscoveredDevice[]> {
  return discoverDevices({
    timeout: 2000,
    ports: [80, 8000],
    maxConcurrent: 30,
    onProgress,
  });
}

/**
 * 扫描单个 IP
 */
export async function scanSingleHost(
  ip: string,
  ports: number[] = DEFAULT_PORTS
): Promise<DiscoveredDevice | null> {
  return scanHostPorts(ip, ports, 5000);
}

/**
 * 获取当前网络 CIDR
 */
export async function getCurrentNetworkCIDR(): Promise<string | null> {
  const networkInfo = await getNetworkInfo();
  return networkInfo?.cidr || null;
}

/**
 * 验证 CIDR 格式
 */
export function validateCIDR(cidr: string): { valid: boolean; error?: string } {
  if (!cidr) {
    return { valid: false, error: '请输入网段地址' };
  }

  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!cidrRegex.test(cidr)) {
    return { valid: false, error: '格式错误，应为 x.x.x.x/xx' };
  }

  const parts = cidr.split('/');
  const ip = parts[0];
  const prefixStr = parts[1];

  if (!ip || !prefixStr) {
    return { valid: false, error: '格式错误，应为 x.x.x.x/xx' };
  }

  const octets = ip.split('.').map(Number);
  const prefix = parseInt(prefixStr, 10);

  if (octets.some(o => o < 0 || o > 255)) {
    return { valid: false, error: 'IP 地址各段应在 0-255 之间' };
  }

  if (prefix < 20 || prefix > 30) {
    return { valid: false, error: '前缀长度应在 20-30 之间 (最多 4094 个主机)' };
  }

  return { valid: true };
}

export default {
  discoverDevices,
  quickScan,
  scanSingleHost,
  getCurrentNetworkCIDR,
  validateCIDR,
};
