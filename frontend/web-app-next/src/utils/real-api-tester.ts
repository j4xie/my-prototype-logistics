/**
 * Real API 集成测试工具
 * 专门用于测试真实后端API的连接和功能
 */

import { realApiClient } from '@/lib/real-api-client';
import { authService } from '@/services/auth.service';
import { REAL_API_CONFIG } from '@/config/api-endpoints';

export interface ApiTestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  response?: any;
  error?: Error;
  duration?: number;
  timestamp: number;
}

export interface ApiTestSuite {
  name: string;
  description: string;
  tests: ApiTestResult[];
  startTime?: number;
  endTime?: number;
  totalDuration?: number;
}

export class RealApiTester {
  private results: ApiTestResult[] = [];
  private suites: ApiTestSuite[] = [];

  constructor() {
    this.initializeSuites();
  }

  private initializeSuites() {
    this.suites = [
      {
        name: 'connectivity',
        description: 'API连接测试',
        tests: []
      },
      {
        name: 'authentication',
        description: '认证系统测试',
        tests: []
      },
      {
        name: 'user-management',
        description: '用户管理测试',
        tests: []
      },
      {
        name: 'whitelist',
        description: '白名单管理测试',
        tests: []
      },
      {
        name: 'platform',
        description: '平台管理测试',
        tests: []
      }
    ];
  }

  /**
   * 添加测试结果
   */
  private addResult(suiteName: string, result: ApiTestResult) {
    this.results.push(result);
    
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.tests.push(result);
    }
  }

  /**
   * 执行单个测试
   */
  private async executeTest(
    suiteName: string,
    testName: string,
    testFunction: () => Promise<any>
  ): Promise<ApiTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await testFunction();
      const duration = Date.now() - startTime;
      
      const result: ApiTestResult = {
        name: testName,
        status: 'success',
        message: `测试通过 (${duration}ms)`,
        response,
        duration,
        timestamp: Date.now()
      };
      
      this.addResult(suiteName, result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: ApiTestResult = {
        name: testName,
        status: 'error',
        message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: error instanceof Error ? error : new Error('未知错误'),
        duration,
        timestamp: Date.now()
      };
      
      this.addResult(suiteName, result);
      return result;
    }
  }

  /**
   * API连接测试
   */
  async testConnectivity(): Promise<ApiTestResult[]> {
    const suiteName = 'connectivity';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '后端服务健康检查',
        test: () => realApiClient.get('/health')
      },
      {
        name: '认证服务端点',
        test: () => realApiClient.get('/api/auth/status')
      },
      {
        name: '用户管理端点',
        test: () => realApiClient.get('/api/users')
      },
      {
        name: '白名单管理端点',
        test: () => realApiClient.get('/api/whitelist')
      },
      {
        name: '平台管理端点',
        test: () => realApiClient.get('/api/platform/factories')
      }
    ];

    const results: ApiTestResult[] = [];
    for (const test of tests) {
      const result = await this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 认证系统测试
   */
  async testAuthentication(): Promise<ApiTestResult[]> {
    const suiteName = 'authentication';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '检查认证状态',
        test: () => authService.checkAuthStatus()
      },
      {
        name: '手机号验证',
        test: () => authService.verifyPhone('13800138000', 'TEST_2024_001')
      },
      {
        name: '获取用户信息',
        test: () => authService.getUserProfile()
      },
      {
        name: '令牌刷新',
        test: async () => {
          const token = localStorage.getItem('auth-token');
          if (!token) {
            throw new Error('无有效令牌进行刷新测试');
          }
          return authService.refreshToken();
        }
      }
    ];

    const results: ApiTestResult[] = [];
    for (const test of tests) {
      const result = await this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 用户管理测试
   */
  async testUserManagement(): Promise<ApiTestResult[]> {
    const suiteName = 'user-management';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '获取用户列表',
        test: () => realApiClient.get('/api/users')
      },
      {
        name: '获取待审核用户',
        test: () => realApiClient.get('/api/users/pending')
      },
      {
        name: '获取用户统计',
        test: () => realApiClient.get('/api/users/stats')
      },
      {
        name: '用户搜索功能',
        test: () => realApiClient.get('/api/users?search=test')
      }
    ];

    const results: ApiTestResult[] = [];
    for (const test of tests) {
      const result = await this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 白名单管理测试
   */
  async testWhitelistManagement(): Promise<ApiTestResult[]> {
    const suiteName = 'whitelist';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '获取白名单列表',
        test: () => realApiClient.get('/api/whitelist')
      },
      {
        name: '获取白名单统计',
        test: () => realApiClient.get('/api/whitelist/stats')
      },
      {
        name: '白名单搜索功能',
        test: () => realApiClient.get('/api/whitelist?search=test')
      },
      {
        name: '检查过期白名单',
        test: () => realApiClient.get('/api/whitelist/expired')
      }
    ];

    const results: ApiTestResult[] = [];
    for (const test of tests) {
      const result = await this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 平台管理测试
   */
  async testPlatformManagement(): Promise<ApiTestResult[]> {
    const suiteName = 'platform';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '获取工厂列表',
        test: () => realApiClient.get('/api/platform/factories')
      },
      {
        name: '获取工厂统计',
        test: () => realApiClient.get('/api/platform/factories/stats')
      },
      {
        name: '工厂搜索功能',
        test: () => realApiClient.get('/api/platform/factories?search=test')
      }
    ];

    const results: ApiTestResult[] = [];
    for (const test of tests) {
      const result = await this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 执行完整的API测试套件
   */
  async runFullTestSuite(): Promise<{
    results: ApiTestResult[];
    suites: ApiTestSuite[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      duration: number;
    };
  }> {
    const startTime = Date.now();
    
    // 清空之前的结果
    this.results = [];
    this.initializeSuites();

    console.log('🚀 开始执行Real API完整测试套件');
    console.log(`📍 API地址: ${REAL_API_CONFIG.baseURL}`);

    // 执行所有测试套件
    await this.testConnectivity();
    await this.testAuthentication();
    await this.testUserManagement();
    await this.testWhitelistManagement();
    await this.testPlatformManagement();

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'success').length,
      failed: this.results.filter(r => r.status === 'error').length,
      duration: totalDuration
    };

    console.log('✅ Real API测试套件完成');
    console.log(`📊 测试结果: ${summary.passed}/${summary.total} 通过`);
    console.log(`⏱️ 总耗时: ${summary.duration}ms`);

    return {
      results: this.results,
      suites: this.suites,
      summary
    };
  }

  /**
   * 获取测试结果
   */
  getResults(): ApiTestResult[] {
    return [...this.results];
  }

  /**
   * 获取测试套件
   */
  getSuites(): ApiTestSuite[] {
    return [...this.suites];
  }

  /**
   * 清空测试结果
   */
  clearResults() {
    this.results = [];
    this.initializeSuites();
  }

  /**
   * 生成测试报告
   */
  generateReport(): string {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'error').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';

    let report = `
Real API 测试报告
================
测试时间: ${new Date().toLocaleString()}
API地址: ${REAL_API_CONFIG.baseURL}

总体统计:
- 总测试数: ${total}
- 通过数: ${passed}
- 失败数: ${failed}
- 通过率: ${passRate}%

测试套件详情:
`;

    for (const suite of this.suites) {
      const suiteTotal = suite.tests.length;
      const suitePassed = suite.tests.filter(t => t.status === 'success').length;
      const suiteFailed = suite.tests.filter(t => t.status === 'error').length;
      const suiteDuration = suite.totalDuration || 0;

      report += `
${suite.description}:
- 测试数: ${suiteTotal}
- 通过: ${suitePassed}
- 失败: ${suiteFailed}
- 耗时: ${suiteDuration}ms
`;

      for (const test of suite.tests) {
        const status = test.status === 'success' ? '✅' : '❌';
        report += `  ${status} ${test.name}: ${test.message}\n`;
      }
    }

    return report;
  }
}

// 导出单例实例
export const realApiTester = new RealApiTester();

// 导出便捷函数
export const runRealApiTests = async () => {
  return await realApiTester.runFullTestSuite();
};

export const testRealApiConnectivity = async () => {
  return await realApiTester.testConnectivity();
};

export const testRealApiAuthentication = async () => {
  return await realApiTester.testAuthentication();
};