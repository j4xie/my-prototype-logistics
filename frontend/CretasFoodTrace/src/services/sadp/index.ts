/**
 * SADP 设备发现与配置服务
 * SADP Device Discovery & Setup Services
 *
 * 本模块提供海康威视设备的发现、激活、配置功能
 *
 * 主要服务:
 * - SadpService: SADP 设备发现服务（UDP 广播扫描）
 * - DeviceActivationService: 设备激活服务（ISAPI 激活/密码管理）
 * - DeviceSetupService: 设备配置服务（完整配置流程）
 *
 * 使用示例:
 * ```typescript
 * import {
 *   SadpService,
 *   DeviceActivationService,
 *   DeviceSetupService,
 * } from '@/services/sadp';
 *
 * // 1. 发现设备
 * await SadpService.startDiscovery();
 * SadpService.onDeviceFound((device) => {
 *   console.log('发现设备:', device.ip, device.model);
 * });
 *
 * // 2. 激活设备
 * const activateResult = await DeviceActivationService.activateDevice({
 *   ip: '192.168.1.64',
 *   password: 'Admin@123',
 * });
 *
 * // 3. 完整配置流程
 * const setupResult = await DeviceSetupService.setupDevice(
 *   device,
 *   {
 *     password: 'Admin@123',
 *     deviceName: '仓库入口摄像头',
 *     enableMotionDetection: true,
 *     enableHttpPush: true,
 *     httpPushUrl: 'http://api.example.com/webhook/camera',
 *   },
 *   (progress) => {
 *     console.log(`配置进度: ${progress.percentage}% - ${progress.stepDescription}`);
 *   }
 * );
 * ```
 */

// ============================================
// 服务导出
// ============================================

export { default as SadpService, SadpServiceImpl, MockSadpServiceImpl, SadpError } from './SadpService';
export { default as DeviceActivationService, DeviceActivationServiceImpl } from './DeviceActivationService';
export { default as DeviceSetupService, DeviceSetupServiceImpl, SETUP_STEPS, STEP_DESCRIPTIONS } from './DeviceSetupService';

// ============================================
// 类型导出
// ============================================

export type {
  // SADP 设备类型
  SadpDevice,
  SadpDiscoveryOptions,
  SadpDiscoveryStatus,
  SadpDiscoveryProgress,
  SadpNativeEvent,
  SadpNativeModule,

  // 网络配置类型
  NetworkConfigRequest,
  NetworkConfigResult,

  // 设备激活类型
  DeviceActivationRequest,
  DeviceActivationResult,
  ActivationStatusResult,
  ActivationErrorCode,

  // 密码管理类型
  PasswordChangeRequest,
  PasswordChangeResult,
  PasswordChangeErrorCode,
  PasswordValidationRule,
  PasswordValidationResult,

  // 设备配置类型
  DeviceSetupConfig,
  SetupResult,
  SetupProgress,
  SetupStep,
  SetupStepResult,
} from './types';

// ============================================
// 常量导出
// ============================================

export {
  DEFAULT_PASSWORD_RULES,
  DEFAULT_DISCOVERY_TIMEOUT,
  DEFAULT_HTTP_PORT,
  DEFAULT_HTTPS_PORT,
  DEVICE_REBOOT_WAIT_TIME,
  CONNECTION_RETRY_COUNT,
  CONNECTION_RETRY_INTERVAL,
} from './types';

// ============================================
// 便捷函数导出
// ============================================

import SadpService from './SadpService';
import DeviceActivationService from './DeviceActivationService';
import DeviceSetupService from './DeviceSetupService';
import type { SadpDevice, DeviceSetupConfig, SetupResult, SetupProgress } from './types';

/**
 * 快速发现设备
 * @param timeout 超时时间 (ms)，默认 10 秒
 * @returns 发现的设备列表
 */
export async function quickDiscoverDevices(timeout: number = 10000): Promise<SadpDevice[]> {
  const devices: SadpDevice[] = [];

  const unsubscribe = SadpService.onDeviceFound((device) => {
    devices.push(device);
  });

  try {
    await SadpService.startDiscovery({ timeout });

    // 等待扫描完成
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (SadpService.getStatus() !== 'discovering') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);

      // 超时保护
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, timeout + 1000);
    });

    return devices;
  } finally {
    unsubscribe();
    await SadpService.stopDiscovery().catch(() => {});
  }
}

/**
 * 快速检查设备激活状态
 * @param ip 设备 IP
 * @param port 端口，默认 80
 * @returns 是否已激活
 */
export async function isDeviceActivated(ip: string, port: number = 80): Promise<boolean> {
  const result = await DeviceActivationService.checkActivationStatus(ip, port);
  return result.isActivated;
}

/**
 * 快速激活设备
 * @param ip 设备 IP
 * @param password 管理员密码
 * @returns 是否成功
 */
export async function quickActivateDevice(ip: string, password: string): Promise<boolean> {
  const result = await DeviceActivationService.activateDevice({ ip, password });
  return result.success;
}

/**
 * 快速配置设备
 * @param device SADP 设备
 * @param config 配置选项
 * @param onProgress 进度回调
 * @returns 配置结果
 */
export async function quickSetupDevice(
  device: SadpDevice,
  config: DeviceSetupConfig,
  onProgress?: (progress: SetupProgress) => void
): Promise<SetupResult> {
  return DeviceSetupService.setupDevice(device, config, onProgress);
}

/**
 * 验证密码是否符合海康设备要求
 * @param password 密码
 * @returns 验证结果
 */
export function validateHikvisionPassword(password: string): { valid: boolean; errors: string[] } {
  return DeviceActivationService.validatePassword(password);
}

/**
 * 生成符合要求的随机密码
 * @returns 随机密码
 */
export function generateDevicePassword(): string {
  return DeviceActivationService.generateRandomPassword();
}

// ============================================
// 默认导出
// ============================================

export default {
  // 服务
  SadpService,
  DeviceActivationService,
  DeviceSetupService,

  // 便捷函数
  quickDiscoverDevices,
  isDeviceActivated,
  quickActivateDevice,
  quickSetupDevice,
  validateHikvisionPassword,
  generateDevicePassword,
};
