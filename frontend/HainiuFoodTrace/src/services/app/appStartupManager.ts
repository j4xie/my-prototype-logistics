import { ActivationService, ActivationStatus } from '../activation/activationService';
import { StorageService } from '../storage/storageService';

export interface AppStartupState {
  isReady: boolean;
  needsActivation: boolean;
  activationStatus?: ActivationStatus;
  error?: string;
}

export class AppStartupManager {
  private static readonly STARTUP_KEY = 'app_startup_complete';

  /**
   * 初始化应用启动流程
   */
  static async initializeApp(): Promise<AppStartupState> {
    try {
      console.log('开始应用初始化...');

      // 1. 检查激活状态
      const activationStatus = await ActivationService.checkActivationStatus();
      console.log('激活状态检查完成:', activationStatus);

      if (!activationStatus.isActivated) {
        return {
          isReady: false,
          needsActivation: true,
          activationStatus,
        };
      }

      // 2. 验证激活状态（与服务器同步）
      console.log('验证激活状态...');
      const isActivationValid = await ActivationService.validateActivation();

      if (!isActivationValid) {
        console.log('激活状态验证失败，需要重新激活');
        // 重置激活状态
        await ActivationService.resetActivation();
        return {
          isReady: false,
          needsActivation: true,
          activationStatus: await ActivationService.checkActivationStatus(),
        };
      }

      // 3. 初始化应用数据
      await this.initializeAppData();

      // 4. 标记启动完成
      await StorageService.setItem(this.STARTUP_KEY, 'true');

      console.log('应用初始化完成');
      return {
        isReady: true,
        needsActivation: false,
        activationStatus,
      };

    } catch (error) {
      console.error('应用初始化失败:', error);
      return {
        isReady: false,
        needsActivation: false,
        error: '应用初始化失败，请重试',
      };
    }
  }

  /**
   * 处理激活完成后的流程
   */
  static async handleActivationComplete(activationStatus: ActivationStatus): Promise<AppStartupState> {
    try {
      console.log('处理激活完成流程...');

      // 初始化应用数据
      await this.initializeAppData();

      // 标记启动完成
      await StorageService.setItem(this.STARTUP_KEY, 'true');

      console.log('激活后初始化完成');
      return {
        isReady: true,
        needsActivation: false,
        activationStatus,
      };

    } catch (error) {
      console.error('激活后初始化失败:', error);
      return {
        isReady: false,
        needsActivation: false,
        activationStatus,
        error: '激活后初始化失败，请重试',
      };
    }
  }

  /**
   * 初始化应用数据
   */
  private static async initializeAppData(): Promise<void> {
    try {
      console.log('初始化应用数据...');

      // 1. 预加载配置数据
      await this.preloadConfigurations();

      // 2. 初始化缓存
      await this.initializeCache();

      // 3. 设置默认用户偏好
      await this.setupDefaultPreferences();

      console.log('应用数据初始化完成');
    } catch (error) {
      console.error('应用数据初始化失败:', error);
      throw error;
    }
  }

  /**
   * 预加载配置数据
   */
  private static async preloadConfigurations(): Promise<void> {
    try {
      // 预加载一些配置数据，比如权限列表、系统设置等
      const defaultConfigs = {
        permissions: ['camera', 'location', 'storage'],
        settings: {
          theme: 'light',
          language: 'zh-CN',
          notifications: true,
        },
        features: {
          offline_mode: true,
          biometric_auth: false,
          auto_sync: true,
        },
      };

      await StorageService.setItem('app_config', JSON.stringify(defaultConfigs));
    } catch (error) {
      console.error('预加载配置失败:', error);
    }
  }

  /**
   * 初始化缓存
   */
  private static async initializeCache(): Promise<void> {
    try {
      // 清理过期缓存
      const cacheKeys = ['temp_data', 'api_cache', 'image_cache'];
      
      for (const key of cacheKeys) {
        const cacheData = await StorageService.getItem(key);
        if (cacheData) {
          const parsed = JSON.parse(cacheData);
          const now = Date.now();
          
          // 清理过期数据（24小时）
          if (parsed.timestamp && (now - parsed.timestamp > 24 * 60 * 60 * 1000)) {
            await StorageService.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('缓存初始化失败:', error);
    }
  }

  /**
   * 设置默认用户偏好
   */
  private static async setupDefaultPreferences(): Promise<void> {
    try {
      const existingPrefs = await StorageService.getItem('user_preferences');
      
      if (!existingPrefs) {
        const defaultPreferences = {
          language: 'zh-CN',
          theme: 'light',
          notifications: {
            enabled: true,
            sound: true,
            vibration: true,
          },
          privacy: {
            analytics: false,
            crash_reports: true,
          },
          app: {
            auto_update: true,
            offline_mode: true,
          },
        };

        await StorageService.setItem('user_preferences', JSON.stringify(defaultPreferences));
      }
    } catch (error) {
      console.error('设置默认偏好失败:', error);
    }
  }

  /**
   * 检查是否需要重新初始化
   */
  static async shouldReinitialize(): Promise<boolean> {
    try {
      const startupComplete = await StorageService.getItem(this.STARTUP_KEY);
      const activationStatus = await ActivationService.checkActivationStatus();
      
      // 如果未完成启动或未激活，需要重新初始化
      return !startupComplete || !activationStatus.isActivated;
    } catch (error) {
      console.error('检查重新初始化需求失败:', error);
      return true;
    }
  }

  /**
   * 重置应用状态
   */
  static async resetAppState(): Promise<void> {
    try {
      console.log('重置应用状态...');
      
      // 清除启动标记
      await StorageService.removeItem(this.STARTUP_KEY);
      
      // 重置激活状态
      await ActivationService.resetActivation();
      
      // 清除缓存
      await StorageService.clear();
      
      console.log('应用状态重置完成');
    } catch (error) {
      console.error('重置应用状态失败:', error);
    }
  }
}