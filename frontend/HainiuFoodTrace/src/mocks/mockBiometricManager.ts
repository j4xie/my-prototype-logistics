import * as LocalAuthentication from 'expo-local-authentication';
import { BiometricAuthOptions, BiometricCapabilities } from '../types/auth';

/**
 * Mock生物识别管理器 - 用于开发环境测试
 */
export class MockBiometricManager {
  // 模拟的设备生物识别能力
  private static mockCapabilities: BiometricCapabilities = {
    isAvailable: true,
    isEnrolled: true,
    supportedTypes: [
      LocalAuthentication.AuthenticationType.FINGERPRINT,
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    ],
    securityLevel: LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
  };

  // 模拟的生物识别状态
  private static mockSettings = {
    enabled: false,
    failedAttempts: 0,
    lockedUntil: null as number | null,
    lastSuccessfulAuth: null as number | null
  };

  /**
   * 获取生物识别能力
   */
  static async getCapabilities(): Promise<BiometricCapabilities> {
    // 模拟检查延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('🎭 Mock: Getting biometric capabilities');
    return { ...this.mockCapabilities };
  }

  /**
   * 检查生物识别是否可用
   */
  static async isAvailable(): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.mockCapabilities.isAvailable && this.mockCapabilities.isEnrolled;
  }

  /**
   * 获取支持的生物识别类型
   */
  static async getSupportedAuthenticationTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return [...this.mockCapabilities.supportedTypes];
  }

  /**
   * 执行生物识别认证
   */
  static async authenticate(options: BiometricAuthOptions = {}): Promise<boolean> {
    const {
      promptMessage = '请验证您的身份',
      cancelButtonText = '取消',
      fallbackToDevicePasscode = false,
      maxAttempts = 3
    } = options;

    console.log('🎭 Mock: Starting biometric authentication', {
      promptMessage,
      cancelButtonText,
      fallbackToDevicePasscode
    });

    // 检查是否被锁定
    if (this.mockSettings.lockedUntil && Date.now() < this.mockSettings.lockedUntil) {
      const remainingTime = Math.ceil((this.mockSettings.lockedUntil - Date.now()) / 1000);
      throw new Error(`生物识别已被锁定，请等待 ${remainingTime} 秒后重试`);
    }

    // 模拟生物识别处理时间
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 模拟成功率 (85% 成功率)
    const success = Math.random() > 0.15;

    if (success) {
      // 重置失败计数
      this.mockSettings.failedAttempts = 0;
      this.mockSettings.lastSuccessfulAuth = Date.now();
      
      console.log('✅ Mock: Biometric authentication successful');
      return true;
    } else {
      // 增加失败计数
      this.mockSettings.failedAttempts++;
      
      console.log(`❌ Mock: Biometric authentication failed (${this.mockSettings.failedAttempts}/${maxAttempts})`);

      // 如果失败次数达到上限，锁定30秒
      if (this.mockSettings.failedAttempts >= maxAttempts) {
        this.mockSettings.lockedUntil = Date.now() + 30000; // 30秒锁定
        throw new Error('生物识别失败次数过多，已锁定30秒');
      }

      throw new Error('生物识别验证失败，请重试');
    }
  }

  /**
   * 检查是否启用生物识别登录
   */
  static async isBiometricLoginEnabled(): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.mockSettings.enabled;
  }

  /**
   * 启用生物识别登录
   */
  static async enableBiometricLogin(): Promise<void> {
    console.log('🎭 Mock: Enabling biometric login');
    
    // 模拟启用过程
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!await this.isAvailable()) {
      throw new Error('生物识别不可用，无法启用');
    }

    // 首先进行一次生物识别验证
    const authSuccess = await this.authenticate({
      promptMessage: '验证身份以启用生物识别登录',
      cancelButtonText: '取消'
    });

    if (authSuccess) {
      this.mockSettings.enabled = true;
      console.log('✅ Mock: Biometric login enabled');
    } else {
      throw new Error('生物识别验证失败，无法启用');
    }
  }

  /**
   * 禁用生物识别登录
   */
  static async disableBiometricLogin(): Promise<void> {
    console.log('🎭 Mock: Disabling biometric login');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.mockSettings.enabled = false;
    this.mockSettings.failedAttempts = 0;
    this.mockSettings.lockedUntil = null;
    
    console.log('✅ Mock: Biometric login disabled');
  }

  /**
   * 获取生物识别类型的显示名称
   */
  static async getBiometricTypeDisplayName(): Promise<string> {
    const types = await this.getSupportedAuthenticationTypes();
    
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return '指纹识别';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return '虹膜识别';
    } else {
      return '生物识别';
    }
  }

  /**
   * 检查硬件是否支持生物识别
   */
  static async hasHardwareAsync(): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.mockCapabilities.isAvailable;
  }

  /**
   * 检查是否已录入生物识别信息
   */
  static async isEnrolledAsync(): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.mockCapabilities.isEnrolled;
  }

  /**
   * 获取认证历史统计 (Mock数据)
   */
  static getAuthStats(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    lastSuccessfulAuth: number | null;
    isCurrentlyLocked: boolean;
  } {
    return {
      totalAttempts: this.mockSettings.failedAttempts + (this.mockSettings.lastSuccessfulAuth ? 1 : 0),
      successfulAttempts: this.mockSettings.lastSuccessfulAuth ? 1 : 0,
      failedAttempts: this.mockSettings.failedAttempts,
      lastSuccessfulAuth: this.mockSettings.lastSuccessfulAuth,
      isCurrentlyLocked: this.mockSettings.lockedUntil !== null && Date.now() < this.mockSettings.lockedUntil
    };
  }

  /**
   * 重置Mock状态 (用于测试)
   */
  static resetMockState(): void {
    this.mockSettings = {
      enabled: false,
      failedAttempts: 0,
      lockedUntil: null,
      lastSuccessfulAuth: null
    };
    console.log('🎭 Mock: Biometric state reset');
  }

  /**
   * 设置Mock能力 (用于不同设备测试)
   */
  static setMockCapabilities(capabilities: Partial<BiometricCapabilities>): void {
    this.mockCapabilities = {
      ...this.mockCapabilities,
      ...capabilities
    };
    console.log('🎭 Mock: Capabilities updated', capabilities);
  }

  /**
   * 模拟不同的设备场景
   */
  static simulateDeviceScenario(scenario: 'no_hardware' | 'not_enrolled' | 'locked' | 'normal'): void {
    switch (scenario) {
      case 'no_hardware':
        this.setMockCapabilities({ isAvailable: false, isEnrolled: false });
        break;
      case 'not_enrolled':
        this.setMockCapabilities({ isAvailable: true, isEnrolled: false });
        break;
      case 'locked':
        this.mockSettings.failedAttempts = 5;
        this.mockSettings.lockedUntil = Date.now() + 30000;
        break;
      case 'normal':
      default:
        this.setMockCapabilities({ isAvailable: true, isEnrolled: true });
        this.resetMockState();
        break;
    }
    console.log('🎭 Mock: Device scenario set to:', scenario);
  }
}

export default MockBiometricManager;