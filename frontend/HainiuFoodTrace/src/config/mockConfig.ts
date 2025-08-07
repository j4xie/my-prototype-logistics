/**
 * Mock配置 - 用于开发环境测试
 */

// 环境检查
const isDevelopment = __DEV__;
const isTestMode = process.env.EXPO_PUBLIC_APP_ENV === 'test';

// Mock配置
export const MOCK_CONFIG = {
  // 是否启用Mock模式
  ENABLE_MOCK: isDevelopment || isTestMode,
  
  // 具体服务的Mock开关
  SERVICES: {
    AUTH_SERVICE: true,           // 认证服务
    BIOMETRIC_MANAGER: true,      // 生物识别管理
    NETWORK_MANAGER: false,       // 网络管理 (保持真实)
    TOKEN_MANAGER: false,         // Token管理 (保持真实)
    USER_IDENTIFICATION: false,   // 用户识别 (保持真实)
  },

  // Mock行为配置
  BEHAVIOR: {
    // 网络延迟模拟 (毫秒)
    NETWORK_DELAY: {
      LOGIN: 1000,
      BIOMETRIC_AUTH: 1500,
      TOKEN_REFRESH: 500,
      PERMISSION_CHECK: 200,
    },

    // 成功率模拟
    SUCCESS_RATES: {
      LOGIN: 0.95,              // 95% 登录成功率
      BIOMETRIC_AUTH: 0.85,     // 85% 生物识别成功率
      TOKEN_REFRESH: 0.98,      // 98% Token刷新成功率
      NETWORK_REQUEST: 0.90,    // 90% 网络请求成功率
    },

    // 错误场景模拟
    ERROR_SCENARIOS: {
      SIMULATE_NETWORK_ERROR: false,    // 模拟网络错误
      SIMULATE_AUTH_TIMEOUT: false,     // 模拟认证超时
      SIMULATE_TOKEN_EXPIRY: false,     // 模拟Token过期
      SIMULATE_BIOMETRIC_LOCK: false,   // 模拟生物识别锁定
    },
  },

  // Mock数据配置
  DATA: {
    // 默认登录用户
    DEFAULT_USER: 'admin',
    
    // 预置的测试用户列表
    TEST_USERS: [
      'dev',           // 系统开发者
      'admin',         // 平台超级管理员
      'operator',      // 平台操作员
      'factory_admin', // 工厂超级管理员
      'permission_admin', // 权限管理员
      'dept_admin',    // 部门管理员
      'worker',        // 操作员
      'viewer'         // 查看者
    ],

    // 启用生物识别的用户
    BIOMETRIC_USERS: ['admin', 'factory_admin', 'dept_admin'],
  },

  // 调试配置
  DEBUG: {
    LOG_MOCK_CALLS: isDevelopment,        // 记录Mock调用
    SHOW_MOCK_INDICATORS: isDevelopment,  // 显示Mock指示器
    ENABLE_MOCK_CONTROLS: isDevelopment,  // 启用Mock控制面板
  }
};

/**
 * 运行时Mock配置管理
 */
export class MockConfigManager {
  private static config = { ...MOCK_CONFIG };

  /**
   * 获取当前配置
   */
  static getConfig() {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  static updateConfig(updates: Partial<typeof MOCK_CONFIG>) {
    this.config = {
      ...this.config,
      ...updates,
      SERVICES: {
        ...this.config.SERVICES,
        ...(updates.SERVICES || {})
      },
      BEHAVIOR: {
        ...this.config.BEHAVIOR,
        ...(updates.BEHAVIOR || {}),
        NETWORK_DELAY: {
          ...this.config.BEHAVIOR.NETWORK_DELAY,
          ...(updates.BEHAVIOR?.NETWORK_DELAY || {})
        },
        SUCCESS_RATES: {
          ...this.config.BEHAVIOR.SUCCESS_RATES,
          ...(updates.BEHAVIOR?.SUCCESS_RATES || {})
        },
        ERROR_SCENARIOS: {
          ...this.config.BEHAVIOR.ERROR_SCENARIOS,
          ...(updates.BEHAVIOR?.ERROR_SCENARIOS || {})
        }
      },
      DATA: {
        ...this.config.DATA,
        ...(updates.DATA || {})
      },
      DEBUG: {
        ...this.config.DEBUG,
        ...(updates.DEBUG || {})
      }
    };

    if (this.config.DEBUG.LOG_MOCK_CALLS) {
      console.log('🎭 Mock config updated:', updates);
    }
  }

  /**
   * 检查特定服务是否启用Mock
   */
  static isServiceMocked(serviceName: keyof typeof MOCK_CONFIG.SERVICES): boolean {
    return this.config.ENABLE_MOCK && this.config.SERVICES[serviceName];
  }

  /**
   * 获取网络延迟配置
   */
  static getNetworkDelay(operation: keyof typeof MOCK_CONFIG.BEHAVIOR.NETWORK_DELAY): number {
    return this.config.BEHAVIOR.NETWORK_DELAY[operation];
  }

  /**
   * 获取成功率配置
   */
  static getSuccessRate(operation: keyof typeof MOCK_CONFIG.BEHAVIOR.SUCCESS_RATES): number {
    return this.config.BEHAVIOR.SUCCESS_RATES[operation];
  }

  /**
   * 检查错误场景是否启用
   */
  static isErrorScenarioEnabled(scenario: keyof typeof MOCK_CONFIG.BEHAVIOR.ERROR_SCENARIOS): boolean {
    return this.config.BEHAVIOR.ERROR_SCENARIOS[scenario];
  }

  /**
   * 模拟网络延迟
   */
  static async simulateNetworkDelay(operation: keyof typeof MOCK_CONFIG.BEHAVIOR.NETWORK_DELAY): Promise<void> {
    if (this.config.ENABLE_MOCK) {
      const delay = this.getNetworkDelay(operation);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * 模拟成功/失败结果
   */
  static simulateSuccessFailure(operation: keyof typeof MOCK_CONFIG.BEHAVIOR.SUCCESS_RATES): boolean {
    if (!this.config.ENABLE_MOCK) return true;
    
    const successRate = this.getSuccessRate(operation);
    return Math.random() < successRate;
  }

  /**
   * 启用特定错误场景 (用于测试)
   */
  static enableErrorScenario(scenario: keyof typeof MOCK_CONFIG.BEHAVIOR.ERROR_SCENARIOS, duration: number = 30000): void {
    this.updateConfig({
      BEHAVIOR: {
        ERROR_SCENARIOS: {
          [scenario]: true
        }
      }
    });

    // 自动恢复
    setTimeout(() => {
      this.updateConfig({
        BEHAVIOR: {
          ERROR_SCENARIOS: {
            [scenario]: false
          }
        }
      });
    }, duration);

    console.log(`🎭 Error scenario "${scenario}" enabled for ${duration}ms`);
  }

  /**
   * 切换Mock模式
   */
  static toggleMockMode(): boolean {
    const newState = !this.config.ENABLE_MOCK;
    this.updateConfig({ ENABLE_MOCK: newState });
    console.log(`🎭 Mock mode ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  /**
   * 重置配置为默认值
   */
  static resetToDefault(): void {
    this.config = { ...MOCK_CONFIG };
    console.log('🎭 Mock config reset to default');
  }
}

/**
 * Mock工具函数
 */
export const MockUtils = {
  /**
   * 创建带Mock指示器的日志
   */
  log: (message: string, data?: any) => {
    if (MOCK_CONFIG.DEBUG.LOG_MOCK_CALLS) {
      console.log(`🎭 [MOCK] ${message}`, data || '');
    }
  },

  /**
   * 模拟随机错误
   */
  maybeThrowError: (errorMessage: string, probability: number = 0.1) => {
    if (MOCK_CONFIG.ENABLE_MOCK && Math.random() < probability) {
      throw new Error(`[MOCK ERROR] ${errorMessage}`);
    }
  },

  /**
   * 创建Mock响应
   */
  createResponse: <T>(data: T, success: boolean = true, message?: string) => ({
    success,
    message: message || (success ? 'Operation successful' : 'Operation failed'),
    data
  }),

  /**
   * 获取随机Mock用户
   */
  getRandomTestUser: () => {
    const users = MOCK_CONFIG.DATA.TEST_USERS;
    return users[Math.floor(Math.random() * users.length)];
  },

  /**
   * 检查用户是否支持生物识别
   */
  userSupportsBiometric: (username: string) => {
    return MOCK_CONFIG.DATA.BIOMETRIC_USERS.includes(username);
  }
};

export default MOCK_CONFIG;