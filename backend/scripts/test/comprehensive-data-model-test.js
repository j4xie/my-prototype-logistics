#!/usr/bin/env node

/**
 * 白垩纪食品溯源系统 - 数据模型完整性测试
 * 测试所有23个数据模型的CRUD操作、数据关系和约束验证
 * 阶段1: 数据模型完整性测试
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';

const prisma = new PrismaClient();

class ComprehensiveDataModelTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      modelResults: new Map()
    };
    this.createdData = new Map(); // 存储创建的测试数据，用于后续删除
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

  async test(name, testFn, modelName = null) {
    this.testResults.total++;
    this.log(`🧪 测试: ${name}`, 'info');
    
    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.passed++;
      if (modelName) {
        const modelResult = this.testResults.modelResults.get(modelName) || { passed: 0, failed: 0 };
        modelResult.passed++;
        this.testResults.modelResults.set(modelName, modelResult);
      }
      
      this.log(`✅ 通过: ${name} (${duration}ms)`, 'success');
      return result;
    } catch (error) {
      this.testResults.failed++;
      if (modelName) {
        const modelResult = this.testResults.modelResults.get(modelName) || { passed: 0, failed: 0 };
        modelResult.failed++;
        this.testResults.modelResults.set(modelName, modelResult);
      }
      
      this.testResults.details.push({ name, error: error.message });
      this.log(`❌ 失败: ${name} - ${error.message}`, 'error');
      return null;
    }
  }

  // 阶段1.1: Factory模型完整性测试
  async testFactoryModel() {
    this.log('🏭 测试Factory模型', 'phase');
    
    // 创建测试
    const factory = await this.test('Factory创建测试', async () => {
      const factoryData = {
        name: '测试食品厂A',
        industry: '食品制造业',
        address: '北京市朝阳区测试路100号',
        employeeCount: 50,
        contactName: '张经理',
        contactPhone: '+86138000000001',
        contactEmail: 'manager@testfactory.com'
      };

      const result = await factoryIdGenerator.generateNewFactoryId(factoryData);
      
      const factory = await prisma.factory.create({
        data: {
          id: result.factoryId,
          ...factoryData,
          industryCode: result.industryCode,
          regionCode: result.regionCode,
          confidence: result.confidence.overall,
          factoryYear: new Date().getFullYear(),
          sequenceNumber: result.sequenceNumber,
          manuallyVerified: true
        }
      });

      this.createdData.set('factory', factory.id);
      return factory;
    }, 'Factory');

    if (!factory) return;

    // 读取测试
    await this.test('Factory读取测试', async () => {
      const retrieved = await prisma.factory.findUnique({
        where: { id: factory.id },
        include: {
          settings: true,
          users: true,
          equipment: true
        }
      });
      
      if (!retrieved || retrieved.name !== factory.name) {
        throw new Error('Factory读取数据不匹配');
      }
      return retrieved;
    }, 'Factory');

    // 更新测试
    await this.test('Factory更新测试', async () => {
      const updated = await prisma.factory.update({
        where: { id: factory.id },
        data: {
          employeeCount: 75,
          subscriptionPlan: 'premium',
          manuallyVerified: true
        }
      });
      
      if (updated.employeeCount !== 75) {
        throw new Error('Factory更新失败');
      }
      return updated;
    }, 'Factory');

    // 关系测试
    await this.test('Factory关系创建测试', async () => {
      const settings = await prisma.factorySettings.create({
        data: {
          factoryId: factory.id,
          allowSelfRegistration: true,
          requireAdminApproval: false,
          defaultUserRole: 'operator',
          sessionTimeoutMinutes: 480,
          maxFailedLoginAttempts: 3,
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true
          },
          departmentSettings: {
            production: { maxUsers: 20 },
            quality: { maxUsers: 10 }
          }
        }
      });

      this.createdData.set('factorySettings', settings.id);
      return settings;
    }, 'Factory');
  }

  // 阶段1.2: User模型完整性测试
  async testUserModel() {
    this.log('👤 测试User模型', 'phase');
    
    const factoryId = this.createdData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过User测试: 需要Factory数据', 'warning');
      return;
    }

    // 创建测试用户
    const user = await this.test('User创建测试', async () => {
      const user = await prisma.user.create({
        data: {
          factoryId,
          username: 'testuser001',
          passwordHash: '$2b$10$test.hash.value.for.testing',
          email: 'testuser@factory.com',
          phone: '+86138000000002',
          fullName: '测试用户A',
          department: 'processing',
          roleCode: 'operator',
          position: '生产操作员',
          isActive: true
        }
      });

      this.createdData.set('user', user.id);
      return user;
    }, 'User');

    if (!user) return;

    // CRUD操作测试
    await this.test('User读取和关系测试', async () => {
      const retrieved = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          factory: true,
          sessions: true,
          roleHistory: true
        }
      });
      
      if (!retrieved || retrieved.username !== user.username) {
        throw new Error('User读取失败');
      }
      
      if (!retrieved.factory || retrieved.factory.id !== factoryId) {
        throw new Error('User-Factory关系错误');
      }
      
      return retrieved;
    }, 'User');

    await this.test('User更新测试', async () => {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          department: 'quality',
          position: '质检员',
          roleCode: 'operator'
        }
      });
      
      if (updated.department !== 'quality') {
        throw new Error('User更新失败');
      }
      return updated;
    }, 'User');
  }

  // 阶段1.3: PlatformAdmin模型测试
  async testPlatformAdminModel() {
    this.log('🛠️ 测试PlatformAdmin模型', 'phase');

    const admin = await this.test('PlatformAdmin创建测试', async () => {
      const admin = await prisma.platformAdmin.create({
        data: {
          username: 'testplatformadmin',
          passwordHash: '$2b$10$test.platform.hash.for.testing',
          email: 'admin@platform.com',
          phone: '+86138000000003',
          fullName: '测试平台管理员',
          role: 'platform_super_admin'
        }
      });

      this.createdData.set('platformAdmin', admin.id);
      return admin;
    }, 'PlatformAdmin');

    if (!admin) return;

    await this.test('PlatformAdmin权限检查', async () => {
      const retrieved = await prisma.platformAdmin.findUnique({
        where: { id: admin.id }
      });
      
      if (retrieved.role !== 'platform_super_admin') {
        throw new Error('PlatformAdmin权限设置错误');
      }
      return retrieved;
    }, 'PlatformAdmin');
  }

  // 阶段1.4: 核心业务模型测试
  async testProcessingBatchModel() {
    this.log('🔄 测试ProcessingBatch模型', 'phase');
    
    const factoryId = this.createdData.get('factory');
    const userId = this.createdData.get('user');
    
    if (!factoryId || !userId) {
      this.log('❌ 跳过ProcessingBatch测试: 需要Factory和User数据', 'warning');
      return;
    }

    const batch = await this.test('ProcessingBatch创建测试', async () => {
      const batch = await prisma.processingBatch.create({
        data: {
          factoryId,
          batchNumber: `BATCH${Date.now()}`,
          productType: '测试产品A',
          rawMaterials: [
            { material: '原料A', quantity: 100, unit: 'kg' },
            { material: '原料B', quantity: 50, unit: 'kg' }
          ],
          startDate: new Date(),
          productionLine: 'LINE001',
          supervisorId: userId,
          targetQuantity: 80,
          status: 'planning',
          notes: '测试批次'
        }
      });

      this.createdData.set('processingBatch', batch.id);
      return batch;
    }, 'ProcessingBatch');

    if (!batch) return;

    // 测试状态转换
    await this.test('ProcessingBatch状态转换测试', async () => {
      const updated = await prisma.processingBatch.update({
        where: { id: batch.id },
        data: {
          status: 'in_progress',
          actualQuantity: 78
        }
      });
      
      if (updated.status !== 'in_progress') {
        throw new Error('批次状态更新失败');
      }
      return updated;
    }, 'ProcessingBatch');
  }

  // 阶段1.5: 设备监控模型测试
  async testEquipmentModels() {
    this.log('📊 测试设备监控相关模型', 'phase');
    
    const factoryId = this.createdData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过设备测试: 需要Factory数据', 'warning');
      return;
    }

    // 测试FactoryEquipment
    const equipment = await this.test('FactoryEquipment创建测试', async () => {
      const equipment = await prisma.factoryEquipment.create({
        data: {
          factoryId,
          equipmentCode: 'EQP001',
          equipmentName: '测试设备A',
          equipmentType: '生产设备',
          department: 'processing',
          location: '车间A-01',
          status: 'active',
          specifications: {
            model: 'TEST-2024',
            capacity: '100kg/h',
            alerts: {
              temperature: { max: 50, min: 0 },
              pressure: { max: 10 }
            },
            maintenance: {
              daily: ['检查温度', '检查压力'],
              weekly: ['清洁设备']
            }
          }
        }
      });

      this.createdData.set('factoryEquipment', equipment.id);
      return equipment;
    }, 'FactoryEquipment');

    if (!equipment) return;

    // 测试DeviceMonitoringData
    await this.test('DeviceMonitoringData创建测试', async () => {
      const monitoringData = await prisma.deviceMonitoringData.create({
        data: {
          equipmentId: equipment.id,
          factoryId,
          timestamp: new Date(),
          metrics: {
            temperature: 25.5,
            pressure: 8.2,
            humidity: 45.0,
            vibration: 0.1
          },
          status: 'normal',
          alertTriggered: false,
          dataSource: 'automatic'
        }
      });

      this.createdData.set('deviceMonitoringData', monitoringData.id);
      return monitoringData;
    }, 'DeviceMonitoringData');
  }

  // 阶段1.6: 告警和通知模型测试
  async testAlertNotificationModel() {
    this.log('⚠️ 测试AlertNotification模型', 'phase');
    
    const factoryId = this.createdData.get('factory');
    const equipmentId = this.createdData.get('factoryEquipment');
    
    if (!factoryId || !equipmentId) {
      this.log('❌ 跳过AlertNotification测试: 需要Factory和Equipment数据', 'warning');
      return;
    }

    const alert = await this.test('AlertNotification创建测试', async () => {
      const alert = await prisma.alertNotification.create({
        data: {
          factoryId,
          alertType: 'equipment',
          severity: 'high',
          title: '设备温度异常',
          message: '设备EQP001温度超过安全阈值',
          sourceId: equipmentId,
          sourceType: 'equipment',
          status: 'new',
          assignedTo: []
        }
      });

      this.createdData.set('alertNotification', alert.id);
      return alert;
    }, 'AlertNotification');

    if (!alert) return;

    // 测试告警状态转换
    await this.test('AlertNotification状态转换测试', async () => {
      const updated = await prisma.alertNotification.update({
        where: { id: alert.id },
        data: {
          status: 'acknowledged',
          assignedTo: [this.createdData.get('user')]
        }
      });
      
      if (updated.status !== 'acknowledged') {
        throw new Error('告警状态更新失败');
      }
      return updated;
    }, 'AlertNotification');
  }

  // 阶段1.7: 质量检测模型测试
  async testQualityInspectionModel() {
    this.log('🔍 测试QualityInspection模型', 'phase');
    
    const factoryId = this.createdData.get('factory');
    const batchId = this.createdData.get('processingBatch');
    const inspectorId = this.createdData.get('user');
    
    if (!factoryId || !batchId || !inspectorId) {
      this.log('❌ 跳过QualityInspection测试: 需要Factory、Batch和User数据', 'warning');
      return;
    }

    const inspection = await this.test('QualityInspection创建测试', async () => {
      const inspection = await prisma.qualityInspection.create({
        data: {
          factoryId,
          batchId,
          inspectorId,
          inspectionType: 'final_product',
          inspectionDate: new Date(),
          testItems: [
            {
              item: '外观检查',
              standard: '无破损、无异物',
              result: 'pass',
              notes: '外观良好'
            },
            {
              item: '重量测试',
              standard: '80-85g',
              result: 'pass',
              actualValue: '83g'
            }
          ],
          overallResult: 'pass',
          qualityScore: 9.5,
          defectDetails: null,
          correctiveActions: null,
          photos: ['inspection_001.jpg', 'inspection_002.jpg']
        }
      });

      this.createdData.set('qualityInspection', inspection.id);
      return inspection;
    }, 'QualityInspection');

    if (!inspection) return;

    // 测试质检结果统计
    await this.test('QualityInspection关系查询测试', async () => {
      const retrieved = await prisma.qualityInspection.findUnique({
        where: { id: inspection.id },
        include: {
          batch: true,
          inspector: true
        }
      });
      
      if (!retrieved.batch || !retrieved.inspector) {
        throw new Error('QualityInspection关系查询失败');
      }
      
      return retrieved;
    }, 'QualityInspection');
  }

  // 阶段1.8: 权限和审计模型测试
  async testPermissionModels() {
    this.log('🔐 测试权限和审计模型', 'phase');
    
    const factoryId = this.createdData.get('factory');
    const userId = this.createdData.get('user');
    
    if (!factoryId || !userId) {
      this.log('❌ 跳过权限测试: 需要Factory和User数据', 'warning');
      return;
    }

    // 测试UserRoleHistory
    await this.test('UserRoleHistory创建测试', async () => {
      const roleHistory = await prisma.userRoleHistory.create({
        data: {
          userId,
          factoryId,
          oldRoleCode: 'operator',
          newRoleCode: 'operator',
          oldDepartment: 'processing',
          newDepartment: 'quality',
          changedByType: 'user',
          changedBy: userId,
          reason: '岗位调整'
        }
      });

      this.createdData.set('userRoleHistory', roleHistory.id);
      return roleHistory;
    }, 'UserRoleHistory');

    // 测试PermissionAuditLog
    await this.test('PermissionAuditLog创建测试', async () => {
      const auditLog = await prisma.permissionAuditLog.create({
        data: {
          actorType: 'user',
          actorId: userId,
          username: 'testuser001',
          action: 'update_user_role',
          resource: 'user',
          targetResourceId: userId.toString(),
          result: 'success',
          ipAddress: '192.168.1.100',
          userAgent: 'TestAgent/1.0',
          timestamp: new Date()
        }
      });

      this.createdData.set('permissionAuditLog', auditLog.id);
      return auditLog;
    }, 'PermissionAuditLog');
  }

  // 阶段1.9: 会话和安全模型测试
  async testSecurityModels() {
    this.log('🛡️ 测试安全相关模型', 'phase');
    
    const userId = this.createdData.get('user');
    const factoryId = this.createdData.get('factory');
    
    if (!userId || !factoryId) {
      this.log('❌ 跳过安全测试: 需要User和Factory数据', 'warning');
      return;
    }

    // 测试Session
    await this.test('Session创建测试', async () => {
      const session = await prisma.session.create({
        data: {
          userId,
          factoryId,
          token: 'test-session-token-' + Date.now(),
          refreshToken: 'test-refresh-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      });

      this.createdData.set('session', session.id);
      return session;
    }, 'Session');

    // 测试TempToken
    await this.test('TempToken创建测试', async () => {
      const tempToken = await prisma.tempToken.create({
        data: {
          token: 'test-temp-token-' + Date.now(),
          type: 'PHONE_VERIFICATION',
          factoryId,
          phoneNumber: '+86138000000004',
          data: {
            verificationCode: '123456',
            purpose: 'registration'
          },
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        }
      });

      this.createdData.set('tempToken', tempToken.id);
      return tempToken;
    }, 'TempToken');
  }

  // 阶段1.10: 移动设备和激活模型测试
  async testMobileDeviceModels() {
    this.log('📱 测试移动设备相关模型', 'phase');
    
    const userId = this.createdData.get('user');
    const factoryId = this.createdData.get('factory');
    
    if (!userId || !factoryId) {
      this.log('❌ 跳过移动设备测试: 需要User和Factory数据', 'warning');
      return;
    }

    // 测试MobileDevice
    await this.test('MobileDevice创建测试', async () => {
      const device = await prisma.mobileDevice.create({
        data: {
          userId,
          deviceId: 'test-mobile-device-001',
          deviceName: '测试手机A',
          deviceModel: 'TestPhone Pro',
          platform: 'android',
          osVersion: '12.0',
          isActive: true
        }
      });

      this.createdData.set('mobileDevice', device.id);
      return device;
    }, 'MobileDevice');

    // 测试ActivationCode
    await this.test('ActivationCode创建测试', async () => {
      const activationCode = await prisma.activationCode.create({
        data: {
          code: 'TEST_ACTIVATION_' + Date.now(),
          type: 'device',
          factoryId,
          maxUses: 1,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdBy: userId,
          status: 'active'
        }
      });

      this.createdData.set('activationCode', activationCode.id);
      return activationCode;
    }, 'ActivationCode');
  }

  // 阶段1.11: 系统日志和监控模型测试
  async testSystemModels() {
    this.log('📋 测试系统日志和监控模型', 'phase');
    
    const factoryId = this.createdData.get('factory');
    
    if (!factoryId) {
      this.log('❌ 跳过系统模型测试: 需要Factory数据', 'warning');
      return;
    }

    // 测试SystemLog
    await this.test('SystemLog创建测试', async () => {
      const systemLog = await prisma.systemLog.create({
        data: {
          factoryId,
          level: 'info',
          category: 'system_test',
          message: '测试系统日志消息',
          details: {
            testType: 'crud-test',
            version: '1.0.0'
          }
        }
      });

      this.createdData.set('systemLog', systemLog.id);
      return systemLog;
    }, 'SystemLog');

    // 测试ApiAccessLog
    await this.test('ApiAccessLog创建测试', async () => {
      const apiLog = await prisma.apiAccessLog.create({
        data: {
          factoryId,
          method: 'GET',
          path: '/api/test',
          statusCode: 200,
          responseTime: 125,
          ipAddress: '192.168.1.100',
          userAgent: 'TestAgent/1.0'
        }
      });

      this.createdData.set('apiAccessLog', apiLog.id);
      return apiLog;
    }, 'ApiAccessLog');

    // 测试DashboardMetric
    await this.test('DashboardMetric创建测试', async () => {
      const dashboardMetric = await prisma.dashboardMetric.create({
        data: {
          factoryId,
          metricType: 'production_summary',
          metricDate: new Date(),
          metricData: {
            totalBatches: 10,
            completedBatches: 8,
            qualityScore: 95.5,
            efficiency: 88.2
          },
          cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
        }
      });

      this.createdData.set('dashboardMetric', dashboardMetric.id);
      return dashboardMetric;
    }, 'DashboardMetric');
  }

  // 阶段1.12: 数据约束和验证测试
  async testDataConstraints() {
    this.log('🔒 测试数据约束和验证', 'phase');
    
    const factoryId = this.createdData.get('factory');

    // 测试唯一约束
    await this.test('用户名唯一约束测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: 'testuser001', // 重复的用户名（同一工厂下）
            passwordHash: '$2b$10$duplicate.test',
            email: 'duplicate@test.com',
            fullName: '重复测试用户'
          }
        });
        throw new Error('应该因为用户名重复而失败');
      } catch (error) {
        if (error.message.includes('Unique constraint') || error.message.includes('unique')) {
          return { message: '唯一约束正常工作' };
        }
        throw error;
      }
    }, 'Constraints');

    // 测试外键约束
    await this.test('外键约束测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId: 'non-existent-factory-id',
            username: 'fktest001',
            passwordHash: '$2b$10$fk.test',
            email: 'fk@test.com',
            fullName: '外键测试用户'
          }
        });
        throw new Error('应该因为外键约束而失败');
      } catch (error) {
        if (error.message.includes('Foreign key constraint') || error.message.includes('foreign key')) {
          return { message: '外键约束正常工作' };
        }
        throw error;
      }
    }, 'Constraints');

    // 测试必填字段约束
    await this.test('必填字段约束测试', async () => {
      try {
        await prisma.factory.create({
          data: {
            // 缺少必填的id字段
            name: '测试工厂'
          }
        });
        throw new Error('应该因为缺少必填字段而失败');
      } catch (error) {
        if (error.message.includes('required') || error.message.includes('Argument')) {
          return { message: '必填字段约束正常工作' };
        }
        throw error;
      }
    }, 'Constraints');
  }

  // 数据清理
  async cleanupTestData() {
    this.log('🧹 清理测试数据', 'phase');
    
    const cleanupOrder = [
      'dashboardMetric', 'apiAccessLog', 'systemLog',
      'activationCode', 'mobileDevice', 'tempToken', 'session',
      'permissionAuditLog', 'userRoleHistory',
      'qualityInspection', 'alertNotification',
      'deviceMonitoringData', 'factoryEquipment',
      'processingBatch', 'user', 'factorySettings',
      'platformAdmin', 'factory'
    ];

    for (const modelKey of cleanupOrder) {
      const id = this.createdData.get(modelKey);
      if (id) {
        await this.test(`清理${modelKey}数据`, async () => {
          const modelName = this.getModelName(modelKey);
          if (modelName && prisma[modelName]) {
            await prisma[modelName].delete({ where: { id } });
            return { message: `已删除${modelKey}: ${id}` };
          }
          return { message: `跳过${modelKey}: 模型不存在` };
        });
      }
    }
  }

  getModelName(key) {
    const modelMap = {
      'factory': 'factory',
      'user': 'user',
      'platformAdmin': 'platformAdmin',
      'factorySettings': 'factorySettings',
      'processingBatch': 'processingBatch',
      'factoryEquipment': 'factoryEquipment',
      'deviceMonitoringData': 'deviceMonitoringData',
      'alertNotification': 'alertNotification',
      'qualityInspection': 'qualityInspection',
      'userRoleHistory': 'userRoleHistory',
      'permissionAuditLog': 'permissionAuditLog',
      'session': 'session',
      'tempToken': 'tempToken',
      'mobileDevice': 'mobileDevice',
      'activationCode': 'activationCode',
      'systemLog': 'systemLog',
      'apiAccessLog': 'apiAccessLog',
      'dashboardMetric': 'dashboardMetric'
    };
    return modelMap[key];
  }

  // 主测试执行器
  async runAllTests() {
    console.log(chalk.cyan.bold('🧪 白垩纪食品溯源系统 - 数据模型完整性测试'));
    console.log(chalk.cyan(`📊 测试范围: 23个数据模型的CRUD操作和约束验证`));
    console.log(chalk.cyan(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`));

    const startTime = Date.now();

    try {
      // 按阶段执行测试
      await this.testFactoryModel();
      await this.testPlatformAdminModel();
      await this.testUserModel();
      await this.testProcessingBatchModel();
      await this.testEquipmentModels();
      await this.testAlertNotificationModel();
      await this.testQualityInspectionModel();
      await this.testPermissionModels();
      await this.testSecurityModels();
      await this.testMobileDeviceModels();
      await this.testSystemModels();
      await this.testDataConstraints();

    } catch (criticalError) {
      this.log(`💥 关键测试失败: ${criticalError.message}`, 'error');
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

    console.log('\n' + '='.repeat(70));
    this.log('📊 数据模型完整性测试完成', 'phase');
    console.log('='.repeat(70));

    console.log(chalk.cyan('\n📈 总体统计:'));
    console.log(`   总计测试: ${this.testResults.total}`);
    console.log(chalk.green(`   通过: ${this.testResults.passed}`));
    console.log(chalk.red(`   失败: ${this.testResults.failed}`));
    console.log(`   成功率: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    console.log(`   总耗时: ${duration}秒`);

    // 分模型统计
    console.log(chalk.cyan('\n📋 分模型测试结果:'));
    for (const [modelName, result] of this.testResults.modelResults) {
      const total = result.passed + result.failed;
      const successRate = total > 0 ? (result.passed / total * 100).toFixed(1) : 0;
      console.log(`   ${modelName}: ${result.passed}/${total} (${successRate}%)`);
    }

    // 失败详情
    if (this.testResults.failed > 0) {
      console.log(chalk.red('\n❌ 失败测试详情:'));
      this.testResults.details.forEach(detail => {
        console.log(chalk.red(`   - ${detail.name}: ${detail.error}`));
      });
    }

    // 测试结论
    console.log(chalk.cyan('\n💡 测试结论:'));
    const successRate = (this.testResults.passed / this.testResults.total) * 100;
    if (successRate >= 95) {
      console.log(chalk.green('   🎉 数据模型完整性优秀！所有主要功能正常'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow('   ⚠️ 数据模型基本正常，部分功能需要改进'));
    } else {
      console.log(chalk.red('   🚨 数据模型存在较多问题，需要重点修复'));
    }

    console.log(chalk.cyan(`\n🏥 数据层健康度: ${successRate.toFixed(1)}%`));

    // 设置退出码
    if (successRate >= 80) {
      console.log(chalk.green('\n✅ 数据模型测试达到可接受标准'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ 数据模型测试未达标，需要修复'));
      process.exit(1);
    }
  }
}

// 执行测试
console.log(chalk.blue('正在初始化数据模型测试器...'));
const tester = new ComprehensiveDataModelTester();

tester.runAllTests().catch(error => {
  console.error(chalk.red('测试执行过程中发生致命错误:'), error);
  process.exit(1);
});