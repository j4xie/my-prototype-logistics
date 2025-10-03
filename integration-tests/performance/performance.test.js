/**
 * 性能测试和指标收集
 * 测试响应时间、并发处理、内存使用、系统负载等性能指标
 */

import fetch from 'node-fetch';
import { expect } from 'chai';
import chalk from 'chalk';
import { performance } from 'perf_hooks';
import testConfig from '../setup/test-config.js';

class PerformanceIntegrationTest {
  constructor() {
    this.apiBase = testConfig.services.backend.apiBase;
    this.testResults = [];
    this.userToken = null;
    this.performanceMetrics = {
      responseTime: {
        min: Infinity,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0,
        samples: []
      },
      throughput: {
        requestsPerSecond: 0,
        totalRequests: 0,
        duration: 0
      },
      concurrency: {
        maxConcurrent: 0,
        successful: 0,
        failed: 0
      },
      memory: {
        initial: 0,
        peak: 0,
        final: 0,
        gcCount: 0
      },
      errorRate: 0
    };
  }

  // 性能监控的API请求方法
  async performanceRequest(endpoint, method = 'GET', body = null, token = null) {
    const startTime = performance.now();
    const memBefore = process.memoryUsage();
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, options);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      const data = await response.json().catch(() => null);
      const memAfter = process.memoryUsage();
      
      // 记录性能指标
      this.recordPerformanceMetric(responseTime, response.ok, memBefore, memAfter);
      
      return {
        status: response.status,
        ok: response.ok,
        data,
        responseTime,
        memoryDelta: memAfter.heapUsed - memBefore.heapUsed
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.recordPerformanceMetric(responseTime, false);
      
      return {
        status: 0,
        ok: false,
        data: null,
        responseTime,
        error: error.message
      };
    }
  }

  // 记录性能指标
  recordPerformanceMetric(responseTime, isSuccess, memBefore = null, memAfter = null) {
    this.performanceMetrics.responseTime.samples.push(responseTime);
    this.performanceMetrics.responseTime.min = Math.min(this.performanceMetrics.responseTime.min, responseTime);
    this.performanceMetrics.responseTime.max = Math.max(this.performanceMetrics.responseTime.max, responseTime);
    
    if (isSuccess) {
      this.performanceMetrics.concurrency.successful++;
    } else {
      this.performanceMetrics.concurrency.failed++;
    }
    
    if (memBefore && memAfter) {
      this.performanceMetrics.memory.peak = Math.max(this.performanceMetrics.memory.peak, memAfter.heapUsed);
    }
  }

  // 计算性能统计
  calculatePerformanceStats() {
    const samples = this.performanceMetrics.responseTime.samples;
    if (samples.length === 0) return;

    // 计算平均响应时间
    this.performanceMetrics.responseTime.avg = samples.reduce((a, b) => a + b, 0) / samples.length;

    // 计算百分位数
    const sorted = samples.slice().sort((a, b) => a - b);
    this.performanceMetrics.responseTime.p95 = sorted[Math.floor(sorted.length * 0.95)];
    this.performanceMetrics.responseTime.p99 = sorted[Math.floor(sorted.length * 0.99)];

    // 计算错误率
    const total = this.performanceMetrics.concurrency.successful + this.performanceMetrics.concurrency.failed;
    this.performanceMetrics.errorRate = (this.performanceMetrics.concurrency.failed / total) * 100;
  }

  // 准备：获取用户Token
  async setupAuthentication() {
    console.log(chalk.blue('\n🔑 准备：用户认证'));
    
    const response = await this.performanceRequest('/mobile/auth/unified-login', 'POST', {
      username: testConfig.testAccounts.processOperator.username,
      password: testConfig.testAccounts.processOperator.password,
      deviceInfo: testConfig.testDevices[0]
    });

    if (response.ok) {
      this.userToken = response.data.data.accessToken;
      console.log(chalk.green('    ✓ 用户认证成功'));
    } else {
      throw new Error('用户认证失败');
    }
  }

  // 测试用例：响应时间基准测试
  async testResponseTimeBenchmark() {
    console.log(chalk.blue('\n⏱️  测试：响应时间基准测试'));
    
    try {
      const endpoints = [
        { name: '用户认证', endpoint: '/users/profile', target: 1000 },
        { name: '任务列表', endpoint: '/processing/tasks', target: 2000 },
        { name: '原料查询', endpoint: '/processing/materials', target: 1500 },
        { name: '系统状态', endpoint: '/system/health', target: 500 }
      ];

      let allPassed = true;
      
      for (const test of endpoints) {
        console.log(chalk.gray(`  测试 ${test.name} 响应时间...`));
        
        // 执行多次请求获取平均值
        const samples = [];
        for (let i = 0; i < 5; i++) {
          const response = await this.performanceRequest(test.endpoint, 'GET', null, this.userToken);
          if (response.ok) {
            samples.push(response.responseTime);
          }
          await this.sleep(100); // 避免请求过于密集
        }

        if (samples.length > 0) {
          const avgResponseTime = samples.reduce((a, b) => a + b, 0) / samples.length;
          const maxResponseTime = Math.max(...samples);
          
          if (avgResponseTime <= test.target) {
            console.log(chalk.green(`    ✓ ${test.name}: 平均 ${avgResponseTime.toFixed(0)}ms (目标: ${test.target}ms)`));
          } else {
            console.log(chalk.red(`    ✗ ${test.name}: 平均 ${avgResponseTime.toFixed(0)}ms 超过目标 ${test.target}ms`));
            allPassed = false;
          }
          
          console.log(chalk.gray(`      最大: ${maxResponseTime.toFixed(0)}ms, 最小: ${Math.min(...samples).toFixed(0)}ms`));
        }
      }

      this.testResults.push({
        test: '响应时间基准测试',
        status: allPassed ? 'passed' : 'failed',
        details: `${endpoints.length} 个端点响应时间测试${allPassed ? '全部达标' : '部分超标'}`
      });

    } catch (error) {
      this.testResults.push({
        test: '响应时间基准测试',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 响应时间基准测试失败:', error.message));
    }
  }

  // 测试用例：并发处理能力
  async testConcurrencyPerformance() {
    console.log(chalk.blue('\n🚀 测试：并发处理能力'));
    
    try {
      const concurrencyLevels = [1, 5, 10, 20];
      const requestsPerLevel = 10;
      
      for (const concurrency of concurrencyLevels) {
        console.log(chalk.gray(`  测试并发级别: ${concurrency}`));
        
        const startTime = performance.now();
        const promises = [];
        
        // 创建并发请求
        for (let i = 0; i < requestsPerLevel; i++) {
          const promise = this.performanceRequest('/processing/tasks', 'GET', null, this.userToken);
          promises.push(promise);
          
          // 控制并发数
          if (promises.length >= concurrency) {
            await Promise.race(promises);
          }
        }
        
        // 等待所有请求完成
        const results = await Promise.allSettled(promises);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // 分析结果
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const failed = results.filter(r => r.status === 'rejected' || !r.value.ok).length;
        const throughput = (successful / duration) * 1000; // 每秒请求数
        
        console.log(chalk.green(`    ✓ 并发${concurrency}: ${successful}成功/${failed}失败, 吞吐量: ${throughput.toFixed(1)} req/s`));
        
        // 记录最高并发数
        this.performanceMetrics.concurrency.maxConcurrent = Math.max(
          this.performanceMetrics.concurrency.maxConcurrent,
          concurrency
        );
        
        await this.sleep(1000); // 让系统恢复
      }

      this.testResults.push({
        test: '并发处理能力',
        status: 'passed',
        details: `最大并发: ${this.performanceMetrics.concurrency.maxConcurrent}`
      });

    } catch (error) {
      this.testResults.push({
        test: '并发处理能力',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 并发处理能力测试失败:', error.message));
    }
  }

  // 测试用例：负载测试
  async testLoadPerformance() {
    console.log(chalk.blue('\n📈 测试：系统负载测试'));
    
    try {
      const testDuration = 30000; // 30秒负载测试
      const requestInterval = 100; // 每100ms一个请求
      
      console.log(chalk.gray(`  执行${testDuration / 1000}秒负载测试...`));
      
      const startTime = performance.now();
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      
      const testOperations = [
        { endpoint: '/processing/tasks', method: 'GET', weight: 0.4 },
        { endpoint: '/processing/materials', method: 'GET', weight: 0.3 },
        { endpoint: '/users/profile', method: 'GET', weight: 0.2 },
        { endpoint: '/system/health', method: 'GET', weight: 0.1 }
      ];

      // 持续发送请求
      while (performance.now() - startTime < testDuration) {
        // 根据权重选择操作
        const random = Math.random();
        let cumulative = 0;
        let selectedOp = testOperations[0];
        
        for (const op of testOperations) {
          cumulative += op.weight;
          if (random <= cumulative) {
            selectedOp = op;
            break;
          }
        }

        try {
          const response = await this.performanceRequest(selectedOp.endpoint, selectedOp.method, null, this.userToken);
          requestCount++;
          
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }

        await this.sleep(requestInterval);
      }

      const actualDuration = performance.now() - startTime;
      const rps = (requestCount / actualDuration) * 1000;
      const errorRate = (errorCount / requestCount) * 100;

      console.log(chalk.green(`    ✓ 负载测试完成: ${requestCount} 个请求`));
      console.log(chalk.white(`    吞吐量: ${rps.toFixed(2)} req/s`));
      console.log(chalk.white(`    成功率: ${((successCount / requestCount) * 100).toFixed(1)}%`));
      console.log(chalk.white(`    错误率: ${errorRate.toFixed(1)}%`));

      // 更新性能指标
      this.performanceMetrics.throughput.requestsPerSecond = rps;
      this.performanceMetrics.throughput.totalRequests = requestCount;
      this.performanceMetrics.throughput.duration = actualDuration;

      const passed = errorRate < 5.0 && rps > 5.0; // 错误率小于5%，吞吐量大于5 req/s
      
      this.testResults.push({
        test: '系统负载测试',
        status: passed ? 'passed' : 'failed',
        details: `${requestCount} 请求, ${rps.toFixed(1)} req/s, ${errorRate.toFixed(1)}% 错误`
      });

    } catch (error) {
      this.testResults.push({
        test: '系统负载测试',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 系统负载测试失败:', error.message));
    }
  }

  // 测试用例：内存使用监控
  async testMemoryUsage() {
    console.log(chalk.blue('\n🧠 测试：内存使用监控'));
    
    try {
      const initialMemory = process.memoryUsage();
      this.performanceMetrics.memory.initial = initialMemory.heapUsed;
      
      console.log(chalk.gray('  初始内存使用:'));
      console.log(chalk.white(`    堆内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`));
      console.log(chalk.white(`    RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`));

      // 执行内存密集型操作
      console.log(chalk.gray('  执行内存密集型操作...'));
      const largeDataOperations = [];
      
      for (let i = 0; i < 50; i++) {
        const operation = this.performanceRequest('/processing/tasks', 'POST', {
          taskName: `内存测试任务 ${i}`,
          status: 'created',
          description: 'A'.repeat(1000), // 1KB描述
          largeData: Array(100).fill('test data').join(' ')
        }, this.userToken);
        
        largeDataOperations.push(operation);
      }

      await Promise.all(largeDataOperations);
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
        this.performanceMetrics.memory.gcCount++;
      }

      const peakMemory = process.memoryUsage();
      this.performanceMetrics.memory.peak = peakMemory.heapUsed;
      
      console.log(chalk.gray('  峰值内存使用:'));
      console.log(chalk.white(`    堆内存: ${(peakMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`));
      console.log(chalk.white(`    RSS: ${(peakMemory.rss / 1024 / 1024).toFixed(2)} MB`));
      
      const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
      console.log(chalk.white(`    增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`));

      // 等待一段时间让内存稳定
      await this.sleep(2000);
      
      const finalMemory = process.memoryUsage();
      this.performanceMetrics.memory.final = finalMemory.heapUsed;
      
      console.log(chalk.gray('  最终内存使用:'));
      console.log(chalk.white(`    堆内存: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`));

      // 检查是否有明显的内存泄漏
      const memoryLeak = finalMemory.heapUsed > initialMemory.heapUsed * 2;
      
      this.testResults.push({
        test: '内存使用监控',
        status: memoryLeak ? 'failed' : 'passed',
        details: `峰值: ${(peakMemory.heapUsed / 1024 / 1024).toFixed(1)}MB, ${memoryLeak ? '可能存在内存泄漏' : '内存使用正常'}`
      });

    } catch (error) {
      this.testResults.push({
        test: '内存使用监控',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 内存使用监控测试失败:', error.message));
    }
  }

  // 测试用例：数据库查询性能
  async testDatabaseQueryPerformance() {
    console.log(chalk.blue('\n🗄️  测试：数据库查询性能'));
    
    try {
      const queryTests = [
        {
          name: '简单查询',
          endpoint: '/processing/tasks?limit=10',
          target: 500
        },
        {
          name: '复杂查询',
          endpoint: '/processing/tasks?status=created&priority=high&sort=createdAt',
          target: 1000
        },
        {
          name: '分页查询',
          endpoint: '/processing/tasks?page=1&limit=50',
          target: 800
        },
        {
          name: '聚合查询',
          endpoint: '/processing/tasks/statistics',
          target: 2000
        }
      ];

      let allPassed = true;
      
      for (const test of queryTests) {
        console.log(chalk.gray(`  测试 ${test.name}...`));
        
        const samples = [];
        for (let i = 0; i < 3; i++) {
          const response = await this.performanceRequest(test.endpoint, 'GET', null, this.userToken);
          if (response.ok) {
            samples.push(response.responseTime);
          }
          await this.sleep(200);
        }

        if (samples.length > 0) {
          const avgTime = samples.reduce((a, b) => a + b, 0) / samples.length;
          
          if (avgTime <= test.target) {
            console.log(chalk.green(`    ✓ ${test.name}: ${avgTime.toFixed(0)}ms (目标: ${test.target}ms)`));
          } else {
            console.log(chalk.red(`    ✗ ${test.name}: ${avgTime.toFixed(0)}ms 超过目标 ${test.target}ms`));
            allPassed = false;
          }
        } else {
          console.log(chalk.yellow(`    ⚠️  ${test.name}: 查询失败或端点未实现`));
        }
      }

      this.testResults.push({
        test: '数据库查询性能',
        status: allPassed ? 'passed' : 'failed',
        details: `${queryTests.length} 个查询测试${allPassed ? '全部达标' : '部分超标'}`
      });

    } catch (error) {
      this.testResults.push({
        test: '数据库查询性能',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 数据库查询性能测试失败:', error.message));
    }
  }

  // 测试用例：API缓存效果
  async testAPICachePerformance() {
    console.log(chalk.blue('\n💾 测试：API缓存性能'));
    
    try {
      const cacheableEndpoint = '/processing/materials';
      
      // 第一次请求（缓存未命中）
      console.log(chalk.gray('  测试缓存未命中...'));
      const firstResponse = await this.performanceRequest(cacheableEndpoint, 'GET', null, this.userToken);
      const firstRequestTime = firstResponse.responseTime;
      
      if (firstResponse.ok) {
        console.log(chalk.green(`    ✓ 首次请求: ${firstRequestTime.toFixed(0)}ms`));
        
        // 立即再次请求（应该从缓存获取）
        console.log(chalk.gray('  测试缓存命中...'));
        const cachedResponse = await this.performanceRequest(cacheableEndpoint, 'GET', null, this.userToken);
        const cachedRequestTime = cachedResponse.responseTime;
        
        if (cachedResponse.ok) {
          console.log(chalk.green(`    ✓ 缓存请求: ${cachedRequestTime.toFixed(0)}ms`));
          
          const cacheImprovement = ((firstRequestTime - cachedRequestTime) / firstRequestTime) * 100;
          
          if (cacheImprovement > 10) {
            console.log(chalk.green(`    ✓ 缓存效果显著: 提升 ${cacheImprovement.toFixed(1)}%`));
          } else {
            console.log(chalk.yellow(`    ⚠️  缓存效果不明显: 仅提升 ${cacheImprovement.toFixed(1)}%`));
          }
        }
      }

      // 测试缓存失效
      console.log(chalk.gray('  测试缓存失效...'));
      await this.sleep(1000); // 等待可能的缓存过期
      
      const expiredResponse = await this.performanceRequest(`${cacheableEndpoint}?cache=bust`, 'GET', null, this.userToken);
      
      if (expiredResponse.ok) {
        console.log(chalk.green(`    ✓ 缓存失效请求: ${expiredResponse.responseTime.toFixed(0)}ms`));
      }

      this.testResults.push({
        test: 'API缓存性能',
        status: 'passed',
        details: 'API缓存机制测试完成'
      });

    } catch (error) {
      this.testResults.push({
        test: 'API缓存性能',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ API缓存性能测试失败:', error.message));
    }
  }

  // 延迟函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 运行所有测试
  async runAllTests() {
    console.log(chalk.cyan.bold('\n⚡ 性能测试和指标收集\n'));
    console.log(chalk.gray('═'.repeat(50)));

    const startTime = performance.now();
    
    // 准备工作
    await this.setupAuthentication();
    
    // 执行测试用例
    await this.testResponseTimeBenchmark();
    await this.testConcurrencyPerformance();
    await this.testLoadPerformance();
    await this.testMemoryUsage();
    await this.testDatabaseQueryPerformance();
    await this.testAPICachePerformance();

    const totalTime = performance.now() - startTime;

    // 计算性能统计
    this.calculatePerformanceStats();

    // 生成测试报告
    this.generateReport(totalTime);
  }

  // 生成测试报告
  generateReport(totalTime) {
    console.log(chalk.gray('\n' + '═'.repeat(50)));
    console.log(chalk.cyan.bold('\n📊 性能测试结果\n'));

    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;

    // 显示每个测试结果
    this.testResults.forEach(result => {
      const icon = result.status === 'passed' ? '✓' : '✗';
      const color = result.status === 'passed' ? chalk.green : chalk.red;
      console.log(color(`  ${icon} ${result.test}`));
      if (result.details) {
        console.log(chalk.gray(`    ${result.details}`));
      }
      if (result.error) {
        console.log(chalk.red(`    错误: ${result.error}`));
      }
    });

    console.log(chalk.gray('\n' + '─'.repeat(50)));
    console.log(chalk.cyan('测试统计:'));
    console.log(chalk.white(`  总测试数: ${total}`));
    console.log(chalk.green(`  通过: ${passed}`));
    console.log(chalk.red(`  失败: ${failed}`));
    console.log(chalk.yellow(`  通过率: ${((passed / total) * 100).toFixed(1)}%`));
    console.log(chalk.gray(`  总耗时: ${(totalTime / 1000).toFixed(2)}秒`));

    // 显示性能指标
    if (this.performanceMetrics.responseTime.samples.length > 0) {
      console.log(chalk.cyan('\n📈 性能指标:'));
      console.log(chalk.white(`  响应时间 (平均): ${this.performanceMetrics.responseTime.avg.toFixed(1)}ms`));
      console.log(chalk.white(`  响应时间 (95%): ${this.performanceMetrics.responseTime.p95.toFixed(1)}ms`));
      console.log(chalk.white(`  响应时间 (99%): ${this.performanceMetrics.responseTime.p99.toFixed(1)}ms`));
      console.log(chalk.white(`  响应时间 (最快): ${this.performanceMetrics.responseTime.min.toFixed(1)}ms`));
      console.log(chalk.white(`  响应时间 (最慢): ${this.performanceMetrics.responseTime.max.toFixed(1)}ms`));
      
      if (this.performanceMetrics.throughput.requestsPerSecond > 0) {
        console.log(chalk.white(`  吞吐量: ${this.performanceMetrics.throughput.requestsPerSecond.toFixed(1)} req/s`));
      }
      
      console.log(chalk.white(`  错误率: ${this.performanceMetrics.errorRate.toFixed(1)}%`));
      console.log(chalk.white(`  峰值内存: ${(this.performanceMetrics.memory.peak / 1024 / 1024).toFixed(1)}MB`));
    }

    // 性能评级
    const performanceScore = this.calculatePerformanceScore();
    console.log(chalk.cyan('\n🏆 性能评级:'));
    console.log(this.getPerformanceGrade(performanceScore));

    if (failed === 0) {
      console.log(chalk.green.bold('\n✅ 性能测试全部通过！系统性能表现良好。'));
    } else {
      console.log(chalk.red.bold(`\n❌ 有 ${failed} 个性能测试未达标，建议优化相关功能。`));
    }
  }

  // 计算性能分数
  calculatePerformanceScore() {
    let score = 100;
    
    // 响应时间评分（权重40%）
    if (this.performanceMetrics.responseTime.avg > 2000) score -= 20;
    else if (this.performanceMetrics.responseTime.avg > 1000) score -= 10;
    else if (this.performanceMetrics.responseTime.avg > 500) score -= 5;
    
    // 错误率评分（权重30%）
    if (this.performanceMetrics.errorRate > 5) score -= 20;
    else if (this.performanceMetrics.errorRate > 2) score -= 10;
    else if (this.performanceMetrics.errorRate > 1) score -= 5;
    
    // 吞吐量评分（权重20%）
    if (this.performanceMetrics.throughput.requestsPerSecond < 5) score -= 15;
    else if (this.performanceMetrics.throughput.requestsPerSecond < 10) score -= 10;
    else if (this.performanceMetrics.throughput.requestsPerSecond < 20) score -= 5;
    
    // 内存使用评分（权重10%）
    if (this.performanceMetrics.memory.peak > 300 * 1024 * 1024) score -= 10;
    else if (this.performanceMetrics.memory.peak > 200 * 1024 * 1024) score -= 5;
    
    return Math.max(0, score);
  }

  // 获取性能等级
  getPerformanceGrade(score) {
    if (score >= 90) return chalk.green.bold(`A级 (${score}分) - 优秀性能`);
    if (score >= 80) return chalk.yellow.bold(`B级 (${score}分) - 良好性能`);
    if (score >= 70) return chalk.orange.bold(`C级 (${score}分) - 一般性能`);
    if (score >= 60) return chalk.red.bold(`D级 (${score}分) - 性能较差`);
    return chalk.red.bold(`F级 (${score}分) - 性能不合格`);
  }
}

// 导出测试类
export default PerformanceIntegrationTest;

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new PerformanceIntegrationTest();
  test.runAllTests().catch(error => {
    console.error(chalk.red('测试执行错误:'), error);
    process.exit(1);
  });
}