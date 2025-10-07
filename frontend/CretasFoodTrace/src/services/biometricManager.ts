/**
 * BiometricManager - 生物识别管理器(简化版)
 * 当前版本暂不实现生物识别功能
 */

import { BiometricAuthOptions } from '../types/auth';

export class BiometricManager {
  /**
   * 检查设备是否支持生物识别
   */
  static async isAvailable(): Promise<boolean> {
    // TODO: 未来实现生物识别
    return false;
  }

  /**
   * 检查是否已注册生物识别
   */
  static async isEnrolled(): Promise<boolean> {
    // TODO: 未来实现生物识别
    return false;
  }

  /**
   * 执行生物识别认证
   */
  static async authenticate(options?: BiometricAuthOptions): Promise<boolean> {
    // TODO: 未来实现生物识别
    console.log('Biometric authentication not implemented yet');
    return false;
  }

  /**
   * 启用生物识别登录
   */
  static async enableBiometricLogin(username: string, password: string): Promise<void> {
    // TODO: 未来实现生物识别
    console.log('Biometric login not implemented yet');
  }

  /**
   * 禁用生物识别登录
   */
  static async disableBiometricLogin(): Promise<void> {
    // TODO: 未来实现生物识别
    console.log('Biometric login disabled');
  }
}

export default BiometricManager;
