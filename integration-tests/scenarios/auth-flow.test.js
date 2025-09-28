/**
 * 认证系统集成测试
 * 测试完整的认证流程，包括注册、登录、Token管理、设备绑定等
 */

import fetch from 'node-fetch';
import { expect } from 'chai';
import chalk from 'chalk';
import testConfig from '../setup/test-config.js';

class AuthenticationIntegrationTest {
  constructor() {
    this.apiBase = testConfig.services.backend.apiBase;
    this.testResults = [];
    this.tokens = {};
  }

  // API请求辅助方法
  async apiRequest(endpoint, method = 'GET', body = null, token = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      ...(body && { body: JSON.stringify(body) })
    };

    const startTime = Date.now();
    const response = await fetch(`${this.apiBase}${endpoint}`, options);
    const responseTime = Date.now() - startTime;
    
    const data = await response.json().catch(() => null);
    
    return {
      status: response.status,
      ok: response.ok,
      data,
      responseTime,
      headers: response.headers
    };
  }

  // 测试用例：统一登录 - 平台用户
  async testPlatformUserLogin() {
    console.log(chalk.blue('\n📱 测试：平台用户统一登录'));
    
    try {
      const response = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.platformAdmin.username,
        password: testConfig.testAccounts.platformAdmin.password,
        deviceInfo: testConfig.testDevices[0]
      });

      // 验证响应
      expect(response.ok).to.be.true;
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('success', true);
      expect(response.data).to.have.property('tokens');
      expect(response.data.tokens).to.have.property('token');
      expect(response.data.tokens).to.have.property('refreshToken');
      expect(response.data).to.have.property('user');
      expect(response.data.user).to.have.property('userType', 'platform');
      
      // 保存token供后续测试使用
      this.tokens.platformAdmin = response.data.tokens.token;
      
      // 性能验证
      expect(response.responseTime).to.be.below(testConfig.performanceTargets.loginResponseTime);

      this.testResults.push({
        test: '平台用户登录',
        status: 'passed',
        responseTime: response.responseTime,
        details: '登录成功，Token获取正常'
      });

      console.log(chalk.green('  ✓ 平台用户登录成功'));
      console.log(chalk.gray(`    响应时间: ${response.responseTime}ms`));
      return true;
    } catch (error) {
      this.testResults.push({
        test: '平台用户登录',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 平台用户登录失败:', error.message));
      throw error;
    }
  }

  // 测试用例：统一登录 - 工厂用户
  async testFactoryUserLogin() {
    console.log(chalk.blue('\n🏭 测试：工厂用户统一登录'));
    
    try {
      const response = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.factoryAdmin.username,
        password: testConfig.testAccounts.factoryAdmin.password,
        deviceInfo: testConfig.testDevices[0]
      });

      // 验证响应
      expect(response.ok).to.be.true;
      expect(response.data.user).to.have.property('userType', 'factory');
      expect(response.data.user).to.have.property('factoryId', testConfig.testFactory.factoryId);
      expect(response.data.user).to.have.property('roleCode', 'factory_super_admin');
      expect(response.data.user).to.have.property('department');
      
      this.tokens.operator = response.data.tokens.token;

      this.testResults.push({
        test: '工厂用户登录',
        status: 'passed',
        responseTime: response.responseTime
      });

      console.log(chalk.green('  ✓ 工厂用户登录成功'));
      console.log(chalk.gray(`    工厂ID: ${response.data.user.factoryId}`));
      console.log(chalk.gray(`    角色: ${response.data.user.roleCode}`));
      return true;
    } catch (error) {
      this.testResults.push({
        test: '工厂用户登录',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 工厂用户登录失败:', error.message));
      throw error;
    }
  }

  // 测试用例：两阶段注册流程
  async testTwoPhaseRegistration() {
    console.log(chalk.blue('\n📝 测试：两阶段注册流程'));
    
    const testPhone = '13800000004';
    const testUsername = `test_user_${Date.now()}`;
    
    try {
      // 阶段1：手机验证
      console.log(chalk.gray('  阶段1: 手机号验证...'));
      const phase1Response = await this.apiRequest('/mobile/auth/register-phase-one', 'POST', {
        phoneNumber: testPhone,
        verificationType: 'registration'
      });

      // 验证阶段1响应
      expect(phase1Response.ok).to.be.true;
      expect(phase1Response.data).to.have.property('tempToken');
      expect(phase1Response.data).to.have.property('expiresIn');
      
      const tempToken = phase1Response.data.tempToken;
      console.log(chalk.green('    ✓ 手机验证通过，获得临时Token'));

      // 模拟验证码输入（测试环境固定验证码）
      const verificationCode = '123456';
      
      // 阶段2：完成注册
      console.log(chalk.gray('  阶段2: 完成注册...'));
      const phase2Response = await this.apiRequest('/mobile/auth/register-phase-two', 'POST', {
        tempToken,
        verificationCode,
        username: testUsername,
        password: 'Test@123456',
        fullName: '测试用户',
        department: 'quality',
        factoryId: testConfig.testFactory.factoryId,
        role: 'viewer'
      });

      // 验证阶段2响应
      expect(phase2Response.ok).to.be.true;
      expect(phase2Response.data).to.have.property('message');
      
      console.log(chalk.green('    ✓ 注册完成'));

      // 验证新用户可以登录
      console.log(chalk.gray('  验证: 新用户登录...'));
      const loginResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testUsername,
        password: 'Test@123456',
        deviceInfo: testConfig.testDevices[1]
      });

      expect(loginResponse.ok).to.be.true;
      expect(loginResponse.data.tokens).to.have.property('token');
      
      this.testResults.push({
        test: '两阶段注册流程',
        status: 'passed',
        details: '注册并登录成功'
      });

      console.log(chalk.green('  ✓ 两阶段注册流程测试通过'));
      return true;
    } catch (error) {
      this.testResults.push({
        test: '两阶段注册流程',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 两阶段注册失败:', error.message));
      return false;
    }
  }

  // 测试用例：Token刷新
  async testTokenRefresh() {
    console.log(chalk.blue('\n🔄 测试：Token刷新机制'));
    
    try {
      // 首先登录获取tokens
      const loginResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.viewer.username,
        password: testConfig.testAccounts.viewer.password,
        deviceInfo: testConfig.testDevices[0]
      });

      const refreshToken = loginResponse.data.tokens.refreshToken;
      
      // 使用refresh token获取新的access token
      const refreshResponse = await this.apiRequest('/mobile/auth/refresh-token', 'POST', {
        refreshToken
      });

      // 验证响应
      expect(refreshResponse.ok).to.be.true;
      expect(refreshResponse.data.tokens).to.have.property('token');
      expect(refreshResponse.data.tokens).to.have.property('refreshToken');
      
      // 验证新token可用
      const testResponse = await this.apiRequest(
        '/users/profile',
        'GET',
        null,
        refreshResponse.data.tokens.token
      );
      
      expect(testResponse.ok).to.be.true;

      this.testResults.push({
        test: 'Token刷新',
        status: 'passed',
        details: 'Token刷新成功，新Token有效'
      });

      console.log(chalk.green('  ✓ Token刷新机制正常'));
      return true;
    } catch (error) {
      this.testResults.push({
        test: 'Token刷新',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ Token刷新失败:', error.message));
      return false;
    }
  }

  // 测试用例：设备绑定
  async testDeviceBinding() {
    console.log(chalk.blue('\n📱 测试：设备绑定功能'));
    
    try {
      // 登录获取token
      const loginResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.factoryAdmin.username,
        password: testConfig.testAccounts.factoryAdmin.password,
        deviceInfo: testConfig.testDevices[0]
      });

      const token = loginResponse.data.tokens.token;
      
      // 绑定新设备
      const bindResponse = await this.apiRequest('/mobile/auth/bind-device', 'POST', {
        deviceId: `TEST_DEVICE_${Date.now()}`,
        deviceModel: 'Test Device Model',
        platform: 'android',
        osVersion: '14.0'
      }, token);

      // 验证响应
      expect(bindResponse.ok).to.be.true;
      expect(bindResponse.data).to.have.property('message');
      
      this.testResults.push({
        test: '设备绑定',
        status: 'passed',
        details: '设备绑定成功'
      });

      console.log(chalk.green('  ✓ 设备绑定功能正常'));
      return true;
    } catch (error) {
      this.testResults.push({
        test: '设备绑定',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 设备绑定失败:', error.message));
      return false;
    }
  }

  // 测试用例：无效凭据登录
  async testInvalidCredentials() {
    console.log(chalk.blue('\n🔒 测试：无效凭据处理'));
    
    try {
      // 错误的用户名
      const wrongUsernameResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: 'wrong_username',
        password: 'Wrong@123456',
        deviceInfo: testConfig.testDevices[0]
      });

      expect(wrongUsernameResponse.ok).to.be.false;
      expect(wrongUsernameResponse.status).to.equal(401);
      console.log(chalk.green('    ✓ 错误用户名正确拒绝'));

      // 错误的密码
      const wrongPasswordResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.platformAdmin.username,
        password: 'WrongPassword',
        deviceInfo: testConfig.testDevices[0]
      });

      expect(wrongPasswordResponse.ok).to.be.false;
      expect(wrongPasswordResponse.status).to.equal(401);
      console.log(chalk.green('    ✓ 错误密码正确拒绝'));

      this.testResults.push({
        test: '无效凭据处理',
        status: 'passed',
        details: '无效凭据正确拒绝'
      });

      console.log(chalk.green('  ✓ 无效凭据处理正常'));
      return true;
    } catch (error) {
      this.testResults.push({
        test: '无效凭据处理',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 无效凭据处理失败:', error.message));
      return false;
    }
  }

  // 测试用例：登出功能
  async testLogout() {
    console.log(chalk.blue('\n🚪 测试：登出功能'));
    
    try {
      // 先登录
      const loginResponse = await this.apiRequest('/mobile/auth/unified-login', 'POST', {
        username: testConfig.testAccounts.viewer.username,
        password: testConfig.testAccounts.viewer.password,
        deviceInfo: testConfig.testDevices[0]
      });

      const token = loginResponse.data.tokens.token;
      
      // 执行登出
      const logoutResponse = await this.apiRequest('/mobile/auth/logout', 'POST', {}, token);
      
      expect(logoutResponse.ok).to.be.true;
      console.log(chalk.green('    ✓ 登出请求成功'));

      // 验证token已失效
      const testResponse = await this.apiRequest('/users/profile', 'GET', null, token);
      expect(testResponse.ok).to.be.false;
      expect(testResponse.status).to.equal(401);
      console.log(chalk.green('    ✓ Token已失效'));

      this.testResults.push({
        test: '登出功能',
        status: 'passed',
        details: '登出成功，Token失效'
      });

      console.log(chalk.green('  ✓ 登出功能正常'));
      return true;
    } catch (error) {
      this.testResults.push({
        test: '登出功能',
        status: 'failed',
        error: error.message
      });
      console.log(chalk.red('  ✗ 登出功能失败:', error.message));
      return false;
    }
  }

  // 运行所有测试
  async runAllTests() {
    console.log(chalk.cyan.bold('\n🔐 认证系统集成测试\n'));
    console.log(chalk.gray('═'.repeat(50)));

    const startTime = Date.now();
    
    // 执行测试用例
    await this.testPlatformUserLogin();
    await this.testFactoryUserLogin();
    await this.testTwoPhaseRegistration();
    await this.testTokenRefresh();
    await this.testDeviceBinding();
    await this.testInvalidCredentials();
    await this.testLogout();

    const totalTime = Date.now() - startTime;

    // 生成测试报告
    this.generateReport(totalTime);
  }

  // 生成测试报告
  generateReport(totalTime) {
    console.log(chalk.gray('\n' + '═'.repeat(50)));
    console.log(chalk.cyan.bold('\n📊 测试结果汇总\n'));

    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;

    // 显示每个测试结果
    this.testResults.forEach(result => {
      const icon = result.status === 'passed' ? '✓' : '✗';
      const color = result.status === 'passed' ? chalk.green : chalk.red;
      console.log(color(`  ${icon} ${result.test}`));
      if (result.responseTime) {
        console.log(chalk.gray(`    响应时间: ${result.responseTime}ms`));
      }
      if (result.error) {
        console.log(chalk.red(`    错误: ${result.error}`));
      }
    });

    console.log(chalk.gray('\n' + '─'.repeat(50)));
    console.log(chalk.cyan('统计信息:'));
    console.log(chalk.white(`  总测试数: ${total}`));
    console.log(chalk.green(`  通过: ${passed}`));
    console.log(chalk.red(`  失败: ${failed}`));
    console.log(chalk.yellow(`  通过率: ${((passed / total) * 100).toFixed(1)}%`));
    console.log(chalk.gray(`  总耗时: ${(totalTime / 1000).toFixed(2)}秒`));

    if (failed === 0) {
      console.log(chalk.green.bold('\n✅ 认证系统集成测试全部通过！'));
    } else {
      console.log(chalk.red.bold(`\n❌ 有 ${failed} 个测试失败，请检查问题。`));
    }
  }
}

// 导出测试类
export default AuthenticationIntegrationTest;

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new AuthenticationIntegrationTest();
  test.runAllTests().catch(error => {
    console.error(chalk.red('测试执行错误:'), error);
    process.exit(1);
  });
}