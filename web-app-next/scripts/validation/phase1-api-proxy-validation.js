#!/usr/bin/env node

/**
 * Phase-1阶段一: API代理层完整性验证脚本
 * 对应任务: TASK-P3-009 - API代理层完整性验证
 */

// 使用全局fetch (Node.js 18+) 或fallback到node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    fetch = require('node-fetch');
  }
} catch (error) {
  // 如果node-fetch不可用，使用全局fetch
  fetch = globalThis.fetch;
}

const BASE_URL = 'http://localhost:3000';
const API_ENDPOINTS = [
  // 认证相关API
  {
    method: 'POST',
    path: '/api/auth/login',
    data: { username: 'admin', password: 'admin123' },
    expectedStatus: 200,
    description: '用户登录'
  },
  {
    method: 'POST',
    path: '/api/auth/verify',
    data: { token: 'mock-jwt-token-admin' },
    expectedStatus: 200,
    description: '令牌验证'
  },
  {
    method: 'GET',
    path: '/api/auth/status',
    expectedStatus: 200,
    description: '认证状态查询'
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    headers: { 'Authorization': 'Bearer mock-jwt-token-admin' },
    expectedStatus: 200,
    description: '用户登出'
  },

  // 产品相关API
  {
    method: 'GET',
    path: '/api/products',
    expectedStatus: 200,
    description: '产品列表查询'
  },
  {
    method: 'GET',
    path: '/api/products?page=1&pageSize=10',
    expectedStatus: 200,
    description: '分页产品查询'
  },
  {
    method: 'GET',
    path: '/api/products?category=水果',
    expectedStatus: 200,
    description: '按类别筛选产品'
  },

  // 溯源相关API
  {
    method: 'GET',
    path: '/api/trace/APPLE-ORG-001',
    expectedStatus: 200,
    description: '产品溯源信息查询'
  },

  // 用户相关API
  {
    method: 'GET',
    path: '/api/users',
    expectedStatus: 200,
    description: '用户列表查询'
  }
];

class ApiProxyValidator {
  constructor() {
    this.results = [];
    this.totalTests = API_ENDPOINTS.length;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  async validateEndpoint(endpoint) {
    try {
      console.log(`🔍 测试: ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);

      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(endpoint.headers || {})
        }
      };

      if (endpoint.data) {
        options.body = JSON.stringify(endpoint.data);
      }

      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const responseData = await response.json();

      const testResult = {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description,
        expectedStatus: endpoint.expectedStatus,
        actualStatus: response.status,
        responseTime: responseTime,
        success: response.status === endpoint.expectedStatus,
        data: responseData,
        timestamp: new Date().toISOString()
      };

      if (testResult.success) {
        console.log(`  ✅ 通过 (${responseTime}ms)`);
        this.passedTests++;
      } else {
        console.log(`  ❌ 失败 - 期望状态: ${endpoint.expectedStatus}, 实际状态: ${response.status}`);
        this.failedTests++;
      }

      this.results.push(testResult);
      return testResult;

    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);

      const errorResult = {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description,
        expectedStatus: endpoint.expectedStatus,
        actualStatus: 'ERROR',
        responseTime: 0,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.results.push(errorResult);
      this.failedTests++;
      return errorResult;
    }
  }

  async validateAll() {
    console.log('🚀 开始API代理层完整性验证...\n');

    for (const endpoint of API_ENDPOINTS) {
      await this.validateEndpoint(endpoint);
      // 间隔100ms避免并发问题
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 ===== API代理层验证报告 =====');
    console.log(`📈 总测试数: ${this.totalTests}`);
    console.log(`✅ 通过: ${this.passedTests}`);
    console.log(`❌ 失败: ${this.failedTests}`);
    console.log(`📊 通过率: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

    // 响应时间统计
    const responseTimes = this.results
      .filter(r => r.success && r.responseTime > 0)
      .map(r => r.responseTime);

    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(`⏱️  平均响应时间: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`⏱️  最大响应时间: ${maxResponseTime}ms`);
      console.log(`⏱️  最小响应时间: ${minResponseTime}ms`);
    }

    // 失败的测试详情
    const failedTests = this.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n❌ 失败的测试详情:');
      failedTests.forEach(test => {
        console.log(`  - ${test.endpoint}: ${test.error || `状态码不匹配 (期望: ${test.expectedStatus}, 实际: ${test.actualStatus})`}`);
      });
    }

    // 生成JSON报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        passRate: ((this.passedTests / this.totalTests) * 100).toFixed(1)
      },
      performance: responseTimes.length > 0 ? {
        avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        maxResponseTime: Math.max(...responseTimes),
        minResponseTime: Math.min(...responseTimes)
      } : null,
      results: this.results
    };

    // 保存报告
    const fs = require('fs');
    const path = require('path');

    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFile = path.join(reportsDir, `api-proxy-validation-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`\n📄 详细报告已保存: ${reportFile}`);

    // 总体结论
    if (this.passedTests === this.totalTests) {
      console.log('\n🎉 API代理层验证通过！所有端点正常工作。');
      process.exit(0);
    } else {
      console.log('\n⚠️  API代理层验证发现问题，请检查失败的端点。');
      process.exit(1);
    }
  }
}

// 等待服务器启动
async function waitForServer() {
  console.log('⏳ 等待开发服务器启动...');

  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/status`);
      if (response.status === 200) {
        console.log('✅ 开发服务器已就绪');
        return true;
      }
    } catch (error) {
      // 服务器还未启动，继续等待
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('❌ 开发服务器启动超时');
  return false;
}

// 主函数
async function main() {
  console.log('🔧 TASK-P3-009: API代理层完整性验证');
  console.log('📍 验证目标: http://localhost:3000');

  // 等待服务器启动
  const serverReady = await waitForServer();
  if (!serverReady) {
    console.log('❌ 无法连接到开发服务器，请确保服务器正在运行');
    process.exit(1);
  }

  // 开始验证
  const validator = new ApiProxyValidator();
  await validator.validateAll();
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
main().catch(error => {
  console.error('❌ 验证过程出错:', error);
  process.exit(1);
});


/**
 * Phase-1阶段一: API代理层完整性验证脚本
 * 对应任务: TASK-P3-009 - API代理层完整性验证
 */

// 使用全局fetch (Node.js 18+) 或fallback到node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    fetch = require('node-fetch');
  }
} catch (error) {
  // 如果node-fetch不可用，使用全局fetch
  fetch = globalThis.fetch;
}

const BASE_URL = 'http://localhost:3000';
const API_ENDPOINTS = [
  // 认证相关API
  {
    method: 'POST',
    path: '/api/auth/login',
    data: { username: 'admin', password: 'admin123' },
    expectedStatus: 200,
    description: '用户登录'
  },
  {
    method: 'POST',
    path: '/api/auth/verify',
    data: { token: 'mock-jwt-token-admin' },
    expectedStatus: 200,
    description: '令牌验证'
  },
  {
    method: 'GET',
    path: '/api/auth/status',
    expectedStatus: 200,
    description: '认证状态查询'
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    headers: { 'Authorization': 'Bearer mock-jwt-token-admin' },
    expectedStatus: 200,
    description: '用户登出'
  },

  // 产品相关API
  {
    method: 'GET',
    path: '/api/products',
    expectedStatus: 200,
    description: '产品列表查询'
  },
  {
    method: 'GET',
    path: '/api/products?page=1&pageSize=10',
    expectedStatus: 200,
    description: '分页产品查询'
  },
  {
    method: 'GET',
    path: '/api/products?category=水果',
    expectedStatus: 200,
    description: '按类别筛选产品'
  },

  // 溯源相关API
  {
    method: 'GET',
    path: '/api/trace/APPLE-ORG-001',
    expectedStatus: 200,
    description: '产品溯源信息查询'
  },

  // 用户相关API
  {
    method: 'GET',
    path: '/api/users',
    expectedStatus: 200,
    description: '用户列表查询'
  }
];

class ApiProxyValidator {
  constructor() {
    this.results = [];
    this.totalTests = API_ENDPOINTS.length;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  async validateEndpoint(endpoint) {
    try {
      console.log(`🔍 测试: ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);

      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(endpoint.headers || {})
        }
      };

      if (endpoint.data) {
        options.body = JSON.stringify(endpoint.data);
      }

      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}${endpoint.path}`, options);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const responseData = await response.json();

      const testResult = {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description,
        expectedStatus: endpoint.expectedStatus,
        actualStatus: response.status,
        responseTime: responseTime,
        success: response.status === endpoint.expectedStatus,
        data: responseData,
        timestamp: new Date().toISOString()
      };

      if (testResult.success) {
        console.log(`  ✅ 通过 (${responseTime}ms)`);
        this.passedTests++;
      } else {
        console.log(`  ❌ 失败 - 期望状态: ${endpoint.expectedStatus}, 实际状态: ${response.status}`);
        this.failedTests++;
      }

      this.results.push(testResult);
      return testResult;

    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);

      const errorResult = {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description,
        expectedStatus: endpoint.expectedStatus,
        actualStatus: 'ERROR',
        responseTime: 0,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.results.push(errorResult);
      this.failedTests++;
      return errorResult;
    }
  }

  async validateAll() {
    console.log('🚀 开始API代理层完整性验证...\n');

    for (const endpoint of API_ENDPOINTS) {
      await this.validateEndpoint(endpoint);
      // 间隔100ms避免并发问题
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 ===== API代理层验证报告 =====');
    console.log(`📈 总测试数: ${this.totalTests}`);
    console.log(`✅ 通过: ${this.passedTests}`);
    console.log(`❌ 失败: ${this.failedTests}`);
    console.log(`📊 通过率: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

    // 响应时间统计
    const responseTimes = this.results
      .filter(r => r.success && r.responseTime > 0)
      .map(r => r.responseTime);

    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(`⏱️  平均响应时间: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`⏱️  最大响应时间: ${maxResponseTime}ms`);
      console.log(`⏱️  最小响应时间: ${minResponseTime}ms`);
    }

    // 失败的测试详情
    const failedTests = this.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n❌ 失败的测试详情:');
      failedTests.forEach(test => {
        console.log(`  - ${test.endpoint}: ${test.error || `状态码不匹配 (期望: ${test.expectedStatus}, 实际: ${test.actualStatus})`}`);
      });
    }

    // 生成JSON报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        passRate: ((this.passedTests / this.totalTests) * 100).toFixed(1)
      },
      performance: responseTimes.length > 0 ? {
        avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        maxResponseTime: Math.max(...responseTimes),
        minResponseTime: Math.min(...responseTimes)
      } : null,
      results: this.results
    };

    // 保存报告
    const fs = require('fs');
    const path = require('path');

    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFile = path.join(reportsDir, `api-proxy-validation-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`\n📄 详细报告已保存: ${reportFile}`);

    // 总体结论
    if (this.passedTests === this.totalTests) {
      console.log('\n🎉 API代理层验证通过！所有端点正常工作。');
      process.exit(0);
    } else {
      console.log('\n⚠️  API代理层验证发现问题，请检查失败的端点。');
      process.exit(1);
    }
  }
}

// 等待服务器启动
async function waitForServer() {
  console.log('⏳ 等待开发服务器启动...');

  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/status`);
      if (response.status === 200) {
        console.log('✅ 开发服务器已就绪');
        return true;
      }
    } catch (error) {
      // 服务器还未启动，继续等待
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('❌ 开发服务器启动超时');
  return false;
}

// 主函数
async function main() {
  console.log('🔧 TASK-P3-009: API代理层完整性验证');
  console.log('📍 验证目标: http://localhost:3000');

  // 等待服务器启动
  const serverReady = await waitForServer();
  if (!serverReady) {
    console.log('❌ 无法连接到开发服务器，请确保服务器正在运行');
    process.exit(1);
  }

  // 开始验证
  const validator = new ApiProxyValidator();
  await validator.validateAll();
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
main().catch(error => {
  console.error('❌ 验证过程出错:', error);
  process.exit(1);
});
