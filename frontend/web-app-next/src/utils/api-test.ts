/**
 * API测试工具
 * 用于测试后端API的连接和功能
 */

import { realApiClient } from '@/lib/real-api-client';
import { authService } from '@/services/auth.service';
import { REAL_API_CONFIG } from '@/config/api-endpoints';

export interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  response?: any;
  error?: Error;
  duration?: number;
}

export class ApiTester {
  private results: TestResult[] = [];

  /**
   * 清除测试结果
   */
  clearResults() {
    this.results = [];
  }

  /**
   * 获取测试结果
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * 添加测试结果
   */
  private addResult(result: TestResult) {
    this.results.push(result);
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      this.addResult({
        name: 'API连接测试',
        status: 'pending',
        message: `正在连接到 ${REAL_API_CONFIG.baseURL}...`
      });

      const response = await realApiClient.get('/health');
      const duration = Date.now() - startTime;

      const result: TestResult = {
        name: 'API连接测试',
        status: 'success',
        message: `连接成功 (${duration}ms)`,
        response,
        duration
      };

      this.addResult(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name: 'API连接测试',
        status: 'error',
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: error instanceof Error ? error : new Error('未知错误'),
        duration
      };

      this.addResult(result);
      return result;
    }
  }

  /**
   * 测试认证状态
   */
  async testAuthStatus(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      this.addResult({
        name: '认证状态测试',
        status: 'pending',
        message: '正在检查认证状态...'
      });

      const response = await authService.checkAuthStatus();
      const duration = Date.now() - startTime;

      const result: TestResult = {
        name: '认证状态测试',
        status: 'success',
        message: `认证状态检查成功 (${duration}ms)`,
        response,
        duration
      };

      this.addResult(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name: '认证状态测试',
        status: 'error',
        message: `认证状态检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: error instanceof Error ? error : new Error('未知错误'),
        duration
      };

      this.addResult(result);
      return result;
    }
  }

  /**
   * 测试手机号验证
   */
  async testPhoneVerification(phoneNumber: string, factoryId: string = 'TEST_2024_001'): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      this.addResult({
        name: '手机号验证测试',
        status: 'pending',
        message: `正在验证手机号 ${phoneNumber}...`
      });

      const response = await authService.verifyPhone(phoneNumber, factoryId);
      const duration = Date.now() - startTime;

      const result: TestResult = {
        name: '手机号验证测试',
        status: 'success',
        message: `手机号验证成功 (${duration}ms)`,
        response,
        duration
      };

      this.addResult(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name: '手机号验证测试',
        status: 'error',
        message: `手机号验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: error instanceof Error ? error : new Error('未知错误'),
        duration
      };

      this.addResult(result);
      return result;
    }
  }

  /**
   * 测试用户登录
   */
  async testLogin(username: string, password: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      this.addResult({
        name: '用户登录测试',
        status: 'pending',
        message: `正在登录用户 ${username}...`
      });

      const response = await authService.login({ username, password });
      const duration = Date.now() - startTime;

      const result: TestResult = {
        name: '用户登录测试',
        status: 'success',
        message: `登录成功 (${duration}ms)`,
        response,
        duration
      };

      this.addResult(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name: '用户登录测试',
        status: 'error',
        message: `登录失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: error instanceof Error ? error : new Error('未知错误'),
        duration
      };

      this.addResult(result);
      return result;
    }
  }

  /**
   * 测试用户注册
   */
  async testRegistration(userData: {
    username: string;
    password: string;
    email: string;
    phone: string;
    name?: string;
    factoryId?: string;
  }): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      this.addResult({
        name: '用户注册测试',
        status: 'pending',
        message: `正在注册用户 ${userData.username}...`
      });

      const response = await authService.register(userData);
      const duration = Date.now() - startTime;

      const result: TestResult = {
        name: '用户注册测试',
        status: 'success',
        message: `注册成功 (${duration}ms)`,
        response,
        duration
      };

      this.addResult(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name: '用户注册测试',
        status: 'error',
        message: `注册失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: error instanceof Error ? error : new Error('未知错误'),
        duration
      };

      this.addResult(result);
      return result;
    }
  }

  /**
   * 运行完整的API测试套件
   */
  async runFullTest(): Promise<TestResult[]> {
    this.clearResults();

    const tests = [
      () => this.testConnection(),
      () => this.testAuthStatus(),
      () => this.testPhoneVerification('13800138000'),
      () => this.testLogin('test_user', 'test_password'),
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
      } catch (error) {
        // 测试异常处理
        results.push({
          name: '测试异常',
          status: 'error',
          message: `测试执行异常: ${error instanceof Error ? error.message : '未知错误'}`,
          error: error instanceof Error ? error : new Error('未知错误')
        });
      }
    }

    return results;
  }

  /**
   * 生成测试报告
   */
  generateReport(): string {
    const results = this.getResults();
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const totalCount = results.length;
    
    const report = `
API测试报告
===========
总测试数: ${totalCount}
成功: ${successCount}
失败: ${errorCount}
成功率: ${totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : 0}%

详细结果:
${results.map(r => `
- ${r.name}: ${r.status.toUpperCase()}
  消息: ${r.message}
  ${r.duration ? `耗时: ${r.duration}ms` : ''}
  ${r.error ? `错误: ${r.error.message}` : ''}
`).join('')}
    `;
    
    return report.trim();
  }
}

// 导出默认实例
export const apiTester = new ApiTester();

// 导出工具函数
export const runApiTest = async () => {
  const tester = new ApiTester();
  return await tester.runFullTest();
};

export const testApiConnection = async () => {
  const tester = new ApiTester();
  return await tester.testConnection();
};