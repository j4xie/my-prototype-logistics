#!/usr/bin/env node

/**
 * 白垩纪食品溯源系统 - 告警系统完整测试
 * 阶段2-1: alertController.js 5个核心功能完整性验证
 * 专注测试：告警列表、告警确认、告警解决、告警统计、告警摘要
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';
import alertController from '../src/controllers/alertController.js';

const prisma = new PrismaClient();

class AlertSystemTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      functionResults: {
        'getAlerts': { passed: 0, failed: 0 },
        'acknowledgeAlert': { passed: 0, failed: 0 },
        'resolveAlert': { passed: 0, failed: 0 },
        'getAlertStatistics': { passed: 0, failed: 0 },
        'getAlertsSummary': { passed: 0, failed: 0 }
      }
    };
    this.testData = new Map();
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
    this.log(`🔔 告警测试: ${name}`, 'info');
    
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
        return res; // 返回res对象以支持链式调用
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
      getResponse: () => responseData
    };
  }

  // 设置基础测试数据
  async setupTestData() {
    this.log('📋 设置告警系统测试数据', 'phase');
    
    // 创建测试工厂
    const factory = await this.test('创建告警测试工厂', async () => {
      const factoryData = {
        name: '告警测试工厂',
        industry: '食品制造业',
        address: '北京市告警区测试路100号',
        employeeCount: 60,
        contactName: '告警测试经理',
        contactPhone: '+86138000000801',
        contactEmail: 'alert@testfactory.com'
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

      this.testData.set('factory', factory.id);
      return factory;
    });

    if (!factory) return null;

    // 创建测试用户
    const users = await this.test('创建告警测试用户', async () => {
      const testUsers = [];
      
      // 管理员用户
      const admin = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'alert_admin',
          passwordHash: '$2b$10$alert.admin.hash',
          email: 'admin@alert.test',
          fullName: '告警系统管理员',
          department: 'management',
          roleCode: 'department_admin',
          isActive: true
        }
      });
      testUsers.push(admin);

      // 操作员用户
      const operator = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'alert_operator',
          passwordHash: '$2b$10$alert.operator.hash',
          email: 'operator@alert.test',
          fullName: '告警系统操作员',
          department: 'processing',
          roleCode: 'operator',
          isActive: true
        }
      });
      testUsers.push(operator);

      // 质检员用户
      const inspector = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'alert_inspector',
          passwordHash: '$2b$10$alert.inspector.hash',
          email: 'inspector@alert.test',
          fullName: '告警系统质检员',
          department: 'quality',
          roleCode: 'operator',
          isActive: true
        }
      });
      testUsers.push(inspector);

      this.testData.set('adminUser', admin.id);
      this.testData.set('operatorUser', operator.id);
      this.testData.set('inspectorUser', inspector.id);
      
      return testUsers;
    });

    if (!users) return null;

    // 创建测试设备
    const equipment = await this.test('创建告警测试设备', async () => {
      const equipment = await prisma.factoryEquipment.create({
        data: {
          factoryId: factory.id,
          equipmentCode: 'ALERT_EQP001',
          equipmentName: '告警测试设备A',
          equipmentType: '告警监控设备',
          department: 'processing',
          location: '告警测试车间-A1',
          status: 'active',
          specifications: {
            model: 'ALERT-TEST-2024',
            alerts: {
              temperature: { max: 70, min: 5 },
              pressure: { max: 15, min: 1 }
            }
          }
        }
      });

      this.testData.set('equipment', equipment.id);
      return equipment;
    });

    // 创建测试批次
    const batch = await this.test('创建告警测试批次', async () => {
      const batch = await prisma.processingBatch.create({
        data: {
          factoryId: factory.id,
          batchNumber: 'ALERT_BATCH_001',
          productType: '告警测试产品',
          rawMaterials: [
            { material: '告警原料A', quantity: 100, unit: 'kg' }
          ],
          startDate: new Date(),
          productionLine: 'ALERT_LINE001',
          supervisorId: users[0].id,
          targetQuantity: 50,
          status: 'in_progress'
        }
      });

      this.testData.set('batch', batch.id);
      return batch;
    });

    return { factory, users, equipment, batch };
  }

  // 创建测试告警数据
  async createTestAlerts() {
    this.log('⚠️ 创建测试告警数据', 'phase');
    
    const factoryId = this.testData.get('factory');
    const equipmentId = this.testData.get('equipment');
    const batchId = this.testData.get('batch');
    const adminId = this.testData.get('adminUser');
    const operatorId = this.testData.get('operatorUser');

    if (!factoryId || !equipmentId || !batchId || !adminId || !operatorId) {
      this.log('❌ 缺少必要的测试数据，跳过告警创建', 'warning');
      return [];
    }

    const testAlerts = [];

    // 创建不同类型和严重程度的告警
    const alertConfigs = [
      // 设备告警
      {
        alertType: 'equipment',
        severity: 'critical',
        title: '设备过热严重告警',
        message: '设备ALERT_EQP001温度达到危险水平，需要立即处理',
        sourceId: equipmentId,
        sourceType: 'equipment',
        status: 'new',
        assignedTo: [adminId]
      },
      {
        alertType: 'equipment',
        severity: 'high',
        title: '设备压力异常',
        message: '设备压力超出正常范围',
        sourceId: equipmentId,
        sourceType: 'equipment',
        status: 'acknowledged',
        assignedTo: [operatorId],
        resolvedBy: operatorId
      },
      // 生产告警
      {
        alertType: 'production',
        severity: 'medium',
        title: '批次进度延迟',
        message: '批次ALERT_BATCH_001生产进度落后于计划',
        sourceId: batchId,
        sourceType: 'batch',
        status: 'in_progress',
        assignedTo: [adminId, operatorId]
      },
      // 质量告警
      {
        alertType: 'quality',
        severity: 'high',
        title: '产品质量异常',
        message: '产品质量检测发现异常指标',
        sourceId: batchId,
        sourceType: 'batch',
        status: 'new',
        assignedTo: []
      },
      // 安全告警
      {
        alertType: 'safety',
        severity: 'critical',
        title: '安全事故风险',
        message: '检测到潜在安全风险，需要立即关注',
        sourceId: equipmentId,
        sourceType: 'equipment',
        status: 'resolved',
        resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2小时前解决
        resolvedBy: adminId,
        resolutionNotes: '已排除安全隐患，设备运行正常'
      },
      // 低优先级告警
      {
        alertType: 'production',
        severity: 'low',
        title: '日常维护提醒',
        message: '设备需要进行日常维护检查',
        sourceId: equipmentId,
        sourceType: 'equipment',
        status: 'new',
        assignedTo: [operatorId]
      }
    ];

    for (let i = 0; i < alertConfigs.length; i++) {
      const config = alertConfigs[i];
      const alert = await this.test(`创建测试告警${i + 1}: ${config.title}`, async () => {
        // 为了模拟真实的时间分布，给告警添加不同的创建时间
        const createdAt = new Date(Date.now() - (i * 60 * 60 * 1000)); // 每个告警间隔1小时
        
        const alert = await prisma.alertNotification.create({
          data: {
            factoryId,
            ...config,
            createdAt,
            ...(config.resolvedAt && { resolvedAt: config.resolvedAt })
          }
        });

        testAlerts.push(alert);
        this.testData.set(`alert${i + 1}`, alert.id);
        return alert;
      });
    }

    this.testData.set('testAlerts', testAlerts.map(a => a.id));
    return testAlerts;
  }

  // 阶段1: getAlerts 功能测试
  async testGetAlerts() {
    this.log('📋 阶段1: getAlerts 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const adminId = this.testData.get('adminUser');
    const operatorId = this.testData.get('operatorUser');

    if (!factoryId || !adminId || !operatorId) {
      this.log('❌ 跳过getAlerts测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: adminId, 
      factoryId, 
      username: 'alert_admin',
      roleCode: 'department_admin' 
    };

    // 测试1.1: 基本告警列表获取
    await this.test('getAlerts - 基本告警列表获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { page: 1, limit: 10 });
      
      await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data || !responseData.data.alerts) {
        throw new Error('告警列表数据格式不正确');
      }

      const alerts = responseData.data.alerts;
      const pagination = responseData.data.pagination;

      if (!Array.isArray(alerts)) {
        throw new Error('告警列表应该是数组');
      }

      if (!pagination || typeof pagination.total !== 'number') {
        throw new Error('分页信息格式不正确');
      }

      return { alertCount: alerts.length, totalCount: pagination.count };
    }, 'getAlerts');

    // 测试1.2: 按严重程度过滤
    await this.test('getAlerts - 按严重程度过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        severity: 'critical',
        page: 1,
        limit: 20
      });
      
      await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const alerts = responseData.data.alerts;

      // 验证所有返回的告警都是critical级别
      const nonCriticalAlerts = alerts.filter(alert => alert.severity !== 'critical');
      if (nonCriticalAlerts.length > 0) {
        throw new Error(`发现非critical告警: ${nonCriticalAlerts.length}个`);
      }

      return { criticalCount: alerts.length };
    }, 'getAlerts');

    // 测试1.3: 按状态过滤
    await this.test('getAlerts - 按状态过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        status: 'new',
        page: 1,
        limit: 20
      });
      
      await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const alerts = responseData.data.alerts;

      // 验证所有返回的告警都是new状态
      const nonNewAlerts = alerts.filter(alert => alert.status !== 'new');
      if (nonNewAlerts.length > 0) {
        throw new Error(`发现非new状态告警: ${nonNewAlerts.length}个`);
      }

      return { newAlertsCount: alerts.length };
    }, 'getAlerts');

    // 测试1.4: 按告警类型过滤
    await this.test('getAlerts - 按告警类型过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        alertType: 'equipment',
        page: 1,
        limit: 20
      });
      
      await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const alerts = responseData.data.alerts;

      // 验证所有返回的告警都是设备类型
      const nonEquipmentAlerts = alerts.filter(alert => alert.alertType !== 'equipment');
      if (nonEquipmentAlerts.length > 0) {
        throw new Error(`发现非equipment类型告警: ${nonEquipmentAlerts.length}个`);
      }

      return { equipmentAlertsCount: alerts.length };
    }, 'getAlerts');

    // 测试1.5: 分页功能测试
    await this.test('getAlerts - 分页功能测试', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        page: 1,
        limit: 3
      });
      
      await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const alerts = responseData.data.alerts;
      const pagination = responseData.data.pagination;

      if (alerts.length > 3) {
        throw new Error(`分页限制失效，返回了${alerts.length}个告警，应该最多3个`);
      }

      if (pagination.limit !== 3) {
        throw new Error('分页信息中的limit不正确');
      }

      return { pageSize: alerts.length, requestedLimit: 3 };
    }, 'getAlerts');

    // 测试1.6: 分配给我的告警过滤
    await this.test('getAlerts - 分配给我的告警过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        assignedToMe: 'true',
        page: 1,
        limit: 20
      });
      
      await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const alerts = responseData.data.alerts;

      // 验证所有告警都分配给了当前用户
      const notAssignedAlerts = alerts.filter(alert => 
        !alert.assignedTo || !alert.assignedTo.includes(adminId)
      );
      
      if (notAssignedAlerts.length > 0) {
        throw new Error(`发现未分配给当前用户的告警: ${notAssignedAlerts.length}个`);
      }

      return { myAlertsCount: alerts.length };
    }, 'getAlerts');

    // 测试1.7: 日期范围过滤
    await this.test('getAlerts - 日期范围过滤', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24小时前
      const endDate = new Date().toISOString();

      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        startDate,
        endDate,
        page: 1,
        limit: 20
      });
      
      await alertController.getAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const alerts = responseData.data.alerts;

      // 验证所有告警都在指定日期范围内
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      const outOfRangeAlerts = alerts.filter(alert => {
        const alertDate = new Date(alert.createdAt);
        return alertDate < startDateObj || alertDate > endDateObj;
      });
      
      if (outOfRangeAlerts.length > 0) {
        throw new Error(`发现超出日期范围的告警: ${outOfRangeAlerts.length}个`);
      }

      return { alertsInRange: alerts.length };
    }, 'getAlerts');
  }

  // 阶段2: acknowledgeAlert 功能测试
  async testAcknowledgeAlert() {
    this.log('✋ 阶段2: acknowledgeAlert 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const operatorId = this.testData.get('operatorUser');
    const newAlertId = this.testData.get('alert1'); // critical设备告警，状态为new

    if (!factoryId || !operatorId || !newAlertId) {
      this.log('❌ 跳过acknowledgeAlert测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: operatorId, 
      factoryId, 
      username: 'alert_operator',
      roleCode: 'operator' 
    };

    // 测试2.1: 成功确认告警
    await this.test('acknowledgeAlert - 成功确认告警', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: newAlertId });
      
      await alertController.acknowledgeAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('确认告警响应数据格式不正确');
      }

      const alert = responseData.data;

      if (alert.status !== 'acknowledged') {
        throw new Error(`告警状态应该是acknowledged，实际是${alert.status}`);
      }

      if (!alert.assignedTo || !alert.assignedTo.includes(operatorId)) {
        throw new Error('确认用户应该被添加到分配列表中');
      }

      return { alertId: alert.id, newStatus: alert.status };
    }, 'acknowledgeAlert');

    // 测试2.2: 确认不存在的告警
    await this.test('acknowledgeAlert - 确认不存在的告警', async () => {
      const nonExistentId = 'non-existent-alert-id';
      const mockReqRes = this.createMockReqRes(mockUser, { id: nonExistentId });
      
      try {
        await alertController.acknowledgeAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为告警不存在而失败');
      } catch (error) {
        if (error.message.includes('告警不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的告警' };
        }
        throw error;
      }
    }, 'acknowledgeAlert');

    // 测试2.3: 确认已经确认过的告警
    await this.test('acknowledgeAlert - 确认已确认的告警', async () => {
      // 使用已经是acknowledged状态的告警
      const acknowledgedAlertId = this.testData.get('alert2');
      const mockReqRes = this.createMockReqRes(mockUser, { id: acknowledgedAlertId });
      
      try {
        await alertController.acknowledgeAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为告警不是new状态而失败');
      } catch (error) {
        if (error.message.includes('只能确认新建状态的告警') || error.message.includes('ValidationError')) {
          return { message: '正确阻止了重复确认' };
        }
        throw error;
      }
    }, 'acknowledgeAlert');

    // 测试2.4: 跨工厂告警确认权限测试
    await this.test('acknowledgeAlert - 跨工厂告警权限测试', async () => {
      // 创建另一个工厂的告警来测试权限
      const otherFactory = await prisma.factory.create({
        data: {
          id: 'OTHER-FACTORY-TEST',
          name: '其他测试工厂',
          industry: '其他行业',
          industryCode: '999',
          regionCode: 'OT'
        }
      });

      const otherAlert = await prisma.alertNotification.create({
        data: {
          factoryId: otherFactory.id,
          alertType: 'quality',
          severity: 'medium',
          title: '其他工厂告警',
          message: '这是其他工厂的告警',
          status: 'new'
        }
      });

      try {
        const mockReqRes = this.createMockReqRes(mockUser, { id: otherAlert.id });
        await alertController.acknowledgeAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为跨工厂权限而失败');
      } catch (error) {
        if (error.message.includes('告警不存在')) {
          return { message: '正确阻止了跨工厂告警访问' };
        }
        throw error;
      } finally {
        // 清理测试数据
        await prisma.alertNotification.delete({ where: { id: otherAlert.id } });
        await prisma.factory.delete({ where: { id: otherFactory.id } });
      }
    }, 'acknowledgeAlert');
  }

  // 阶段3: resolveAlert 功能测试
  async testResolveAlert() {
    this.log('✅ 阶段3: resolveAlert 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const adminId = this.testData.get('adminUser');
    const inProgressAlertId = this.testData.get('alert3'); // production告警，状态为in_progress

    if (!factoryId || !adminId || !inProgressAlertId) {
      this.log('❌ 跳过resolveAlert测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: adminId, 
      factoryId, 
      username: 'alert_admin',
      roleCode: 'department_admin' 
    };

    // 测试3.1: 成功解决告警
    await this.test('resolveAlert - 成功解决告警', async () => {
      const resolutionNotes = '问题已排查并解决，生产进度已恢复正常';
      const mockReqRes = this.createMockReqRes(
        mockUser, 
        { id: inProgressAlertId },
        {},
        { resolutionNotes }
      );
      
      await alertController.resolveAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('解决告警响应数据格式不正确');
      }

      const alert = responseData.data;

      if (alert.status !== 'resolved') {
        throw new Error(`告警状态应该是resolved，实际是${alert.status}`);
      }

      if (alert.resolvedBy !== adminId) {
        throw new Error('解决者ID不正确');
      }

      if (!alert.resolvedAt) {
        throw new Error('缺少解决时间');
      }

      if (alert.resolutionNotes !== resolutionNotes) {
        throw new Error('解决说明不正确');
      }

      return { 
        alertId: alert.id, 
        newStatus: alert.status,
        resolvedBy: alert.resolvedBy,
        resolutionNotes: alert.resolutionNotes
      };
    }, 'resolveAlert');

    // 测试3.2: 解决不存在的告警
    await this.test('resolveAlert - 解决不存在的告警', async () => {
      const nonExistentId = 'non-existent-resolve-id';
      const mockReqRes = this.createMockReqRes(
        mockUser, 
        { id: nonExistentId },
        {},
        { resolutionNotes: '测试解决说明' }
      );
      
      try {
        await alertController.resolveAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为告警不存在而失败');
      } catch (error) {
        if (error.message.includes('告警不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的告警' };
        }
        throw error;
      }
    }, 'resolveAlert');

    // 测试3.3: 解决已经解决的告警
    await this.test('resolveAlert - 解决已解决的告警', async () => {
      const resolvedAlertId = this.testData.get('alert5'); // 已解决的安全告警
      const mockReqRes = this.createMockReqRes(
        mockUser, 
        { id: resolvedAlertId },
        {},
        { resolutionNotes: '重复解决测试' }
      );
      
      try {
        await alertController.resolveAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为告警已解决而失败');
      } catch (error) {
        if (error.message.includes('告警已经解决或关闭') || error.message.includes('ValidationError')) {
          return { message: '正确阻止了重复解决' };
        }
        throw error;
      }
    }, 'resolveAlert');

    // 测试3.4: 无解决说明的告警解决
    await this.test('resolveAlert - 无解决说明的告警解决', async () => {
      const newAlertId = this.testData.get('alert4'); // quality告警，状态为new
      const mockReqRes = this.createMockReqRes(
        mockUser, 
        { id: newAlertId },
        {},
        {} // 没有resolutionNotes
      );
      
      await alertController.resolveAlert(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('解决告警响应数据格式不正确');
      }

      const alert = responseData.data;

      if (alert.status !== 'resolved') {
        throw new Error(`告警状态应该是resolved，实际是${alert.status}`);
      }

      if (alert.resolutionNotes !== null) {
        throw new Error('无解决说明时resolutionNotes应该是null');
      }

      return { 
        alertId: alert.id, 
        newStatus: alert.status,
        hasNotes: alert.resolutionNotes !== null
      };
    }, 'resolveAlert');
  }

  // 阶段4: getAlertStatistics 功能测试
  async testGetAlertStatistics() {
    this.log('📊 阶段4: getAlertStatistics 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const adminId = this.testData.get('adminUser');

    if (!factoryId || !adminId) {
      this.log('❌ 跳过getAlertStatistics测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: adminId, 
      factoryId, 
      username: 'alert_admin',
      roleCode: 'department_admin' 
    };

    // 测试4.1: 基本统计数据获取
    await this.test('getAlertStatistics - 基本统计数据获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await alertController.getAlertStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('统计数据响应格式不正确');
      }

      const data = responseData.data;

      // 验证响应结构
      if (!data.summary || typeof data.summary.total !== 'number') {
        throw new Error('缺少summary.total统计');
      }

      if (!data.distribution || !data.distribution.severity || !Array.isArray(data.distribution.severity)) {
        throw new Error('缺少severity分布统计');
      }

      if (!data.distribution.status || !Array.isArray(data.distribution.status)) {
        throw new Error('缺少status分布统计');
      }

      if (!data.distribution.type || !Array.isArray(data.distribution.type)) {
        throw new Error('缺少type分布统计');
      }

      // 验证统计数据合理性
      const severityStats = data.distribution.severity;
      const totalFromSeverity = severityStats.reduce((sum, stat) => sum + stat.count, 0);
      
      if (totalFromSeverity === 0) {
        throw new Error('严重程度统计应该有数据');
      }

      return { 
        totalAlerts: data.summary.total,
        activeAlerts: data.summary.active,
        criticalAlerts: data.summary.critical,
        avgResolutionHours: data.summary.avgResolutionHours,
        severityDistribution: severityStats.length
      };
    }, 'getAlertStatistics');

    // 测试4.2: 按日期范围统计
    await this.test('getAlertStatistics - 按日期范围统计', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7天前
      const endDate = new Date().toISOString();

      const mockReqRes = this.createMockReqRes(mockUser, {}, { startDate, endDate });
      
      await alertController.getAlertStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const data = responseData.data;

      if (!data.dateRange || !data.dateRange.start || !data.dateRange.end) {
        throw new Error('缺少日期范围信息');
      }

      // 验证日期范围
      const responseStartDate = new Date(data.dateRange.start);
      const responseEndDate = new Date(data.dateRange.end);
      const requestStartDate = new Date(startDate);
      const requestEndDate = new Date(endDate);

      if (Math.abs(responseStartDate - requestStartDate) > 60000) { // 允许1分钟误差
        throw new Error('开始日期不匹配');
      }

      if (Math.abs(responseEndDate - requestEndDate) > 60000) {
        throw new Error('结束日期不匹配');
      }

      return { 
        dateRangeStart: data.dateRange.start,
        dateRangeEnd: data.dateRange.end,
        totalInRange: data.summary.total
      };
    }, 'getAlertStatistics');

    // 测试4.3: 按告警类型统计
    await this.test('getAlertStatistics - 按告警类型统计', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { alertType: 'equipment' });
      
      await alertController.getAlertStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const data = responseData.data;

      // 验证只统计了equipment类型的告警
      const typeStats = data.distribution.type;
      const nonEquipmentTypes = typeStats.filter(stat => stat.type !== 'equipment');
      
      if (nonEquipmentTypes.length > 0) {
        throw new Error(`统计包含了非equipment类型: ${nonEquipmentTypes.map(t => t.type).join(', ')}`);
      }

      return { 
        filteredType: 'equipment',
        equipmentAlerts: typeStats.find(t => t.type === 'equipment')?.count || 0
      };
    }, 'getAlertStatistics');

    // 测试4.4: 平均解决时间计算验证
    await this.test('getAlertStatistics - 平均解决时间计算', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await alertController.getAlertStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const data = responseData.data;

      const avgResolutionHours = data.summary.avgResolutionHours;
      
      // 验证平均解决时间是数字且合理
      if (typeof avgResolutionHours !== 'number') {
        throw new Error('平均解决时间应该是数字');
      }

      if (avgResolutionHours < 0) {
        throw new Error('平均解决时间不能为负数');
      }

      // 手动计算验证
      const resolvedAlerts = await prisma.alertNotification.findMany({
        where: {
          factoryId,
          status: 'resolved',
          resolvedAt: { not: null }
        },
        select: { createdAt: true, resolvedAt: true }
      });

      let manualAvg = 0;
      if (resolvedAlerts.length > 0) {
        const totalTime = resolvedAlerts.reduce((sum, alert) => {
          return sum + (new Date(alert.resolvedAt) - new Date(alert.createdAt));
        }, 0);
        manualAvg = totalTime / resolvedAlerts.length / (1000 * 60 * 60); // 转换为小时
      }

      // 允许小的舍入误差
      const difference = Math.abs(avgResolutionHours - manualAvg);
      if (difference > 0.1) {
        throw new Error(`平均解决时间计算不准确，API返回${avgResolutionHours}，手动计算${manualAvg}`);
      }

      return { 
        avgResolutionHours,
        resolvedAlertsCount: resolvedAlerts.length,
        calculationAccuracy: difference < 0.1
      };
    }, 'getAlertStatistics');
  }

  // 阶段5: getAlertsSummary 功能测试
  async testGetAlertsSummary() {
    this.log('📋 阶段5: getAlertsSummary 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const operatorId = this.testData.get('operatorUser');

    if (!factoryId || !operatorId) {
      this.log('❌ 跳过getAlertsSummary测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: operatorId, 
      factoryId, 
      username: 'alert_operator',
      roleCode: 'operator' 
    };

    // 测试5.1: 基本摘要数据获取
    await this.test('getAlertsSummary - 基本摘要数据获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await alertController.getAlertsSummary(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('摘要数据响应格式不正确');
      }

      const data = responseData.data;

      // 验证响应结构
      if (!data.activeBySeverity) {
        throw new Error('缺少activeBySeverity数据');
      }

      if (!Array.isArray(data.urgentAlerts)) {
        throw new Error('urgentAlerts应该是数组');
      }

      if (typeof data.todayCount !== 'number') {
        throw new Error('todayCount应该是数字');
      }

      if (typeof data.myPendingCount !== 'number') {
        throw new Error('myPendingCount应该是数字');
      }

      if (!data.overallStatus) {
        throw new Error('缺少overallStatus');
      }

      // 验证严重程度统计结构
      const activeBySeverity = data.activeBySeverity;
      const requiredSeverities = ['critical', 'high', 'medium', 'low'];
      
      for (const severity of requiredSeverities) {
        if (typeof activeBySeverity[severity] !== 'number') {
          throw new Error(`缺少${severity}严重程度统计`);
        }
      }

      return { 
        criticalCount: activeBySeverity.critical,
        highCount: activeBySeverity.high,
        mediumCount: activeBySeverity.medium,
        lowCount: activeBySeverity.low,
        urgentAlertsCount: data.urgentAlerts.length,
        todayCount: data.todayCount,
        myPendingCount: data.myPendingCount,
        overallStatus: data.overallStatus
      };
    }, 'getAlertsSummary');

    // 测试5.2: 紧急告警列表验证
    await this.test('getAlertsSummary - 紧急告警列表验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await alertController.getAlertsSummary(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const data = responseData.data;

      const urgentAlerts = data.urgentAlerts;

      // 验证紧急告警都是高优先级且活跃的
      for (const alert of urgentAlerts) {
        if (!['high', 'critical'].includes(alert.severity)) {
          throw new Error(`紧急告警包含了非高优先级告警: ${alert.severity}`);
        }

        if (!['new', 'acknowledged', 'in_progress'].includes(alert.status)) {
          throw new Error(`紧急告警包含了非活跃状态告警: ${alert.status}`);
        }

        // 验证告警结构
        if (!alert.id || !alert.title || !alert.createdAt) {
          throw new Error('紧急告警缺少必要字段');
        }
      }

      // 验证数量限制（最多5个）
      if (urgentAlerts.length > 5) {
        throw new Error(`紧急告警数量超过限制: ${urgentAlerts.length} > 5`);
      }

      // 验证排序（按创建时间倒序）
      for (let i = 1; i < urgentAlerts.length; i++) {
        const prevDate = new Date(urgentAlerts[i - 1].createdAt);
        const currDate = new Date(urgentAlerts[i].createdAt);
        
        if (prevDate < currDate) {
          throw new Error('紧急告警未按创建时间倒序排列');
        }
      }

      return { 
        urgentAlertsValid: true,
        urgentAlertsCount: urgentAlerts.length,
        maxSeverity: urgentAlerts.length > 0 ? urgentAlerts[0].severity : 'none'
      };
    }, 'getAlertsSummary');

    // 测试5.3: 今日告警统计验证
    await this.test('getAlertsSummary - 今日告警统计验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await alertController.getAlertsSummary(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const data = responseData.data;

      const todayCount = data.todayCount;

      // 手动计算今日告警数量进行验证
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const manualTodayCount = await prisma.alertNotification.count({
        where: {
          factoryId,
          createdAt: { gte: todayStart }
        }
      });

      if (todayCount !== manualTodayCount) {
        throw new Error(`今日告警统计不准确，API返回${todayCount}，手动计算${manualTodayCount}`);
      }

      return { 
        todayCount,
        manualCount: manualTodayCount,
        accurate: todayCount === manualTodayCount
      };
    }, 'getAlertsSummary');

    // 测试5.4: 我的待处理告警统计验证
    await this.test('getAlertsSummary - 我的待处理告警统计', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await alertController.getAlertsSummary(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const data = responseData.data;

      const myPendingCount = data.myPendingCount;

      // 手动计算待处理告警数量
      const manualPendingCount = await prisma.alertNotification.count({
        where: {
          factoryId,
          status: { in: ['new', 'acknowledged', 'in_progress'] },
          assignedTo: {
            path: '$',
            array_contains: operatorId
          }
        }
      });

      if (myPendingCount !== manualPendingCount) {
        throw new Error(`我的待处理告警统计不准确，API返回${myPendingCount}，手动计算${manualPendingCount}`);
      }

      return { 
        myPendingCount,
        manualCount: manualPendingCount,
        accurate: myPendingCount === manualPendingCount
      };
    }, 'getAlertsSummary');

    // 测试5.5: 整体状态判断验证
    await this.test('getAlertsSummary - 整体状态判断验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await alertController.getAlertsSummary(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('响应数据格式不正确');
      }
      
      const data = responseData.data;

      const overallStatus = data.overallStatus;
      const urgentAlerts = data.urgentAlerts;
      const todayCount = data.todayCount;

      // 验证状态判断逻辑
      let expectedStatus;
      if (urgentAlerts.length > 0) {
        expectedStatus = 'urgent';
      } else if (todayCount > 5) {
        expectedStatus = 'attention';
      } else {
        expectedStatus = 'normal';
      }

      if (overallStatus !== expectedStatus) {
        throw new Error(`整体状态判断不正确，期望${expectedStatus}，实际${overallStatus}`);
      }

      if (!['urgent', 'attention', 'normal'].includes(overallStatus)) {
        throw new Error(`整体状态值不正确: ${overallStatus}`);
      }

      return { 
        overallStatus,
        expectedStatus,
        urgentAlertsCount: urgentAlerts.length,
        todayCount,
        statusLogicCorrect: overallStatus === expectedStatus
      };
    }, 'getAlertsSummary');
  }

  // 清理测试数据
  async cleanupTestData() {
    this.log('🧹 清理告警测试数据', 'phase');
    
    try {
      // 删除测试告警
      await prisma.alertNotification.deleteMany({
        where: {
          OR: [
            { factoryId: { contains: '-%' } }, // 工厂ID格式
            { title: { contains: '告警测试' } },
            { title: { contains: '设备过热' } },
            { title: { contains: '批次进度' } },
            { title: { contains: '产品质量' } },
            { title: { contains: '安全事故' } },
            { title: { contains: '维护提醒' } }
          ]
        }
      });

      // 删除测试批次
      await prisma.processingBatch.deleteMany({
        where: { batchNumber: { contains: 'ALERT_' } }
      });

      // 删除测试设备
      await prisma.factoryEquipment.deleteMany({
        where: { equipmentCode: { contains: 'ALERT_' } }
      });

      // 删除测试用户
      await prisma.user.deleteMany({
        where: { username: { contains: 'alert_' } }
      });

      // 删除测试工厂
      await prisma.factory.deleteMany({
        where: {
          OR: [
            { name: { contains: '告警测试' } },
            { id: { contains: '-%' } }
          ]
        }
      });

      return { message: '告警测试数据清理完成' };
    } catch (error) {
      this.log(`清理过程中出现错误: ${error.message}`, 'warning');
      return { message: '告警测试数据部分清理' };
    }
  }

  // 主测试执行器
  async runAllTests() {
    console.log(chalk.cyan.bold('🔔 白垩纪食品溯源系统 - 告警系统完整测试'));
    console.log(chalk.cyan('📊 测试范围: alertController.js 5个核心功能'));
    console.log(chalk.cyan(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`));

    const startTime = Date.now();

    try {
      // 设置基础测试数据
      const baseData = await this.setupTestData();
      if (!baseData) {
        throw new Error('基础测试数据设置失败');
      }

      // 创建测试告警数据
      await this.createTestAlerts();

      // 按阶段执行告警功能测试
      await this.testGetAlerts();
      await this.testAcknowledgeAlert();
      await this.testResolveAlert();
      await this.testGetAlertStatistics();
      await this.testGetAlertsSummary();

    } catch (criticalError) {
      this.log(`💥 关键告警测试失败: ${criticalError.message}`, 'error');
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
    this.log('🔔 告警系统完整测试完成', 'phase');
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
    console.log(chalk.cyan('\n💡 告警系统测试结论:'));
    const successRate = (this.testResults.passed / this.testResults.total) * 100;
    if (successRate >= 90) {
      console.log(chalk.green('   🎉 告警系统功能优秀！所有核心功能正常'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow('   ⚠️ 告警系统基本正常，部分功能需要改进'));
    } else {
      console.log(chalk.red('   🚨 告警系统存在较多问题，需要重点修复'));
    }

    console.log(chalk.cyan(`\n🔔 告警系统健康度: ${successRate.toFixed(1)}%`));

    // 功能完整性评估
    const functionsTestedCount = Object.values(this.testResults.functionResults)
      .filter(result => result.passed + result.failed > 0).length;
    
    console.log(chalk.cyan(`\n🎯 功能覆盖度: ${functionsTestedCount}/5 个核心功能`));

    // 设置退出码
    if (successRate >= 85 && functionsTestedCount >= 5) {
      console.log(chalk.green('\n✅ 告警系统测试达到可接受标准'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ 告警系统测试未达标，需要修复'));
      process.exit(1);
    }
  }
}

// 执行告警系统测试
console.log(chalk.blue('正在初始化告警系统测试器...'));
const tester = new AlertSystemTester();

tester.runAllTests().catch(error => {
  console.error(chalk.red('告警系统测试执行过程中发生致命错误:'), error);
  process.exit(1);
});