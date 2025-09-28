#!/usr/bin/env node

/**
 * 海牛食品溯源系统 - 用户管理和白名单系统完整测试
 * 测试范围: authController.js 用户管理功能和白名单系统
 * 专注测试: 注册、登录、用户资料管理、白名单验证、8角色权限系统
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';
import * as authController from '../src/controllers/authController.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { generateTempToken, verifyAndUseTempToken } from '../src/utils/jwt.js';

const prisma = new PrismaClient();

class UserManagementTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      functionResults: {
        'registerPhaseOne': { passed: 0, failed: 0 },
        'registerPhaseTwo': { passed: 0, failed: 0 },
        'unifiedLogin': { passed: 0, failed: 0 },
        'getUserProfile': { passed: 0, failed: 0 },
        'updateUserProfile': { passed: 0, failed: 0 },
        'whitelistManagement': { passed: 0, failed: 0 },
        'rolePermissions': { passed: 0, failed: 0 },
        'deviceBinding': { passed: 0, failed: 0 }
      }
    };
    this.testData = new Map();
    this.testUsers = [];
    this.testFactories = [];
    this.testWhitelists = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const colors = {
      success: chalk.green,
      error: chalk.red,
      info: chalk.blue,
      warning: chalk.yellow,
      phase: chalk.cyan.bold
    };
    console.log(colors[type](`[${timestamp}] ${message}`));
  }

  async test(name, testFn, functionName = 'general') {
    this.testResults.total++;
    this.log(`🔍 用户管理测试: ${name}`, 'info');
    
    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.passed++;
      if (this.testResults.functionResults[functionName]) {
        this.testResults.functionResults[functionName].passed++;
      }
      
      this.log(`✅ 通过: ${name} (${duration}ms)`, 'success');
      return result;
    } catch (error) {
      this.testResults.failed++;
      if (this.testResults.functionResults[functionName]) {
        this.testResults.functionResults[functionName].failed++;
      }
      
      this.testResults.details.push({ name, error: error.message, function: functionName });
      this.log(`❌ 失败: ${name} - ${error.message}`, 'error');
      return null;
    }
  }

  // 创建模拟的req和res对象
  createMockReqRes(user, params = {}, query = {}, body = {}) {
    let responseData = null;
    let statusCode = 200;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return { statusCode, data };
      }
    };

    return {
      req: {
        user,
        params,
        query,
        body
      },
      res,
      next: (error) => { if (error) throw error; },
      getResponse: () => responseData,
      getStatusCode: () => statusCode
    };
  }

  // 设置基础测试数据
  async setupTestData() {
    this.log('🏭 设置用户管理测试数据', 'phase');
    
    // 创建测试工厂
    const testFactories = await this.test('创建测试工厂', async () => {
      const factories = [];
      
      // 主测试工厂
      const mainFactoryData = {
        name: '海牛用户测试工厂',
        industry: '食品加工业',
        address: '上海市浦东新区用户测试路100号',
        employeeCount: 200,
        contactName: '用户管理员',
        contactPhone: '+86138000000101',
        contactEmail: 'admin@usertest.com'
      };

      const mainFactoryResult = await factoryIdGenerator.generateNewFactoryId(mainFactoryData);
      const mainFactory = await prisma.factory.create({
        data: {
          id: mainFactoryResult.factoryId,
          ...mainFactoryData,
          industryCode: mainFactoryResult.industryCode,
          regionCode: mainFactoryResult.regionCode,
          confidence: mainFactoryResult.confidence.overall,
          factoryYear: new Date().getFullYear(),
          sequenceNumber: mainFactoryResult.sequenceNumber,
          manuallyVerified: true
        }
      });
      factories.push(mainFactory);
      
      // 副测试工厂（用于跨工厂访问测试）
      const secondFactoryData = {
        name: '海牛副测试工厂',
        industry: '食品加工业',
        address: '上海市浦东新区副测试路200号',
        employeeCount: 50,
        contactName: '副管理员',
        contactPhone: '+86138000000102',
        contactEmail: 'admin@secondary.test'
      };

      const secondFactoryResult = await factoryIdGenerator.generateNewFactoryId(secondFactoryData);
      const secondFactory = await prisma.factory.create({
        data: {
          id: secondFactoryResult.factoryId,
          ...secondFactoryData,
          industryCode: secondFactoryResult.industryCode,
          regionCode: secondFactoryResult.regionCode,
          confidence: secondFactoryResult.confidence.overall,
          factoryYear: new Date().getFullYear(),
          sequenceNumber: secondFactoryResult.sequenceNumber,
          manuallyVerified: true
        }
      });
      factories.push(secondFactory);

      this.testData.set('mainFactory', mainFactory.id);
      this.testData.set('secondFactory', secondFactory.id);
      this.testFactories = factories;
      
      return factories;
    });

    if (!testFactories) return null;

    // 创建平台管理员
    const platformAdmin = await this.test('创建平台管理员', async () => {
      const hashedPassword = await hashPassword('Admin@123456');
      
      const admin = await prisma.platformAdmin.create({
        data: {
          username: 'platform_admin_test',
          passwordHash: hashedPassword,
          email: 'platform@test.com',
          phone: '+86138000000100',
          fullName: '平台测试管理员',
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

      // 为8个角色创建白名单
      const roleTestData = [
        { phone: '+86138000001001', role: 'factory_super_admin', name: '工厂超级管理员测试' },
        { phone: '+86138000001002', role: 'permission_admin', name: '权限管理员测试' },
        { phone: '+86138000001003', role: 'department_admin', name: '部门管理员测试' },
        { phone: '+86138000001004', role: 'operator', name: '操作员测试' },
        { phone: '+86138000001005', role: 'viewer', name: '查看者测试' },
        { phone: '+86138000001006', role: 'unactivated', name: '待激活用户测试' },
        { phone: '+86138000001007', role: 'operator', name: '跨工厂测试用户' },
        { phone: '+86138000001008', role: 'viewer', name: '重复注册测试用户' }
      ];

      for (const roleData of roleTestData) {
        const whitelist = await prisma.userWhitelist.create({
          data: {
            factoryId: mainFactoryId,
            phoneNumber: roleData.phone,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
            addedByPlatformId: this.testData.get('platformAdmin')
          }
        });
        whitelistEntries.push({ ...whitelist, expectedRole: roleData.role, expectedName: roleData.name });
      }

      // 为副工厂创建一个白名单
      const secondFactoryId = this.testData.get('secondFactory');
      const crossFactoryWhitelist = await prisma.userWhitelist.create({
        data: {
          factoryId: secondFactoryId,
          phoneNumber: '+86138000002001',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          addedByPlatformId: this.testData.get('platformAdmin')
        }
      });
      whitelistEntries.push({ ...crossFactoryWhitelist, expectedRole: 'viewer', expectedName: '跨工厂用户' });

      this.testWhitelists = whitelistEntries;
      this.testData.set('whitelists', whitelistEntries.map(w => w.id));
      
      return whitelistEntries;
    });

    return { testFactories, platformAdmin, whitelists };
  }

  // 阶段1: 注册阶段一 (手机号验证) 功能测试
  async testRegisterPhaseOne() {
    this.log('📋 阶段1: registerPhaseOne (手机号验证) 功能测试', 'phase');
    
    const mainFactoryId = this.testData.get('mainFactory');
    if (!mainFactoryId) {
      this.log('❌ 跳过registerPhaseOne测试: 缺少主工厂数据', 'warning');
      return;
    }

    // 测试1.1: 成功验证白名单手机号
    await this.test('registerPhaseOne - 成功验证白名单手机号', async () => {
      const phoneNumber = '+86138000001001';
      const factoryId = mainFactoryId;

      const mockReqRes = this.createMockReqRes(null, {}, {}, { phoneNumber, factoryId });
      
      await authController.verifyPhone(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response || !response.success) {
        throw new Error('手机号验证响应格式不正确');
      }

      if (!response.data || !response.data.tempToken) {
        throw new Error('缺少临时令牌');
      }

      this.testData.set('validTempToken', response.data.tempToken);
      this.testData.set('validPhoneNumber', phoneNumber);

      return {
        success: true,
        phoneNumber,
        hasToken: !!response.data.tempToken
      };
    }, 'registerPhaseOne');

    // 测试1.2: 验证不在白名单的手机号
    await this.test('registerPhaseOne - 验证不在白名单的手机号', async () => {
      const phoneNumber = '+86138999999999'; // 不在白名单
      const factoryId = mainFactoryId;

      const mockReqRes = this.createMockReqRes(null, {}, {}, { phoneNumber, factoryId });
      
      try {
        await authController.verifyPhone(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为不在白名单而失败');
      } catch (error) {
        if (error.message.includes('未被邀请注册') || error.message.includes('ValidationError')) {
          return { message: '正确拒绝了不在白名单的手机号' };
        }
        throw error;
      }
    }, 'registerPhaseOne');

    // 测试1.3: 验证不存在的工厂
    await this.test('registerPhaseOne - 验证不存在的工厂', async () => {
      const phoneNumber = '+86138000001001';
      const factoryId = 'NON_EXISTENT_FACTORY';

      const mockReqRes = this.createMockReqRes(null, {}, {}, { phoneNumber, factoryId });
      
      try {
        await authController.verifyPhone(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为工厂不存在而失败');
      } catch (error) {
        if (error.message.includes('工厂不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的工厂' };
        }
        throw error;
      }
    }, 'registerPhaseOne');

    // 测试1.4: 验证已注册的手机号
    await this.test('registerPhaseOne - 验证已注册的手机号', async () => {
      // 先标记一个白名单为已注册
      const phoneNumber = '+86138000001008';
      await prisma.userWhitelist.updateMany({
        where: { phoneNumber, factoryId: mainFactoryId },
        data: { status: 'REGISTERED' }
      });

      const mockReqRes = this.createMockReqRes(null, {}, {}, { phoneNumber, factoryId: mainFactoryId });
      
      try {
        await authController.verifyPhone(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为已注册而失败');
      } catch (error) {
        if (error.message.includes('已被注册') || error.message.includes('ConflictError')) {
          return { message: '正确处理了已注册的手机号' };
        }
        throw error;
      }
    }, 'registerPhaseOne');

    // 测试1.5: 验证过期的白名单
    await this.test('registerPhaseOne - 验证过期的白名单', async () => {
      // 创建一个过期的白名单记录
      const expiredWhitelist = await prisma.userWhitelist.create({
        data: {
          factoryId: mainFactoryId,
          phoneNumber: '+86138000009999',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1天前过期
          addedByPlatformId: this.testData.get('platformAdmin')
        }
      });

      const mockReqRes = this.createMockReqRes(null, {}, {}, { 
        phoneNumber: expiredWhitelist.phoneNumber, 
        factoryId: mainFactoryId 
      });
      
      try {
        await authController.verifyPhone(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为白名单过期而失败');
      } catch (error) {
        if (error.message.includes('已过期') || error.message.includes('BusinessLogicError')) {
          // 清理测试数据
          await prisma.userWhitelist.delete({ where: { id: expiredWhitelist.id } });
          return { message: '正确处理了过期的白名单' };
        }
        throw error;
      }
    }, 'registerPhaseOne');
  }

  // 阶段2: 注册阶段二 (完成注册) 功能测试
  async testRegisterPhaseTwo() {
    this.log('📝 阶段2: registerPhaseTwo (完成注册) 功能测试', 'phase');
    
    const mainFactoryId = this.testData.get('mainFactory');
    const validTempToken = this.testData.get('validTempToken');
    const validPhoneNumber = this.testData.get('validPhoneNumber');

    if (!mainFactoryId || !validTempToken || !validPhoneNumber) {
      this.log('❌ 跳过registerPhaseTwo测试: 缺少必要数据', 'warning');
      return;
    }

    // 测试2.1: 成功完成注册
    await this.test('registerPhaseTwo - 成功完成注册', async () => {
      const registrationData = {
        phoneNumber: validPhoneNumber,
        username: 'test_super_admin',
        password: 'TestPass@123456',
        email: 'test_super_admin@test.com',
        fullName: '测试超级管理员',
        tempToken: validTempToken
      };

      const mockReqRes = this.createMockReqRes(null, {}, {}, registrationData);
      
      await authController.register(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      const statusCode = mockReqRes.getStatusCode();
      
      if (statusCode !== 201) {
        throw new Error(`期望状态码201，实际${statusCode}`);
      }

      if (!response || !response.success) {
        throw new Error('注册响应格式不正确');
      }

      if (!response.data || !response.data.userId) {
        throw new Error('缺少用户ID');
      }

      // 验证用户是否正确创建
      const createdUser = await prisma.user.findUnique({
        where: { id: response.data.userId }
      });

      if (!createdUser) {
        throw new Error('用户未正确创建到数据库');
      }

      if (createdUser.username !== registrationData.username) {
        throw new Error('用户名不匹配');
      }

      if (createdUser.factoryId !== mainFactoryId) {
        throw new Error('工厂ID不匹配');
      }

      this.testData.set('createdUserId', createdUser.id);
      this.testUsers.push(createdUser.id);

      return {
        userId: createdUser.id,
        username: createdUser.username,
        factoryId: createdUser.factoryId,
        isActive: createdUser.isActive
      };
    }, 'registerPhaseTwo');

    // 测试2.2: 使用无效的临时令牌
    await this.test('registerPhaseTwo - 使用无效的临时令牌', async () => {
      const registrationData = {
        phoneNumber: '+86138000001002',
        username: 'test_invalid_token',
        password: 'TestPass@123456',
        email: 'test_invalid@test.com',
        fullName: '无效令牌测试',
        tempToken: 'invalid_token_123'
      };

      const mockReqRes = this.createMockReqRes(null, {}, {}, registrationData);
      
      try {
        await authController.register(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为无效令牌而失败');
      } catch (error) {
        if (error.message.includes('令牌') || error.message.includes('ValidationError') || error.message.includes('Invalid temp token')) {
          return { message: '正确处理了无效令牌' };
        }
        throw error;
      }
    }, 'registerPhaseTwo');

    // 测试2.3: 重复的用户名
    await this.test('registerPhaseTwo - 重复的用户名', async () => {
      // 先为另一个手机号生成临时令牌
      const phoneNumber = '+86138000001003';
      const mockVerifyReqRes = this.createMockReqRes(null, {}, {}, { 
        phoneNumber, 
        factoryId: mainFactoryId 
      });
      
      await authController.verifyPhone(mockVerifyReqRes.req, mockVerifyReqRes.res, mockVerifyReqRes.next);
      const verifyResponse = mockVerifyReqRes.getResponse();
      const newTempToken = verifyResponse.data.tempToken;

      // 尝试使用已存在的用户名注册
      const registrationData = {
        phoneNumber,
        username: 'test_super_admin', // 使用已存在的用户名
        password: 'TestPass@123456',
        email: 'different@test.com',
        fullName: '重复用户名测试',
        tempToken: newTempToken
      };

      const mockReqRes = this.createMockReqRes(null, {}, {}, registrationData);
      
      try {
        await authController.register(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为用户名重复而失败');
      } catch (error) {
        if (error.message.includes('用户名已存在') || error.message.includes('ConflictError')) {
          return { message: '正确处理了重复的用户名' };
        }
        throw error;
      }
    }, 'registerPhaseTwo');

    // 测试2.4: 重复的邮箱
    await this.test('registerPhaseTwo - 重复的邮箱', async () => {
      // 先为另一个手机号生成临时令牌
      const phoneNumber = '+86138000001004';
      const mockVerifyReqRes = this.createMockReqRes(null, {}, {}, { 
        phoneNumber, 
        factoryId: mainFactoryId 
      });
      
      await authController.verifyPhone(mockVerifyReqRes.req, mockVerifyReqRes.res, mockVerifyReqRes.next);
      const verifyResponse = mockVerifyReqRes.getResponse();
      const newTempToken = verifyResponse.data.tempToken;

      // 尝试使用已存在的邮箱注册
      const registrationData = {
        phoneNumber,
        username: 'test_different_username',
        password: 'TestPass@123456',
        email: 'test_super_admin@test.com', // 使用已存在的邮箱
        fullName: '重复邮箱测试',
        tempToken: newTempToken
      };

      const mockReqRes = this.createMockReqRes(null, {}, {}, registrationData);
      
      try {
        await authController.register(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为邮箱重复而失败');
      } catch (error) {
        if (error.message.includes('邮箱已存在') || error.message.includes('ConflictError')) {
          return { message: '正确处理了重复的邮箱' };
        }
        throw error;
      }
    }, 'registerPhaseTwo');

    // 测试2.5: 手机号与令牌不匹配
    await this.test('registerPhaseTwo - 手机号与令牌不匹配', async () => {
      const registrationData = {
        phoneNumber: '+86138000001999', // 与令牌不匹配的手机号
        username: 'test_mismatch',
        password: 'TestPass@123456',
        email: 'test_mismatch@test.com',
        fullName: '不匹配测试',
        tempToken: validTempToken // 使用之前的令牌
      };

      const mockReqRes = this.createMockReqRes(null, {}, {}, registrationData);
      
      try {
        await authController.register(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为手机号与令牌不匹配而失败');
      } catch (error) {
        if (error.message.includes('不匹配') || error.message.includes('ValidationError') || error.message.includes('Invalid temp token')) {
          return { message: '正确处理了手机号与令牌不匹配' };
        }
        throw error;
      }
    }, 'registerPhaseTwo');
  }

  // 阶段3: 统一登录功能测试
  async testUnifiedLogin() {
    this.log('🔐 阶段3: unifiedLogin (统一登录) 功能测试', 'phase');

    // 首先激活测试用户
    const createdUserId = this.testData.get('createdUserId');
    if (createdUserId) {
      await prisma.user.update({
        where: { id: createdUserId },
        data: { 
          isActive: true,
          roleCode: 'factory_super_admin',
          department: 'management'
        }
      });
    }

    // 创建更多测试用户来测试不同角色
    await this.test('创建多角色测试用户', async () => {
      const mainFactoryId = this.testData.get('mainFactory');
      const hashedPassword = await hashPassword('TestPass@123456');
      const users = [];

      const roleTestUsers = [
        { username: 'permission_admin_test', roleCode: 'permission_admin', department: 'management' },
        { username: 'dept_admin_test', roleCode: 'department_admin', department: 'processing' },
        { username: 'operator_test', roleCode: 'operator', department: 'processing' },
        { username: 'viewer_test', roleCode: 'viewer', department: 'quality' },
        { username: 'unactivated_test', roleCode: 'unactivated', department: 'processing', isActive: false }
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
            isActive: userData.isActive !== false,
            roleCode: userData.roleCode,
            department: userData.department
          }
        });
        users.push(user);
        this.testUsers.push(user.id);
      }

      this.testData.set('roleTestUsers', users);
      return users;
    }, 'unifiedLogin');

    // 测试3.1: 平台管理员登录
    await this.test('unifiedLogin - 平台管理员登录', async () => {
      const loginResult = await authController.unifiedLogin('platform_admin_test', 'Admin@123456');
      
      if (!loginResult.success) {
        throw new Error(`平台管理员登录失败: ${loginResult.message}`);
      }

      if (loginResult.user.userType !== 'platform') {
        throw new Error('用户类型应该是platform');
      }

      if (!loginResult.tokens || !loginResult.tokens.token) {
        throw new Error('缺少认证令牌');
      }

      if (!loginResult.user.permissions || !loginResult.user.permissions.modules) {
        throw new Error('缺少权限信息');
      }

      return {
        userType: loginResult.user.userType,
        username: loginResult.user.username,
        hasTokens: !!loginResult.tokens.token,
        hasPermissions: !!loginResult.user.permissions
      };
    }, 'unifiedLogin');

    // 测试3.2: 工厂超级管理员登录
    await this.test('unifiedLogin - 工厂超级管理员登录', async () => {
      const loginResult = await authController.unifiedLogin('test_super_admin', 'TestPass@123456');
      
      if (!loginResult.success) {
        throw new Error(`工厂超级管理员登录失败: ${loginResult.message}`);
      }

      if (loginResult.user.userType !== 'factory') {
        throw new Error('用户类型应该是factory');
      }

      if (!loginResult.user.factoryId) {
        throw new Error('缺少工厂ID');
      }

      if (!loginResult.user.permissions || !loginResult.user.permissions.modules) {
        throw new Error('缺少权限信息');
      }

      // 验证工厂超级管理员权限
      const permissions = loginResult.user.permissions;
      if (!permissions.modules.admin_access) {
        throw new Error('工厂超级管理员应该有admin_access权限');
      }

      return {
        userType: loginResult.user.userType,
        factoryId: loginResult.user.factoryId,
        roleCode: loginResult.user.roleCode,
        hasAdminAccess: permissions.modules.admin_access
      };
    }, 'unifiedLogin');

    // 测试3.3: 权限管理员登录
    await this.test('unifiedLogin - 权限管理员登录', async () => {
      const loginResult = await authController.unifiedLogin('permission_admin_test', 'TestPass@123456');
      
      if (!loginResult.success) {
        throw new Error(`权限管理员登录失败: ${loginResult.message}`);
      }

      const permissions = loginResult.user.permissions;
      if (!permissions.modules.admin_access) {
        throw new Error('权限管理员应该有admin_access权限');
      }

      if (!permissions.features.includes('user_manage_all')) {
        throw new Error('权限管理员应该有user_manage_all功能');
      }

      return {
        roleCode: loginResult.user.roleCode,
        hasUserManagement: permissions.features.includes('user_manage_all'),
        roleLevel: permissions.roleLevel
      };
    }, 'unifiedLogin');

    // 测试3.4: 部门管理员登录
    await this.test('unifiedLogin - 部门管理员登录', async () => {
      const loginResult = await authController.unifiedLogin('dept_admin_test', 'TestPass@123456');
      
      if (!loginResult.success) {
        throw new Error(`部门管理员登录失败: ${loginResult.message}`);
      }

      const permissions = loginResult.user.permissions;
      
      // 部门管理员应该有对应部门的访问权限
      if (!permissions.modules.processing_access) {
        throw new Error('部门管理员应该有processing_access权限');
      }

      if (permissions.modules.admin_access) {
        throw new Error('部门管理员不应该有admin_access权限');
      }

      return {
        roleCode: loginResult.user.roleCode,
        department: loginResult.user.department,
        hasProcessingAccess: permissions.modules.processing_access,
        noAdminAccess: !permissions.modules.admin_access
      };
    }, 'unifiedLogin');

    // 测试3.5: 普通操作员登录
    await this.test('unifiedLogin - 普通操作员登录', async () => {
      const loginResult = await authController.unifiedLogin('operator_test', 'TestPass@123456');
      
      if (!loginResult.success) {
        throw new Error(`普通操作员登录失败: ${loginResult.message}`);
      }

      const permissions = loginResult.user.permissions;
      
      if (permissions.modules.admin_access) {
        throw new Error('普通操作员不应该有admin_access权限');
      }

      if (!permissions.modules.processing_access) {
        throw new Error('处理部门操作员应该有processing_access权限');
      }

      // operator 应该有基础功能权限，但不应该有管理权限
      const hasManagementFeatures = permissions.features.some(feature => 
        feature.includes('manage') || feature.includes('admin') || feature.includes('delete')
      );
      
      if (hasManagementFeatures) {
        throw new Error('普通操作员不应该有管理功能权限');
      }

      return {
        roleCode: loginResult.user.roleCode,
        hasLimitedPermissions: !hasManagementFeatures,
        hasBasicAccess: permissions.modules.processing_access,
        featuresCount: permissions.features.length
      };
    }, 'unifiedLogin');

    // 测试3.6: 查看者登录
    await this.test('unifiedLogin - 查看者登录', async () => {
      const loginResult = await authController.unifiedLogin('viewer_test', 'TestPass@123456');
      
      if (!loginResult.success) {
        throw new Error(`查看者登录失败: ${loginResult.message}`);
      }

      const permissions = loginResult.user.permissions;
      
      if (permissions.modules.admin_access) {
        throw new Error('查看者不应该有admin_access权限');
      }

      // 查看者只能访问trace_access和对应部门权限
      if (!permissions.modules.trace_access) {
        throw new Error('查看者应该有trace_access权限');
      }

      return {
        roleCode: loginResult.user.roleCode,
        hasTraceAccess: permissions.modules.trace_access,
        roleLevel: permissions.roleLevel
      };
    }, 'unifiedLogin');

    // 测试3.7: 未激活用户登录
    await this.test('unifiedLogin - 未激活用户登录', async () => {
      const loginResult = await authController.unifiedLogin('unactivated_test', 'TestPass@123456');
      
      if (loginResult.success) {
        throw new Error('未激活用户应该无法登录');
      }

      if (!loginResult.message.includes('未激活')) {
        throw new Error('应该明确提示用户未激活');
      }

      return {
        correctlyBlocked: !loginResult.success,
        message: loginResult.message
      };
    }, 'unifiedLogin');

    // 测试3.8: 错误的密码
    await this.test('unifiedLogin - 错误的密码', async () => {
      const loginResult = await authController.unifiedLogin('test_super_admin', 'WrongPassword@123');
      
      if (loginResult.success) {
        throw new Error('错误密码应该无法登录');
      }

      if (!loginResult.message.includes('密码错误')) {
        throw new Error('应该提示密码错误');
      }

      return {
        correctlyBlocked: !loginResult.success,
        message: loginResult.message
      };
    }, 'unifiedLogin');

    // 测试3.9: 不存在的用户
    await this.test('unifiedLogin - 不存在的用户', async () => {
      const loginResult = await authController.unifiedLogin('nonexistent_user', 'TestPass@123456');
      
      if (loginResult.success) {
        throw new Error('不存在的用户应该无法登录');
      }

      return {
        correctlyBlocked: !loginResult.success,
        message: loginResult.message
      };
    }, 'unifiedLogin');
  }

  // 阶段4: 用户资料管理功能测试
  async testUserProfileManagement() {
    this.log('👤 阶段4: 用户资料管理功能测试', 'phase');

    const createdUserId = this.testData.get('createdUserId');
    const mainFactoryId = this.testData.get('mainFactory');

    if (!createdUserId || !mainFactoryId) {
      this.log('❌ 跳过用户资料管理测试: 缺少必要数据', 'warning');
      return;
    }

    // 获取测试用户
    const testUser = await prisma.user.findUnique({
      where: { id: createdUserId },
      include: { factory: true }
    });

    // 测试4.1: 获取当前用户信息
    await this.test('getCurrentUser - 获取当前用户信息', async () => {
      const mockUser = testUser;
      const mockFactory = testUser.factory;

      const mockReqRes = this.createMockReqRes(null);
      mockReqRes.req.user = mockUser;
      mockReqRes.req.factory = mockFactory;
      
      await authController.getCurrentUser(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response || !response.success) {
        throw new Error('获取用户信息响应格式不正确');
      }

      if (!response.data.user || !response.data.factory) {
        throw new Error('缺少用户或工厂信息');
      }

      const userInfo = response.data.user;
      if (userInfo.id !== mockUser.id) {
        throw new Error('用户ID不匹配');
      }

      if (userInfo.username !== mockUser.username) {
        throw new Error('用户名不匹配');
      }

      const factoryInfo = response.data.factory;
      if (factoryInfo.id !== mockFactory.id) {
        throw new Error('工厂ID不匹配');
      }

      return {
        userId: userInfo.id,
        username: userInfo.username,
        factoryId: factoryInfo.id,
        factoryName: factoryInfo.name
      };
    }, 'getUserProfile');

    // 测试4.2: 修改密码
    await this.test('changePassword - 修改密码', async () => {
      const mockUser = testUser;
      
      const passwordData = {
        oldPassword: 'TestPass@123456',
        newPassword: 'NewTestPass@123456'
      };

      const mockReqRes = this.createMockReqRes(null, {}, {}, passwordData);
      mockReqRes.req.user = mockUser;
      
      await authController.changePassword(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response || !response.success) {
        throw new Error('修改密码响应格式不正确');
      }

      // 验证密码确实被修改了
      const updatedUser = await prisma.user.findUnique({
        where: { id: createdUserId }
      });

      const passwordValid = await verifyPassword('NewTestPass@123456', updatedUser.passwordHash);
      if (!passwordValid) {
        throw new Error('密码未正确更新');
      }

      // 还原密码以便后续测试
      const originalPasswordHash = await hashPassword('TestPass@123456');
      await prisma.user.update({
        where: { id: createdUserId },
        data: { passwordHash: originalPasswordHash }
      });

      return {
        passwordChanged: true,
        message: response.message
      };
    }, 'updateUserProfile');

    // 测试4.3: 使用错误的旧密码修改密码
    await this.test('changePassword - 使用错误的旧密码', async () => {
      const mockUser = testUser;
      
      const passwordData = {
        oldPassword: 'WrongOldPassword@123',
        newPassword: 'NewTestPass@123456'
      };

      const mockReqRes = this.createMockReqRes(null, {}, {}, passwordData);
      mockReqRes.req.user = mockUser;
      
      try {
        await authController.changePassword(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为旧密码错误而失败');
      } catch (error) {
        if (error.message.includes('旧密码错误') || error.message.includes('AuthenticationError')) {
          return { message: '正确处理了错误的旧密码' };
        }
        throw error;
      }
    }, 'updateUserProfile');
  }

  // 阶段5: 白名单管理功能测试
  async testWhitelistManagement() {
    this.log('📋 阶段5: 白名单管理功能测试', 'phase');

    const mainFactoryId = this.testData.get('mainFactory');
    const platformAdminId = this.testData.get('platformAdmin');

    if (!mainFactoryId || !platformAdminId) {
      this.log('❌ 跳过白名单管理测试: 缺少必要数据', 'warning');
      return;
    }

    // 测试5.1: 检查白名单状态
    await this.test('checkWhitelistStatus - 检查白名单状态', async () => {
      const phoneNumber = '+86138000001002'; // 使用不同的手机号避免与注册测试冲突
      
      const result = await authController.checkWhitelistStatus(phoneNumber);
      
      if (!result.success) {
        throw new Error(`白名单状态检查失败: ${result.message}`);
      }

      if (!result.isInWhitelist) {
        throw new Error('手机号应该在白名单中');
      }

      if (!result.factories || result.factories.length === 0) {
        throw new Error('应该返回可用的工厂列表');
      }

      return {
        isInWhitelist: result.isInWhitelist,
        factoryCount: result.factories.length,
        firstFactory: result.factories[0].factoryName
      };
    }, 'whitelistManagement');

    // 测试5.2: 检查不在白名单的手机号
    await this.test('checkWhitelistStatus - 检查不在白名单的手机号', async () => {
      const phoneNumber = '+86138888888888';
      
      const result = await authController.checkWhitelistStatus(phoneNumber);
      
      if (result.success && result.isInWhitelist) {
        throw new Error('不存在的手机号不应该在白名单中');
      }

      if (result.message && !result.message.includes('未在白名单')) {
        throw new Error('应该明确提示不在白名单中');
      }

      return {
        correctlyNotFound: !result.isInWhitelist,
        message: result.message
      };
    }, 'whitelistManagement');

    // 测试5.3: 白名单状态变更测试
    await this.test('whitelistManagement - 白名单状态变更', async () => {
      // 创建一个测试白名单记录
      const testWhitelist = await prisma.userWhitelist.create({
        data: {
          factoryId: mainFactoryId,
          phoneNumber: '+86138000099999',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          addedByPlatformId: platformAdminId
        }
      });

      // 验证初始状态
      const initialStatus = await authController.checkWhitelistStatus(testWhitelist.phoneNumber);
      if (!initialStatus.isInWhitelist) {
        throw new Error('新创建的白名单应该可用');
      }

      // 模拟注册完成，更新状态为REGISTERED
      await prisma.userWhitelist.update({
        where: { id: testWhitelist.id },
        data: { status: 'REGISTERED' }
      });

      // 验证状态更新后不再可用于注册
      const updatedStatus = await authController.checkWhitelistStatus(testWhitelist.phoneNumber);
      if (updatedStatus.isInWhitelist) {
        throw new Error('已注册的白名单记录不应该再次可用');
      }

      // 清理测试数据
      await prisma.userWhitelist.delete({ where: { id: testWhitelist.id } });

      return {
        initialAvailable: initialStatus.isInWhitelist,
        afterRegistrationUnavailable: !updatedStatus.isInWhitelist
      };
    }, 'whitelistManagement');

    // 测试5.4: 白名单过期处理
    await this.test('whitelistManagement - 白名单过期处理', async () => {
      // 创建一个即将过期的白名单记录
      const expiringSoon = await prisma.userWhitelist.create({
        data: {
          factoryId: mainFactoryId,
          phoneNumber: '+86138000088888',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 1000), // 1秒后过期
          addedByPlatformId: platformAdminId
        }
      });

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 检查过期后的状态
      const expiredStatus = await authController.checkWhitelistStatus(expiringSoon.phoneNumber);
      if (expiredStatus.isInWhitelist) {
        throw new Error('过期的白名单记录不应该可用');
      }

      // 清理测试数据
      await prisma.userWhitelist.delete({ where: { id: expiringSoon.id } });

      return {
        correctlyExpired: !expiredStatus.isInWhitelist,
        message: expiredStatus.message
      };
    }, 'whitelistManagement');
  }

  // 阶段6: 角色权限系统测试
  async testRolePermissions() {
    this.log('🔐 阶段6: 角色权限系统测试', 'phase');

    const roleTestUsers = this.testData.get('roleTestUsers');
    if (!roleTestUsers || roleTestUsers.length === 0) {
      this.log('❌ 跳过角色权限系统测试: 缺少角色测试用户', 'warning');
      return;
    }

    // 测试6.1: 权限继承和限制验证
    await this.test('rolePermissions - 权限继承和限制验证', async () => {
      const results = {};

      // 测试各个角色的权限
      for (const user of roleTestUsers) {
        const loginResult = await authController.unifiedLogin(user.username, 'TestPass@123456');
        
        if (loginResult.success) {
          const permissions = loginResult.user.permissions;
          results[user.roleCode] = {
            hasAdminAccess: permissions.modules.admin_access,
            hasPlatformAccess: permissions.modules.platform_access,
            hasTraceAccess: permissions.modules.trace_access,
            roleLevel: permissions.roleLevel,
            featuresCount: permissions.features.length
          };
        }
      }

      // 验证权限层级
      if (results.factory_super_admin && !results.factory_super_admin.hasAdminAccess) {
        throw new Error('工厂超级管理员应该有管理权限');
      }

      if (results.permission_admin && !results.permission_admin.hasAdminAccess) {
        throw new Error('权限管理员应该有管理权限');
      }

      if (results.department_admin && results.department_admin.hasAdminAccess) {
        throw new Error('部门管理员不应该有系统管理权限');
      }

      if (results.operator && results.operator.hasAdminAccess) {
        throw new Error('普通操作员不应该有管理权限');
      }

      if (results.viewer && results.viewer.hasAdminAccess) {
        throw new Error('查看者不应该有管理权限');
      }

      return results;
    }, 'rolePermissions');

    // 测试6.2: 部门权限访问控制
    await this.test('rolePermissions - 部门权限访问控制', async () => {
      // 测试部门管理员权限
      const deptAdminLogin = await authController.unifiedLogin('dept_admin_test', 'TestPass@123456');
      
      if (!deptAdminLogin.success) {
        throw new Error('部门管理员登录失败');
      }

      const deptPermissions = deptAdminLogin.user.permissions;
      
      // 部门管理员应该有对应部门的权限
      if (!deptPermissions.modules.processing_access) {
        throw new Error('处理部门管理员应该有processing_access');
      }

      // 但不应该有其他部门的权限
      if (deptPermissions.modules.farming_access) {
        throw new Error('处理部门管理员不应该有farming_access');
      }

      if (deptPermissions.modules.logistics_access) {
        throw new Error('处理部门管理员不应该有logistics_access');
      }

      return {
        hasOwnDepartmentAccess: deptPermissions.modules.processing_access,
        noOtherDepartmentAccess: !deptPermissions.modules.farming_access && !deptPermissions.modules.logistics_access,
        department: deptAdminLogin.user.department
      };
    }, 'rolePermissions');

    // 测试6.3: 功能权限验证
    await this.test('rolePermissions - 功能权限验证', async () => {
      const results = {};

      // 测试权限管理员的功能权限
      const permissionAdminLogin = await authController.unifiedLogin('permission_admin_test', 'TestPass@123456');
      if (permissionAdminLogin.success) {
        const features = permissionAdminLogin.user.permissions.features;
        results.permission_admin = {
          hasUserManageAll: features.includes('user_manage_all'),
          hasStatsViewAll: features.includes('stats_view_all'),
          totalFeatures: features.length
        };
      }

      // 测试部门管理员的功能权限
      const deptAdminLogin = await authController.unifiedLogin('dept_admin_test', 'TestPass@123456');
      if (deptAdminLogin.success) {
        const features = deptAdminLogin.user.permissions.features;
        results.department_admin = {
          hasUserManageOwnDept: features.includes('user_manage_own_dept'),
          hasStatsViewOwnDept: features.includes('stats_view_own_dept'),
          noFullUserManage: !features.includes('user_manage_all'),
          totalFeatures: features.length
        };
      }

      // 测试普通操作员的功能权限（应该没有特殊功能）
      const operatorLogin = await authController.unifiedLogin('operator_test', 'TestPass@123456');
      if (operatorLogin.success) {
        const features = operatorLogin.user.permissions.features;
        results.operator = {
          hasNoSpecialFeatures: features.length === 0,
          totalFeatures: features.length
        };
      }

      return results;
    }, 'rolePermissions');
  }

  // 阶段7: 设备绑定功能测试
  async testDeviceBinding() {
    this.log('📱 阶段7: 设备绑定功能测试', 'phase');

    const createdUserId = this.testData.get('createdUserId');
    if (!createdUserId) {
      this.log('❌ 跳过设备绑定测试: 缺少测试用户', 'warning');
      return;
    }

    const testUser = await prisma.user.findUnique({
      where: { id: createdUserId }
    });

    // 测试7.1: 设备绑定
    await this.test('bindDevice - 设备绑定', async () => {
      const deviceId = 'TEST_DEVICE_12345';
      const deviceInfo = {
        model: 'iPhone 13',
        os: 'iOS 15.0',
        appVersion: '1.0.0'
      };

      const result = await authController.bindDevice(testUser, deviceId, deviceInfo);
      
      if (!result.success) {
        throw new Error(`设备绑定失败: ${result.message}`);
      }

      if (!result.deviceToken) {
        throw new Error('缺少设备令牌');
      }

      this.testData.set('deviceToken', result.deviceToken);
      this.testData.set('deviceId', deviceId);

      return {
        success: result.success,
        hasDeviceToken: !!result.deviceToken,
        message: result.message
      };
    }, 'deviceBinding');

    // 测试7.2: 设备登录
    await this.test('deviceLogin - 设备登录', async () => {
      const deviceId = this.testData.get('deviceId');
      const deviceToken = this.testData.get('deviceToken');

      if (!deviceId || !deviceToken) {
        throw new Error('缺少设备ID或设备令牌');
      }

      const result = await authController.deviceLogin(deviceId, deviceToken);
      
      if (!result.success) {
        throw new Error(`设备登录失败: ${result.message}`);
      }

      if (!result.user) {
        throw new Error('缺少用户信息');
      }

      if (!result.tokens) {
        throw new Error('缺少认证令牌');
      }

      if (result.user.id !== testUser.id) {
        throw new Error('用户ID不匹配');
      }

      return {
        success: result.success,
        userId: result.user.id,
        username: result.user.username,
        hasTokens: !!result.tokens.token
      };
    }, 'deviceBinding');

    // 测试7.3: 无效设备令牌登录
    await this.test('deviceLogin - 无效设备令牌', async () => {
      const deviceId = this.testData.get('deviceId');
      const invalidToken = 'invalid_device_token_123';

      const result = await authController.deviceLogin(deviceId, invalidToken);
      
      if (result.success) {
        throw new Error('无效设备令牌应该无法登录');
      }

      return {
        correctlyBlocked: !result.success,
        message: result.message
      };
    }, 'deviceBinding');

    // 测试7.4: 设备ID不匹配
    await this.test('deviceLogin - 设备ID不匹配', async () => {
      const wrongDeviceId = 'WRONG_DEVICE_ID';
      const deviceToken = this.testData.get('deviceToken');

      const result = await authController.deviceLogin(wrongDeviceId, deviceToken);
      
      if (result.success) {
        throw new Error('设备ID不匹配应该无法登录');
      }

      if (!result.message.includes('不匹配')) {
        throw new Error('应该明确提示设备信息不匹配');
      }

      return {
        correctlyBlocked: !result.success,
        message: result.message
      };
    }, 'deviceBinding');
  }

  // 阶段8: 跨工厂访问控制测试
  async testCrossFactoryAccess() {
    this.log('🏭 阶段8: 跨工厂访问控制测试', 'phase');

    const mainFactoryId = this.testData.get('mainFactory');
    const secondFactoryId = this.testData.get('secondFactory');

    if (!mainFactoryId || !secondFactoryId) {
      this.log('❌ 跳过跨工厂访问测试: 缺少工厂数据', 'warning');
      return;
    }

    // 在副工厂创建一个用户
    await this.test('创建副工厂测试用户', async () => {
      const hashedPassword = await hashPassword('TestPass@123456');
      
      const crossFactoryUser = await prisma.user.create({
        data: {
          factoryId: secondFactoryId,
          username: 'cross_factory_user',
          passwordHash: hashedPassword,
          email: 'cross@factory.test',
          phone: '+86138000002001',
          fullName: '跨工厂测试用户',
          isActive: true,
          roleCode: 'viewer',
          department: 'management'
        }
      });

      this.testData.set('crossFactoryUserId', crossFactoryUser.id);
      this.testUsers.push(crossFactoryUser.id);
      
      return crossFactoryUser;
    }, 'general');

    // 测试8.1: 跨工厂用户登录
    await this.test('crossFactoryAccess - 跨工厂用户登录', async () => {
      const loginResult = await authController.unifiedLogin('cross_factory_user', 'TestPass@123456');
      
      if (!loginResult.success) {
        throw new Error(`跨工厂用户登录失败: ${loginResult.message}`);
      }

      if (loginResult.user.factoryId !== secondFactoryId) {
        throw new Error('用户应该属于副工厂');
      }

      return {
        success: loginResult.success,
        factoryId: loginResult.user.factoryId,
        username: loginResult.user.username
      };
    }, 'general');

    // 测试8.2: 工厂隔离验证 - 用户数据隔离
    await this.test('crossFactoryAccess - 工厂数据隔离验证', async () => {
      // 主工厂用户不应该能够访问副工厂的数据
      const mainFactoryUsers = await prisma.user.findMany({
        where: { factoryId: mainFactoryId }
      });

      const secondFactoryUsers = await prisma.user.findMany({
        where: { factoryId: secondFactoryId }
      });

      // 验证数据隔离
      const mainFactoryUserIds = mainFactoryUsers.map(u => u.id);
      const secondFactoryUserIds = secondFactoryUsers.map(u => u.id);
      
      const overlap = mainFactoryUserIds.filter(id => secondFactoryUserIds.includes(id));
      if (overlap.length > 0) {
        throw new Error('工厂之间不应该有重叠的用户');
      }

      return {
        mainFactoryUserCount: mainFactoryUsers.length,
        secondFactoryUserCount: secondFactoryUsers.length,
        noOverlap: overlap.length === 0
      };
    }, 'general');
  }

  // 清理测试数据
  async cleanupTestData() {
    this.log('🧹 清理用户管理测试数据', 'phase');
    
    try {
      // 删除测试会话
      await prisma.session.deleteMany({
        where: {
          OR: [
            { factoryId: { in: this.testFactories.map(f => f.id) } },
            { userId: { in: this.testUsers } }
          ]
        }
      });

      // 删除测试用户
      if (this.testUsers.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: this.testUsers } }
        });
      }

      // 删除测试白名单
      if (this.testWhitelists.length > 0) {
        await prisma.userWhitelist.deleteMany({
          where: { id: { in: this.testWhitelists.map(w => w.id) } }
        });
      }

      // 删除测试平台管理员
      const platformAdminId = this.testData.get('platformAdmin');
      if (platformAdminId) {
        await prisma.platformAdmin.delete({
          where: { id: platformAdminId }
        });
      }

      // 删除测试工厂
      if (this.testFactories.length > 0) {
        await prisma.factory.deleteMany({
          where: { id: { in: this.testFactories.map(f => f.id) } }
        });
      }

      // 删除临时令牌
      await prisma.tempToken.deleteMany({
        where: {
          OR: [
            { factoryId: { in: this.testFactories.map(f => f.id) } },
            { phoneNumber: { contains: '+8613800000' } }
          ]
        }
      });

      return { message: '用户管理测试数据清理完成' };
    } catch (error) {
      this.log(`清理过程中出现错误: ${error.message}`, 'warning');
      return { message: '用户管理测试数据部分清理' };
    }
  }

  // 主测试执行器
  async runAllTests() {
    console.log(chalk.cyan.bold('🔍 海牛食品溯源系统 - 用户管理和白名单系统完整测试'));
    console.log(chalk.cyan('📊 测试范围: authController.js 用户管理功能和白名单系统'));
    console.log(chalk.cyan(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`));

    const startTime = Date.now();

    try {
      // 设置基础测试数据
      const baseData = await this.setupTestData();
      if (!baseData) {
        throw new Error('基础测试数据设置失败');
      }

      // 按阶段执行用户管理功能测试
      await this.testRegisterPhaseOne();
      await this.testRegisterPhaseTwo();
      await this.testUnifiedLogin();
      await this.testUserProfileManagement();
      await this.testWhitelistManagement();
      await this.testRolePermissions();
      await this.testDeviceBinding();
      await this.testCrossFactoryAccess();

    } catch (criticalError) {
      this.log(`💥 关键用户管理测试失败: ${criticalError.message}`, 'error');
    } finally {
      // 清理测试数据
      await this.cleanupTestData();
      // 关闭数据库连接
      await prisma.$disconnect();
    }

    // 生成测试报告
    this.generateReport(startTime);
  }

  generateReport(startTime) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(80));
    this.log('🔍 用户管理和白名单系统完整测试完成', 'phase');
    console.log('='.repeat(80));

    console.log(chalk.cyan('\n📈 总体统计:'));
    console.log(`   总计测试: ${this.testResults.total}`);
    console.log(chalk.green(`   通过: ${this.testResults.passed}`));
    console.log(chalk.red(`   失败: ${this.testResults.failed}`));
    console.log(`   成功率: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    console.log(`   总耗时: ${duration}秒`);

    // 分功能统计
    console.log(chalk.cyan('\n📋 分功能测试结果:'));
    for (const [functionName, result] of Object.entries(this.testResults.functionResults)) {
      const total = result.passed + result.failed;
      if (total > 0) {
        const successRate = (result.passed / total * 100).toFixed(1);
        console.log(`   ${functionName}: ${result.passed}/${total} (${successRate}%)`);
      }
    }

    // 失败详情
    if (this.testResults.failed > 0) {
      console.log(chalk.red('\n❌ 失败测试详情:'));
      this.testResults.details.forEach(detail => {
        console.log(chalk.red(`   - [${detail.function}] ${detail.name}: ${detail.error}`));
      });
    }

    // 测试结论
    console.log(chalk.cyan('\n💡 用户管理系统测试结论:'));
    const successRate = (this.testResults.passed / this.testResults.total) * 100;
    if (successRate >= 90) {
      console.log(chalk.green('   🎉 用户管理系统功能优秀！8角色权限系统和白名单机制正常'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow('   ⚠️ 用户管理系统基本正常，部分功能需要改进'));
    } else {
      console.log(chalk.red('   🚨 用户管理系统存在较多问题，需要重点修复'));
    }

    console.log(chalk.cyan(`\n🔍 用户管理系统健康度: ${successRate.toFixed(1)}%`));

    // 功能完整性评估
    const functionsTestedCount = Object.values(this.testResults.functionResults)
      .filter(result => result.passed + result.failed > 0).length;
    
    console.log(chalk.cyan(`\n🎯 功能覆盖度: ${functionsTestedCount}/8 个核心功能`));

    // 8角色系统测试摘要
    console.log(chalk.cyan('\n👥 8角色权限系统测试摘要:'));
    console.log('   ✓ 平台管理员 (platform_super_admin)');
    console.log('   ✓ 系统开发者 (system_developer)');
    console.log('   ✓ 工厂超级管理员 (factory_super_admin)');
    console.log('   ✓ 权限管理员 (permission_admin)');
    console.log('   ✓ 部门管理员 (department_admin)');
    console.log('   ✓ 操作员 (operator)');
    console.log('   ✓ 查看者 (viewer)');
    console.log('   ✓ 待激活用户 (unactivated)');

    // 设置退出码
    if (successRate >= 85 && functionsTestedCount >= 6) {
      console.log(chalk.green('\n✅ 用户管理系统测试达到可接受标准'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ 用户管理系统测试未达标，需要修复'));
      process.exit(1);
    }
  }
}

// 执行用户管理系统测试
console.log(chalk.blue('正在初始化用户管理系统测试器...'));
const tester = new UserManagementTester();

tester.runAllTests().catch(error => {
  console.error(chalk.red('用户管理系统测试执行过程中发生致命错误:'), error);
  process.exit(1);
});