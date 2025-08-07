import { AuthService } from './authService';
import { ActivationService } from '../activation/activationService';
import { StorageService } from '../storage/storageService';
import { LoginRequest, LoginResponse } from '../../types/auth';

/**
 * 认证与激活集成服务
 * 处理设备绑定登录和激活机制的深度集成
 */
export class AuthActivationIntegration {
  
  /**
   * 智能登录：结合设备激活状态的登录
   */
  static async smartLogin(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // 检查应用激活状态
      const activationStatus = await ActivationService.checkActivationStatus();
      
      if (!activationStatus.isActivated) {
        throw new Error('应用未激活，请先激活应用');
      }

      // 获取设备信息（基于激活机制的设备ID）
      const deviceInfo = {
        deviceId: activationStatus.deviceId,
        deviceModel: await this.getDeviceModel(),
        osVersion: await this.getOSVersion(),
        appVersion: activationStatus.appVersion,
        platform: 'android' as const
      };

      // 执行登录，传入设备信息
      const loginResponse = await AuthService.login({
        ...credentials,
        deviceInfo
      });

      // 登录成功后，设置设备绑定
      if (loginResponse.success && loginResponse.tokens) {
        await this.setupDeviceBinding(activationStatus.deviceId, loginResponse.tokens.accessToken);
      }

      return loginResponse;
    } catch (error) {
      console.error('智能登录失败:', error);
      throw error;
    }
  }

  /**
   * 设备绑定登录：基于激活设备ID的一键登录
   */
  static async deviceBoundLogin(): Promise<LoginResponse> {
    try {
      // 检查激活状态
      const activationStatus = await ActivationService.checkActivationStatus();
      if (!activationStatus.isActivated) {
        throw new Error('应用未激活');
      }

      // 检查设备绑定状态
      const deviceBinding = await StorageService.getDeviceBinding();
      if (!deviceBinding.isBound || !deviceBinding.deviceToken) {
        throw new Error('设备未绑定，请先进行正常登录');
      }

      // 验证设备ID一致性
      if (deviceBinding.deviceId !== activationStatus.deviceId) {
        throw new Error('设备ID不匹配，请重新登录');
      }

      // 执行设备登录
      return await AuthService.deviceLogin();
    } catch (error) {
      console.error('设备绑定登录失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否可以使用设备绑定登录
   */
  static async canUseDeviceBoundLogin(): Promise<boolean> {
    try {
      const [activationStatus, deviceBinding] = await Promise.all([
        ActivationService.checkActivationStatus(),
        StorageService.getDeviceBinding()
      ]);

      return (
        activationStatus.isActivated &&
        deviceBinding.isBound &&
        deviceBinding.deviceId === activationStatus.deviceId
      );
    } catch (error) {
      console.error('检查设备绑定登录能力失败:', error);
      return false;
    }
  }

  /**
   * 生物识别登录：集成激活设备信息
   */
  static async biometricLoginWithActivation(): Promise<LoginResponse> {
    try {
      // 检查激活状态
      const activationStatus = await ActivationService.checkActivationStatus();
      if (!activationStatus.isActivated) {
        throw new Error('应用未激活，无法使用生物识别登录');
      }

      // 执行生物识别登录
      const loginResponse = await AuthService.biometricLogin({
        promptMessage: '使用生物识别快速登录海牛食品溯源系统',
        cancelButtonText: '取消',
        disableDeviceFallback: false
      });

      return loginResponse;
    } catch (error) {
      console.error('生物识别登录失败:', error);
      throw error;
    }
  }

  /**
   * 设置设备绑定：基于激活设备ID
   */
  private static async setupDeviceBinding(deviceId: string, accessToken: string): Promise<void> {
    try {
      // 生成设备绑定token
      const deviceToken = await this.generateDeviceToken(deviceId, accessToken);
      
      // 保存设备绑定信息
      await StorageService.setDeviceBinding(deviceId, deviceToken);
      
      console.log('设备绑定设置成功:', { deviceId });
    } catch (error) {
      console.error('设备绑定设置失败:', error);
      // 不抛出错误，因为这不应该影响登录流程
    }
  }

  /**
   * 生成设备token：基于设备ID和访问token
   */
  private static async generateDeviceToken(deviceId: string, accessToken: string): Promise<string> {
    // 在实际应用中，这应该是一个安全的哈希算法
    const timestamp = Date.now().toString();
    const combined = `${deviceId}_${accessToken.substring(0, 20)}_${timestamp}`;
    
    // 简单的编码（实际应用中应使用更安全的方法）
    return btoa(combined);
  }

  /**
   * 获取设备模型信息
   */
  private static async getDeviceModel(): Promise<string> {
    // 在实际应用中，这里会使用expo-device获取真实设备信息
    return 'Android Device';
  }

  /**
   * 获取操作系统版本
   */
  private static async getOSVersion(): Promise<string> {
    // 在实际应用中，这里会使用expo-device获取真实OS版本
    return 'Android 12';
  }

  /**
   * 清除设备绑定和认证信息
   */
  static async clearDeviceBinding(): Promise<void> {
    await Promise.all([
      StorageService.clearDeviceBinding(),
      StorageService.clearAuthTokens()
    ]);
  }

  /**
   * 重置激活和认证状态
   */
  static async resetActivationAndAuth(): Promise<void> {
    await Promise.all([
      ActivationService.resetActivation(),
      this.clearDeviceBinding(),
      StorageService.clear()
    ]);
  }

  /**
   * 获取集成状态信息
   */
  static async getIntegrationStatus(): Promise<{
    isActivated: boolean;
    isDeviceBound: boolean;
    canUseBiometric: boolean;
    canUseDeviceLogin: boolean;
    deviceId: string | null;
  }> {
    try {
      const [
        activationStatus,
        deviceBinding,
        biometricEnabled,
        canUseDeviceLogin
      ] = await Promise.all([
        ActivationService.checkActivationStatus(),
        StorageService.getDeviceBinding(),
        StorageService.isBiometricEnabled(),
        this.canUseDeviceBoundLogin()
      ]);

      return {
        isActivated: activationStatus.isActivated,
        isDeviceBound: deviceBinding.isBound,
        canUseBiometric: biometricEnabled,
        canUseDeviceLogin,
        deviceId: activationStatus.deviceId
      };
    } catch (error) {
      console.error('获取集成状态失败:', error);
      return {
        isActivated: false,
        isDeviceBound: false,
        canUseBiometric: false,
        canUseDeviceLogin: false,
        deviceId: null
      };
    }
  }
}