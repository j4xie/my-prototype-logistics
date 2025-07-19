/**
 * 系统健康检查工具
 * 自动化检查Real API、权限系统、用户认证等关键系统组件
 */

import { realApiClient } from '@/lib/real-api-client';
import { authService } from '@/services/auth.service';
import { REAL_API_CONFIG } from '@/config/api-endpoints';
import { PermissionChecker, UserPermissions } from '@/types/permissions';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  responseTime?: number;
  details?: any;
  timestamp: number;
}

export interface SystemHealthReport {
  overallStatus: 'healthy' | 'warning' | 'error';
  timestamp: number;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    warning: number;
    error: number;
  };
}

export class SystemHealthChecker {
  private static instance: SystemHealthChecker;
  private checks: HealthCheckResult[] = [];

  private constructor() {}

  public static getInstance(): SystemHealthChecker {
    if (!SystemHealthChecker.instance) {
      SystemHealthChecker.instance = new SystemHealthChecker();
    }
    return SystemHealthChecker.instance;
  }

  /**
   * 检查Real API连接状态
   */
  async checkRealApiConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await realApiClient.get('/health');
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Real API Connection',
        status: 'healthy',
        message: `API连接正常 (${responseTime}ms)`,
        responseTime,
        details: response,
        timestamp: Date.now()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Real API Connection',
        status: 'error',
        message: `API连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 检查认证服务状态
   */
  async checkAuthService(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await authService.checkAuthStatus();
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Authentication Service',
        status: 'healthy',
        message: `认证服务正常 (${responseTime}ms)`,
        responseTime,
        details: response,
        timestamp: Date.now()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Authentication Service',
        status: 'error',
        message: `认证服务异常: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 检查用户管理API
   */
  async checkUserManagementApi(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await realApiClient.get('/api/users');
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'User Management API',
        status: 'healthy',
        message: `用户管理API正常 (${responseTime}ms)`,
        responseTime,
        details: response,
        timestamp: Date.now()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'User Management API',
        status: 'error',
        message: `用户管理API异常: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 检查白名单管理API
   */
  async checkWhitelistApi(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await realApiClient.get('/api/whitelist');
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Whitelist API',
        status: 'healthy',
        message: `白名单API正常 (${responseTime}ms)`,
        responseTime,
        details: response,
        timestamp: Date.now()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Whitelist API',
        status: 'error',
        message: `白名单API异常: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 检查平台管理API
   */
  async checkPlatformApi(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await realApiClient.get('/api/platform/factories');
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Platform API',
        status: 'healthy',
        message: `平台API正常 (${responseTime}ms)`,
        responseTime,
        details: response,
        timestamp: Date.now()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'Platform API',
        status: 'error',
        message: `平台API异常: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 检查权限系统
   */
  async checkPermissionSystem(userPermissions?: UserPermissions): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      if (!userPermissions) {
        return {
          component: 'Permission System',
          status: 'warning',
          message: '用户权限数据不可用',
          responseTime: Date.now() - startTime,
          timestamp: Date.now()
        };
      }

      // 检查权限数据完整性
      const requiredFields = ['modules', 'features', 'roleLevel', 'roleName'];
      const missingFields = requiredFields.filter(field => !(field in userPermissions));
      
      if (missingFields.length > 0) {
        return {
          component: 'Permission System',
          status: 'error',
          message: `权限数据不完整，缺少字段: ${missingFields.join(', ')}`,
          responseTime: Date.now() - startTime,
          details: { missingFields },
          timestamp: Date.now()
        };
      }

      // 检查权限逻辑
      const moduleCount = Object.keys(userPermissions.modules).length;
      const featureCount = Object.keys(userPermissions.features).length;
      const roleLevel = userPermissions.roleLevel;
      
      if (moduleCount === 0) {
        return {
          component: 'Permission System',
          status: 'error',
          message: '用户没有任何模块权限',
          responseTime: Date.now() - startTime,
          timestamp: Date.now()
        };
      }

      // 检查角色级别有效性
      const validLevels = [0, 5, 10, 20, 50];
      if (!validLevels.includes(roleLevel)) {
        return {
          component: 'Permission System',
          status: 'error',
          message: `无效的角色级别: ${roleLevel}`,
          responseTime: Date.now() - startTime,
          timestamp: Date.now()
        };
      }

      return {
        component: 'Permission System',
        status: 'healthy',
        message: `权限系统正常 (${moduleCount}个模块, ${featureCount}个功能, 级别${roleLevel})`,
        responseTime: Date.now() - startTime,
        details: {
          moduleCount,
          featureCount,
          roleLevel,
          roleName: userPermissions.roleName
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        component: 'Permission System',
        status: 'error',
        message: `权限系统检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime: Date.now() - startTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 检查本地存储
   */
  async checkLocalStorage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // 检查localStorage可用性
      const testKey = 'health-check-test';
      const testValue = 'test-value';
      
      localStorage.setItem(testKey, testValue);
      const retrievedValue = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrievedValue !== testValue) {
        return {
          component: 'Local Storage',
          status: 'error',
          message: 'localStorage数据不一致',
          responseTime: Date.now() - startTime,
          timestamp: Date.now()
        };
      }

      // 检查关键数据
      const authToken = localStorage.getItem('auth-token');
      const userInfo = localStorage.getItem('user-info');
      
      return {
        component: 'Local Storage',
        status: 'healthy',
        message: `本地存储正常 (${authToken ? '有' : '无'}令牌, ${userInfo ? '有' : '无'}用户信息)`,
        responseTime: Date.now() - startTime,
        details: {
          hasAuthToken: !!authToken,
          hasUserInfo: !!userInfo
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        component: 'Local Storage',
        status: 'error',
        message: `本地存储检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime: Date.now() - startTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 检查网络连接
   */
  async checkNetworkConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // 检查网络状态
      const isOnline = navigator.onLine;
      
      if (!isOnline) {
        return {
          component: 'Network Connection',
          status: 'error',
          message: '网络连接不可用',
          responseTime: Date.now() - startTime,
          timestamp: Date.now()
        };
      }

      // 检查API基础连接
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(REAL_API_CONFIG.baseURL + '/health', {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        return {
          component: 'Network Connection',
          status: 'healthy',
          message: `网络连接正常 (${response.status})`,
          responseTime: Date.now() - startTime,
          details: {
            status: response.status,
            statusText: response.statusText
          },
          timestamp: Date.now()
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      return {
        component: 'Network Connection',
        status: 'error',
        message: `网络连接检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
        responseTime: Date.now() - startTime,
        details: error,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 执行完整的系统健康检查
   */
  async runFullHealthCheck(userPermissions?: UserPermissions): Promise<SystemHealthReport> {
    console.log('🏥 开始系统健康检查');
    
    const startTime = Date.now();
    this.checks = [];

    // 并行执行所有检查
    const checkPromises = [
      this.checkNetworkConnection(),
      this.checkRealApiConnection(),
      this.checkAuthService(),
      this.checkUserManagementApi(),
      this.checkWhitelistApi(),
      this.checkPlatformApi(),
      this.checkPermissionSystem(userPermissions),
      this.checkLocalStorage()
    ];

    const results = await Promise.allSettled(checkPromises);
    
    // 处理检查结果
    const checks: HealthCheckResult[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(result.value);
      } else {
        checks.push({
          component: `Check ${index + 1}`,
          status: 'error',
          message: `检查失败: ${result.reason}`,
          timestamp: Date.now()
        });
      }
    });

    this.checks = checks;

    // 计算总体状态
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      warning: checks.filter(c => c.status === 'warning').length,
      error: checks.filter(c => c.status === 'error').length
    };

    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    if (summary.error > 0) {
      overallStatus = 'error';
    } else if (summary.warning > 0) {
      overallStatus = 'warning';
    }

    const report: SystemHealthReport = {
      overallStatus,
      timestamp: Date.now(),
      checks,
      summary
    };

    const duration = Date.now() - startTime;
    console.log(`✅ 系统健康检查完成 (${duration}ms)`);
    console.log(`📊 状态: ${overallStatus} | 健康: ${summary.healthy}/${summary.total}`);

    return report;
  }

  /**
   * 获取最近的检查结果
   */
  getLastChecks(): HealthCheckResult[] {
    return [...this.checks];
  }

  /**
   * 清除检查结果
   */
  clearChecks(): void {
    this.checks = [];
  }

  /**
   * 生成健康检查报告
   */
  generateHealthReport(report: SystemHealthReport): string {
    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      error: '❌'
    };

    let reportText = `
系统健康检查报告
================
检查时间: ${new Date(report.timestamp).toLocaleString()}
总体状态: ${statusEmoji[report.overallStatus]} ${report.overallStatus.toUpperCase()}
API地址: ${REAL_API_CONFIG.baseURL}

统计信息:
- 总检查项: ${report.summary.total}
- 健康: ${report.summary.healthy}
- 警告: ${report.summary.warning}
- 错误: ${report.summary.error}

详细结果:
`;

    for (const check of report.checks) {
      const emoji = statusEmoji[check.status];
      const responseTime = check.responseTime ? ` (${check.responseTime}ms)` : '';
      reportText += `${emoji} ${check.component}: ${check.message}${responseTime}\n`;
    }

    return reportText;
  }
}

// 导出单例实例
export const systemHealthChecker = SystemHealthChecker.getInstance();

// 导出便捷函数
export const runSystemHealthCheck = async (userPermissions?: UserPermissions) => {
  return await systemHealthChecker.runFullHealthCheck(userPermissions);
};

export const checkRealApiHealth = async () => {
  return await systemHealthChecker.checkRealApiConnection();
};

export const checkAuthHealth = async () => {
  return await systemHealthChecker.checkAuthService();
};