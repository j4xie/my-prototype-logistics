#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import * as authController from '../src/controllers/authController.js';
import * as alertController from '../src/controllers/alertController.js';
import * as equipmentController from '../src/controllers/equipmentController.js';
import * as qualityController from '../src/controllers/qualityController.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

class ProductionFlowTester {
  constructor() {
    this.tests = [];
    this.failures = [];
    this.testData = new Map();
    this.testUsers = [];
    this.testFactories = [];
    this.testEntities = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      phase: '📋',
      flow: '🔄'
    };
    console.log(`[${timestamp}] ${icons[type] || '📝'} ${message}`);
  }

  async test(name, testFunction, category = 'flow') {
    const startTime = Date.now();
    
    try {
      this.log(`🔍 生产流程测试: ${name}`);
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

  async setupProductionTestData() {
    this.log('🏭 设置生产流程集成测试数据', 'phase');

    // 创建测试工厂
    const testFactory = await this.test('创建生产测试工厂', async () => {
      const factory = await prisma.factory.create({
        data: {
          id: 'PROD-FLOW-FACTORY-001',
          name: '生产流程测试工厂',
          industry: '食品制造业',
          address: '生产流程测试地址456号',
          industryCode: '140',
          regionCode: 'BJ'
        }
      });

      this.testFactories.push(factory.id);
      this.testData.set('factory', factory.id);
      
      return factory;
    });

    // 创建测试用户（不同角色）
    const testUsers = await this.test('创建生产流程测试用户', async () => {
      const hashedPassword = await bcrypt.hash('ProdTest@123456', 12);
      const users = [];
      const factoryId = this.testData.get('factory');

      const roleTestUsers = [
        { username: 'prod_supervisor', roleCode: 'factory_super_admin', department: 'management' },
        { username: 'quality_inspector', roleCode: 'operator', department: 'quality' },
        { username: 'equipment_operator', roleCode: 'operator', department: 'processing' }
      ];

      for (const userData of roleTestUsers) {
        const user = await prisma.user.create({
          data: {
            factoryId,
            username: userData.username,
            passwordHash: hashedPassword,
            email: `${userData.username}@prodtest.com`,
            phone: `+861380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            fullName: `生产测试用户_${userData.roleCode}`,
            isActive: true,
            roleCode: userData.roleCode,
            department: userData.department
          }
        });
        users.push(user);
        this.testUsers.push(user.id);
      }

      this.testData.set('supervisor', users[0]);
      this.testData.set('qualityInspector', users[1]);
      this.testData.set('equipmentOperator', users[2]);
      
      return users;
    });

    // 创建测试设备
    const testEquipment = await this.test('创建生产测试设备', async () => {
      const factoryId = this.testData.get('factory');
      
      const equipment = await prisma.factoryEquipment.create({
        data: {
          factoryId,
          equipmentCode: 'PROD-EQ-001',
          equipmentName: '生产线设备A',
          equipmentType: '生产设备',
          department: 'processing',
          status: 'active',
          location: '生产车间A区',
          specifications: {
            maxTemperature: 200,
            maxPressure: 50,
            alerts: {
              temperature: { max: 180, min: 10 },
              pressure: { max: 45, min: 5 }
            }
          }
        }
      });

      this.testEntities.push({ type: 'equipment', id: equipment.id });
      this.testData.set('equipment', equipment);
      
      return equipment;
    });

    return { testFactory, testUsers, testEquipment };
  }

  // 阶段1: 完整生产批次流程测试
  async testProductionBatchFlow() {
    this.log('📋 阶段1: 完整生产批次流程测试', 'phase');
    
    const supervisor = this.testData.get('supervisor');
    const qualityInspector = this.testData.get('qualityInspector');
    const factoryId = this.testData.get('factory');

    // 步骤1: 用户登录验证
    const supervisorLogin = await this.test('1.1 生产主管登录系统', async () => {
      const loginResult = await authController.unifiedLogin(supervisor.username, 'ProdTest@123456');
      
      if (!loginResult.success) {
        throw new Error(`主管登录失败: ${loginResult.message}`);
      }

      this.testData.set('supervisorAuth', loginResult);
      
      return {
        userId: loginResult.user.id,
        roleCode: loginResult.user.roleCode,
        factoryId: loginResult.user.factoryId
      };
    }, 'authentication');

    // 步骤2: 创建生产批次
    const productionBatch = await this.test('1.2 创建生产批次', async () => {
      const batch = await prisma.processingBatch.create({
        data: {
          factoryId,
          batchNumber: `PROD-${Date.now()}`,
          productType: '有机面粉',
          rawMaterials: {
            wheat: { quantity: 1000, unit: 'kg', supplier: '优质供应商A' },
            water: { quantity: 200, unit: 'L', quality: '纯净水' }
          },
          startDate: new Date(),
          status: 'planning',
          productionLine: 'A线',
          supervisorId: supervisor.id,
          targetQuantity: 800.50,
          notes: '优质有机面粉生产批次'
        }
      });

      this.testEntities.push({ type: 'batch', id: batch.id });
      this.testData.set('batch', batch);
      
      return {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status
      };
    }, 'production');

    // 步骤3: 更新批次状态为进行中
    await this.test('1.3 开始生产批次', async () => {
      const batch = this.testData.get('batch');
      
      const updatedBatch = await prisma.processingBatch.update({
        where: { id: batch.id },
        data: { 
          status: 'in_progress',
          actualQuantity: 0
        }
      });

      this.testData.set('batch', updatedBatch);
      
      return {
        batchId: updatedBatch.id,
        newStatus: updatedBatch.status
      };
    }, 'production');

    // 步骤4: 质检员登录
    const inspectorLogin = await this.test('1.4 质检员登录系统', async () => {
      const loginResult = await authController.unifiedLogin(qualityInspector.username, 'ProdTest@123456');
      
      if (!loginResult.success) {
        throw new Error(`质检员登录失败: ${loginResult.message}`);
      }

      this.testData.set('inspectorAuth', loginResult);
      
      return {
        userId: loginResult.user.id,
        department: loginResult.user.department
      };
    }, 'authentication');

    // 步骤5: 提交原料质检
    const rawMaterialInspection = await this.test('1.5 提交原料质检记录', async () => {
      const batch = this.testData.get('batch');
      const inspectorAuth = this.testData.get('inspectorAuth');
      
      const mockUser = {
        id: inspectorAuth.user.id,
        factoryId: inspectorAuth.user.factoryId
      };

      const inspectionData = {
        batchId: batch.id,
        inspectionType: 'raw_material',
        testItems: {
          moisture: { value: 13.2, standard: '≤14%', result: 'pass' },
          protein: { value: 12.8, standard: '≥12%', result: 'pass' },
          impurities: { value: 0.5, standard: '≤1%', result: 'pass' }
        },
        overallResult: 'pass',
        qualityScore: 8.5,
        correctiveActions: '原料质量良好，可进入生产'
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, inspectionData);
      
      await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response.success) {
        throw new Error('原料质检提交失败');
      }

      this.testData.set('rawInspection', response.data);
      
      return {
        inspectionId: response.data.id,
        result: response.data.overallResult,
        score: response.data.qualityScore
      };
    }, 'quality');

    return {
      supervisorLogin,
      productionBatch,
      inspectorLogin,
      rawMaterialInspection
    };
  }

  // 阶段2: 设备监控和告警集成测试
  async testEquipmentAlertFlow() {
    this.log('📋 阶段2: 设备监控和告警集成测试', 'phase');
    
    const equipmentOperator = this.testData.get('equipmentOperator');
    const equipment = this.testData.get('equipment');

    // 步骤1: 设备操作员登录
    const operatorLogin = await this.test('2.1 设备操作员登录', async () => {
      const loginResult = await authController.unifiedLogin(equipmentOperator.username, 'ProdTest@123456');
      
      if (!loginResult.success) {
        throw new Error(`设备操作员登录失败: ${loginResult.message}`);
      }

      this.testData.set('operatorAuth', loginResult);
      
      return {
        userId: loginResult.user.id,
        department: loginResult.user.department
      };
    }, 'authentication');

    // 步骤2: 上报正常设备数据
    const normalDataReport = await this.test('2.2 上报正常设备监控数据', async () => {
      const operatorAuth = this.testData.get('operatorAuth');
      
      const mockUser = {
        id: operatorAuth.user.id,
        factoryId: operatorAuth.user.factoryId
      };

      const normalMetrics = {
        temperature: 120,  // 正常温度
        pressure: 30,      // 正常压力
        vibration: 0.2,
        runningTime: 3600
      };

      const mockReqRes = this.createMockReqRes(mockUser, { id: equipment.id }, {}, {
        metrics: normalMetrics,
        status: 'normal',
        dataSource: 'manual'
      });
      
      await equipmentController.reportEquipmentData(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (mockReqRes.getStatusCode() !== 201) {
        throw new Error('正常数据上报失败');
      }

      return {
        dataId: response.data.id,
        alertTriggered: response.data.alertTriggered,
        metrics: normalMetrics
      };
    }, 'monitoring');

    // 步骤3: 上报异常设备数据触发告警
    const alertDataReport = await this.test('2.3 上报异常数据触发设备告警', async () => {
      const operatorAuth = this.testData.get('operatorAuth');
      
      const mockUser = {
        id: operatorAuth.user.id,
        factoryId: operatorAuth.user.factoryId
      };

      const alertMetrics = {
        temperature: 190,  // 超高温度 (超过180度阈值)
        pressure: 50,      // 超高压力 (超过45压力阈值)
        vibration: 1.5,
        runningTime: 7200
      };

      const mockReqRes = this.createMockReqRes(mockUser, { id: equipment.id }, {}, {
        metrics: alertMetrics,
        status: 'maintenance', // 使用有效的枚举值
        dataSource: 'sensor'
      });
      
      await equipmentController.reportEquipmentData(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response.data.alertTriggered) {
        throw new Error('预期应该触发告警');
      }

      return {
        dataId: response.data.id,
        alertTriggered: response.data.alertTriggered,
        alertMessage: response.data.message
      };
    }, 'monitoring');

    // 步骤4: 查询设备告警列表
    const alertList = await this.test('2.4 查询设备告警列表', async () => {
      const operatorAuth = this.testData.get('operatorAuth');
      
      const mockUser = {
        id: operatorAuth.user.id,
        factoryId: operatorAuth.user.factoryId
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, { 
        equipmentId: equipment.id,
        limit: 10
      });
      
      await equipmentController.getEquipmentAlerts(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response.success || !Array.isArray(response.data.alerts)) {
        throw new Error('获取设备告警列表失败');
      }

      const equipmentAlerts = response.data.alerts.filter(alert => alert.sourceId === equipment.id);
      
      return {
        totalAlerts: response.data.alerts.length,
        equipmentAlerts: equipmentAlerts.length,
        firstAlert: equipmentAlerts[0] || null
      };
    }, 'alerts');

    return {
      operatorLogin,
      normalDataReport,
      alertDataReport,
      alertList
    };
  }

  // 阶段3: 完整生产到质检流程测试
  async testCompleteProductionFlow() {
    this.log('📋 阶段3: 完整生产到质检流程测试', 'phase');
    
    const batch = this.testData.get('batch');
    const supervisorAuth = this.testData.get('supervisorAuth');
    const inspectorAuth = this.testData.get('inspectorAuth');

    // 步骤1: 更新生产进度
    const updateProgress = await this.test('3.1 更新生产批次进度', async () => {
      const updatedBatch = await prisma.processingBatch.update({
        where: { id: batch.id },
        data: { 
          actualQuantity: 750.30, // 更新实际产量
          status: 'quality_check' // 进入质检阶段
        }
      });

      this.testData.set('batch', updatedBatch);
      
      return {
        batchId: updatedBatch.id,
        actualQuantity: updatedBatch.actualQuantity,
        newStatus: updatedBatch.status
      };
    }, 'production');

    // 步骤2: 提交过程质检
    const processInspection = await this.test('3.2 提交过程质检记录', async () => {
      const mockUser = {
        id: inspectorAuth.user.id,
        factoryId: inspectorAuth.user.factoryId
      };

      const inspectionData = {
        batchId: batch.id,
        inspectionType: 'process',
        testItems: {
          texture: { value: 'fine', standard: 'fine/medium', result: 'pass' },
          color: { value: 'natural', standard: 'natural', result: 'pass' },
          smell: { value: 'normal', standard: 'normal', result: 'pass' }
        },
        overallResult: 'pass',
        qualityScore: 8.8,
        correctiveActions: '加工过程正常'
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, inspectionData);
      
      await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response.success) {
        throw new Error('过程质检提交失败');
      }

      return {
        inspectionId: response.data.id,
        result: response.data.overallResult,
        score: response.data.qualityScore
      };
    }, 'quality');

    // 步骤3: 提交最终产品质检
    const finalInspection = await this.test('3.3 提交最终产品质检', async () => {
      const mockUser = {
        id: inspectorAuth.user.id,
        factoryId: inspectorAuth.user.factoryId
      };

      const inspectionData = {
        batchId: batch.id,
        inspectionType: 'final_product',
        testItems: {
          moisture: { value: 13.5, standard: '≤14%', result: 'pass' },
          protein: { value: 12.9, standard: '≥12%', result: 'pass' },
          ash: { value: 0.8, standard: '≤1%', result: 'pass' },
          packaging: { value: 'intact', standard: 'intact', result: 'pass' }
        },
        overallResult: 'pass',
        qualityScore: 9.2,
        correctiveActions: '最终产品质量优秀，符合出厂标准'
      };

      const mockReqRes = this.createMockReqRes(mockUser, {}, {}, inspectionData);
      
      await qualityController.submitInspection(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response.success) {
        throw new Error('最终质检提交失败');
      }

      this.testData.set('finalInspection', response.data);
      
      return {
        inspectionId: response.data.id,
        result: response.data.overallResult,
        score: response.data.qualityScore
      };
    }, 'quality');

    // 步骤4: 完成生产批次
    const completeBatch = await this.test('3.4 完成生产批次', async () => {
      const updatedBatch = await prisma.processingBatch.update({
        where: { id: batch.id },
        data: { 
          status: 'completed',
          endDate: new Date(),
          qualityGrade: 'A' // 基于质检结果设置等级
        }
      });

      return {
        batchId: updatedBatch.id,
        finalStatus: updatedBatch.status,
        qualityGrade: updatedBatch.qualityGrade,
        endDate: updatedBatch.endDate
      };
    }, 'production');

    // 步骤5: 获取完整的生产统计
    const productionStats = await this.test('3.5 获取生产批次统计', async () => {
      const mockUser = {
        id: supervisorAuth.user.id,
        factoryId: supervisorAuth.user.factoryId
      };

      const mockReqRes = this.createMockReqRes(mockUser);
      
      await qualityController.getQualityStatistics(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const response = mockReqRes.getResponse();
      
      if (!response.success) {
        throw new Error('获取质检统计失败');
      }

      return {
        totalInspections: response.data.summary.totalInspections,
        avgQualityScore: response.data.summary.avgQualityScore,
        passRate: response.data.resultDistribution.pass || 0,
        batchCompleted: true
      };
    }, 'reporting');

    return {
      updateProgress,
      processInspection,
      finalInspection,
      completeBatch,
      productionStats
    };
  }

  async cleanup() {
    this.log('🧹 清理生产流程测试数据');

    try {
      // 删除质检记录
      await prisma.qualityInspection.deleteMany({
        where: { factoryId: { in: this.testFactories } }
      });

      // 删除设备监控数据
      await prisma.deviceMonitoringData.deleteMany({
        where: { factoryId: { in: this.testFactories } }
      });

      // 删除告警通知
      await prisma.alertNotification.deleteMany({
        where: { factoryId: { in: this.testFactories } }
      });

      // 删除生产批次
      await prisma.processingBatch.deleteMany({
        where: { factoryId: { in: this.testFactories } }
      });

      // 删除测试实体
      for (const entity of this.testEntities) {
        if (entity.type === 'equipment') {
          await prisma.factoryEquipment.deleteMany({
            where: { id: entity.id }
          });
        }
      }

      // 删除创建的用户
      if (this.testUsers.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: this.testUsers } }
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
    this.log('🔄 生产流程集成测试完成', 'phase');
    console.log('================================================================================\n');

    console.log('📈 总体统计:');
    console.log(`   总计测试: ${totalTests}`);
    console.log(`   通过: ${passedTests}`);
    console.log(`   失败: ${failedTests}`);
    console.log(`   成功率: ${successRate}%`);
    console.log(`   总耗时: ${totalTime.toFixed(2)}秒\n`);

    // 按功能分组统计
    const categories = [...new Set(this.tests.map(t => t.category))];
    console.log('📋 分阶段测试结果:');
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

    console.log('\n💡 生产流程集成测试结论:');
    if (successRate >= 90) {
      console.log('   🎉 生产流程集成完美！所有系统协作良好');
    } else if (successRate >= 80) {
      console.log('   ✅ 生产流程集成良好，系统协作基本正常');
    } else if (successRate >= 70) {
      console.log('   ⚠️ 生产流程存在部分问题，需要优化系统集成');
    } else {
      console.log('   ❌ 生产流程集成存在严重问题，需要全面检查');
    }

    console.log(`\n🔄 生产流程集成健康度: ${successRate}%`);
    
    console.log('\n🎯 测试覆盖的完整流程:');
    console.log('   ✓ 用户认证 → 批次创建 → 质检记录 → 设备监控 → 告警处理');
    console.log('   ✓ 原料检验 → 过程检验 → 成品检验 → 统计报告');
    console.log('   ✓ 设备数据上报 → 异常检测 → 自动告警 → 告警查询');

    if (successRate >= 85) {
      console.log('\n✅ 生产流程集成测试达到可接受标准');
    } else {
      console.log('\n❌ 生产流程集成测试未达标，需要修复');
    }
  }

  async run() {
    console.log('正在初始化生产流程集成测试器...');
    console.log('🔄 海牛食品溯源系统 - 完整生产流程集成测试');
    console.log('📊 测试范围: 用户认证→批次管理→质检→设备监控→告警的完整数据流');
    console.log(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`);

    try {
      await this.setupProductionTestData();
      await this.testProductionBatchFlow();
      await this.testEquipmentAlertFlow();
      await this.testCompleteProductionFlow();
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
const tester = new ProductionFlowTester();
tester.run().catch(console.error);