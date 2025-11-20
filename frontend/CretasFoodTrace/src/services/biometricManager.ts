/**
 * BiometricManager - 生物识别管理器(简化版)
 * 当前版本暂不实现生物识别功能
 */

import { BiometricAuthOptions } from '../types/auth';
import { NotImplementedError } from '../errors';

interface BiometricCredentials {
  username: string;
  encryptedToken: string;
  deviceInfo?: any;
}

export class BiometricManager {
  /**
   * 检查设备是否支持生物识别
   */
  static async isAvailable(): Promise<boolean> {
    throw new NotImplementedError('生物识别设备检测', 'v2.0', '生物识别功能尚未实现，请使用密码登录');
  }

  /**
   * 检查是否已注册生物识别
   */
  static async isEnrolled(): Promise<boolean> {
    throw new NotImplementedError('生物识别注册检查', 'v2.0', '生物识别功能尚未实现');
  }

  /**
   * 执行生物识别认证
   */
  static async authenticate(options?: BiometricAuthOptions): Promise<boolean> {
    throw new NotImplementedError('生物识别认证', 'v2.0', '生物识别认证功能尚未实现，请使用密码登录');
  }

  /**
   * 检查是否启用生物识别登录
   */
  static async isBiometricLoginEnabled(): Promise<boolean> {
    throw new NotImplementedError('生物识别登录状态检查', 'v2.0', '生物识别功能尚未实现');
  }

  /**
   * 获取已保存的生物识别凭据
   */
  static async getBiometricCredentials(): Promise<BiometricCredentials | null> {
    throw new NotImplementedError('获取生物识别凭据', 'v2.0', '生物识别凭据管理功能尚未实现');
  }

  /**
   * 保存生物识别凭据
   */
  static async saveBiometricCredentials(credentials: BiometricCredentials): Promise<void> {
    throw new NotImplementedError('保存生物识别凭据', 'v2.0', '生物识别凭据保存功能尚未实现');
  }

  /**
   * 启用生物识别登录
   */
  static async enableBiometricLogin(username: string, password: string): Promise<void> {
    throw new NotImplementedError('启用生物识别登录', 'v2.0', '生物识别登录启用功能尚未实现');
  }

  /**
   * 禁用生物识别登录
   */
  static async disableBiometricLogin(): Promise<void> {
    throw new NotImplementedError('禁用生物识别登录', 'v2.0', '生物识别登录禁用功能尚未实现');
  }
}

export default BiometricManager;
