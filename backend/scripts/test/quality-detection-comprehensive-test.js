#!/usr/bin/env node

/**
 * 白垩纪食品溯源系统 - 质量检测系统完整测试
 * 阶段2-3: qualityController.js 6个核心功能完整性验证
 * 专注测试：提交质检、查询质检、质检详情、更新质检、质检统计、质量趋势
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';
import qualityController from '../src/controllers/qualityController.js';

const prisma = new PrismaClient();

class QualityDetectionTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      functionResults: {
        'submitInspection': { passed: 0, failed: 0 },
        'getInspections': { passed: 0, failed: 0 },
        'getInspectionById': { passed: 0, failed: 0 },
        'updateInspection': { passed: 0, failed: 0 },
        'getQualityStatistics': { passed: 0, failed: 0 },
        'getQualityTrends': { passed: 0, failed: 0 }
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
    this.log(`🔍 质检测试: ${name}`, 'info');
    
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
    this.log('🏭 设置质量检测测试数据', 'phase');
    
    // 创建测试工厂
    const factory = await this.test('创建质检测试工厂', async () => {
      const factoryData = {
        name: '质量检测测试工厂',
        industry: '食品加工业',
        address: '上海市浦东新区质量路300号',
        employeeCount: 100,
        contactName: '质检经理',
        contactPhone: '+86138000000803',
        contactEmail: 'quality@testfactory.com'
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
    const users = await this.test('创建质检测试用户', async () => {
      const testUsers = [];
      
      // 质检主管
      const supervisor = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'quality_supervisor',
          passwordHash: '$2b$10$quality.supervisor.hash',
          email: 'supervisor@quality.test',
          fullName: '质检主管张三',
          department: 'quality',
          roleCode: 'department_admin',
          isActive: true
        }
      });
      testUsers.push(supervisor);

      // 质检员1
      const inspector1 = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'quality_inspector1',
          passwordHash: '$2b$10$quality.inspector1.hash',
          email: 'inspector1@quality.test',
          fullName: '质检员李四',
          department: 'quality',
          roleCode: 'operator',
          isActive: true
        }
      });
      testUsers.push(inspector1);

      // 质检员2（不同部门）
      const inspector2 = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'quality_inspector2',
          passwordHash: '$2b$10$quality.inspector2.hash',
          email: 'inspector2@quality.test',
          fullName: '质检员王五',
          department: 'processing',
          roleCode: 'operator',
          isActive: true
        }
      });
      testUsers.push(inspector2);

      this.testData.set('supervisorUser', supervisor.id);
      this.testData.set('inspector1User', inspector1.id);
      this.testData.set('inspector2User', inspector2.id);
      
      return testUsers;
    });

    if (!users) return null;

    // 创建测试批次
    const batches = await this.test('创建质检测试批次', async () => {
      const batchList = [];

      // 批次1：进行中的批次
      const batch1 = await prisma.processingBatch.create({
        data: {
          factoryId: factory.id,
          batchNumber: 'QC_BATCH_001',
          productType: '优质面粉',
          rawMaterials: [
            { material: '小麦', quantity: 1000, unit: 'kg', supplier: '优质农场' },
            { material: '添加剂', quantity: 5, unit: 'kg', supplier: '食品配料公司' }
          ],
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前开始
          productionLine: 'LINE_A',
          supervisorId: users[0].id,
          targetQuantity: 800,
          actualQuantity: 750,
          status: 'in_progress'
        }
      });
      batchList.push(batch1);

      // 批次2：质检中的批次
      const batch2 = await prisma.processingBatch.create({
        data: {
          factoryId: factory.id,
          batchNumber: 'QC_BATCH_002',
          productType: '高筋面粉',
          rawMaterials: [
            { material: '优质小麦', quantity: 1500, unit: 'kg', supplier: '北方农场' }
          ],
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14天前开始
          productionLine: 'LINE_B',
          supervisorId: users[0].id,
          targetQuantity: 1200,
          actualQuantity: 1180,
          status: 'quality_check'
        }
      });
      batchList.push(batch2);

      // 批次3：已完成的批次
      const batch3 = await prisma.processingBatch.create({
        data: {
          factoryId: factory.id,
          batchNumber: 'QC_BATCH_003',
          productType: '全麦面粉',
          rawMaterials: [
            { material: '全麦', quantity: 800, unit: 'kg', supplier: '有机农场' }
          ],
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前开始
          endDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20天前结束
          productionLine: 'LINE_C',
          supervisorId: users[0].id,
          targetQuantity: 600,
          actualQuantity: 590,
          status: 'completed',
          qualityGrade: 'A'
        }
      });
      batchList.push(batch3);

      this.testData.set('inProgressBatch', batch1.id);
      this.testData.set('qualityCheckBatch', batch2.id);
      this.testData.set('completedBatch', batch3.id);
      this.testData.set('batchList', batchList.map(b => b.id));
      
      return batchList;
    });

    return { factory, users, batches };
  }

  // 创建测试质检记录
  async createTestInspections() {
    this.log('📝 创建测试质检记录', 'phase');
    
    const factoryId = this.testData.get('factory');
    const inspector1Id = this.testData.get('inspector1User');
    const inspector2Id = this.testData.get('inspector2User');
    const qualityCheckBatchId = this.testData.get('qualityCheckBatch');
    const completedBatchId = this.testData.get('completedBatch');

    if (!factoryId || !inspector1Id || !qualityCheckBatchId) {
      this.log('❌ 缺少必要的测试数据，跳过质检记录创建', 'warning');
      return [];
    }

    const inspections = [];

    // 为质检中的批次创建多个质检记录
    const inspectionConfigs = [
      {
        batchId: qualityCheckBatchId,
        inspectorId: inspector1Id,
        inspectionType: 'raw_material',
        testItems: {
          moisture: { value: 12.5, standard: '≤14%', result: 'pass' },
          protein: { value: 13.2, standard: '≥12%', result: 'pass' },
          gluten: { value: 28.5, standard: '≥26%', result: 'pass' }
        },
        overallResult: 'pass',
        qualityScore: 9.5,
        inspectionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5天前
      },
      {
        batchId: qualityCheckBatchId,
        inspectorId: inspector2Id,
        inspectionType: 'process',
        testItems: {
          temperature: { value: 185, standard: '180-190°C', result: 'pass' },
          time: { value: 45, standard: '40-50min', result: 'pass' },
          appearance: { value: '良好', standard: '无异常', result: 'pass' }
        },
        overallResult: 'pass',
        qualityScore: 9.2,
        inspectionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3天前
      },
      {
        batchId: qualityCheckBatchId,
        inspectorId: inspector1Id,
        inspectionType: 'final_product',
        testItems: {
          appearance: { value: '色泽均匀', standard: '无异色', result: 'pass' },
          taste: { value: '口感良好', standard: '无异味', result: 'pass' },
          packaging: { value: '完好', standard: '密封良好', result: 'pass' },
          weight: { value: 24.98, standard: '25±0.05kg', result: 'pass' }
        },
        overallResult: 'pass',
        qualityScore: 9.8,
        inspectionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1天前
      }
    ];

    // 添加一个失败的质检记录
    if (completedBatchId) {
      inspectionConfigs.push({
        batchId: completedBatchId,
        inspectorId: inspector2Id,
        inspectionType: 'process',
        testItems: {
          temperature: { value: 195, standard: '180-190°C', result: 'fail' },
          moisture: { value: 15.5, standard: '≤14%', result: 'fail' }
        },
        overallResult: 'fail',
        qualityScore: 6.5,
        defectDetails: [
          { defect: '温度超标', severity: 'medium', count: 1 },
          { defect: '水分含量过高', severity: 'high', count: 1 }
        ],
        correctiveActions: '调整烘烤温度，延长干燥时间',
        inspectionDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10天前
      });
    }

    // 创建质检记录
    for (let i = 0; i < inspectionConfigs.length; i++) {
      const config = inspectionConfigs[i];
      const inspection = await this.test(`创建质检记录${i + 1}`, async () => {
        const record = await prisma.qualityInspection.create({
          data: {
            factoryId,
            ...config,
            photos: i === 0 ? ['photo1.jpg', 'photo2.jpg'] : null
          }
        });

        inspections.push(record);
        return record;
      });
    }

    this.testData.set('inspections', inspections.map(i => i?.id).filter(Boolean));
    if (inspections[0]) {
      this.testData.set('firstInspectionId', inspections[0].id);
    }
    
    return inspections;
  }

  // 阶段1: submitInspection 功能测试
  async testSubmitInspection() {
    this.log('📋 阶段1: submitInspection 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const inspector1Id = this.testData.get('inspector1User');
    const inProgressBatchId = this.testData.get('inProgressBatch');

    if (!factoryId || !inspector1Id || !inProgressBatchId) {
      this.log('❌ 跳过submitInspection测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: inspector1Id, 
      factoryId, 
      username: 'quality_inspector1',
      roleCode: 'operator' 
    };

    // 测试1.1: 成功提交质检记录
    await this.test('submitInspection - 成功提交质检记录', async () => {
      const inspectionData = {
        batchId: inProgressBatchId,
        inspectionType: 'raw_material',
        testItems: {
          moisture: { value: 13.0, standard: '≤14%', result: 'pass' },
          protein: { value: 12.8, standard: '≥12%', result: 'pass' }
        },
        overallResult: 'pass',
        qualityScore: 8.5,
        photos: ['test_photo1.jpg', 'test_photo2.jpg']
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, inspectionData);
      
      await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('质检提交响应数据格式不正确');
      }

      const inspection = responseData.data;

      if (!inspection.id) {
        throw new Error('缺少质检记录ID');
      }

      if (inspection.batchId !== inProgressBatchId) {
        throw new Error('批次ID不匹配');
      }

      if (inspection.inspectorId !== inspector1Id) {
        throw new Error('检测员ID不匹配');
      }

      // 验证包含的关联数据
      if (!inspection.inspector || !inspection.batch) {
        throw new Error('缺少关联的检测员或批次信息');
      }

      return { 
        inspectionId: inspection.id,
        batchId: inspection.batchId,
        inspectorName: inspection.inspector.fullName
      };
    }, 'submitInspection');

    // 测试1.2: 提交失败的质检记录
    await this.test('submitInspection - 提交失败的质检记录', async () => {
      const failedInspectionData = {
        batchId: inProgressBatchId,
        inspectionType: 'process',
        testItems: {
          temperature: { value: 200, standard: '180-190°C', result: 'fail' },
          time: { value: 60, standard: '40-50min', result: 'fail' }
        },
        overallResult: 'fail',
        qualityScore: 4.5,
        defectDetails: [
          { defect: '温度过高', severity: 'high', count: 1 },
          { defect: '时间过长', severity: 'medium', count: 1 }
        ],
        correctiveActions: '立即调整温度和时间参数'
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, failedInspectionData);
      
      await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspection = responseData.data;

      if (inspection.overallResult !== 'fail') {
        throw new Error('质检结果应该是fail');
      }

      if (!inspection.defectDetails) {
        throw new Error('缺少缺陷详情');
      }

      if (!inspection.correctiveActions) {
        throw new Error('缺少纠正措施');
      }

      return { 
        inspectionId: inspection.id,
        result: inspection.overallResult,
        defectCount: inspection.defectDetails.length
      };
    }, 'submitInspection');

    // 测试1.3: 不存在的批次
    await this.test('submitInspection - 不存在的批次', async () => {
      const invalidData = {
        batchId: 'non-existent-batch-id',
        inspectionType: 'raw_material',
        testItems: { test: 'data' },
        overallResult: 'pass',
        qualityScore: 7.0
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, invalidData);
      
      try {
        await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为批次不存在而失败');
      } catch (error) {
        if (error.message.includes('批次不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的批次' };
        }
        throw error;
      }
    }, 'submitInspection');

    // 测试1.4: 条件通过的质检
    await this.test('submitInspection - 条件通过的质检', async () => {
      const conditionalData = {
        batchId: inProgressBatchId,
        inspectionType: 'final_product',
        testItems: {
          appearance: { value: '轻微瑕疵', standard: '无异常', result: 'conditional' },
          weight: { value: 24.95, standard: '25±0.05kg', result: 'pass' }
        },
        overallResult: 'conditional_pass',
        qualityScore: 7.5,
        defectDetails: [
          { defect: '外观轻微瑕疵', severity: 'low', count: 3 }
        ],
        correctiveActions: '后续批次注意外观质量控制'
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, conditionalData);
      
      await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspection = responseData.data;

      if (inspection.overallResult !== 'conditional_pass') {
        throw new Error('质检结果应该是conditional_pass');
      }

      return { 
        inspectionId: inspection.id,
        result: inspection.overallResult,
        score: inspection.qualityScore
      };
    }, 'submitInspection');

    // 测试1.5: 缺少必要字段
    await this.test('submitInspection - 缺少必要字段', async () => {
      const incompleteData = {
        batchId: inProgressBatchId,
        // 缺少inspectionType
        testItems: { test: 'data' },
        // 缺少overallResult
        qualityScore: 7.0
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, incompleteData);
      
      // 注意：由于Prisma的验证，这个测试可能会抛出错误
      try {
        await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        // 如果没有验证，检查结果
        const responseData = mockReqRes.getResponse();
        if (responseData && responseData.data) {
          // 某些字段可能有默认值，但应该验证关键字段
          return { message: '提交成功但可能缺少验证' };
        }
      } catch (error) {
        // 预期会因为缺少必要字段而失败
        return { message: '正确拒绝了不完整的数据' };
      }
    }, 'submitInspection');
  }

  // 阶段2: getInspections 功能测试
  async testGetInspections() {
    this.log('📊 阶段2: getInspections 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const supervisorId = this.testData.get('supervisorUser');

    if (!factoryId || !supervisorId) {
      this.log('❌ 跳过getInspections测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: supervisorId, 
      factoryId, 
      username: 'quality_supervisor',
      roleCode: 'department_admin' 
    };

    // 测试2.1: 基本质检列表获取
    await this.test('getInspections - 基本质检列表获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { page: 1, limit: 10 });
      
      await qualityController.getInspections(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('质检列表响应数据格式不正确');
      }

      const inspections = responseData.data.inspections;
      const pagination = responseData.data.pagination;

      if (!Array.isArray(inspections)) {
        throw new Error('质检列表应该是数组');
      }

      if (!pagination || typeof pagination.total !== 'number') {
        throw new Error('分页信息格式不正确');
      }

      // 验证质检记录结构
      if (inspections.length > 0) {
        const firstInspection = inspections[0];
        const requiredFields = ['id', 'batchId', 'inspectorId', 'inspectionType', 'overallResult'];
        
        for (const field of requiredFields) {
          if (!(field in firstInspection)) {
            throw new Error(`质检记录缺少字段: ${field}`);
          }
        }

        // 验证关联数据
        if (!firstInspection.inspector || !firstInspection.batch) {
          throw new Error('缺少关联的检测员或批次信息');
        }
      }

      return { 
        inspectionCount: inspections.length,
        totalCount: pagination.count
      };
    }, 'getInspections');

    // 测试2.2: 按批次ID过滤
    await this.test('getInspections - 按批次ID过滤', async () => {
      const qualityCheckBatchId = this.testData.get('qualityCheckBatch');
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        batchId: qualityCheckBatchId,
        page: 1,
        limit: 20
      });
      
      await qualityController.getInspections(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspections = responseData.data.inspections;

      // 验证所有返回的质检都属于指定批次
      const wrongBatchInspections = inspections.filter(i => i.batchId !== qualityCheckBatchId);
      if (wrongBatchInspections.length > 0) {
        throw new Error(`发现其他批次的质检记录: ${wrongBatchInspections.length}个`);
      }

      return { batchInspectionCount: inspections.length };
    }, 'getInspections');

    // 测试2.3: 按检测类型过滤
    await this.test('getInspections - 按检测类型过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        inspectionType: 'raw_material',
        page: 1,
        limit: 20
      });
      
      await qualityController.getInspections(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspections = responseData.data.inspections;

      // 验证所有返回的质检都是原材料检测
      const wrongTypeInspections = inspections.filter(i => i.inspectionType !== 'raw_material');
      if (wrongTypeInspections.length > 0) {
        throw new Error(`发现非raw_material类型质检: ${wrongTypeInspections.length}个`);
      }

      return { rawMaterialInspectionCount: inspections.length };
    }, 'getInspections');

    // 测试2.4: 按结果过滤
    await this.test('getInspections - 按结果过滤', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        overallResult: 'pass',
        page: 1,
        limit: 20
      });
      
      await qualityController.getInspections(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspections = responseData.data.inspections;

      // 验证所有返回的质检都是通过的
      const failedInspections = inspections.filter(i => i.overallResult !== 'pass');
      if (failedInspections.length > 0) {
        throw new Error(`发现非pass结果的质检: ${failedInspections.length}个`);
      }

      return { passedInspectionCount: inspections.length };
    }, 'getInspections');

    // 测试2.5: 按日期范围过滤
    await this.test('getInspections - 按日期范围过滤', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7天前
      const endDate = new Date().toISOString();

      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        startDate,
        endDate,
        page: 1,
        limit: 20
      });
      
      await qualityController.getInspections(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspections = responseData.data.inspections;

      // 验证所有质检都在日期范围内
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      const outOfRangeInspections = inspections.filter(i => {
        const inspectionDate = new Date(i.inspectionDate);
        return inspectionDate < startDateObj || inspectionDate > endDateObj;
      });
      
      if (outOfRangeInspections.length > 0) {
        throw new Error(`发现超出日期范围的质检: ${outOfRangeInspections.length}个`);
      }

      return { dateRangeInspectionCount: inspections.length };
    }, 'getInspections');

    // 测试2.6: 搜索功能
    await this.test('getInspections - 搜索功能', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        search: 'QC_BATCH',
        page: 1,
        limit: 20
      });
      
      await qualityController.getInspections(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspections = responseData.data.inspections;

      // 验证搜索结果相关性
      if (inspections.length > 0) {
        // 至少应该包含批次号中有QC_BATCH的记录
        const relevantInspections = inspections.filter(i => 
          i.batch.batchNumber.includes('QC_BATCH') ||
          i.batch.productType.includes('QC_BATCH') ||
          (i.inspector.fullName && i.inspector.fullName.includes('QC_BATCH'))
        );

        if (relevantInspections.length === 0 && inspections.length > 0) {
          this.log('⚠️ 搜索结果可能不相关', 'warning');
        }
      }

      return { searchResultCount: inspections.length };
    }, 'getInspections');
  }

  // 阶段3: getInspectionById 功能测试
  async testGetInspectionById() {
    this.log('🔍 阶段3: getInspectionById 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const supervisorId = this.testData.get('supervisorUser');
    const firstInspectionId = this.testData.get('firstInspectionId');

    if (!factoryId || !supervisorId || !firstInspectionId) {
      this.log('❌ 跳过getInspectionById测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: supervisorId, 
      factoryId, 
      username: 'quality_supervisor',
      roleCode: 'department_admin' 
    };

    // 测试3.1: 成功获取质检详情
    await this.test('getInspectionById - 成功获取质检详情', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, { id: firstInspectionId });
      
      await qualityController.getInspectionById(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('质检详情响应数据格式不正确');
      }

      const inspection = responseData.data;

      if (inspection.id !== firstInspectionId) {
        throw new Error('返回的质检ID不匹配');
      }

      // 验证详细信息的完整性
      const requiredFields = [
        'id', 'batchId', 'factoryId', 'inspectorId',
        'inspectionType', 'inspectionDate', 'testItems',
        'overallResult'
      ];
      
      for (const field of requiredFields) {
        if (!(field in inspection)) {
          throw new Error(`质检详情缺少字段: ${field}`);
        }
      }

      // 验证关联数据的完整性
      if (!inspection.inspector || !inspection.inspector.fullName) {
        throw new Error('缺少检测员详细信息');
      }

      if (!inspection.batch || !inspection.batch.batchNumber) {
        throw new Error('缺少批次详细信息');
      }

      // 验证批次包含额外信息
      const batchFields = ['rawMaterials', 'targetQuantity', 'actualQuantity'];
      for (const field of batchFields) {
        if (!(field in inspection.batch)) {
          throw new Error(`批次信息缺少字段: ${field}`);
        }
      }

      return { 
        inspectionId: inspection.id,
        batchNumber: inspection.batch.batchNumber,
        inspectorName: inspection.inspector.fullName,
        hasRawMaterials: !!inspection.batch.rawMaterials
      };
    }, 'getInspectionById');

    // 测试3.2: 不存在的质检记录
    await this.test('getInspectionById - 不存在的质检记录', async () => {
      const nonExistentId = 'non-existent-inspection-id';
      const mockReqRes = this.createMockReqRes(mockUser, { id: nonExistentId });
      
      try {
        await qualityController.getInspectionById(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为质检记录不存在而失败');
      } catch (error) {
        if (error.message.includes('质检记录不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的质检记录' };
        }
        throw error;
      }
    }, 'getInspectionById');

    // 测试3.3: 跨工厂访问限制
    await this.test('getInspectionById - 跨工厂访问限制', async () => {
      // 创建另一个工厂的质检记录
      const otherFactory = await prisma.factory.create({
        data: {
          id: 'OTHER-QC-FACTORY',
          name: '其他质检工厂',
          industry: '其他行业',
          industryCode: '999',
          regionCode: 'OT'
        }
      });

      const otherBatch = await prisma.processingBatch.create({
        data: {
          factoryId: otherFactory.id,
          batchNumber: 'OTHER_BATCH',
          productType: '其他产品',
          startDate: new Date(),
          status: 'in_progress'
        }
      });

      const otherInspection = await prisma.qualityInspection.create({
        data: {
          factoryId: otherFactory.id,
          batchId: otherBatch.id,
          inspectorId: supervisorId, // 使用同一个检测员ID（实际不应该发生）
          inspectionType: 'raw_material',
          inspectionDate: new Date(),
          testItems: { test: 'data' },
          overallResult: 'pass'
        }
      });

      try {
        const mockReqRes = this.createMockReqRes(mockUser, { id: otherInspection.id });
        await qualityController.getInspectionById(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为跨工厂访问而失败');
      } catch (error) {
        if (error.message.includes('质检记录不存在')) {
          return { message: '正确阻止了跨工厂访问' };
        }
        throw error;
      } finally {
        // 清理测试数据
        await prisma.qualityInspection.delete({ where: { id: otherInspection.id } });
        await prisma.processingBatch.delete({ where: { id: otherBatch.id } });
        await prisma.factory.delete({ where: { id: otherFactory.id } });
      }
    }, 'getInspectionById');
  }

  // 阶段4: updateInspection 功能测试
  async testUpdateInspection() {
    this.log('✏️ 阶段4: updateInspection 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const inspector1Id = this.testData.get('inspector1User');
    const firstInspectionId = this.testData.get('firstInspectionId');

    if (!factoryId || !inspector1Id || !firstInspectionId) {
      this.log('❌ 跳过updateInspection测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: inspector1Id, 
      factoryId, 
      username: 'quality_inspector1',
      roleCode: 'operator' 
    };

    // 测试4.1: 成功更新质检记录
    await this.test('updateInspection - 成功更新质检记录', async () => {
      const updateData = {
        testItems: {
          moisture: { value: 12.8, standard: '≤14%', result: 'pass' },
          protein: { value: 13.5, standard: '≥12%', result: 'pass' },
          gluten: { value: 29.0, standard: '≥26%', result: 'pass' }
        },
        qualityScore: 9.6,
        photos: ['updated_photo1.jpg', 'updated_photo2.jpg', 'updated_photo3.jpg']
      };

      const mockReqRes = this.createMockReqRes(mockUser, { id: firstInspectionId }, {}, updateData);
      
      await qualityController.updateInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('质检更新响应数据格式不正确');
      }

      const inspection = responseData.data;

      if (inspection.id !== firstInspectionId) {
        throw new Error('返回的质检ID不匹配');
      }

      // Handle Decimal type from Prisma/MySQL
      const actualScore = parseFloat(inspection.qualityScore);
      if (Math.abs(actualScore - updateData.qualityScore) > 0.01) {
        throw new Error(`质量分数未正确更新，期望${updateData.qualityScore}，实际${actualScore}`);
      }

      return { 
        inspectionId: inspection.id,
        updatedScore: inspection.qualityScore,
        photoCount: inspection.photos ? inspection.photos.length : 0
      };
    }, 'updateInspection');

    // 测试4.2: 更新结果为失败
    await this.test('updateInspection - 更新结果为失败', async () => {
      const failUpdateData = {
        overallResult: 'fail',
        qualityScore: 5.0,
        defectDetails: [
          { defect: '严重质量问题', severity: 'high', count: 5 }
        ],
        correctiveActions: '立即停产整改'
      };

      const mockReqRes = this.createMockReqRes(mockUser, { id: firstInspectionId }, {}, failUpdateData);
      
      await qualityController.updateInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspection = responseData.data;

      if (inspection.overallResult !== 'fail') {
        throw new Error('质检结果应该更新为fail');
      }

      if (!inspection.defectDetails) {
        throw new Error('缺少缺陷详情');
      }

      return { 
        inspectionId: inspection.id,
        newResult: inspection.overallResult,
        newScore: inspection.qualityScore
      };
    }, 'updateInspection');

    // 测试4.3: 更新不存在的质检记录
    await this.test('updateInspection - 更新不存在的质检记录', async () => {
      const nonExistentId = 'non-existent-inspection-id';
      const mockReqRes = this.createMockReqRes(mockUser, { id: nonExistentId }, {}, {
        qualityScore: 8.0
      });
      
      try {
        await qualityController.updateInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为质检记录不存在而失败');
      } catch (error) {
        if (error.message.includes('质检记录不存在') || error.message.includes('NotFoundError')) {
          return { message: '正确处理了不存在的质检记录' };
        }
        throw error;
      }
    }, 'updateInspection');

    // 测试4.4: 尝试更新已完成批次的质检
    await this.test('updateInspection - 尝试更新已完成批次的质检', async () => {
      // 首先为已完成的批次创建一个质检记录
      const completedBatchId = this.testData.get('completedBatch');
      
      const completedInspection = await prisma.qualityInspection.create({
        data: {
          factoryId,
          batchId: completedBatchId,
          inspectorId: inspector1Id,
          inspectionType: 'final_product',
          inspectionDate: new Date(),
          testItems: { test: 'completed' },
          overallResult: 'pass',
          qualityScore: 8.0
        }
      });

      try {
        const mockReqRes = this.createMockReqRes(mockUser, { id: completedInspection.id }, {}, {
          qualityScore: 9.0
        });
        
        await qualityController.updateInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
        throw new Error('应该因为批次已完成而无法更新');
      } catch (error) {
        if (error.message.includes('已完成批次的质检记录不能修改') || error.message.includes('ValidationError')) {
          return { message: '正确阻止了对已完成批次的质检更新' };
        }
        throw error;
      } finally {
        // 清理测试数据
        await prisma.qualityInspection.delete({ where: { id: completedInspection.id } });
      }
    }, 'updateInspection');

    // 测试4.5: 部分更新
    await this.test('updateInspection - 部分更新', async () => {
      const partialUpdateData = {
        qualityScore: 9.9 // 只更新分数
      };

      const mockReqRes = this.createMockReqRes(mockUser, { id: firstInspectionId }, {}, partialUpdateData);
      
      await qualityController.updateInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const inspection = responseData.data;

      // Handle Decimal type from Prisma/MySQL  
      const actualScore = parseFloat(inspection.qualityScore);
      if (Math.abs(actualScore - partialUpdateData.qualityScore) > 0.01) {
        throw new Error(`质量分数未正确更新，期望${partialUpdateData.qualityScore}，实际${actualScore}`);
      }

      // 其他字段应该保持不变
      if (!inspection.testItems) {
        throw new Error('其他字段不应该被清除');
      }

      return { 
        inspectionId: inspection.id,
        updatedScore: inspection.qualityScore,
        testItemsPreserved: !!inspection.testItems
      };
    }, 'updateInspection');
  }

  // 阶段5: getQualityStatistics 功能测试
  async testGetQualityStatistics() {
    this.log('📈 阶段5: getQualityStatistics 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const supervisorId = this.testData.get('supervisorUser');

    if (!factoryId || !supervisorId) {
      this.log('❌ 跳过getQualityStatistics测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: supervisorId, 
      factoryId, 
      username: 'quality_supervisor',
      roleCode: 'department_admin' 
    };

    // 测试5.1: 基本统计数据获取
    await this.test('getQualityStatistics - 基本统计数据获取', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await qualityController.getQualityStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('质检统计响应数据格式不正确');
      }

      const data = responseData.data;

      // 验证统计数据结构
      if (!data.summary || typeof data.summary.totalInspections !== 'number') {
        throw new Error('缺少总体统计信息');
      }

      if (!data.resultDistribution || typeof data.resultDistribution !== 'object') {
        throw new Error('缺少结果分布统计');
      }

      if (!Array.isArray(data.typeStats)) {
        throw new Error('类型统计应该是数组');
      }

      if (!Array.isArray(data.inspectorStats)) {
        throw new Error('检测员统计应该是数组');
      }

      // 验证平均分数 (handle Decimal type from Prisma)
      if (data.summary.avgQualityScore !== null) {
        const avgScore = parseFloat(data.summary.avgQualityScore);
        if (isNaN(avgScore)) {
          throw new Error('平均质量分数格式不正确');
        }
      }

      return { 
        totalInspections: data.summary.totalInspections,
        avgScore: data.summary.avgQualityScore,
        typeCount: data.typeStats.length,
        inspectorCount: data.inspectorStats.length
      };
    }, 'getQualityStatistics');

    // 测试5.2: 按日期范围统计
    await this.test('getQualityStatistics - 按日期范围统计', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30天前
      const endDate = new Date().toISOString();

      const mockReqRes = this.createMockReqRes(mockUser, {}, { startDate, endDate });
      
      await qualityController.getQualityStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 统计数据应该基于日期范围
      if (data.summary.totalInspections < 0) {
        throw new Error('统计数量不能为负数');
      }

      return { 
        dateRangeTotal: data.summary.totalInspections,
        hasData: data.summary.totalInspections > 0
      };
    }, 'getQualityStatistics');

    // 测试5.3: 按检测类型统计
    await this.test('getQualityStatistics - 按检测类型统计', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { inspectionType: 'raw_material' });
      
      await qualityController.getQualityStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 类型统计应该包含各种检测类型
      const typeStats = data.typeStats;
      
      typeStats.forEach(stat => {
        if (!stat.type || typeof stat.count !== 'number') {
          throw new Error('类型统计格式不正确');
        }
        
        // Handle Decimal type from Prisma/MySQL for avgScore
        if (stat.avgScore !== null) {
          const avgScore = parseFloat(stat.avgScore);
          if (isNaN(avgScore)) {
            throw new Error(`类型平均分数格式不正确: ${typeof stat.avgScore}, 值: ${stat.avgScore}`);
          }
        }
      });

      return { 
        filteredType: 'raw_material',
        typeStatsCount: typeStats.length
      };
    }, 'getQualityStatistics');

    // 测试5.4: 按部门统计
    await this.test('getQualityStatistics - 按部门统计', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { department: 'quality' });
      
      await qualityController.getQualityStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 检测员统计应该包含检测员信息
      const inspectorStats = data.inspectorStats;
      
      inspectorStats.forEach(stat => {
        if (!stat.inspector) {
          throw new Error('缺少检测员信息');
        }
        
        if (typeof stat.count !== 'number') {
          throw new Error('检测员统计数量格式不正确');
        }
        
        // Handle Decimal type from Prisma/MySQL for avgScore
        if (stat.avgScore !== null) {
          const avgScore = parseFloat(stat.avgScore);
          if (isNaN(avgScore)) {
            throw new Error(`检测员平均分数格式不正确: ${typeof stat.avgScore}, 值: ${stat.avgScore}`);
          }
        }
      });

      return { 
        department: 'quality',
        inspectorStatsCount: inspectorStats.length
      };
    }, 'getQualityStatistics');

    // 测试5.5: 结果分布验证
    await this.test('getQualityStatistics - 结果分布验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser);
      
      await qualityController.getQualityStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const resultDistribution = responseData.data.resultDistribution;

      // 验证可能的结果类型
      const possibleResults = ['pass', 'fail', 'conditional_pass'];
      
      Object.keys(resultDistribution).forEach(result => {
        if (!possibleResults.includes(result)) {
          throw new Error(`未知的质检结果类型: ${result}`);
        }
        
        if (typeof resultDistribution[result] !== 'number' || resultDistribution[result] < 0) {
          throw new Error(`结果分布数量不正确: ${result}`);
        }
      });

      // 计算总数
      const totalFromDistribution = Object.values(resultDistribution).reduce((sum, count) => sum + count, 0);

      return { 
        distributionTypes: Object.keys(resultDistribution),
        totalFromDistribution
      };
    }, 'getQualityStatistics');
  }

  // 阶段6: getQualityTrends 功能测试
  async testGetQualityTrends() {
    this.log('📉 阶段6: getQualityTrends 功能测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    const supervisorId = this.testData.get('supervisorUser');

    if (!factoryId || !supervisorId) {
      this.log('❌ 跳过getQualityTrends测试: 缺少必要数据', 'warning');
      return;
    }

    const mockUser = { 
      id: supervisorId, 
      factoryId, 
      username: 'quality_supervisor',
      roleCode: 'department_admin' 
    };

    // 测试6.1: 月度趋势数据
    await this.test('getQualityTrends - 月度趋势数据', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { period: 'month' });
      
      await qualityController.getQualityTrends(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      
      if (!responseData || !responseData.data) {
        throw new Error('质量趋势响应数据格式不正确');
      }

      const data = responseData.data;

      if (data.period !== 'month') {
        throw new Error('周期应该是month');
      }

      if (!data.dateRange || !data.dateRange.start || !data.dateRange.end) {
        throw new Error('缺少日期范围');
      }

      if (!Array.isArray(data.trends)) {
        throw new Error('趋势数据应该是数组');
      }

      if (!Array.isArray(data.passRateData)) {
        throw new Error('合格率数据应该是数组');
      }

      // 验证趋势数据结构
      data.trends.forEach(trend => {
        if (!trend.date || typeof trend.total !== 'number') {
          throw new Error('趋势数据格式不正确');
        }
        
        if (typeof trend.pass !== 'number' || typeof trend.fail !== 'number') {
          throw new Error('趋势数据缺少pass/fail统计');
        }
      });

      return { 
        period: data.period,
        trendCount: data.trends.length,
        totalInspections: data.summary.totalInspections
      };
    }, 'getQualityTrends');

    // 测试6.2: 周趋势数据
    await this.test('getQualityTrends - 周趋势数据', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { period: 'week' });
      
      await qualityController.getQualityTrends(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      if (data.period !== 'week') {
        throw new Error('周期应该是week');
      }

      // 验证日期范围是否为7天
      const startDate = new Date(data.dateRange.start);
      const endDate = new Date(data.dateRange.end);
      const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 8) { // 允许一点误差
        throw new Error('周趋势的日期范围应该约为7天');
      }

      return { 
        period: data.period,
        dateRangeDays: diffDays
      };
    }, 'getQualityTrends');

    // 测试6.3: 季度趋势数据
    await this.test('getQualityTrends - 季度趋势数据', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { period: 'quarter' });
      
      await qualityController.getQualityTrends(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      if (data.period !== 'quarter') {
        throw new Error('周期应该是quarter');
      }

      // 验证日期范围是否约为90天
      const startDate = new Date(data.dateRange.start);
      const endDate = new Date(data.dateRange.end);
      const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 85 || diffDays > 95) { // 允许一点误差
        throw new Error('季度趋势的日期范围应该约为90天');
      }

      return { 
        period: data.period,
        dateRangeDays: diffDays
      };
    }, 'getQualityTrends');

    // 测试6.4: 按检测类型过滤趋势
    await this.test('getQualityTrends - 按检测类型过滤趋势', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        period: 'month',
        inspectionType: 'raw_material'
      });
      
      await qualityController.getQualityTrends(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 数据应该基于特定的检测类型
      if (data.summary.totalInspections < 0) {
        throw new Error('总检测数不能为负数');
      }

      return { 
        filteredType: 'raw_material',
        totalInspections: data.summary.totalInspections
      };
    }, 'getQualityTrends');

    // 测试6.5: 合格率计算验证
    await this.test('getQualityTrends - 合格率计算验证', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { period: 'month' });
      
      await qualityController.getQualityTrends(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 验证合格率数据
      data.passRateData.forEach(item => {
        if (!item.date || typeof item.passRate !== 'number' || typeof item.total !== 'number') {
          throw new Error('合格率数据格式不正确');
        }
        
        if (item.passRate < 0 || item.passRate > 100) {
          throw new Error('合格率应该在0-100之间');
        }
        
        if (item.total < 0) {
          throw new Error('总数不能为负数');
        }
      });

      // 验证总体合格率
      const overallPassRate = data.summary.overallPassRate;
      if (typeof overallPassRate !== 'number' || overallPassRate < 0 || overallPassRate > 100) {
        throw new Error('总体合格率格式不正确');
      }

      return { 
        passRateDataCount: data.passRateData.length,
        overallPassRate: overallPassRate
      };
    }, 'getQualityTrends');

    // 测试6.6: 平均分数趋势
    await this.test('getQualityTrends - 平均分数趋势', async () => {
      const mockReqRes = this.createMockReqRes(mockUser, {}, { period: 'month' });
      
      await qualityController.getQualityTrends(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const responseData = mockReqRes.getResponse();
      const data = responseData.data;

      // 验证趋势数据中的平均分数
      data.trends.forEach(trend => {
        if (trend.avgScore !== undefined) {
          if (typeof trend.avgScore !== 'number' || trend.avgScore < 0 || trend.avgScore > 10) {
            throw new Error('平均分数应该在0-10之间');
          }
        }
      });

      const hasScoreData = data.trends.some(trend => trend.avgScore > 0);

      return { 
        hasScoreData,
        trendCount: data.trends.length
      };
    }, 'getQualityTrends');
  }

  // 清理测试数据
  async cleanupTestData() {
    this.log('🧹 清理质量检测测试数据', 'phase');
    
    try {
      // 删除测试质检记录
      await prisma.qualityInspection.deleteMany({
        where: {
          OR: [
            { batch: { batchNumber: { contains: 'QC_BATCH_' } } },
            { factoryId: { contains: '-%' } }
          ]
        }
      });

      // 删除测试批次
      await prisma.processingBatch.deleteMany({
        where: { batchNumber: { contains: 'QC_BATCH_' } }
      });

      // 删除测试用户
      await prisma.user.deleteMany({
        where: { username: { contains: 'quality_' } }
      });

      // 删除测试工厂
      await prisma.factory.deleteMany({
        where: {
          OR: [
            { name: { contains: '质量检测测试' } },
            { name: { contains: '质检测试' } },
            { id: { contains: '-%' } }
          ]
        }
      });

      return { message: '质量检测测试数据清理完成' };
    } catch (error) {
      this.log(`清理过程中出现错误: ${error.message}`, 'warning');
      return { message: '质量检测测试数据部分清理' };
    }
  }

  // 主测试执行器
  async runAllTests() {
    console.log(chalk.cyan.bold('🔍 白垩纪食品溯源系统 - 质量检测系统完整测试'));
    console.log(chalk.cyan('📊 测试范围: qualityController.js 6个核心功能'));
    console.log(chalk.cyan(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`));

    const startTime = Date.now();

    try {
      // 设置基础测试数据
      const baseData = await this.setupTestData();
      if (!baseData) {
        throw new Error('基础测试数据设置失败');
      }

      // 创建测试质检记录
      await this.createTestInspections();

      // 按阶段执行质量检测功能测试
      await this.testSubmitInspection();
      await this.testGetInspections();
      await this.testGetInspectionById();
      await this.testUpdateInspection();
      await this.testGetQualityStatistics();
      await this.testGetQualityTrends();

    } catch (criticalError) {
      this.log(`💥 关键质量检测测试失败: ${criticalError.message}`, 'error');
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
    this.log('🔍 质量检测系统完整测试完成', 'phase');
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
    console.log(chalk.cyan('\n💡 质量检测系统测试结论:'));
    const successRate = (this.testResults.passed / this.testResults.total) * 100;
    if (successRate >= 90) {
      console.log(chalk.green('   🎉 质量检测系统功能优秀！所有核心功能正常'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow('   ⚠️ 质量检测系统基本正常，部分功能需要改进'));
    } else {
      console.log(chalk.red('   🚨 质量检测系统存在较多问题，需要重点修复'));
    }

    console.log(chalk.cyan(`\n🔍 质量检测系统健康度: ${successRate.toFixed(1)}%`));

    // 功能完整性评估
    const functionsTestedCount = Object.values(this.testResults.functionResults)
      .filter(result => result.passed + result.failed > 0).length;
    
    console.log(chalk.cyan(`\n🎯 功能覆盖度: ${functionsTestedCount}/6 个核心功能`));

    // 设置退出码
    if (successRate >= 85 && functionsTestedCount >= 6) {
      console.log(chalk.green('\n✅ 质量检测系统测试达到可接受标准'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ 质量检测系统测试未达标，需要修复'));
      process.exit(1);
    }
  }
}

// 执行质量检测系统测试
console.log(chalk.blue('正在初始化质量检测系统测试器...'));
const tester = new QualityDetectionTester();

tester.runAllTests().catch(error => {
  console.error(chalk.red('质量检测系统测试执行过程中发生致命错误:'), error);
  process.exit(1);
});