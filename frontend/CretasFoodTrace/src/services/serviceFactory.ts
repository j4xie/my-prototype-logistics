// 真实服务导入
import { AuthService } from './auth/authService';
import { NetworkManager } from './networkManager';
import { TokenManager } from './tokenManager';

/**
 * 服务工厂 - 提供统一的服务访问接口
 */
export class ServiceFactory {
  /**
   * 获取认证服务
   */
  static getAuthService() {
    return AuthService;
  }

  /**
   * 获取网络管理器
   */
  static getNetworkManager() {
    return NetworkManager;
  }

  /**
   * 获取Token管理器
   */
  static getTokenManager() {
    return TokenManager;
  }

  /**
   * 获取服务状态
   */
  static getServiceStatus() {
    return {
      services: {
        AuthService: 'REAL',
        NetworkManager: 'REAL',
        TokenManager: 'REAL',
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
export const NetworkManagerInstance = ServiceFactory.getNetworkManager();
export const TokenManagerInstance = ServiceFactory.getTokenManager();

// 在开发环境中记录服务状态
// 检查 __DEV__ 是否存在，防止在非RN环境中报错
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  ServiceFactory.logServiceStatus();
}

export default ServiceFactory;