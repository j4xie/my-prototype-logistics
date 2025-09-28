#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import * as authController from '../src/controllers/authController.js';
import * as alertController from '../src/controllers/alertController.js';
import * as equipmentController from '../src/controllers/equipmentController.js';
import * as qualityController from '../src/controllers/qualityController.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

class RolePermissionTester {
  constructor() {
    this.tests = [];
    this.failures = [];
    this.testData = new Map();
    this.testUsers = [];
    this.testFactories = [];
    this.platformAdmins = [];
    
    // 8个角色权限矩阵定义
    this.roles = {
      // 平台级角色
      system_developer: {
        level: 0,
        type: 'platform',
        expectedPermissions: {
          modules: {
            platform_access: true,
            admin_access: true,
            trace_access: true,
            processing_access: true,
            logistics_access: true,
            farming_access: true
          },
          features: ['system_admin', 'platform_manage_all', 'factory_manage_all', 'user_manage_all']
        }
      },
      platform_super_admin: {
        level: 1,
        type: 'platform',
        expectedPermissions: {
          modules: {
            platform_access: true,
            admin_access: true,
            trace_access: true,
            processing_access: true,
            logistics_access: true,
            farming_access: true
          },
          features: ['platform_manage_all', 'factory_manage_all', 'user_manage_all']
        }
      },
      platform_operator: {
        level: 2,
        type: 'platform',
        expectedPermissions: {
          modules: {
            platform_access: true,
            admin_access: false,
            trace_access: true,
            processing_access: true,
            logistics_access: true,
            farming_access: true
          },
          features: ['factory_view_all', 'stats_view_all']
        }
      },
      // 工厂级角色
      factory_super_admin: {
        level: 5,
        type: 'factory',
        expectedPermissions: {
          modules: {
            platform_access: false,
            admin_access: true,
            trace_access: true,
            processing_access: true,
            logistics_access: true,
            farming_access: true
          },
          features: ['user_manage_all', 'whitelist_manage_all', 'stats_view_all']
        }
      },
      permission_admin: {
        level: 10,
        type: 'factory',
        expectedPermissions: {
          modules: {
            platform_access: false,
            admin_access: true,
            trace_access: true,
            processing_access: false,
            logistics_access: false,
            farming_access: false
          },
          features: ['user_manage_all', 'stats_view_all']
        }
      },
      department_admin: {
        level: 15,
        type: 'factory',
        expectedPermissions: {
          modules: {
            platform_access: false,
            admin_access: false,
            trace_access: true,
            processing_access: true, // 根据部门
            logistics_access: false,
            farming_access: false
          },
          features: ['user_manage_department', 'stats_view_department']
        }
      },
      operator: {
        level: 20,
        type: 'factory',
        expectedPermissions: {
          modules: {
            platform_access: false,
            admin_access: false,
            trace_access: true,
            processing_access: true, // 根据部门
            logistics_access: false,
            farming_access: false
          },
          features: ['data_input', 'stats_view_basic']
        }
      },
      viewer: {
        level: 30,
        type: 'factory',
        expectedPermissions: {
          modules: {
            platform_access: false,
            admin_access: false,
            trace_access: true,
            processing_access: false,
            logistics_access: false,
            farming_access: false
          },
          features: ['stats_view_basic']
        }
      }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      phase: '📋',
      role: '👤'
    };
    console.log(`[${timestamp}] ${icons[type] || '📝'} ${message}`);
  }

  async test(name, testFunction, category = 'role') {
    const startTime = Date.now();
    
    try {
      this.log(`🔍 权限矩阵测试: ${name}`);
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
      }
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

  async setupRoleTestData() {
    this.log('🏭 设置8角色权限矩阵测试数据', 'phase');

    // 创建两个测试工厂
    const testFactories = await this.test('创建权限测试工厂', async () => {
      const factories = [];
      
      const mainFactory = await prisma.factory.create({
        data: {
          id: 'ROLE-TEST-FACTORY-001',
          name: '权限测试主工厂',
          industry: '食品制造业',
          industryCode: '140',
          regionCode: 'BJ'
        }
      });
      factories.push(mainFactory);
      this.testFactories.push(mainFactory.id);

      const secondFactory = await prisma.factory.create({
        data: {
          id: 'ROLE-TEST-FACTORY-002',
          name: '权限测试副工厂',
          industry: '食品制造业',
          industryCode: '140',
          regionCode: 'SH'
        }
      });
      factories.push(secondFactory);
      this.testFactories.push(secondFactory.id);

      this.testData.set('mainFactory', mainFactory.id);
      this.testData.set('secondFactory', secondFactory.id);
      
      return factories;
    });

    // 创建3个平台管理员
    const platformAdmins = await this.test('创建平台管理员', async () => {
      const admins = [];
      const hashedPassword = await bcrypt.hash('RoleTest@123456', 12);

      const platformRoles = ['system_developer', 'platform_super_admin', 'platform_operator'];
      
      for (const role of platformRoles) {
        const admin = await prisma.platformAdmin.create({
          data: {
            username: `test_${role}`,
            passwordHash: hashedPassword,
            email: `${role}@roletest.com`,
            fullName: `测试${role}`,
            role: role
          }
        });
        admins.push(admin);
        this.platformAdmins.push(admin.id);
      }

      this.testData.set('platformAdmins', admins);
      return admins;
    });

    // 创建5个工厂用户
    const factoryUsers = await this.test('创建工厂角色用户', async () => {
      const users = [];
      const hashedPassword = await bcrypt.hash('RoleTest@123456', 12);
      const mainFactoryId = this.testData.get('mainFactory');

      const factoryRoles = [
        { role: 'factory_super_admin', dept: 'management' },
        { role: 'permission_admin', dept: 'management' },
        { role: 'department_admin', dept: 'processing' },
        { role: 'operator', dept: 'quality' },
        { role: 'viewer', dept: 'logistics' }
      ];

      for (const roleData of factoryRoles) {
        const user = await prisma.user.create({
          data: {
            factoryId: mainFactoryId,
            username: `test_${roleData.role}`,
            passwordHash: hashedPassword,
            email: `${roleData.role}@roletest.com`,
            phone: `+861380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            fullName: `测试${roleData.role}`,
            isActive: true,
            roleCode: roleData.role,
            department: roleData.dept
          }
        });
        users.push(user);
        this.testUsers.push(user.id);
      }

      this.testData.set('factoryUsers', users);
      return users;
    });

    return { testFactories, platformAdmins, factoryUsers };
  }

  // 测试平台角色权限
  async testPlatformRoles() {
    this.log('📋 阶段1: 平台角色权限矩阵测试', 'phase');
    
    const platformAdmins = this.testData.get('platformAdmins');

    for (const admin of platformAdmins) {
      const roleName = admin.role;
      const expectedRole = this.roles[roleName];

      if (!expectedRole) {
        this.log(`⚠️ 跳过未定义的角色: ${roleName}`, 'warning');
        continue;
      }

      await this.test(`${roleName} - 登录和权限验证`, async () => {
        // 使用unifiedLogin测试登录
        const loginResult = await authController.unifiedLogin(admin.username, 'RoleTest@123456');
        
        if (!loginResult.success) {
          throw new Error(`${roleName}登录失败: ${loginResult.message}`);
        }

        const user = loginResult.user;
        const permissions = user.permissions;

        // 验证用户类型
        if (user.userType !== 'platform') {
          throw new Error(`${roleName}用户类型不正确: 期望platform，实际${user.userType}`);
        }

        // 验证权限级别
        if (permissions.roleLevel !== expectedRole.level) {
          throw new Error(`${roleName}权限级别不正确: 期望${expectedRole.level}，实际${permissions.roleLevel}`);
        }

        // 验证模块权限
        for (const [module, expected] of Object.entries(expectedRole.expectedPermissions.modules)) {
          const actual = permissions.modules[module];
          if (actual !== expected) {
            throw new Error(`${roleName}模块权限${module}不正确: 期望${expected}，实际${actual}`);
          }
        }

        // 验证特性权限
        const expectedFeatures = expectedRole.expectedPermissions.features;
        const hasRequiredFeatures = expectedFeatures.some(feature => 
          permissions.features.includes(feature)
        );
        
        if (!hasRequiredFeatures) {
          throw new Error(`${roleName}缺少必要特性权限: 期望包含${expectedFeatures.join('或')}中的至少一个`);
        }

        return {
          role: roleName,
          userType: user.userType,
          roleLevel: permissions.roleLevel,
          moduleCount: Object.keys(permissions.modules).length,
          featureCount: permissions.features.length,
          loginSuccess: true
        };
      }, 'platform');

      // 测试跨工厂访问权限
      if (roleName !== 'platform_operator') { // 平台操作员没有管理权限
        await this.test(`${roleName} - 跨工厂数据访问权限`, async () => {
          const loginResult = await authController.unifiedLogin(admin.username, 'RoleTest@123456');
          const mockUser = {
            id: loginResult.user.id,
            userType: loginResult.user.userType,
            permissions: loginResult.user.permissions,
            factoryId: null // 平台用户没有特定工厂ID
          };

          // 尝试访问两个工厂的告警数据
          const mockReqRes = this.createMockReqRes(mockUser);
          
          await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
          const response = mockReqRes.getResponse();
          
          if (!response.success) {
            throw new Error(`${roleName}无法访问告警数据`);
          }

          return {
            role: roleName,
            canAccessAlerts: true,
            alertCount: response.data.alerts ? response.data.alerts.length : 0
          };
        }, 'platform');
      }
    }
  }

  // 测试工厂角色权限
  async testFactoryRoles() {
    this.log('📋 阶段2: 工厂角色权限矩阵测试', 'phase');
    
    const factoryUsers = this.testData.get('factoryUsers');

    for (const user of factoryUsers) {
      const roleName = user.roleCode;
      const expectedRole = this.roles[roleName];

      if (!expectedRole) {
        this.log(`⚠️ 跳过未定义的角色: ${roleName}`, 'warning');
        continue;
      }

      await this.test(`${roleName} - 登录和权限验证`, async () => {
        // 使用unifiedLogin测试登录
        const loginResult = await authController.unifiedLogin(user.username, 'RoleTest@123456');
        
        if (!loginResult.success) {
          throw new Error(`${roleName}登录失败: ${loginResult.message}`);
        }

        const loggedUser = loginResult.user;
        const permissions = loggedUser.permissions;

        // 验证用户类型
        if (loggedUser.userType !== 'factory') {
          throw new Error(`${roleName}用户类型不正确: 期望factory，实际${loggedUser.userType}`);
        }

        // 验证权限级别
        if (permissions.roleLevel !== expectedRole.level) {
          throw new Error(`${roleName}权限级别不正确: 期望${expectedRole.level}，实际${permissions.roleLevel}`);
        }

        // 验证工厂ID
        if (!loggedUser.factoryId) {
          throw new Error(`${roleName}缺少工厂ID`);
        }

        // 验证基础模块权限
        const criticalModules = ['trace_access', 'admin_access', 'platform_access'];
        for (const module of criticalModules) {
          if (module in expectedRole.expectedPermissions.modules) {
            const expected = expectedRole.expectedPermissions.modules[module];
            const actual = permissions.modules[module];
            if (actual !== expected) {
              throw new Error(`${roleName}关键模块权限${module}不正确: 期望${expected}，实际${actual}`);
            }
          }
        }

        return {
          role: roleName,
          userType: loggedUser.userType,
          factoryId: loggedUser.factoryId,
          department: loggedUser.department,
          roleLevel: permissions.roleLevel,
          hasAdminAccess: permissions.modules.admin_access,
          hasTraceAccess: permissions.modules.trace_access,
          loginSuccess: true
        };
      }, 'factory');

      // 测试数据访问权限
      await this.test(`${roleName} - 数据访问权限验证`, async () => {
        const loginResult = await authController.unifiedLogin(user.username, 'RoleTest@123456');
        const mockUser = {
          id: loginResult.user.id,
          factoryId: loginResult.user.factoryId,
          roleCode: loginResult.user.roleCode,
          department: loginResult.user.department,
          permissions: loginResult.user.permissions
        };

        let canAccessQuality = false;
        let canAccessEquipment = false;
        let canAccessAlerts = false;

        // 测试质检数据访问
        try {
          const mockReqRes = this.createMockReqRes(mockUser);
          await qualityController.getInspections(mockReqRes.req, mockReqRes.res, mockReqRes.next);
          const response = mockReqRes.getResponse();
          canAccessQuality = response && response.success;
        } catch (error) {
          canAccessQuality = false;
        }

        // 测试设备监控访问
        try {
          const mockReqRes = this.createMockReqRes(mockUser);
          await equipmentController.getEquipmentMonitoring(mockReqRes.req, mockReqRes.res, mockReqRes.next);
          const response = mockReqRes.getResponse();
          canAccessEquipment = response && response.success;
        } catch (error) {
          canAccessEquipment = false;
        }

        // 测试告警访问
        try {
          const mockReqRes = this.createMockReqRes(mockUser);
          await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
          const response = mockReqRes.getResponse();
          canAccessAlerts = response && response.success;
        } catch (error) {
          canAccessAlerts = false;
        }

        // 根据角色验证访问权限
        if (roleName === 'factory_super_admin') {
          if (!canAccessQuality || !canAccessEquipment || !canAccessAlerts) {
            throw new Error(`${roleName}应该能访问所有数据模块`);
          }
        } else if (roleName === 'viewer') {
          // viewer应该能查看但不能修改
          if (!canAccessQuality && !canAccessEquipment && !canAccessAlerts) {
            throw new Error(`${roleName}应该至少能查看某些数据`);
          }
        }

        return {
          role: roleName,
          canAccessQuality,
          canAccessEquipment,
          canAccessAlerts,
          accessLevel: roleName === 'factory_super_admin' ? 'full' : 
                      roleName === 'viewer' ? 'read-only' : 'departmental'
        };
      }, 'factory');
    }
  }

  // 测试权限隔离和安全
  async testPermissionIsolation() {
    this.log('📋 阶段3: 权限隔离和安全测试', 'phase');

    // 测试工厂间数据隔离
    await this.test('工厂间数据隔离验证', async () => {
      const factoryUsers = this.testData.get('factoryUsers');
      const mainFactoryUser = factoryUsers.find(u => u.roleCode === 'factory_super_admin');
      
      const loginResult = await authController.unifiedLogin(mainFactoryUser.username, 'RoleTest@123456');
      const mockUser = {
        id: loginResult.user.id,
        factoryId: loginResult.user.factoryId, // 保持原来的工厂ID
        userType: loginResult.user.userType, // 添加userType
        roleCode: loginResult.user.roleCode
      };

      // 创建副工厂的告警数据
      const secondFactoryAlert = await prisma.alertNotification.create({
        data: {
          factoryId: this.testData.get('secondFactory'),
          alertType: 'equipment',
          severity: 'medium',
          title: '副工厂设备告警',
          message: '这是副工厂的告警数据，主工厂用户不应访问'
        }
      });

      try {
        const mockReqRes = this.createMockReqRes(mockUser);
        await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        const response = mockReqRes.getResponse();
        
        // 检查是否能看到副工厂的数据
        const alerts = response.data.alerts || [];
        const hasSecondFactoryData = alerts.some(alert => alert.factoryId === this.testData.get('secondFactory'));
        
        if (hasSecondFactoryData) {
          throw new Error('工厂用户能访问其他工厂的数据，数据隔离失败');
        }

        return {
          isolation: 'success',
          alertCount: alerts.length,
          canAccessOtherFactory: false
        };
      } finally {
        // 清理测试数据
        await prisma.alertNotification.delete({ where: { id: secondFactoryAlert.id } });
      }
    }, 'security');

    // 测试权限升级攻击防护
    await this.test('权限升级攻击防护', async () => {
      const factoryUsers = this.testData.get('factoryUsers');
      const viewerUser = factoryUsers.find(u => u.roleCode === 'viewer');
      
      const loginResult = await authController.unifiedLogin(viewerUser.username, 'RoleTest@123456');
      const mockUser = {
        id: loginResult.user.id,
        factoryId: loginResult.user.factoryId,
        roleCode: 'factory_super_admin', // 尝试伪装成管理员
        permissions: loginResult.user.permissions // 但权限仍是viewer
      };

      // viewer尝试创建告警（需要管理员权限）
      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, {
        alertType: 'safety', // 使用有效的枚举值
        severity: 'high',
        title: '权限攻击测试',
        message: 'viewer用户尝试创建告警'
      });

      try {
        await alertController.createAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        const response = mockReqRes.getResponse();
        
        // 如果成功创建，说明权限控制有问题
        if (response && response.success) {
          throw new Error('viewer用户能够执行管理员操作，权限控制失败');
        }
      } catch (error) {
        // 期望抛出权限错误
        if (error.message.includes('权限不足') || error.message.includes('AccessDenied')) {
          return {
            protectionWorking: true,
            errorMessage: error.message
          };
        }
        throw error;
      }

      return {
        protectionWorking: true,
        preventedEscalation: true
      };
    }, 'security');
  }

  // 测试角色继承和优先级
  async testRoleHierarchy() {
    this.log('📋 阶段4: 角色层次和优先级测试', 'phase');

    await this.test('角色权限级别排序验证', async () => {
      const allUsers = [
        ...this.testData.get('platformAdmins'),
        ...this.testData.get('factoryUsers')
      ];

      const rolePermissions = [];

      for (const userData of allUsers) {
        const username = userData.username;
        const loginResult = await authController.unifiedLogin(username, 'RoleTest@123456');
        
        if (loginResult.success) {
          rolePermissions.push({
            username,
            role: userData.role || userData.roleCode,
            roleLevel: loginResult.user.permissions.roleLevel,
            userType: loginResult.user.userType
          });
        }
      }

      // 验证平台用户权限级别 < 工厂用户权限级别
      const platformUsers = rolePermissions.filter(u => u.userType === 'platform');
      const factoryUsers = rolePermissions.filter(u => u.userType === 'factory');

      const maxPlatformLevel = Math.max(...platformUsers.map(u => u.roleLevel));
      const minFactoryLevel = Math.min(...factoryUsers.map(u => u.roleLevel));

      if (maxPlatformLevel >= minFactoryLevel) {
        throw new Error(`权限级别排序错误: 最高平台级别${maxPlatformLevel} >= 最低工厂级别${minFactoryLevel}`);
      }

      return {
        totalRoles: rolePermissions.length,
        platformRoles: platformUsers.length,
        factoryRoles: factoryUsers.length,
        hierarchyValid: true,
        levelRange: {
          platformMin: Math.min(...platformUsers.map(u => u.roleLevel)),
          platformMax: maxPlatformLevel,
          factoryMin: minFactoryLevel,
          factoryMax: Math.max(...factoryUsers.map(u => u.roleLevel))
        }
      };
    }, 'hierarchy');
  }

  async cleanup() {
    this.log('🧹 清理8角色权限测试数据');

    try {
      // 删除告警通知
      await prisma.alertNotification.deleteMany({
        where: { factoryId: { in: this.testFactories } }
      });

      // 删除创建的用户
      if (this.testUsers.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: this.testUsers } }
        });
      }

      // 删除平台管理员
      if (this.platformAdmins.length > 0) {
        await prisma.platformAdmin.deleteMany({
          where: { id: { in: this.platformAdmins } }
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
    this.log('👤 8角色权限矩阵测试完成', 'phase');
    console.log('================================================================================\n');

    console.log('📈 总体统计:');
    console.log(`   总计测试: ${totalTests}`);
    console.log(`   通过: ${passedTests}`);
    console.log(`   失败: ${failedTests}`);
    console.log(`   成功率: ${successRate}%`);
    console.log(`   总耗时: ${totalTime.toFixed(2)}秒\n`);

    // 按类别分组统计
    const categories = [...new Set(this.tests.map(t => t.category))];
    console.log('📋 分类别测试结果:');
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

    console.log('\n👥 8角色权限体系测试摘要:');
    console.log('   ✓ 平台级角色 (3个): system_developer, platform_super_admin, platform_operator');
    console.log('   ✓ 工厂级角色 (5个): factory_super_admin, permission_admin, department_admin, operator, viewer');
    console.log('   ✓ 权限隔离: 工厂间数据隔离');
    console.log('   ✓ 安全防护: 权限升级攻击防护');
    console.log('   ✓ 角色层次: 权限级别正确排序');

    console.log('\n💡 8角色权限矩阵测试结论:');
    if (successRate >= 90) {
      console.log('   🎉 权限矩阵设计完美！8角色体系运行正常');
    } else if (successRate >= 80) {
      console.log('   ✅ 权限矩阵基本正确，个别权限配置需要调整');
    } else if (successRate >= 70) {
      console.log('   ⚠️ 权限矩阵存在问题，需要优化角色权限配置');
    } else {
      console.log('   ❌ 权限矩阵存在严重问题，需要重新设计');
    }

    console.log(`\n👤 权限矩阵健康度: ${successRate}%`);
    
    console.log('\n🎯 权限验证覆盖:');
    console.log('   ✓ 登录验证 → 权限获取 → 模块访问 → 数据隔离');
    console.log('   ✓ 平台用户跨工厂访问 → 工厂用户数据隔离');
    console.log('   ✓ 角色权限继承 → 权限升级防护 → 安全边界');

    if (successRate >= 85) {
      console.log('\n✅ 8角色权限矩阵测试达到可接受标准');
    } else {
      console.log('\n❌ 8角色权限矩阵测试未达标，需要修复');
    }
  }

  async run() {
    console.log('正在初始化8角色权限矩阵测试器...');
    console.log('👤 海牛食品溯源系统 - 8角色完整权限矩阵测试');
    console.log('📊 测试范围: 3个平台角色 + 5个工厂角色的完整权限验证');
    console.log(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`);

    try {
      await this.setupRoleTestData();
      await this.testPlatformRoles();
      await this.testFactoryRoles();
      await this.testPermissionIsolation();
      await this.testRoleHierarchy();
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
const tester = new RolePermissionTester();
tester.run().catch(console.error);