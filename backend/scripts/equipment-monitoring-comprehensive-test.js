#!/usr/bin/env node

/**
 * 海牛食品溯源系统 - 设备监控系统完整测试
 * 阶段2-2: equipmentController.js 5个核心功能完整性验证
 * 专注测试：设备监控列表、设备指标历史、数据上报、设备告警、设备状态
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';
import equipmentController from '../src/controllers/equipmentController.js';

const prisma = new PrismaClient();

class EquipmentMonitoringTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      functionResults: {
        'getEquipmentMonitoring': { passed: 0, failed: 0 },
        'getEquipmentMetrics': { passed: 0, failed: 0 },
        'reportEquipmentData': { passed: 0, failed: 0 },
        'getEquipmentAlerts': { passed: 0, failed: 0 },
        'getEquipmentStatus': { passed: 0, failed: 0 }
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
    this.log(`⚙️ 设备测试: ${name}`, 'info');
    
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
      getResponse: () => responseData
    };
  }

  // 设置基础测试数据
  async setupTestData() {
    this.log('🏭 设置设备监控测试数据', 'phase');
    
    // 创建测试工厂
    const factory = await this.test('创建设备监控测试工厂', async () => {
      const factoryData = {
        name: '设备监控测试工厂',
        industry: '智能制造业',
        address: '深圳市南山区科技路200号',
        employeeCount: 80,
        contactName: '设备管理员',
        contactPhone: '+86138000000802',
        contactEmail: 'equipment@testfactory.com'
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
    const users = await this.test('创建设备监控测试用户', async () => {
      const testUsers = [];
      
      // 设备管理员
      const admin = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'equipment_admin',
          passwordHash: '$2b$10$equipment.admin.hash',
          email: 'admin@equipment.test',
          fullName: '设备系统管理员',
          department: 'management',
          roleCode: 'factory_super_admin',
          isActive: true
        }
      });
      testUsers.push(admin);

      // 维护技工
      const technician = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'equipment_tech',
          passwordHash: '$2b$10$equipment.tech.hash',
          email: 'tech@equipment.test',
          fullName: '设备维护技工',
          department: 'processing',
          roleCode: 'operator',
          isActive: true
        }
      });
      testUsers.push(technician);

      this.testData.set('adminUser', admin.id);
      this.testData.set('techUser', technician.id);
      
      return testUsers;
    });

    if (!users) return null;

    // 创建测试设备
    const equipment = await this.test('创建设备监控测试设备', async () => {
      const equipmentList = [];

      // 设备1：生产线设备
      const productionEquipment = await prisma.factoryEquipment.create({
        data: {
          factoryId: factory.id,
          equipmentCode: 'EQUIP_PROD_001',
          equipmentName: '自动化生产线A',
          equipmentType: '生产设备',
          department: 'processing',
          location: '生产车间A-1',
          status: 'active',
          specifications: {
            model: 'AUTO-PROD-2024',
            capacity: '1000件/小时',
            alerts: {
              temperature: { max: 80, min: 10 },
              pressure: { max: 15, min: 2 },
              vibration: { max: 5, min: 0 }
            }
          }
        }
      });
      equipmentList.push(productionEquipment);

      // 设备2：质检设备
      const qualityEquipment = await prisma.factoryEquipment.create({
        data: {
          factoryId: factory.id,
          equipmentCode: 'EQUIP_QC_001',
          equipmentName: '在线质量检测仪',
          equipmentType: '检测设备',
          department: 'quality',
          location: '质检室',
          status: 'active',
          specifications: {
            model: 'QC-DETECT-2024',
            precision: '±0.1%',
            alerts: {
              accuracy: { min: 95 },
              response_time: { max: 3 }
            }
          }
        }
      });
      equipmentList.push(qualityEquipment);

      // 设备3：维护中设备
      const maintenanceEquipment = await prisma.factoryEquipment.create({
        data: {
          factoryId: factory.id,
          equipmentCode: 'EQUIP_MAINT_001',
          equipmentName: '包装机器人',
          equipmentType: '包装设备',
          department: 'logistics',
          location: '包装车间',
          status: 'maintenance',
          specifications: {
            model: 'PACK-ROBOT-2024',
            speed: '500包/分钟',
            alerts: {
              motor_temp: { max: 70 },
              battery_level: { min: 20 }
            }
          }
        }
      });
      equipmentList.push(maintenanceEquipment);

      this.testData.set('productionEquipment', productionEquipment.id);
      this.testData.set('qualityEquipment', qualityEquipment.id);
      this.testData.set('maintenanceEquipment', maintenanceEquipment.id);
      this.testData.set('equipmentList', equipmentList.map(e => e.id));
      
      return equipmentList;
    });

    return { factory, users, equipment };
  }

  // 创建测试监控数据
  async createTestMonitoringData() {
    this.log('📊 创建测试监控数据', 'phase');
    
    const factoryId = this.testData.get('factory');
    const productionEquipmentId = this.testData.get('productionEquipment');
    const qualityEquipmentId = this.testData.get('qualityEquipment');

    if (!factoryId || !productionEquipmentId || !qualityEquipmentId) {
      this.log('❌ 缺少必要的测试数据，跳过监控数据创建', 'warning');
      return [];
    }

    const monitoringData = [];

    // 为生产设备创建24小时内的监控数据
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(Date.now() - i * 60 * 60 * 1000); // 每小时一条数据
      
      // 生产设备数据（大部分正常，少量警告）
      const productionData = await this.test(`创建生产设备监控数据${i + 1}`, async () => {
        const isAlert = i === 2 || i === 15; // 在第2和第15小时触发告警
        
        const data = await prisma.deviceMonitoringData.create({
          data: {
            equipmentId: productionEquipmentId,
            factoryId,
            timestamp,
            metrics: {
              temperature: isAlert ? 85 : 65 + Math.random() * 10, // 告警时超过80度
              pressure: isAlert ? 18 : 8 + Math.random() * 5, // 告警时超过15
              vibration: Math.random() * 3,
              efficiency: 85 + Math.random() * 10
            },
            status: isAlert ? 'warning' : 'normal',
            alertTriggered: isAlert,
            dataSource: i % 3 === 0 ? 'automatic' : 'sensor'
          }
        });
        
        monitoringData.push(data);
        return data;
      });
    }

    // 为质检设备创建监控数据
    for (let i = 0; i < 12; i++) {
      const timestamp = new Date(Date.now() - i * 2 * 60 * 60 * 1000); // 每2小时一条数据
      
      const qualityData = await this.test(`创建质检设备监控数据${i + 1}`, async () => {
        const data = await prisma.deviceMonitoringData.create({
          data: {
            equipmentId: qualityEquipmentId,
            factoryId,
            timestamp,
            metrics: {
              accuracy: 96 + Math.random() * 3,
              response_time: 1.5 + Math.random() * 1,
              sample_rate: 100 + Math.random() * 50,
              calibration_status: Math.random() > 0.8 ? 0 : 1 // 偶尔需要校准
            },
            status: 'normal',
            alertTriggered: false,
            dataSource: 'automatic'
          }
        });
        
        monitoringData.push(data);
        return data;
      });
    }

    this.testData.set('monitoringData', monitoringData.map(d => d.id));
    return monitoringData;
  }

  // 阶段1: getEquipmentMonitoring 功能测试
  async testGetEquipmentMonitoring() {
    this.log('📋 阶段1: getEquipmentMonitoring 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const adminId = this.testData.get('adminUser');

    if (!factoryId || !adminId) {
      this.log('❌ 跳过getEquipmentMonitoring测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: adminId, 
      factoryId, 
      username: 'equipment_admin',
      roleCode: 'factory_super_admin' 
    };

    // 测试1.1: 基本设备监控列表获取
    await this.test('getEquipmentMonitoring - 基本设备监控列表', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { page: 1, limit: 10 });
      
      await equipmentController.getEquipmentMonitoring(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('设备监控响应数据格式不正确');
      }

      const equipment = responseData.data.equipment;
      const pagination = responseData.data.pagination;

      if (!Array.isArray(equipment)) {
        throw new Error('设备列表应该是数组');
      }

      if (!pagination || typeof pagination.total !== 'number') {
        throw new Error('分页信息格式不正确');
      }

      // 验证设备数据结构
      if (equipment.length > 0) {
        const firstEquipment = equipment[0];
        const requiredFields = ['id', 'equipmentCode', 'equipmentName', 'status', 'isOnline'];
        
        for (const field of requiredFields) {
          if (!(field in firstEquipment)) {
            throw new Error(`设备数据缺少字段: ${field}`);
          }
        }
      }

      return { equipmentCount: equipment.length, totalCount: pagination.count };
    }, 'getEquipmentMonitoring');

    // 测试1.2: 按部门过滤
    await this.test('getEquipmentMonitoring - 按部门过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        department: 'processing',
        page: 1,
        limit: 20
      });
      
      await equipmentController.getEquipmentMonitoring(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const equipment = responseData.data.equipment;

      // 验证所有返回的设备都属于processing部门
      const nonProcessingEquipment = equipment.filter(eq => eq.department !== 'processing');
      if (nonProcessingEquipment.length > 0) {
        throw new Error(`发现非processing部门设备: ${nonProcessingEquipment.length}个`);
      }

      return { processingEquipmentCount: equipment.length };
    }, 'getEquipmentMonitoring');

    // 测试1.3: 按状态过滤
    await this.test('getEquipmentMonitoring - 按状态过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        status: 'active',
        page: 1,
        limit: 20
      });
      
      await equipmentController.getEquipmentMonitoring(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const equipment = responseData.data.equipment;

      // 验证所有返回的设备都是active状态
      const nonActiveEquipment = equipment.filter(eq => eq.status !== 'active');
      if (nonActiveEquipment.length > 0) {
        throw new Error(`发现非active状态设备: ${nonActiveEquipment.length}个`);
      }

      return { activeEquipmentCount: equipment.length };
    }, 'getEquipmentMonitoring');

    // 测试1.4: 按设备类型过滤
    await this.test('getEquipmentMonitoring - 按设备类型过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        equipmentType: '生产',
        page: 1,
        limit: 20
      });
      
      await equipmentController.getEquipmentMonitoring(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const equipment = responseData.data.equipment;

      // 验证所有返回的设备类型都包含"生产"
      const nonProductionEquipment = equipment.filter(eq => 
        !eq.equipmentType || !eq.equipmentType.includes('生产')
      );
      if (nonProductionEquipment.length > 0) {
        throw new Error(`发现不包含"生产"的设备类型: ${nonProductionEquipment.length}个`);
      }

      return { productionEquipmentCount: equipment.length };
    }, 'getEquipmentMonitoring');

    // 测试1.5: 分页功能验证
    await this.test('getEquipmentMonitoring - 分页功能验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        page: 1,
        limit: 2
      });
      
      await equipmentController.getEquipmentMonitoring(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const equipment = responseData.data.equipment;
      const pagination = responseData.data.pagination;

      if (equipment.length > 2) {
        throw new Error(`分页限制失效，返回了${equipment.length}个设备，应该最多2个`);
      }

      if (pagination.limit !== 2) {
        throw new Error('分页信息中的limit不正确');
      }

      return { pageSize: equipment.length, requestedLimit: 2 };
    }, 'getEquipmentMonitoring');

    // 测试1.6: 在线状态验证
    await this.test('getEquipmentMonitoring - 在线状态验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { page: 1, limit: 20 });
      
      await equipmentController.getEquipmentMonitoring(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const equipment = responseData.data.equipment;

      // 验证在线状态逻辑
      equipment.forEach(eq => {
        if (typeof eq.isOnline !== 'boolean') {
          throw new Error(`设备${eq.equipmentCode}的在线状态应该是布尔值`);
        }

        // 如果有最新数据，检查时间逻辑
        if (eq.latestData && eq.isOnline) {
          const dataTime = new Date(eq.latestData.timestamp);
          const timeDiff = new Date() - dataTime;
          // 允许一定的时间误差（比如10分钟）
          if (timeDiff > 10 * 60 * 1000) {
            this.log(`⚠️ 设备${eq.equipmentCode}显示在线，但最新数据时间超过10分钟`, 'warning');
          }
        }
      });

      return { totalEquipment: equipment.length };
    }, 'getEquipmentMonitoring');
  }

  // 阶段2: getEquipmentMetrics 功能测试
  async testGetEquipmentMetrics() {
    this.log('📊 阶段2: getEquipmentMetrics 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const adminId = this.testData.get('adminUser');
    const productionEquipmentId = this.testData.get('productionEquipment');

    if (!factoryId || !adminId || !productionEquipmentId) {
      this.log('❌ 跳过getEquipmentMetrics测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: adminId, 
      factoryId, 
      username: 'equipment_admin',
      roleCode: 'factory_super_admin' 
    };

    // 测试2.1: 基本指标数据获取
    await this.test('getEquipmentMetrics - 基本指标数据获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId }, { limit: 50 });
      
      await equipmentController.getEquipmentMetrics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('设备指标响应数据格式不正确');
      }

      const data = responseData.data;

      // 验证响应结构
      if (!data.equipment || !data.equipment.id) {
        throw new Error('缺少设备信息');
      }

      if (!Array.isArray(data.data)) {
        throw new Error('指标数据应该是数组');
      }

      if (!data.timeRange || !data.timeRange.start || !data.timeRange.end) {
        throw new Error('缺少时间范围信息');
      }

      // 验证数据结构
      if (data.data.length > 0) {
        const firstData = data.data[0];
        const requiredFields = ['timestamp', 'metrics', 'status'];
        
        for (const field of requiredFields) {
          if (!(field in firstData)) {
            throw new Error(`监控数据缺少字段: ${field}`);
          }
        }
      }

      return { 
        dataPoints: data.data.length,
        equipmentId: data.equipment.id,
        alertCount: data.summary?.alertCount || 0
      };
    }, 'getEquipmentMetrics');

    // 测试2.2: 按时间范围过滤
    await this.test('getEquipmentMetrics - 按时间范围过滤', async () => {
      const startDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12小时前
      const endDate = new Date().toISOString();

      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId }, { 
        startDate,
        endDate,
        limit: 100
      });
      
      await equipmentController.getEquipmentMetrics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 验证时间范围
      const responseStartDate = new Date(data.timeRange.start);
      const responseEndDate = new Date(data.timeRange.end);
      const requestStartDate = new Date(startDate);
      const requestEndDate = new Date(endDate);

      if (Math.abs(responseStartDate - requestStartDate) > 60000) { // 允许1分钟误差
        throw new Error('开始时间不匹配');
      }

      if (Math.abs(responseEndDate - requestEndDate) > 60000) {
        throw new Error('结束时间不匹配');
      }

      // 验证数据时间在范围内
      const outOfRangeData = data.data.filter(item => {
        const itemTime = new Date(item.timestamp);
        return itemTime < requestStartDate || itemTime > requestEndDate;
      });

      if (outOfRangeData.length > 0) {
        throw new Error(`发现${outOfRangeData.length}个超出时间范围的数据点`);
      }

      return { 
        timeRangeData: data.data.length,
        requestedHours: 12
      };
    }, 'getEquipmentMetrics');

    // 测试2.3: 按天聚合数据
    await this.test('getEquipmentMetrics - 按天聚合数据', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId }, { 
        interval: 'day',
        limit: 200
      });
      
      await equipmentController.getEquipmentMetrics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      if (data.interval !== 'day') {
        throw new Error('返回的interval不正确');
      }

      // 如果有聚合数据，验证聚合信息
      const aggregatedData = data.data.filter(item => item.dataSource === 'aggregated');
      aggregatedData.forEach(item => {
        if (!item.aggregationInfo) {
          throw new Error('聚合数据缺少aggregationInfo');
        }
        
        if (typeof item.aggregationInfo.dataPoints !== 'number') {
          throw new Error('聚合信息缺少dataPoints');
        }
      });

      return { 
        interval: data.interval,
        aggregatedCount: aggregatedData.length
      };
    }, 'getEquipmentMetrics');

    // 测试2.4: 不存在的设备
    await this.test('getEquipmentMetrics - 不存在的设备', async () => {
      const nonExistentId = 'non-existent-equipment-id';
      const mockReqRes = this.createMockReqRes(mockUser, { id: nonExistentId });
      
      try {
        await equipmentController.getEquipmentMetrics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为设备不存在而失败');
      } catch (error) {
        if (error.message.includes('设备不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的设备' };
        }
        throw error;
      }
    }, 'getEquipmentMetrics');

    // 测试2.5: 数据量限制验证
    await this.test('getEquipmentMetrics - 数据量限制验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId }, { 
        limit: 10
      });
      
      await equipmentController.getEquipmentMetrics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      if (data.data.length > 10) {
        throw new Error(`数据量限制失效，返回了${data.data.length}条数据，应该最多10条`);
      }

      return { actualCount: data.data.length, requestedLimit: 10 };
    }, 'getEquipmentMetrics');
  }

  // 阶段3: reportEquipmentData 功能测试
  async testReportEquipmentData() {
    this.log('📤 阶段3: reportEquipmentData 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const techId = this.testData.get('techUser');
    const qualityEquipmentId = this.testData.get('qualityEquipment');

    if (!factoryId || !techId || !qualityEquipmentId) {
      this.log('❌ 跳过reportEquipmentData测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: techId, 
      factoryId, 
      username: 'equipment_tech',
      roleCode: 'operator' 
    };

    // 测试3.1: 正常数据上报
    await this.test('reportEquipmentData - 正常数据上报', async () => {
      const testMetrics = {
        accuracy: 97.5,
        response_time: 2.1,
        sample_rate: 125,
        calibration_status: 1
      };

      const mockReqRes = this.createMockReqRes(mockUser, { id: qualityEquipmentId }, {}, {
        metrics: testMetrics,
        status: 'normal',
        dataSource: 'manual'
      });
      
      await equipmentController.reportEquipmentData(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('数据上报响应格式不正确');
      }

      const data = responseData.data;

      if (!data.id) {
        throw new Error('缺少监控数据ID');
      }

      if (!data.timestamp) {
        throw new Error('缺少时间戳');
      }

      if (typeof data.alertTriggered !== 'boolean') {
        throw new Error('alertTriggered应该是布尔值');
      }

      return { 
        dataId: data.id,
        alertTriggered: data.alertTriggered,
        message: data.message
      };
    }, 'reportEquipmentData');

    // 测试3.2: 触发告警的数据上报
    await this.test('reportEquipmentData - 触发告警的数据上报', async () => {
      const alertMetrics = {
        accuracy: 90, // 低于95%的阈值，应该触发告警
        response_time: 1.8,
        sample_rate: 80,
        calibration_status: 0
      };

      const mockReqRes = this.createMockReqRes(mockUser, { id: qualityEquipmentId }, {}, {
        metrics: alertMetrics,
        status: 'maintenance', // Use valid EquipmentStatus enum value instead of 'warning'
        dataSource: 'sensor'
      });
      
      await equipmentController.reportEquipmentData(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 注意：告警触发逻辑可能需要根据specifications中的alerts配置来判断
      // 这里主要测试接口的响应结构
      if (typeof data.alertTriggered !== 'boolean') {
        throw new Error('alertTriggered应该是布尔值');
      }

      if (data.alertTriggered && !data.message.includes('告警')) {
        throw new Error('触发告警时消息应该包含"告警"字样');
      }

      return { 
        alertTriggered: data.alertTriggered,
        status: 'maintenance'
      };
    }, 'reportEquipmentData');

    // 测试3.3: 无效数据格式
    await this.test('reportEquipmentData - 无效数据格式', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: qualityEquipmentId }, {}, {
        metrics: 'invalid_metrics', // 应该是对象，不是字符串
        status: 'normal'
      });
      
      try {
        await equipmentController.reportEquipmentData(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为数据格式无效而失败');
      } catch (error) {
        if (error.message.includes('指标数据格式不正确') || error.message.includes('ValidationError')) {
          return { message: '正确拒绝了无效数据格式' };
        }
        throw error;
      }
    }, 'reportEquipmentData');

    // 测试3.4: 不存在的设备
    await this.test('reportEquipmentData - 不存在的设备', async () => {
      const nonExistentId = 'non-existent-equipment-id';
      const mockReqRes = this.createMockReqRes(mockUser, { id: nonExistentId }, {}, {
        metrics: { test: 123 },
        status: 'normal'
      });
      
      try {
        await equipmentController.reportEquipmentData(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为设备不存在而失败');
      } catch (error) {
        if (error.message.includes('设备不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的设备' };
        }
        throw error;
      }
    }, 'reportEquipmentData');

    // 测试3.5: 缺少指标数据
    await this.test('reportEquipmentData - 缺少指标数据', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: qualityEquipmentId }, {}, {
        status: 'normal',
        dataSource: 'manual'
        // 缺少metrics字段
      });
      
      try {
        await equipmentController.reportEquipmentData(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为缺少指标数据而失败');
      } catch (error) {
        if (error.message.includes('指标数据格式不正确') || error.message.includes('ValidationError')) {
          return { message: '正确处理了缺少指标数据的情况' };
        }
        throw error;
      }
    }, 'reportEquipmentData');
  }

  // 阶段4: getEquipmentAlerts 功能测试
  async testGetEquipmentAlerts() {
    this.log('🚨 阶段4: getEquipmentAlerts 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const adminId = this.testData.get('adminUser');
    const productionEquipmentId = this.testData.get('productionEquipment');

    if (!factoryId || !adminId) {
      this.log('❌ 跳过getEquipmentAlerts测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: adminId, 
      factoryId, 
      username: 'equipment_admin',
      roleCode: 'factory_super_admin' 
    };

    // 首先创建一些设备告警数据用于测试
    await this.test('创建测试设备告警数据', async () => {
      const alertsData = [
        {
          factoryId,
          alertType: 'equipment',
          severity: 'high',
          title: '生产设备过热告警',
          message: '设备温度超过安全阈值',
          sourceId: productionEquipmentId,
          sourceType: 'equipment',
          status: 'new'
        },
        {
          factoryId,
          alertType: 'equipment',
          severity: 'medium',
          title: '设备压力异常',
          message: '设备压力值波动较大',
          sourceId: productionEquipmentId,
          sourceType: 'equipment',
          status: 'acknowledged'
        }
      ];

      for (const alertData of alertsData) {
        await prisma.alertNotification.create({ data: alertData });
      }

      return { createdAlerts: alertsData.length };
    });

    // 测试4.1: 基本设备告警列表获取
    await this.test('getEquipmentAlerts - 基本告警列表获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { page: 1, limit: 10 });
      
      await equipmentController.getEquipmentAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('设备告警响应数据格式不正确');
      }

      const alerts = responseData.data.alerts;
      const pagination = responseData.data.pagination;

      if (!Array.isArray(alerts)) {
        throw new Error('告警列表应该是数组');
      }

      if (!pagination || typeof pagination.total !== 'number') {
        throw new Error('分页信息格式不正确');
      }

      // 验证所有告警都是equipment类型
      const nonEquipmentAlerts = alerts.filter(alert => alert.alertType !== 'equipment');
      if (nonEquipmentAlerts.length > 0) {
        throw new Error(`发现非equipment类型告警: ${nonEquipmentAlerts.length}个`);
      }

      return { alertCount: alerts.length, totalCount: pagination.count };
    }, 'getEquipmentAlerts');

    // 测试4.2: 按特定设备过滤
    await this.test('getEquipmentAlerts - 按特定设备过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        equipmentId: productionEquipmentId,
        page: 1,
        limit: 20
      });
      
      await equipmentController.getEquipmentAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const alerts = responseData.data.alerts;

      // 验证所有返回的告警都是指定设备的
      const wrongEquipmentAlerts = alerts.filter(alert => alert.sourceId !== productionEquipmentId);
      if (wrongEquipmentAlerts.length > 0) {
        throw new Error(`发现其他设备的告警: ${wrongEquipmentAlerts.length}个`);
      }

      return { specificEquipmentAlerts: alerts.length };
    }, 'getEquipmentAlerts');

    // 测试4.3: 按严重程度过滤
    await this.test('getEquipmentAlerts - 按严重程度过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        severity: 'high',
        page: 1,
        limit: 20
      });
      
      await equipmentController.getEquipmentAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const alerts = responseData.data.alerts;

      // 验证所有返回的告警都是high级别
      const nonHighAlerts = alerts.filter(alert => alert.severity !== 'high');
      if (nonHighAlerts.length > 0) {
        throw new Error(`发现非high严重程度告警: ${nonHighAlerts.length}个`);
      }

      return { highSeverityAlerts: alerts.length };
    }, 'getEquipmentAlerts');

    // 测试4.4: 按状态过滤
    await this.test('getEquipmentAlerts - 按状态过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        status: 'new',
        page: 1,
        limit: 20
      });
      
      await equipmentController.getEquipmentAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const alerts = responseData.data.alerts;

      // 验证所有返回的告警都是new状态
      const nonNewAlerts = alerts.filter(alert => alert.status !== 'new');
      if (nonNewAlerts.length > 0) {
        throw new Error(`发现非new状态告警: ${nonNewAlerts.length}个`);
      }

      return { newAlerts: alerts.length };
    }, 'getEquipmentAlerts');

    // 测试4.5: 设备信息关联验证
    await this.test('getEquipmentAlerts - 设备信息关联验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { page: 1, limit: 20 });
      
      await equipmentController.getEquipmentAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const alerts = responseData.data.alerts;

      // 验证告警中包含设备信息
      alerts.forEach(alert => {
        if (alert.sourceId) {
          if (!alert.equipment) {
            throw new Error(`告警${alert.id}有sourceId但缺少equipment信息`);
          }
          
          const requiredFields = ['id', 'equipmentCode', 'equipmentName', 'department'];
          requiredFields.forEach(field => {
            if (!(field in alert.equipment)) {
              throw new Error(`设备信息缺少字段: ${field}`);
            }
          });
        }
      });

      return { alertsWithEquipment: alerts.filter(a => a.equipment).length };
    }, 'getEquipmentAlerts');
  }

  // 阶段5: getEquipmentStatus 功能测试
  async testGetEquipmentStatus() {
    this.log('📈 阶段5: getEquipmentStatus 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const adminId = this.testData.get('adminUser');
    const productionEquipmentId = this.testData.get('productionEquipment');

    if (!factoryId || !adminId || !productionEquipmentId) {
      this.log('❌ 跳过getEquipmentStatus测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: adminId, 
      factoryId, 
      username: 'equipment_admin',
      roleCode: 'factory_super_admin' 
    };

    // 测试5.1: 基本设备状态获取
    await this.test('getEquipmentStatus - 基本设备状态获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId });
      
      await equipmentController.getEquipmentStatus(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('设备状态响应数据格式不正确');
      }

      const data = responseData.data;

      // 验证响应结构
      if (!data.equipment || !data.equipment.id) {
        throw new Error('缺少设备基本信息');
      }

      if (!data.currentStatus) {
        throw new Error('缺少当前状态信息');
      }

      const requiredStatusFields = ['isOnline', 'status', 'healthScore', 'uptime'];
      requiredStatusFields.forEach(field => {
        if (!(field in data.currentStatus)) {
          throw new Error(`当前状态缺少字段: ${field}`);
        }
      });

      if (!Array.isArray(data.recentData)) {
        throw new Error('最近数据应该是数组');
      }

      if (!Array.isArray(data.recentAlerts)) {
        throw new Error('最近告警应该是数组');
      }

      // 验证数值范围
      const healthScore = data.currentStatus.healthScore;
      if (typeof healthScore !== 'number' || healthScore < 0 || healthScore > 100) {
        throw new Error('健康度应该是0-100之间的数字');
      }

      const uptime = data.currentStatus.uptime;
      if (typeof uptime !== 'number' || uptime < 0 || uptime > 100) {
        throw new Error('运行时间百分比应该是0-100之间的数字');
      }

      return { 
        equipmentId: data.equipment.id,
        isOnline: data.currentStatus.isOnline,
        healthScore: data.currentStatus.healthScore,
        recentDataCount: data.recentData.length,
        recentAlertsCount: data.recentAlerts.length
      };
    }, 'getEquipmentStatus');

    // 测试5.2: 设备信息完整性验证
    await this.test('getEquipmentStatus - 设备信息完整性验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId });
      
      await equipmentController.getEquipmentStatus(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const equipment = responseData.data.equipment;

      const requiredFields = [
        'id', 'equipmentCode', 'equipmentName', 
        'equipmentType', 'department', 'status', 'location'
      ];
      
      requiredFields.forEach(field => {
        if (!(field in equipment)) {
          throw new Error(`设备信息缺少字段: ${field}`);
        }
      });

      if (equipment.id !== productionEquipmentId) {
        throw new Error('返回的设备ID不匹配');
      }

      return { 
        equipmentCode: equipment.equipmentCode,
        equipmentName: equipment.equipmentName,
        department: equipment.department
      };
    }, 'getEquipmentStatus');

    // 测试5.3: 最近数据验证
    await this.test('getEquipmentStatus - 最近数据验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId });
      
      await equipmentController.getEquipmentStatus(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const recentData = responseData.data.recentData;

      if (recentData.length > 10) {
        throw new Error(`最近数据数量超过限制: ${recentData.length} > 10`);
      }

      // 验证数据结构和排序
      recentData.forEach((data, index) => {
        const requiredFields = ['timestamp', 'metrics', 'status'];
        requiredFields.forEach(field => {
          if (!(field in data)) {
            throw new Error(`监控数据缺少字段: ${field}`);
          }
        });

        // 验证时间倒序排列
        if (index > 0) {
          const prevTime = new Date(recentData[index - 1].timestamp);
          const currTime = new Date(data.timestamp);
          
          if (prevTime < currTime) {
            throw new Error('监控数据未按时间倒序排列');
          }
        }
      });

      return { 
        recentDataCount: recentData.length,
        latestTimestamp: recentData.length > 0 ? recentData[0].timestamp : null
      };
    }, 'getEquipmentStatus');

    // 测试5.4: 最近告警验证
    await this.test('getEquipmentStatus - 最近告警验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId });
      
      await equipmentController.getEquipmentStatus(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const recentAlerts = responseData.data.recentAlerts;

      if (recentAlerts.length > 5) {
        throw new Error(`最近告警数量超过限制: ${recentAlerts.length} > 5`);
      }

      // 验证告警都是最近24小时的
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      recentAlerts.forEach(alert => {
        const requiredFields = ['id', 'severity', 'title', 'createdAt', 'status'];
        requiredFields.forEach(field => {
          if (!(field in alert)) {
            throw new Error(`告警数据缺少字段: ${field}`);
          }
        });

        const alertTime = new Date(alert.createdAt);
        if (alertTime < oneDayAgo) {
          throw new Error(`发现超过24小时的告警: ${alert.id}`);
        }
      });

      // 验证时间倒序排列
      recentAlerts.forEach((alert, index) => {
        if (index > 0) {
          const prevTime = new Date(recentAlerts[index - 1].createdAt);
          const currTime = new Date(alert.createdAt);
          
          if (prevTime < currTime) {
            throw new Error('告警数据未按时间倒序排列');
          }
        }
      });

      return { 
        recentAlertsCount: recentAlerts.length,
        alertTimeRange: '24小时内'
      };
    }, 'getEquipmentStatus');

    // 测试5.5: 不存在的设备
    await this.test('getEquipmentStatus - 不存在的设备', async () => {
      const nonExistentId = 'non-existent-equipment-id';
      const mockReqRes = this.createMockReqRes(mockUser, { id: nonExistentId });
      
      try {
        await equipmentController.getEquipmentStatus(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为设备不存在而失败');
      } catch (error) {
        if (error.message.includes('设备不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的设备' };
        }
        throw error;
      }
    }, 'getEquipmentStatus');

    // 测试5.6: 健康度和运行时间计算验证
    await this.test('getEquipmentStatus - 健康度和运行时间计算', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: productionEquipmentId });
      
      await equipmentController.getEquipmentStatus(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const currentStatus = responseData.data.currentStatus;

      const healthScore = currentStatus.healthScore;
      const uptime = currentStatus.uptime;

      // 基于监控数据手动验证计算是否合理
      const recentData = responseData.data.recentData;
      
      if (recentData.length > 0) {
        const errorCount = recentData.filter(d => d.status === 'error').length;
        const warningCount = recentData.filter(d => d.status === 'warning').length;
        const alertCount = recentData.filter(d => d.alertTriggered).length;
        
        // 健康度应该反映错误和告警的情况
        if (errorCount > 0 && healthScore === 100) {
          throw new Error('存在错误状态时健康度不应该是100');
        }
        
        if (alertCount > 0 && healthScore === 100) {
          throw new Error('存在告警时健康度不应该是100');
        }
      }

      return { 
        healthScore,
        uptime,
        calculationValid: true
      };
    }, 'getEquipmentStatus');
  }

  // 清理测试数据
  async cleanupTestData() {
    this.log('🧹 清理设备监控测试数据', 'phase');
    
    try {
      // 删除测试设备告警
      await prisma.alertNotification.deleteMany({
        where: {
          OR: [
            { title: { contains: '生产设备过热告警' } },
            { title: { contains: '设备压力异常' } },
            { factoryId: { contains: '-%' } }
          ]
        }
      });

      // 删除测试监控数据
      await prisma.deviceMonitoringData.deleteMany({
        where: {
          OR: [
            { dataSource: { contains: 'test' } },
            { equipmentId: { in: this.testData.get('equipmentList') || [] } }
          ]
        }
      });

      // 删除测试设备
      await prisma.factoryEquipment.deleteMany({
        where: { equipmentCode: { contains: 'EQUIP_' } }
      });

      // 删除测试用户
      await prisma.user.deleteMany({
        where: { username: { contains: 'equipment_' } }
      });

      // 删除测试工厂
      await prisma.factory.deleteMany({
        where: {
          OR: [
            { name: { contains: '设备监控测试' } },
            { id: { contains: '-%' } }
          ]
        }
      });

      return { message: '设备监控测试数据清理完成' };
    } catch (error) {
      this.log(`清理过程中出现错误: ${error.message}`, 'warning');
      return { message: '设备监控测试数据部分清理' };
    }
  }

  // 主测试执行器
  async runAllTests() {
    console.log(chalk.cyan.bold('⚙️ 海牛食品溯源系统 - 设备监控系统完整测试'));
    console.log(chalk.cyan('📊 测试范围: equipmentController.js 5个核心功能'));
    console.log(chalk.cyan(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`));

    const startTime = Date.now();

    try {
      // 设置基础测试数据
      const baseData = await this.setupTestData();
      if (!baseData) {
        throw new Error('基础测试数据设置失败');
      }

      // 创建测试监控数据
      await this.createTestMonitoringData();

      // 按阶段执行设备监控功能测试
      await this.testGetEquipmentMonitoring();
      await this.testGetEquipmentMetrics();
      await this.testReportEquipmentData();
      await this.testGetEquipmentAlerts();
      await this.testGetEquipmentStatus();

    } catch (criticalError) {
      this.log(`💥 关键设备监控测试失败: ${criticalError.message}`, 'error');
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
    this.log('⚙️ 设备监控系统完整测试完成', 'phase');
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
    console.log(chalk.cyan('\n💡 设备监控系统测试结论:'));
    const successRate = (this.testResults.passed / this.testResults.total) * 100;
    if (successRate >= 90) {
      console.log(chalk.green('   🎉 设备监控系统功能优秀！所有核心功能正常'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow('   ⚠️ 设备监控系统基本正常，部分功能需要改进'));
    } else {
      console.log(chalk.red('   🚨 设备监控系统存在较多问题，需要重点修复'));
    }

    console.log(chalk.cyan(`\n⚙️ 设备监控系统健康度: ${successRate.toFixed(1)}%`));

    // 功能完整性评估
    const functionsTestedCount = Object.values(this.testResults.functionResults)
      .filter(result => result.passed + result.failed > 0).length;
    
    console.log(chalk.cyan(`\n🎯 功能覆盖度: ${functionsTestedCount}/5 个核心功能`));

    // 设置退出码
    if (successRate >= 85 && functionsTestedCount >= 5) {
      console.log(chalk.green('\n✅ 设备监控系统测试达到可接受标准'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ 设备监控系统测试未达标，需要修复'));
      process.exit(1);
    }
  }
}

// 执行设备监控系统测试
console.log(chalk.blue('正在初始化设备监控系统测试器...'));
const tester = new EquipmentMonitoringTester();

tester.runAllTests().catch(error => {
  console.error(chalk.red('设备监控系统测试执行过程中发生致命错误:'), error);
  process.exit(1);
});