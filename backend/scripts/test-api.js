#!/usr/bin/env node

/**
 * API测试脚本
 * 用于测试海牛食品溯源系统的各个API端点
 */

import axios from 'axios';
import chalk from 'chalk';

class APITester {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.tokens = {};
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    switch (type) {
      case 'success':
        console.log(chalk.green(`[${timestamp}] ✓ ${message}`));
        break;
      case 'error':
        console.log(chalk.red(`[${timestamp}] ✗ ${message}`));
        break;
      case 'info':
        console.log(chalk.blue(`[${timestamp}] ℹ ${message}`));
        break;
      case 'warning':
        console.log(chalk.yellow(`[${timestamp}] ⚠ ${message}`));
        break;
    }
  }

  async test(name, testFn) {
    this.testResults.total++;
    this.log(`开始测试: ${name}`, 'info');
    
    try {
      await testFn();
      this.testResults.passed++;
      this.log(`测试通过: ${name}`, 'success');
    } catch (error) {
      this.testResults.failed++;
      this.log(`测试失败: ${name} - ${error.message}`, 'error');
    }
  }

  async request(method, url, data = null, headers = {}) {
    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${url}`,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      throw new Error(`${method} ${url}: ${error.response?.data?.message || error.message}`);
    }
  }

  // 健康检查测试
  async testHealthCheck() {
    await this.test('系统健康检查', async () => {
      const response = await this.request('GET', '/api/mobile/health');
      if (!response.success) {
        throw new Error('健康检查失败');
      }
    });
  }

  // 认证相关测试
  async testAuthentication() {
    await this.test('统一登录 - 管理员', async () => {
      const loginData = {
        username: 'platform_admin',
        password: 'Admin@123456',
        deviceInfo: {
          deviceId: 'TEST_DEVICE_001',
          deviceModel: 'Test Device',
          platform: 'test',
          osVersion: '1.0'
        }
      };

      const response = await this.request('POST', '/api/mobile/auth/unified-login', loginData);
      if (!response.success || !response.tokens) {
        throw new Error('登录失败');
      }

      this.tokens.admin = response.tokens.token;
    });

    await this.test('用户信息获取', async () => {
      const response = await this.request('GET', '/api/mobile/auth/profile', null, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success || !response.user) {
        throw new Error('获取用户信息失败');
      }
    });

    await this.test('权限检查', async () => {
      const permissionData = {
        permissionChecks: [
          {
            type: 'permission',
            values: ['processing_batch_create'],
            operator: 'OR'
          }
        ]
      };

      const response = await this.request('POST', '/api/mobile/permissions/batch-check', permissionData, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success) {
        throw new Error('权限检查失败');
      }
    });
  }

  // 加工模块测试
  async testProcessingModule() {
    let batchId = null;

    await this.test('创建生产批次', async () => {
      const batchData = {
        productType: '测试产品',
        rawMaterials: [
          { material: '原料A', quantity: 100, unit: 'kg' }
        ],
        startDate: new Date().toISOString().split('T')[0],
        productionLine: '测试生产线',
        targetQuantity: 80
      };

      const response = await this.request('POST', '/api/mobile/processing/batches', batchData, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success || !response.data.id) {
        throw new Error('创建批次失败');
      }
      batchId = response.data.id;
    });

    await this.test('获取批次列表', async () => {
      const response = await this.request('GET', '/api/mobile/processing/batches?page=1&limit=10', null, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success || !Array.isArray(response.data.batches)) {
        throw new Error('获取批次列表失败');
      }
    });

    if (batchId) {
      await this.test('开始生产', async () => {
        const response = await this.request('POST', `/api/mobile/processing/batches/${batchId}/start`, {}, {
          'Authorization': `Bearer ${this.tokens.admin}`
        });
        if (!response.success) {
          throw new Error('开始生产失败');
        }
      });

      await this.test('提交质检记录', async () => {
        const inspectionData = {
          batchId,
          inspectionType: 'process',
          testItems: {
            temperature: '25°C',
            ph_value: '7.0'
          },
          overallResult: 'pass',
          qualityScore: 0.95
        };

        const response = await this.request('POST', '/api/mobile/processing/quality/inspections', inspectionData, {
          'Authorization': `Bearer ${this.tokens.admin}`
        });
        if (!response.success) {
          throw new Error('提交质检记录失败');
        }
      });
    }
  }

  // 仪表板测试
  async testDashboard() {
    await this.test('获取概览数据', async () => {
      const response = await this.request('GET', '/api/mobile/processing/dashboard/overview?period=today', null, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success || !response.data.summary) {
        throw new Error('获取概览数据失败');
      }
    });

    await this.test('获取生产统计', async () => {
      const response = await this.request('GET', '/api/mobile/processing/dashboard/production', null, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success) {
        throw new Error('获取生产统计失败');
      }
    });
  }

  // Phase 3功能测试
  async testPhase3Features() {
    await this.test('生成激活码', async () => {
      const activationData = {
        type: 'device',
        maxUses: 1,
        validDays: 30,
        notes: 'API测试生成'
      };

      const response = await this.request('POST', '/api/mobile/activation/generate', activationData, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success || !response.data.code) {
        throw new Error('生成激活码失败');
      }
    });

    await this.test('获取系统性能数据', async () => {
      const response = await this.request('GET', '/api/mobile/system/performance', null, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success || !response.data.system) {
        throw new Error('获取系统性能数据失败');
      }
    });

    await this.test('生成Excel报表', async () => {
      const reportData = {
        reportType: 'production',
        parameters: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        }
      };

      const response = await this.request('POST', '/api/mobile/reports/generate/excel', reportData, {
        'Authorization': `Bearer ${this.tokens.admin}`
      });
      if (!response.success || !response.data.filename) {
        throw new Error('生成Excel报表失败');
      }
    });
  }

  // 错误处理测试
  async testErrorHandling() {
    await this.test('无效认证处理', async () => {
      try {
        await this.request('GET', '/api/mobile/auth/profile', null, {
          'Authorization': 'Bearer invalid_token'
        });
        throw new Error('应该返回认证错误');
      } catch (error) {
        if (!error.message.includes('401') && !error.message.includes('认证')) {
          throw error;
        }
      }
    });

    await this.test('无效请求参数处理', async () => {
      try {
        await this.request('POST', '/api/mobile/processing/batches', {
          // 缺少必需字段
          productType: ''
        }, {
          'Authorization': `Bearer ${this.tokens.admin}`
        });
        throw new Error('应该返回验证错误');
      } catch (error) {
        if (!error.message.includes('400') && !error.message.includes('验证')) {
          throw error;
        }
      }
    });
  }

  // 运行所有测试
  async runAllTests() {
    console.log(chalk.cyan('🚀 开始API测试...'));
    console.log(chalk.cyan(`测试目标: ${this.baseURL}`));
    console.log('');

    const startTime = Date.now();

    try {
      await this.testHealthCheck();
      await this.testAuthentication();
      await this.testProcessingModule();
      await this.testDashboard();
      await this.testPhase3Features();
      await this.testErrorHandling();
    } catch (error) {
      this.log(`测试过程中发生严重错误: ${error.message}`, 'error');
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('');
    console.log(chalk.cyan('📊 测试结果汇总:'));
    console.log(`总计测试: ${this.testResults.total}`);
    console.log(chalk.green(`通过: ${this.testResults.passed}`));
    console.log(chalk.red(`失败: ${this.testResults.failed}`));
    console.log(`测试时长: ${duration}秒`);

    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    console.log(`成功率: ${successRate}%`);

    if (this.testResults.failed === 0) {
      console.log(chalk.green('🎉 所有测试通过!'));
      process.exit(0);
    } else {
      console.log(chalk.red('❌ 部分测试失败'));
      process.exit(1);
    }
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const baseURL = args[0] || 'http://localhost:3001';

const tester = new APITester(baseURL);
tester.runAllTests().catch(error => {
  console.error(chalk.red('测试执行失败:'), error);
  process.exit(1);
});