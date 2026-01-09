/**
 * SADP 设备发现服务
 * SADP (Search Active Devices Protocol) Device Discovery Service
 *
 * SADP 是海康威视私有协议，通过 UDP 广播发现局域网内的设备。
 * 在 React Native 中需要通过原生模块实现 UDP 通信。
 *
 * 主要功能：
 * - 发现局域网内的海康威视设备
 * - 修改设备网络配置
 * - 监听设备上下线事件
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type {
  SadpDevice,
  SadpDiscoveryOptions,
  SadpDiscoveryStatus,
  SadpDiscoveryProgress,
  NetworkConfigRequest,
  NetworkConfigResult,
  SadpNativeModule,
  SadpNativeEvent,
  DEFAULT_DISCOVERY_TIMEOUT,
} from './types';

// ============================================
// 原生模块接口
// ============================================

/**
 * SADP 原生模块
 * iOS: CretasSadpModule
 * Android: CretasSadpModule
 */
const SadpNative = NativeModules.CretasSadpModule as SadpNativeModule | undefined;

/**
 * 事件发射器 (用于监听原生模块事件)
 */
let sadpEventEmitter: NativeEventEmitter | null = null;

if (SadpNative) {
  sadpEventEmitter = new NativeEventEmitter(NativeModules.CretasSadpModule);
}

// ============================================
// 类型守卫
// ============================================

/**
 * 验证 SADP 设备对象
 */
function isValidSadpDevice(obj: unknown): obj is SadpDevice {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const device = obj as Record<string, unknown>;
  return (
    typeof device.mac === 'string' &&
    typeof device.ip === 'string' &&
    typeof device.port === 'number'
  );
}

// ============================================
// SADP 服务类
// ============================================

type DeviceFoundCallback = (device: SadpDevice) => void;
type DeviceLostCallback = (device: SadpDevice) => void;
type StatusChangedCallback = (status: SadpDiscoveryStatus) => void;
type ErrorCallback = (error: string) => void;

class SadpServiceImpl {
  private devices: Map<string, SadpDevice> = new Map();
  private status: SadpDiscoveryStatus = 'idle';
  private discoveryStartTime: number = 0;
  private deviceFoundCallbacks: Set<DeviceFoundCallback> = new Set();
  private deviceLostCallbacks: Set<DeviceLostCallback> = new Set();
  private statusChangedCallbacks: Set<StatusChangedCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private eventSubscription: { remove: () => void } | null = null;

  constructor() {
    this.setupEventListeners();
  }

  // ========== 公开方法 ==========

  /**
   * 检查原生模块是否可用
   */
  isNativeModuleAvailable(): boolean {
    return SadpNative !== undefined;
  }

  /**
   * 获取当前平台
   */
  getPlatform(): string {
    return Platform.OS;
  }

  /**
   * 开始设备发现
   * @param options 发现选项
   */
  async startDiscovery(options?: SadpDiscoveryOptions): Promise<void> {
    if (!SadpNative) {
      throw new SadpError(
        'NATIVE_MODULE_NOT_AVAILABLE',
        'SADP 原生模块不可用，请确保已正确安装'
      );
    }

    if (this.status === 'discovering') {
      console.warn('[SADP] 发现已在进行中');
      return;
    }

    try {
      this.status = 'discovering';
      this.discoveryStartTime = Date.now();
      this.devices.clear();
      this.notifyStatusChanged('discovering');

      console.log('[SADP] 开始设备发现', options);
      await SadpNative.startDiscovery(options);
    } catch (error) {
      this.status = 'error';
      this.notifyStatusChanged('error');
      throw this.wrapError(error);
    }
  }

  /**
   * 停止设备发现
   */
  async stopDiscovery(): Promise<void> {
    if (!SadpNative) {
      throw new SadpError(
        'NATIVE_MODULE_NOT_AVAILABLE',
        'SADP 原生模块不可用'
      );
    }

    if (this.status !== 'discovering') {
      return;
    }

    try {
      await SadpNative.stopDiscovery();
      this.status = 'stopped';
      this.notifyStatusChanged('stopped');
      console.log('[SADP] 设备发现已停止');
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * 修改设备 IP 配置
   * @param mac 设备 MAC 地址
   * @param newIp 新 IP 地址
   * @param netmask 子网掩码
   * @param gateway 网关
   * @param password 管理员密码 (可选，未激活设备不需要)
   */
  async modifyDeviceIp(
    mac: string,
    newIp: string,
    netmask: string,
    gateway: string,
    password?: string
  ): Promise<NetworkConfigResult> {
    if (!SadpNative) {
      throw new SadpError(
        'NATIVE_MODULE_NOT_AVAILABLE',
        'SADP 原生模块不可用'
      );
    }

    // 参数验证
    if (!this.isValidMacAddress(mac)) {
      return {
        success: false,
        error: 'MAC 地址格式无效',
        errorCode: 'INVALID_MAC',
      };
    }

    if (!this.isValidIpAddress(newIp)) {
      return {
        success: false,
        error: 'IP 地址格式无效',
        errorCode: 'INVALID_IP',
      };
    }

    if (!this.isValidIpAddress(netmask)) {
      return {
        success: false,
        error: '子网掩码格式无效',
        errorCode: 'INVALID_NETMASK',
      };
    }

    if (!this.isValidIpAddress(gateway)) {
      return {
        success: false,
        error: '网关地址格式无效',
        errorCode: 'INVALID_GATEWAY',
      };
    }

    try {
      const request: NetworkConfigRequest = {
        mac,
        newIp,
        netmask,
        gateway,
        password,
      };

      console.log('[SADP] 修改设备 IP', { mac, newIp });
      const result = await SadpNative.modifyDeviceIp(request);

      if (result.success) {
        // 更新本地缓存
        const device = this.devices.get(mac);
        if (device) {
          device.ip = newIp;
          device.netmask = netmask;
          device.gateway = gateway;
          this.devices.set(mac, device);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error),
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * 获取当前发现状态
   */
  getStatus(): SadpDiscoveryStatus {
    return this.status;
  }

  /**
   * 获取发现进度
   */
  getProgress(): SadpDiscoveryProgress {
    return {
      status: this.status,
      deviceCount: this.devices.size,
      elapsedTime: this.status === 'discovering'
        ? Date.now() - this.discoveryStartTime
        : 0,
    };
  }

  /**
   * 获取已发现的所有设备
   */
  getDiscoveredDevices(): SadpDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * 根据 MAC 地址获取设备
   */
  getDeviceByMac(mac: string): SadpDevice | undefined {
    return this.devices.get(mac.toUpperCase());
  }

  /**
   * 获取未激活的设备
   */
  getUnactivatedDevices(): SadpDevice[] {
    return this.getDiscoveredDevices().filter(d => !d.isActivated);
  }

  /**
   * 获取已激活的设备
   */
  getActivatedDevices(): SadpDevice[] {
    return this.getDiscoveredDevices().filter(d => d.isActivated);
  }

  // ========== 事件监听 ==========

  /**
   * 监听设备发现事件
   * @param callback 设备发现回调
   * @returns 取消监听函数
   */
  onDeviceFound(callback: DeviceFoundCallback): () => void {
    this.deviceFoundCallbacks.add(callback);
    return () => {
      this.deviceFoundCallbacks.delete(callback);
    };
  }

  /**
   * 监听设备离线事件
   * @param callback 设备离线回调
   * @returns 取消监听函数
   */
  onDeviceLost(callback: DeviceLostCallback): () => void {
    this.deviceLostCallbacks.add(callback);
    return () => {
      this.deviceLostCallbacks.delete(callback);
    };
  }

  /**
   * 监听状态变化事件
   * @param callback 状态变化回调
   * @returns 取消监听函数
   */
  onStatusChanged(callback: StatusChangedCallback): () => void {
    this.statusChangedCallbacks.add(callback);
    return () => {
      this.statusChangedCallbacks.delete(callback);
    };
  }

  /**
   * 监听错误事件
   * @param callback 错误回调
   * @returns 取消监听函数
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  /**
   * 清除所有监听器
   */
  removeAllListeners(): void {
    this.deviceFoundCallbacks.clear();
    this.deviceLostCallbacks.clear();
    this.statusChangedCallbacks.clear();
    this.errorCallbacks.clear();
  }

  /**
   * 销毁服务 (清理资源)
   */
  destroy(): void {
    this.removeAllListeners();
    if (this.eventSubscription) {
      this.eventSubscription.remove();
      this.eventSubscription = null;
    }
    this.devices.clear();
    this.status = 'idle';
  }

  // ========== 私有方法 ==========

  /**
   * 设置原生事件监听
   */
  private setupEventListeners(): void {
    if (!sadpEventEmitter) {
      console.warn('[SADP] 事件发射器不可用，原生模块可能未安装');
      return;
    }

    this.eventSubscription = sadpEventEmitter.addListener(
      'SadpEvent',
      (event: SadpNativeEvent) => {
        this.handleNativeEvent(event);
      }
    );
  }

  /**
   * 处理原生模块事件
   */
  private handleNativeEvent(event: SadpNativeEvent): void {
    switch (event.type) {
      case 'deviceFound':
        if (event.device && isValidSadpDevice(event.device)) {
          this.handleDeviceFound(event.device);
        }
        break;

      case 'deviceLost':
        if (event.device && isValidSadpDevice(event.device)) {
          this.handleDeviceLost(event.device);
        }
        break;

      case 'statusChanged':
        if (event.status) {
          this.status = event.status;
          this.notifyStatusChanged(event.status);
        }
        break;

      case 'error':
        if (event.error) {
          this.notifyError(event.error);
        }
        break;
    }
  }

  /**
   * 处理设备发现
   */
  private handleDeviceFound(device: SadpDevice): void {
    const normalizedMac = device.mac.toUpperCase();
    const existingDevice = this.devices.get(normalizedMac);

    // 更新或添加设备
    const updatedDevice: SadpDevice = {
      ...device,
      mac: normalizedMac,
      discoveredAt: existingDevice?.discoveredAt || Date.now(),
      lastSeenAt: Date.now(),
    };

    this.devices.set(normalizedMac, updatedDevice);

    // 通知监听器
    this.deviceFoundCallbacks.forEach(callback => {
      try {
        callback(updatedDevice);
      } catch (err) {
        console.error('[SADP] 设备发现回调错误:', err);
      }
    });

    console.log('[SADP] 发现设备:', updatedDevice.ip, updatedDevice.model);
  }

  /**
   * 处理设备离线
   */
  private handleDeviceLost(device: SadpDevice): void {
    const normalizedMac = device.mac.toUpperCase();
    const existingDevice = this.devices.get(normalizedMac);

    if (existingDevice) {
      this.devices.delete(normalizedMac);

      // 通知监听器
      this.deviceLostCallbacks.forEach(callback => {
        try {
          callback(existingDevice);
        } catch (err) {
          console.error('[SADP] 设备离线回调错误:', err);
        }
      });

      console.log('[SADP] 设备离线:', existingDevice.ip);
    }
  }

  /**
   * 通知状态变化
   */
  private notifyStatusChanged(status: SadpDiscoveryStatus): void {
    this.statusChangedCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (err) {
        console.error('[SADP] 状态变化回调错误:', err);
      }
    });
  }

  /**
   * 通知错误
   */
  private notifyError(error: string): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('[SADP] 错误回调错误:', err);
      }
    });
  }

  // ========== 验证方法 ==========

  /**
   * 验证 MAC 地址格式
   */
  private isValidMacAddress(mac: string): boolean {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  /**
   * 验证 IP 地址格式
   */
  private isValidIpAddress(ip: string): boolean {
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipRegex);
    if (!match) return false;

    return match.slice(1).every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  // ========== 错误处理 ==========

  /**
   * 包装错误
   */
  private wrapError(error: unknown): SadpError {
    if (error instanceof SadpError) {
      return error;
    }
    return new SadpError('UNKNOWN', this.getErrorMessage(error));
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知错误';
  }
}

// ============================================
// SADP 错误类
// ============================================

export class SadpError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SadpError';
    this.code = code;
  }
}

// ============================================
// 模拟实现 (用于开发和测试)
// ============================================

/**
 * 创建模拟 SADP 服务 (原生模块不可用时使用)
 */
class MockSadpServiceImpl extends SadpServiceImpl {
  private mockDevices: SadpDevice[] = [];
  private mockDiscoveryTimeout: NodeJS.Timeout | null = null;

  override isNativeModuleAvailable(): boolean {
    return false;
  }

  override async startDiscovery(options?: SadpDiscoveryOptions): Promise<void> {
    console.log('[SADP Mock] 开始模拟设备发现');

    // 生成模拟设备
    this.mockDevices = this.generateMockDevices();

    // 模拟异步发现过程
    let index = 0;
    const interval = setInterval(() => {
      if (index < this.mockDevices.length) {
        const device = this.mockDevices[index];
        if (device) {
          // 调用父类的设备处理
          this['handleDeviceFound'](device);
        }
        index++;
      } else {
        clearInterval(interval);
        this['status'] = 'stopped';
        this['notifyStatusChanged']('stopped');
      }
    }, 500);

    // 超时停止
    const timeout = options?.timeout || 10000;
    this.mockDiscoveryTimeout = setTimeout(() => {
      clearInterval(interval);
      this['status'] = 'stopped';
      this['notifyStatusChanged']('stopped');
    }, timeout);
  }

  override async stopDiscovery(): Promise<void> {
    if (this.mockDiscoveryTimeout) {
      clearTimeout(this.mockDiscoveryTimeout);
      this.mockDiscoveryTimeout = null;
    }
    this['status'] = 'stopped';
    this['notifyStatusChanged']('stopped');
    console.log('[SADP Mock] 设备发现已停止');
  }

  override async modifyDeviceIp(
    mac: string,
    newIp: string,
    netmask: string,
    gateway: string,
    _password?: string
  ): Promise<NetworkConfigResult> {
    console.log('[SADP Mock] 修改设备 IP', { mac, newIp });

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      newIp,
    };
  }

  /**
   * 生成模拟设备数据
   */
  private generateMockDevices(): SadpDevice[] {
    return [
      {
        mac: 'AA:BB:CC:DD:EE:01',
        ip: '192.168.1.64',
        port: 80,
        model: 'DS-2CD2T47G2-L',
        serialNumber: 'DS-2CD2T47G2-L20210101CCWR123456789',
        firmwareVersion: 'V5.7.1 build 210101',
        isActivated: true,
        deviceType: 'IPC',
        deviceName: '仓库入口摄像头',
        netmask: '255.255.255.0',
        gateway: '192.168.1.1',
        dhcpEnabled: false,
        discoveredAt: Date.now(),
        lastSeenAt: Date.now(),
      },
      {
        mac: 'AA:BB:CC:DD:EE:02',
        ip: '192.168.1.65',
        port: 80,
        model: 'DS-7608NI-K2',
        serialNumber: 'DS-7608NIK220210515CCWR987654321',
        firmwareVersion: 'V4.30.085 build 210515',
        isActivated: true,
        deviceType: 'NVR',
        deviceName: '主NVR',
        netmask: '255.255.255.0',
        gateway: '192.168.1.1',
        dhcpEnabled: false,
        discoveredAt: Date.now(),
        lastSeenAt: Date.now(),
      },
      {
        mac: 'AA:BB:CC:DD:EE:03',
        ip: '192.168.1.66',
        port: 80,
        model: 'DS-2CD2T47G2-L',
        serialNumber: 'DS-2CD2T47G2-L20210201CCWR111222333',
        firmwareVersion: 'V5.7.1 build 210101',
        isActivated: false,  // 未激活设备
        deviceType: 'IPC',
        netmask: '255.255.255.0',
        gateway: '192.168.1.1',
        dhcpEnabled: true,
        discoveredAt: Date.now(),
        lastSeenAt: Date.now(),
      },
    ];
  }
}

// ============================================
// 单例导出
// ============================================

/**
 * SADP 服务单例
 * 如果原生模块不可用，使用模拟实现
 */
const SadpService: SadpServiceImpl = SadpNative
  ? new SadpServiceImpl()
  : new MockSadpServiceImpl();

export default SadpService;
export { SadpServiceImpl, MockSadpServiceImpl };
