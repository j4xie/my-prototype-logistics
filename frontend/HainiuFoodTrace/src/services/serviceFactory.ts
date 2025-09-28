// 真实服务导入
import { AuthService } from './auth/authService';
import { BiometricManager } from './biometricManager';
import { NetworkManager } from './networkManager';
import { TokenManager } from './tokenManager';
import { UserIdentificationService } from './userIdentification';
import { ActivationService } from './activation/activationService';
import { ProcessingService } from './processing/processingService';
import { AlertService } from './alert/alertService';
import { ReportService } from './report/reportService';
import { SystemService } from './system/systemService';
import { LocationService } from './location/locationService';
import { NotificationService } from './notification/notificationService';

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
   * 获取生物识别管理器
   */
  static getBiometricManager() {
    return BiometricManager;
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
   * 获取用户识别服务
   */
  static getUserIdentificationService() {
    return UserIdentificationService;
  }

  /**
   * 获取激活服务
   */
  static getActivationService() {
    return ActivationService;
  }

  /**
   * 获取加工处理服务
   */
  static getProcessingService() {
    return ProcessingService;
  }

  /**
   * 获取告警服务
   */
  static getAlertService() {
    return AlertService;
  }

  /**
   * 获取报表服务
   */
  static getReportService() {
    return ReportService;
  }

  /**
   * 获取系统监控服务
   */
  static getSystemService() {
    return SystemService;
  }

  /**
   * 获取位置服务
   */
  static getLocationService() {
    return LocationService;
  }

  /**
   * 获取通知服务
   */
  static getNotificationService() {
    return NotificationService;
  }

  /**
   * 获取服务状态
   */
  static getServiceStatus() {
    return {
      services: {
        AuthService: 'REAL',
        BiometricManager: 'REAL',
        NetworkManager: 'REAL',
        TokenManager: 'REAL',
        UserIdentificationService: 'REAL',
        ActivationService: 'REAL',
        ProcessingService: 'REAL',
        AlertService: 'REAL',
        ReportService: 'REAL',
        SystemService: 'REAL',
        LocationService: 'REAL',
        NotificationService: 'REAL',
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
export const ActivationServiceInstance = ServiceFactory.getActivationService();
export const ProcessingServiceInstance = ServiceFactory.getProcessingService();
export const AlertServiceInstance = ServiceFactory.getAlertService();
export const ReportServiceInstance = ServiceFactory.getReportService();
export const SystemServiceInstance = ServiceFactory.getSystemService();
export const LocationServiceInstance = ServiceFactory.getLocationService();
export const NotificationServiceInstance = ServiceFactory.getNotificationService();

// 在开发环境中记录服务状态
if (__DEV__) {
  ServiceFactory.logServiceStatus();
}

export default ServiceFactory;