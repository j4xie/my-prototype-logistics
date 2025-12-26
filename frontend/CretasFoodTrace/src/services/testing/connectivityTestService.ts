/**
 * 服务器连接测试服务
 *
 * @description 执行远程服务器连接测试，验证 API 端点可用性
 * @created 2025-12-26
 */

import axios, { AxiosInstance } from 'axios';
import { NetworkManager } from '../networkManager';
import {
  TestCase,
  TestResult,
  TestContext,
  TestExecutionResult,
  TestSummary,
  PhaseStatus,
  TestPhase,
  TestLogEntry,
  LogLevel,
  DEFAULT_SERVER_CONFIG,
  PHASE_NAMES,
} from '../../types/testing';

/**
 * 测试日志回调类型
 */
type LogCallback = (entry: TestLogEntry) => void;

/**
 * 测试结果回调类型
 */
type TestResultCallback = (result: TestResult) => void;

/**
 * 服务器连接测试服务
 */
export class ConnectivityTestService {
  private axiosInstance: AxiosInstance;
  private context: TestContext = {};
  private logCallback?: LogCallback;
  private resultCallback?: TestResultCallback;
  private testCases: TestCase[] = [];

  constructor(baseUrl: string = DEFAULT_SERVER_CONFIG.baseUrl) {
    // 创建独立的 axios 实例，不使用拦截器
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: DEFAULT_SERVER_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // 初始化测试用例
    this.initializeTestCases();
  }

  /**
   * 设置日志回调
   */
  setLogCallback(callback: LogCallback): void {
    this.logCallback = callback;
  }

  /**
   * 设置测试结果回调
   */
  setResultCallback(callback: TestResultCallback): void {
    this.resultCallback = callback;
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, testId?: string): void {
    const entry: TestLogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      testId,
    };
    this.logCallback?.(entry);

    // 同时输出到控制台
    const prefix = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }[level];
    console.log(`[${entry.timestamp}] ${prefix} ${message}`);
  }

  /**
   * 初始化测试用例
   */
  private initializeTestCases(): void {
    this.testCases = [
      // ============ Phase 1: 网络与健康检查 ============
      {
        testId: 'NET-001',
        testName: '网络连接检查',
        category: 'network',
        phase: 1,
        requiresAuth: false,
        execute: async () => {
          const isConnected = await NetworkManager.isConnected();
          const state = await NetworkManager.getCurrentState();
          return {
            success: isConnected,
            data: { type: state?.type, isInternetReachable: state?.isInternetReachable },
            errorMessage: isConnected ? undefined : '无网络连接',
          };
        },
      },
      {
        testId: 'SYS-001',
        testName: '系统健康检查',
        category: 'health',
        phase: 1,
        endpoint: '/api/mobile/health',
        method: 'GET',
        requiresAuth: false,
        execute: async () => {
          try {
            const response = await this.axiosInstance.get('/api/mobile/health');
            return { success: true, data: response.data };
          } catch (error: unknown) {
            return { success: false, errorMessage: this.getErrorMessage(error) };
          }
        },
      },
      {
        testId: 'SYS-002',
        testName: '服务器可达性',
        category: 'health',
        phase: 1,
        endpoint: '/api/mobile/auth/unified-login',
        method: 'POST',
        requiresAuth: false,
        execute: async () => {
          try {
            // 发送空请求，只验证端点可达性（会返回错误，但能建立连接）
            await this.axiosInstance.post('/api/mobile/auth/unified-login', {});
            return { success: true, data: { reachable: true } };
          } catch (error: unknown) {
            // 400/401 错误表示服务器可达
            if (axios.isAxiosError(error) && error.response) {
              const status = error.response.status;
              if (status === 400 || status === 401 || status === 403) {
                return { success: true, data: { reachable: true, status } };
              }
            }
            return { success: false, errorMessage: this.getErrorMessage(error) };
          }
        },
      },

      // ============ Phase 2: 认证测试 ============
      {
        testId: 'AUTH-001',
        testName: '统一登录',
        category: 'auth',
        phase: 2,
        endpoint: '/api/mobile/auth/unified-login',
        method: 'POST',
        requiresAuth: false,
        execute: async () => {
          try {
            const response = await this.axiosInstance.post('/api/mobile/auth/unified-login', {
              username: DEFAULT_SERVER_CONFIG.testUsername,
              password: DEFAULT_SERVER_CONFIG.testPassword,
            });
            const data = response.data;

            if (data.success && data.data) {
              // 提取认证信息到上下文
              const authData = data.data;
              this.context.accessToken = authData.accessToken || authData.token;
              this.context.refreshToken = authData.refreshToken;
              this.context.factoryId = authData.user?.factoryId || authData.factoryId || 'F001';
              this.context.userId = authData.user?.id || authData.userId;
              this.context.username = authData.user?.username || authData.username;
              this.context.role = authData.user?.role || authData.role;

              return { success: true, data: { factoryId: this.context.factoryId, role: this.context.role } };
            }
            return { success: false, errorMessage: data.message || '登录失败' };
          } catch (error: unknown) {
            return { success: false, errorMessage: this.getErrorMessage(error) };
          }
        },
      },
      {
        testId: 'AUTH-002',
        testName: 'Token 验证',
        category: 'auth',
        phase: 2,
        endpoint: '/api/mobile/auth/validate',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => {
          if (!context.accessToken) {
            return { success: false, errorMessage: '缺少 accessToken (请先通过登录测试)' };
          }
          try {
            const response = await this.axiosInstance.get('/api/mobile/auth/validate', {
              headers: { Authorization: `Bearer ${context.accessToken}` },
            });
            return { success: response.data?.success ?? true, data: response.data };
          } catch (error: unknown) {
            return { success: false, errorMessage: this.getErrorMessage(error) };
          }
        },
      },
      {
        testId: 'AUTH-003',
        testName: '获取当前用户',
        category: 'auth',
        phase: 2,
        endpoint: '/api/mobile/auth/me',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => {
          if (!context.accessToken) {
            return { success: false, errorMessage: '缺少 accessToken' };
          }
          try {
            const response = await this.axiosInstance.get('/api/mobile/auth/me', {
              headers: { Authorization: `Bearer ${context.accessToken}` },
            });
            const data = response.data;
            return { success: data.success ?? true, data: data.data || data };
          } catch (error: unknown) {
            return { success: false, errorMessage: this.getErrorMessage(error) };
          }
        },
      },

      // ============ Phase 3: 业务 API 测试 ============
      {
        testId: 'BIZ-001',
        testName: 'Dashboard 概览',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/reports/dashboard/overview',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'reports/dashboard/overview'),
      },
      {
        testId: 'BIZ-002',
        testName: '用户列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/users',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'users?page=1&size=5'),
      },
      {
        testId: 'BIZ-003',
        testName: '设备告警',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/equipment-alerts',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'equipment-alerts?page=1&size=5'),
      },
      {
        testId: 'BIZ-004',
        testName: 'AI 服务健康',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/ai/health',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'ai/health'),
      },
      {
        testId: 'BIZ-005',
        testName: '生产批次列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/processing/batches',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'processing/batches?page=1&size=5'),
      },
      {
        testId: 'BIZ-006',
        testName: '质量 Dashboard',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/reports/dashboard/quality',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'reports/dashboard/quality'),
      },
      {
        testId: 'BIZ-007',
        testName: '设备 Dashboard',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/reports/dashboard/equipment',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'reports/dashboard/equipment'),
      },
      {
        testId: 'BIZ-008',
        testName: '原材料类型',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/raw-material-types',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'raw-material-types'),
      },

      // ============ 扩展业务 API 测试 ============
      {
        testId: 'BIZ-009',
        testName: '生产计划列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/production-plans',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'production-plans?page=1&size=5'),
      },
      {
        testId: 'BIZ-010',
        testName: '原材料批次列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/material-batches',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'material-batches?page=1&size=5'),
      },
      {
        testId: 'BIZ-011',
        testName: '出货记录列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/shipments',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'shipments?page=1&size=5'),
      },
      {
        testId: 'BIZ-012',
        testName: '考勤状态',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/timeclock/status',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'timeclock/status'),
      },
      {
        testId: 'BIZ-013',
        testName: '设备列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/equipment',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'equipment?page=1&size=5'),
      },
      {
        testId: 'BIZ-014',
        testName: '供应商列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/suppliers',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'suppliers?page=1&size=5'),
      },
      {
        testId: 'BIZ-015',
        testName: '客户列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/customers',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'customers?page=1&size=5'),
      },
      {
        testId: 'BIZ-016',
        testName: '部门列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/departments',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'departments'),
      },
      {
        testId: 'BIZ-017',
        testName: '质检记录列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/quality-inspections',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'quality-inspections?page=1&size=5'),
      },
      {
        testId: 'BIZ-018',
        testName: '产品类型列表',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/product-types',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'product-types'),
      },
      {
        testId: 'BIZ-019',
        testName: '转换率配置',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/conversions',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'conversions?page=1&size=5'),
      },
      {
        testId: 'BIZ-020',
        testName: '设备维护记录',
        category: 'business',
        phase: 3,
        endpoint: '/{factoryId}/reports/dashboard/equipment',
        method: 'GET',
        requiresAuth: true,
        execute: async (context) => this.executeAuthenticatedGet(context, 'reports/dashboard/equipment'),
      },
    ];
  }

  /**
   * 执行带认证的 GET 请求
   */
  private async executeAuthenticatedGet(context: TestContext, endpoint: string): Promise<TestExecutionResult> {
    if (!context.accessToken) {
      return { success: false, errorMessage: '缺少 accessToken' };
    }
    if (!context.factoryId) {
      return { success: false, errorMessage: '缺少 factoryId' };
    }

    try {
      const url = `/api/mobile/${context.factoryId}/${endpoint}`;
      const response = await this.axiosInstance.get(url, {
        headers: { Authorization: `Bearer ${context.accessToken}` },
      });
      const data = response.data;
      return { success: data.success ?? true, data: data.data || data };
    } catch (error: unknown) {
      return { success: false, errorMessage: this.getErrorMessage(error) };
    }
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.response.statusText;
        return `HTTP ${status}: ${message}`;
      }
      if (error.code === 'ECONNABORTED') {
        return '请求超时';
      }
      if (error.code === 'ERR_NETWORK') {
        return '网络错误，无法连接到服务器';
      }
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * 运行单个测试
   */
  async runTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    this.log('info', `开始测试: ${testCase.testName}`, testCase.testId);

    let result: TestResult;
    try {
      const executionResult = await testCase.execute(this.context);
      const endTime = Date.now();

      result = {
        testId: testCase.testId,
        testName: testCase.testName,
        category: testCase.category,
        phase: testCase.phase,
        status: executionResult.success ? 'success' : 'failed',
        responseTimeMs: endTime - startTime,
        errorMessage: executionResult.errorMessage,
        responseData: executionResult.data,
        timestamp: new Date().toISOString(),
      };

      if (executionResult.success) {
        this.log('success', `${testCase.testName} 通过 (${result.responseTimeMs}ms)`, testCase.testId);
      } else {
        this.log('error', `${testCase.testName} 失败: ${executionResult.errorMessage}`, testCase.testId);
      }
    } catch (error: unknown) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);

      result = {
        testId: testCase.testId,
        testName: testCase.testName,
        category: testCase.category,
        phase: testCase.phase,
        status: 'failed',
        responseTimeMs: endTime - startTime,
        errorMessage,
        timestamp: new Date().toISOString(),
      };

      this.log('error', `${testCase.testName} 异常: ${errorMessage}`, testCase.testId);
    }

    this.resultCallback?.(result);
    return result;
  }

  /**
   * 运行指定阶段的所有测试
   */
  async runPhase(phase: TestPhase): Promise<PhaseStatus> {
    const phaseTests = this.testCases.filter(t => t.phase === phase);
    this.log('info', `开始 Phase ${phase}: ${PHASE_NAMES[phase]} (${phaseTests.length} 个测试)`);

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of phaseTests) {
      const result = await this.runTest(testCase);
      results.push(result);

      if (result.status === 'success') {
        passed++;
      } else {
        failed++;
      }
    }

    const status: PhaseStatus = {
      phase,
      phaseName: PHASE_NAMES[phase],
      status: failed === 0 ? 'success' : 'failed',
      tests: results,
      passed,
      failed,
      total: phaseTests.length,
    };

    this.log(
      failed === 0 ? 'success' : 'warning',
      `Phase ${phase} 完成: ${passed}/${status.total} 通过`
    );

    return status;
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<TestSummary> {
    const startTime = Date.now();
    this.log('info', '开始全部测试...');

    // 重置上下文
    this.context = {};

    const phases: PhaseStatus[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // 按阶段运行测试
    for (const phase of [1, 2, 3] as TestPhase[]) {
      const phaseStatus = await this.runPhase(phase);
      phases.push(phaseStatus);
      totalPassed += phaseStatus.passed;
      totalFailed += phaseStatus.failed;

      // 如果关键阶段失败，跳过后续测试
      if (phase === 1 && phaseStatus.failed > 0) {
        this.log('warning', 'Phase 1 失败，跳过后续测试');
        totalSkipped = this.testCases.filter(t => t.phase > 1).length;
        break;
      }
      if (phase === 2 && phaseStatus.failed > 0) {
        this.log('warning', 'Phase 2 认证失败，跳过业务 API 测试');
        totalSkipped = this.testCases.filter(t => t.phase > 2).length;
        break;
      }
    }

    const endTime = Date.now();
    const summary: TestSummary = {
      totalTests: this.testCases.length,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      totalDurationMs: endTime - startTime,
      timestamp: new Date().toISOString(),
      phases,
    };

    this.log(
      totalFailed === 0 ? 'success' : 'error',
      `测试完成: ${totalPassed}/${summary.totalTests} 通过, ${totalFailed} 失败, ${totalSkipped} 跳过 (耗时 ${summary.totalDurationMs}ms)`
    );

    return summary;
  }

  /**
   * 获取所有测试用例
   */
  getTestCases(): TestCase[] {
    return this.testCases;
  }

  /**
   * 获取当前上下文
   */
  getContext(): TestContext {
    return { ...this.context };
  }

  /**
   * 清除上下文
   */
  clearContext(): void {
    this.context = {};
  }
}

// 导出单例实例
export const connectivityTestService = new ConnectivityTestService();
