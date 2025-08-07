import { MockConfigManager } from '../config/mockConfig';

// 真实服务导入
import { AuthService } from './auth/authService';
import { BiometricManager } from './biometricManager';
import { NetworkManager } from './networkManager';
import { TokenManager } from './tokenManager';
import { UserIdentificationService } from './userIdentification';

// Mock服务导入
import { MockAuthService } from '../mocks/mockAuthService';
import { MockBiometricManager } from '../mocks/mockBiometricManager';

/**
 * 服务工厂 - 根据配置返回真实服务或Mock服务
 */
export class ServiceFactory {
  /**
   * 获取认证服务
   */
  static getAuthService() {
    if (MockConfigManager.isServiceMocked('AUTH_SERVICE')) {
      return MockAuthService;
    }
    return AuthService;
  }

  /**
   * 获取生物识别管理器
   */
  static getBiometricManager() {
    if (MockConfigManager.isServiceMocked('BIOMETRIC_MANAGER')) {
      return MockBiometricManager;
    }
    return BiometricManager;
  }

  /**
   * 获取网络管理器 (通常保持真实)
   */
  static getNetworkManager() {
    if (MockConfigManager.isServiceMocked('NETWORK_MANAGER')) {
      // 如果需要，这里可以添加MockNetworkManager
      console.log('🎭 Mock NetworkManager not implemented, using real service');
    }
    return NetworkManager;
  }

  /**
   * 获取Token管理器 (通常保持真实)
   */
  static getTokenManager() {
    if (MockConfigManager.isServiceMocked('TOKEN_MANAGER')) {
      // 如果需要，这里可以添加MockTokenManager
      console.log('🎭 Mock TokenManager not implemented, using real service');
    }
    return TokenManager;
  }

  /**
   * 获取用户识别服务 (通常保持真实)
   */
  static getUserIdentificationService() {
    if (MockConfigManager.isServiceMocked('USER_IDENTIFICATION')) {
      // 如果需要，这里可以添加MockUserIdentificationService
      console.log('🎭 Mock UserIdentificationService not implemented, using real service');
    }
    return UserIdentificationService;
  }

  /**
   * 获取所有服务的Mock状态
   */
  static getServiceStatus() {
    const config = MockConfigManager.getConfig();
    return {
      mockEnabled: config.ENABLE_MOCK,
      services: {
        AuthService: MockConfigManager.isServiceMocked('AUTH_SERVICE') ? 'MOCK' : 'REAL',
        BiometricManager: MockConfigManager.isServiceMocked('BIOMETRIC_MANAGER') ? 'MOCK' : 'REAL',
        NetworkManager: MockConfigManager.isServiceMocked('NETWORK_MANAGER') ? 'MOCK' : 'REAL',
        TokenManager: MockConfigManager.isServiceMocked('TOKEN_MANAGER') ? 'MOCK' : 'REAL',
        UserIdentificationService: MockConfigManager.isServiceMocked('USER_IDENTIFICATION') ? 'MOCK' : 'REAL',
      }
    };
  }

  /**
   * 打印服务状态 (调试用)
   */
  static logServiceStatus() {
    const status = this.getServiceStatus();
    console.log('🏭 Service Factory Status:', status);
  }
}

/**
 * 导出便捷的服务实例
 */
export const AuthServiceInstance = ServiceFactory.getAuthService();
export const BiometricManagerInstance = ServiceFactory.getBiometricManager();
export const NetworkManagerInstance = ServiceFactory.getNetworkManager();
export const TokenManagerInstance = ServiceFactory.getTokenManager();
export const UserIdentificationServiceInstance = ServiceFactory.getUserIdentificationService();

// 在开发环境中记录服务状态
if (__DEV__) {
  ServiceFactory.logServiceStatus();
}

export default ServiceFactory;