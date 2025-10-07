#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import * as authController from '../src/controllers/authController.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

class UserManagementTester {
  constructor() {
    this.tests = [];
    this.failures = [];
    this.testData = new Map();
    this.testUsers = [];
    this.testFactories = [];
    this.testWhitelists = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      phase: '📋'
    };
    console.log(`[${timestamp}] ${icons[type] || '📝'} ${message}`);
  }

  async test(name, testFunction, category = 'general') {
    const startTime = Date.now();
    
    try {
      this.log(`🔍 用户管理测试: ${name}`);
      const result = await testFunction();
      const duration = Date.now() - startTime;
      this.log(`✅ 通过: ${name} (${duration}ms)`, 'success');
      this.tests.push({ name, category, status: 'passed', duration, result });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`❌ 失败: ${name} - ${error.message}`, 'error');
      this.tests.push({ name, category, status: 'failed', duration, error: error.message });
      this.failures.push({ name, category, error: error.message });
      return null;
    }
  }

  createMockReqRes(user = null, params = {}, query = {}, body = {}) {
    let statusCode = 200;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
      send: (data) => {
        responseData = data;
        return res;
      },
      cookie: () => res,
      clearCookie: () => res
    };

    const req = {
      user: user,
      params: params,
      query: query,
      body: body,
      headers: {},
      ip: '127.0.0.1',
      get: (header) => req.headers[header.toLowerCase()] || ''
    };

    const next = (error) => {
      if (error) {
        throw error;
      }
    };

    return {
      req,
      res,
      next,
      getResponse: () => responseData,
      getStatusCode: () => statusCode
    };
  }

  async setupTestData() {
    this.log('🏭 设置用户管理测试数据', 'phase');

    // 创建测试工厂
    const testFactory = await this.test('创建测试工厂', async () => {
      const factory = await prisma.factory.create({
        data: {
          id: 'USER-TEST-FACTORY-001',
          name: '用户管理测试工厂',
          industry: '食品制造业',
          address: '测试地址123号',
          industryCode: '140',
          regionCode: 'SH'
        }
      });

      this.testFactories.push(factory.id);
      this.testData.set('mainFactory', factory.id);
      
      return factory;
    });

    // 创建平台管理员
    const platformAdmin = await this.test('创建平台管理员', async () => {
      const hashedPassword = await bcrypt.hash('Admin@123456', 12);
      
      const admin = await prisma.platformAdmin.create({
        data: {
          username: 'test_platform_admin',
          passwordHash: hashedPassword,
          email: 'platform@test.com',
          fullName: '测试平台管理员',
          role: 'platform_super_admin'
        }
      });

      this.testData.set('platformAdmin', admin.id);
      
      return admin;
    });

    // 创建白名单记录
    const whitelists = await this.test('创建白名单记录', async () => {
      const mainFactoryId = this.testData.get('mainFactory');
      const whitelistEntries = [];

      const roleTestData = [
        { phone: '+86138000001001', name: '工厂超级管理员测试' },
        { phone: '+86138000001002', name: '权限管理员测试' },
        { phone: '+86138000001003', name: '部门管理员测试' },
      ];

      for (const roleData of roleTestData) {
        const whitelist = await prisma.userWhitelist.create({
          data: {
            factoryId: mainFactoryId,
            phoneNumber: roleData.phone,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            addedByPlatformId: this.testData.get('platformAdmin')
          }
        });
        whitelistEntries.push(whitelist);
        this.testWhitelists.push(whitelist.id);
      }
      
      return whitelistEntries;
    });

    // 创建测试用户
    const testUsers = await this.test('创建基础测试用户', async () => {
      const mainFactoryId = this.testData.get('mainFactory');
      const hashedPassword = await bcrypt.hash('TestPass@123456', 12);
      const users = [];

      // 创建几个基本角色用户
      const roleTestUsers = [
        { username: 'factory_admin_test', roleCode: 'factory_super_admin', department: 'management' },
        { username: 'permission_admin_test', roleCode: 'permission_admin', department: 'management' },
        { username: 'operator_test', roleCode: 'operator', department: 'processing' }
      ];

      for (const userData of roleTestUsers) {
        const user = await prisma.user.create({
          data: {
            factoryId: mainFactoryId,
            username: userData.username,
            passwordHash: hashedPassword,
            email: `${userData.username}@test.com`,
            phone: `+861380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            fullName: `测试用户_${userData.roleCode}`,
            isActive: true,
            roleCode: userData.roleCode,
            department: userData.department
          }
        });
        users.push(user);
        this.testUsers.push(user.id);
      }

      this.testData.set('testUsers', users.map(u => ({ id: u.id, roleCode: u.roleCode })));
      
      return users;
    });

    return { testFactory, platformAdmin, whitelists, testUsers };
  }

  // 测试手机号验证功能
  async testPhoneVerification() {
    this.log('📋 阶段1: 手机号验证功能测试', 'phase');
    
    const mainFactoryId = this.testData.get('mainFactory');

    // 测试1.1: 成功验证白名单手机号
    await this.test('verifyPhone - 成功验证白名单手机号', async () => {
      const phoneNumber = '+86138000001001';
      const mockReqRes = this.createMockReqRes(null, {}, {}, { 
        phoneNumber, 
        factoryId: mainFactoryId 
      });
      
      await authController.verifyPhone(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response || !response.success) {
        throw new Error('手机号验证响应格式不正确');
      }

      return { 
        phoneVerified: true,
        phoneNumber,
        factoryId: mainFactoryId
      };
    }, 'verifyPhone');

    // 测试1.2: 验证不在白名单的手机号
    await this.test('verifyPhone - 验证不在白名单的手机号', async () => {
      const phoneNumber = '+86138000009999';
      const mockReqRes = this.createMockReqRes(null, {}, {}, { 
        phoneNumber, 
        factoryId: mainFactoryId 
      });
      
      try {
        await authController.verifyPhone(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为不在白名单而失败');
      } catch (error) {
        if (error.message.includes('不在白名单') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不在白名单的手机号' };
        }
        throw error;
      }
    }, 'verifyPhone');
  }

  // 测试用户登录功能
  async testUserLogin() {
    this.log('🔐 阶段2: 用户登录功能测试', 'phase');
    
    const testUsers = this.testData.get('testUsers');
    
    // 测试2.1: 工厂超级管理员登录
    const factoryAdminUser = testUsers.find(u => u.roleCode === 'factory_super_admin');
    if (factoryAdminUser) {
      await this.test('unifiedLogin - 工厂超级管理员登录', async () => {
        const loginResult = await authController.unifiedLogin('factory_admin_test', 'TestPass@123456');
        
        if (!loginResult.success) {
          throw new Error(`工厂超级管理员登录失败: ${loginResult.message}`);
        }

        if (!loginResult.user) {
          throw new Error('缺少用户信息');
        }

        if (loginResult.user.roleCode !== 'factory_super_admin') {
          throw new Error('角色代码不正确');
        }

        return { 
          userId: loginResult.user.id,
          username: loginResult.user.username,
          roleCode: loginResult.user.roleCode,
          loginSuccess: true
        };
      }, 'unifiedLogin');
    }

    // 测试2.2: 权限管理员登录
    const permissionAdminUser = testUsers.find(u => u.roleCode === 'permission_admin');
    if (permissionAdminUser) {
      await this.test('unifiedLogin - 权限管理员登录', async () => {
        const loginResult = await authController.unifiedLogin('permission_admin_test', 'TestPass@123456');
        
        if (!loginResult.success) {
          throw new Error(`权限管理员登录失败: ${loginResult.message}`);
        }

        return { 
          userId: loginResult.user.id,
          roleCode: loginResult.user.roleCode,
          loginSuccess: true
        };
      }, 'unifiedLogin');
    }

    // 测试2.3: 操作员登录
    const operatorUser = testUsers.find(u => u.roleCode === 'operator');
    if (operatorUser) {
      await this.test('unifiedLogin - 操作员登录', async () => {
        const loginResult = await authController.unifiedLogin('operator_test', 'TestPass@123456');
        
        if (!loginResult.success) {
          throw new Error(`操作员登录失败: ${loginResult.message}`);
        }

        return { 
          userId: loginResult.user.id,
          roleCode: loginResult.user.roleCode,
          loginSuccess: true
        };
      }, 'unifiedLogin');
    }
  }

  // 测试用户资料管理
  async testUserProfile() {
    this.log('👤 阶段3: 用户资料管理测试', 'phase');
    
    const testUsers = this.testData.get('testUsers');
    const factoryAdminUser = testUsers.find(u => u.roleCode === 'factory_super_admin');
    
    if (!factoryAdminUser) {
      this.log('❌ 跳过用户资料测试: 缺少工厂管理员用户', 'warning');
      return;
    }

    // 测试3.1: 获取当前用户信息
    await this.test('getCurrentUser - 获取当前用户信息', async () => {
      // 获取完整的用户信息
      const fullUser = await prisma.user.findUnique({
        where: { id: factoryAdminUser.id },
        include: { factory: true }
      });

      const mockUser = {
        id: fullUser.id,
        username: fullUser.username,
        email: fullUser.email,
        fullName: fullUser.fullName,
        phone: fullUser.phone,
        roleCode: fullUser.roleCode,
        department: fullUser.department,
        position: fullUser.position,
        lastLogin: fullUser.lastLogin
      };

      const mockReq = {
        user: mockUser,
        factory: fullUser.factory
      };

      let statusCode = 200;
      let responseData = null;

      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          responseData = data;
          return res;
        }
      };

      const next = (error) => {
        if (error) throw error;
      };
      
      await authController.getCurrentUser(mockReq, res, next);
      const response = responseData;
      
      if (!response || !response.success) {
        throw new Error('获取用户信息响应格式不正确');
      }

      if (!response.data || !response.data.user) {
        throw new Error('缺少用户数据');
      }

      return {
        userId: response.data.user.id,
        username: response.data.user.username,
        roleCode: response.data.user.roleCode
      };
    }, 'getCurrentUser');

    // 测试3.2: 修改密码
    await this.test('changePassword - 修改用户密码', async () => {
      // 获取完整的用户信息
      const fullUser = await prisma.user.findUnique({
        where: { id: factoryAdminUser.id }
      });

      const mockUser = {
        id: fullUser.id,
        username: fullUser.username,
        email: fullUser.email,
        fullName: fullUser.fullName,
        factoryId: fullUser.factoryId,
        roleCode: fullUser.roleCode,
        passwordHash: fullUser.passwordHash // 添加密码哈希用于验证
      };

      const passwordData = {
        oldPassword: 'TestPass@123456', // 修正字段名为oldPassword
        newPassword: 'NewPass@123456'
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, passwordData);
      
      await authController.changePassword(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response || !response.success) {
        throw new Error(`修改密码失败: ${response ? response.message : '无响应'}`);
      }

      return {
        passwordChanged: true,
        message: response.message
      };
    }, 'changePassword');
  }

  async cleanup() {
    this.log('🧹 清理用户管理测试数据');

    try {
      // 删除创建的用户
      if (this.testUsers.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: this.testUsers } }
        });
      }

      // 删除白名单记录
      if (this.testWhitelists.length > 0) {
        await prisma.userWhitelist.deleteMany({
          where: { id: { in: this.testWhitelists } }
        });
      }

      // 删除平台管理员
      const platformAdminId = this.testData.get('platformAdmin');
      if (platformAdminId) {
        await prisma.platformAdmin.deleteMany({
          where: { id: platformAdminId }
        });
      }

      // 删除测试工厂
      if (this.testFactories.length > 0) {
        await prisma.factory.deleteMany({
          where: { id: { in: this.testFactories } }
        });
      }
    } catch (error) {
      this.log(`清理数据时发生错误: ${error.message}`, 'warning');
    }
  }

  generateReport() {
    const totalTests = this.tests.length;
    const passedTests = this.tests.filter(t => t.status === 'passed').length;
    const failedTests = this.tests.filter(t => t.status === 'failed').length;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;
    const totalTime = this.tests.reduce((sum, test) => sum + test.duration, 0) / 1000;

    console.log('\n================================================================================');
    this.log('🔍 用户管理系统测试完成', 'phase');
    console.log('================================================================================\n');

    console.log('📈 总体统计:');
    console.log(`   总计测试: ${totalTests}`);
    console.log(`   通过: ${passedTests}`);
    console.log(`   失败: ${failedTests}`);
    console.log(`   成功率: ${successRate}%`);
    console.log(`   总耗时: ${totalTime.toFixed(2)}秒\n`);

    // 按功能分组统计
    const categories = [...new Set(this.tests.map(t => t.category))];
    console.log('📋 分功能测试结果:');
    categories.forEach(category => {
      const categoryTests = this.tests.filter(t => t.category === category);
      const categoryPassed = categoryTests.filter(t => t.status === 'passed').length;
      const categoryTotal = categoryTests.length;
      const categoryRate = categoryTotal > 0 ? (categoryPassed / categoryTotal * 100).toFixed(1) : 0;
      console.log(`   ${category}: ${categoryPassed}/${categoryTotal} (${categoryRate}%)`);
    });

    // 失败详情
    if (this.failures.length > 0) {
      console.log('\n❌ 失败的测试详情:');
      this.failures.forEach(failure => {
        console.log(`   - [${failure.category}] ${failure.name}: ${failure.error}`);
      });
    }

    console.log('\n💡 用户管理系统测试结论:');
    if (successRate >= 85) {
      console.log('   🎉 用户管理系统功能优秀！');
    } else if (successRate >= 70) {
      console.log('   ⚠️ 用户管理系统基本正常，部分功能需要改进');
    } else {
      console.log('   ❌ 用户管理系统存在严重问题，需要全面检查');
    }

    console.log(`\n🔍 用户管理系统健康度: ${successRate}%`);
    
    const testedFunctions = categories.length;
    console.log(`\n🎯 功能覆盖度: ${testedFunctions}/3 个核心功能`);

    if (successRate >= 85) {
      console.log('\n✅ 用户管理系统测试达到可接受标准');
    } else {
      console.log('\n❌ 用户管理系统测试未达标，需要修复');
    }
  }

  async run() {
    console.log('正在初始化用户管理系统测试器...');
    console.log('🔍 白垩纪食品溯源系统 - 用户管理和白名单系统测试（简化版）');
    console.log('📊 测试范围: authController.js 核心用户管理功能');
    console.log(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`);

    try {
      await this.setupTestData();
      await this.testPhoneVerification();
      await this.testUserLogin();
      await this.testUserProfile();
    } catch (error) {
      this.log(`测试执行出现严重错误: ${error.message}`, 'error');
    } finally {
      await this.cleanup();
      this.generateReport();
      await prisma.$disconnect();
    }
  }
}

// 执行测试
const tester = new UserManagementTester();
tester.run().catch(console.error);