#!/usr/bin/env node

/**
 * 白垩纪食品溯源系统 - 数据关系完整性测试
 * 阶段1-2: 外键约束和级联操作完整性验证
 * 专注测试：外键约束、级联删除、孤儿记录防护、复杂关系场景
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';

const prisma = new PrismaClient();

class RelationshipIntegrityTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      categories: {
        'foreign_key_constraints': { passed: 0, failed: 0 },
        'cascade_operations': { passed: 0, failed: 0 },
        'orphan_prevention': { passed: 0, failed: 0 },
        'complex_relationships': { passed: 0, failed: 0 }
      }
    };
    this.testData = new Map(); // 存储测试数据ID
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

  async test(name, testFn, category = 'general') {
    this.testResults.total++;
    this.log(`🔗 关系测试: ${name}`, 'info');
    
    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.passed++;
      if (this.testResults.categories[category]) {
        this.testResults.categories[category].passed++;
      }
      
      this.log(`✅ 通过: ${name} (${duration}ms)`, 'success');
      return result;
    } catch (error) {
      this.testResults.failed++;
      if (this.testResults.categories[category]) {
        this.testResults.categories[category].failed++;
      }
      
      this.testResults.details.push({ name, error: error.message, category });
      this.log(`❌ 失败: ${name} - ${error.message}`, 'error');
      return null;
    }
  }

  // 阶段1: 外键约束测试
  async testForeignKeyConstraints() {
    this.log('🔒 阶段1: 外键约束完整性测试', 'phase');

    // 测试1.1: Factory外键约束
    await this.test('Factory不存在时创建User失败测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId: 'NON_EXISTENT_FACTORY_ID',
            username: 'fk_test_user',
            passwordHash: '$2b$10$test.hash',
            email: 'fktest@test.com',
            fullName: '外键测试用户'
          }
        });
        throw new Error('应该因外键约束失败');
      } catch (error) {
        if (error.message.includes('Foreign key constraint') || 
            error.message.includes('foreign key') ||
            error.code === 'P2003') {
          return { message: 'Factory外键约束正常工作' };
        }
        throw error;
      }
    }, 'foreign_key_constraints');

    // 测试1.2: 创建测试工厂用于后续测试
    const factory = await this.test('创建测试工厂', async () => {
      const factoryData = {
        name: '关系测试工厂',
        industry: '食品制造业', 
        address: '北京市测试区关系路100号',
        employeeCount: 30,
        contactName: '关系测试经理',
        contactPhone: '+86138000000101',
        contactEmail: 'relation@testfactory.com'
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
    }, 'foreign_key_constraints');

    if (!factory) {
      this.log('❌ 无法创建测试工厂，跳过后续外键测试', 'warning');
      return;
    }

    // 测试1.3: User-Factory外键约束
    const user = await this.test('User正确外键创建测试', async () => {
      const user = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: 'relation_test_user',
          passwordHash: '$2b$10$relation.test.hash',
          email: 'relationtest@factory.com',
          phone: '+86138000000102',
          fullName: '关系测试用户',
          department: 'processing',
          roleCode: 'operator',
          position: '关系测试员',
          isActive: true
        }
      });

      this.testData.set('user', user.id);
      return user;
    }, 'foreign_key_constraints');

    // 测试1.4: ProcessingBatch外键约束
    const batch = await this.test('ProcessingBatch外键约束测试', async () => {
      if (!user) throw new Error('需要有效用户');

      const batch = await prisma.processingBatch.create({
        data: {
          factoryId: factory.id,
          batchNumber: `REL_BATCH_${Date.now()}`,
          productType: '关系测试产品',
          rawMaterials: [
            { material: '关系原料A', quantity: 100, unit: 'kg' }
          ],
          startDate: new Date(),
          productionLine: 'REL_LINE001',
          supervisorId: user.id,
          targetQuantity: 50,
          status: 'planning',
          notes: '关系测试批次'
        }
      });

      this.testData.set('batch', batch.id);
      return batch;
    }, 'foreign_key_constraints');

    // 测试1.5: 无效supervisorId测试
    await this.test('ProcessingBatch无效supervisorId测试', async () => {
      try {
        await prisma.processingBatch.create({
          data: {
            factoryId: factory.id,
            batchNumber: `INVALID_SUP_${Date.now()}`,
            productType: '测试产品',
            rawMaterials: [],
            startDate: new Date(),
            productionLine: 'TEST001',
            supervisorId: 999999, // 不存在的用户ID
            targetQuantity: 10,
            status: 'planning'
          }
        });
        throw new Error('应该因supervisorId外键约束失败');
      } catch (error) {
        if (error.message.includes('Foreign key constraint') || 
            error.code === 'P2003') {
          return { message: 'SupervisorId外键约束正常工作' };
        }
        throw error;
      }
    }, 'foreign_key_constraints');

    // 测试1.6: Equipment外键约束
    const equipment = await this.test('FactoryEquipment外键约束测试', async () => {
      const equipment = await prisma.factoryEquipment.create({
        data: {
          factoryId: factory.id,
          equipmentCode: 'REL_EQP001',
          equipmentName: '关系测试设备',
          equipmentType: '测试设备',
          department: 'processing',
          location: '关系测试车间',
          status: 'active',
          specifications: {
            model: 'REL-TEST-2024',
            alerts: { temperature: { max: 60, min: 0 } }
          }
        }
      });

      this.testData.set('equipment', equipment.id);
      return equipment;
    }, 'foreign_key_constraints');
  }

  // 阶段2: 级联操作测试
  async testCascadeOperations() {
    this.log('⚡ 阶段2: 级联操作测试', 'phase');

    const factoryId = this.testData.get('factory');
    const userId = this.testData.get('user');
    const batchId = this.testData.get('batch');
    const equipmentId = this.testData.get('equipment');

    if (!factoryId || !userId || !batchId || !equipmentId) {
      this.log('❌ 跳过级联测试: 缺少必要的测试数据', 'warning');
      return;
    }

    // 测试2.1: 创建复杂关系数据
    const qualityInspection = await this.test('创建质检记录用于级联测试', async () => {
      const inspection = await prisma.qualityInspection.create({
        data: {
          factoryId,
          batchId,
          inspectorId: userId,
          inspectionType: 'final_product', // 使用正确的枚举值
          inspectionDate: new Date(),
          testItems: [
            {
              item: '级联测试项',
              standard: '级联测试标准',
              result: 'pass',
              notes: '级联测试'
            }
          ],
          overallResult: 'pass',
          qualityScore: 9.5, // MySQL DECIMAL(3,2) 最大值为9.99
          defectDetails: null,
          correctiveActions: null,
          photos: ['cascade_test.jpg']
        }
      });

      this.testData.set('qualityInspection', inspection.id);
      return inspection;
    }, 'cascade_operations');

    // 测试2.2: 创建设备监控数据
    const monitoringData = await this.test('创建设备监控数据用于级联测试', async () => {
      const data = await prisma.deviceMonitoringData.create({
        data: {
          equipmentId,
          factoryId,
          timestamp: new Date(),
          metrics: {
            temperature: 25.0,
            pressure: 8.0,
            humidity: 45.0
          },
          status: 'normal',
          alertTriggered: false,
          dataSource: 'cascade_test'
        }
      });

      this.testData.set('monitoringData', data.id);
      return data;
    }, 'cascade_operations');

    // 测试2.3: 创建告警通知
    const alert = await this.test('创建告警通知用于级联测试', async () => {
      const alert = await prisma.alertNotification.create({
        data: {
          factoryId,
          alertType: 'equipment',
          severity: 'medium',
          title: '级联测试告警',
          message: '这是用于级联测试的告警',
          sourceId: equipmentId,
          sourceType: 'equipment',
          status: 'new',
          assignedTo: [userId]
        }
      });

      this.testData.set('alert', alert.id);
      return alert;
    }, 'cascade_operations');

    // 测试2.4: 创建用户会话
    const session = await this.test('创建用户会话用于级联测试', async () => {
      const session = await prisma.session.create({
        data: {
          userId,
          factoryId,
          token: 'cascade-test-token-' + Date.now(),
          refreshToken: 'cascade-refresh-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      });

      this.testData.set('session', session.id);
      return session;
    }, 'cascade_operations');

    // 测试2.5: 测试删除设备时的级联效果
    await this.test('删除设备的级联操作测试', async () => {
      // 首先记录删除前的相关数据数量
      const [monitoringCount, alertCount] = await Promise.all([
        prisma.deviceMonitoringData.count({ 
          where: { equipmentId } 
        }),
        prisma.alertNotification.count({ 
          where: { sourceId: equipmentId, sourceType: 'equipment' } 
        })
      ]);

      if (monitoringCount === 0 || alertCount === 0) {
        throw new Error('测试数据不完整，无法验证级联删除');
      }

      // 删除设备
      await prisma.factoryEquipment.delete({
        where: { id: equipmentId }
      });

      // 检查关联数据是否被正确处理
      const [remainingMonitoring, remainingAlerts] = await Promise.all([
        prisma.deviceMonitoringData.count({ 
          where: { equipmentId } 
        }),
        prisma.alertNotification.count({ 
          where: { sourceId: equipmentId, sourceType: 'equipment' } 
        })
      ]);

      // 根据Prisma schema设置，监控数据应该被级联删除
      if (remainingMonitoring > 0) {
        throw new Error(`设备监控数据未被级联删除，剩余 ${remainingMonitoring} 条`);
      }

      // 告警通知可能需要手动处理或设置为未解决状态
      this.log(`设备删除完成，监控数据级联删除成功，告警数据: ${remainingAlerts}`, 'info');
      
      return { 
        message: '设备级联删除成功',
        deletedMonitoring: monitoringCount,
        remainingAlerts: remainingAlerts
      };
    }, 'cascade_operations');

    // 更新测试数据映射，删除已删除的设备
    this.testData.delete('equipment');
    this.testData.delete('monitoringData');
  }

  // 阶段3: 孤儿记录防护测试
  async testOrphanPrevention() {
    this.log('🛡️ 阶段3: 孤儿记录防护测试', 'phase');

    const factoryId = this.testData.get('factory');
    
    if (!factoryId) {
      this.log('❌ 跳过孤儿防护测试: 缺少工厂数据', 'warning');
      return;
    }

    // 为孤儿防护测试创建新的用户，避免被之前的级联删除影响
    const orphanTestUser = await this.test('创建孤儿防护测试用户', async () => {
      const user = await prisma.user.create({
        data: {
          factoryId,
          username: 'orphan_protection_user',
          passwordHash: '$2b$10$orphan.protection.hash',
          email: 'orphan@protection.com',
          phone: '+86138000000301',
          fullName: '孤儿防护测试用户',
          department: 'processing',
          roleCode: 'operator',
          position: '孤儿防护测试员',
          isActive: true
        }
      });

      this.testData.set('orphanTestUser', user.id);
      return user;
    }, 'orphan_prevention');

    if (!orphanTestUser) {
      this.log('❌ 无法创建孤儿防护测试用户', 'warning');
      return;
    }

    const userId = orphanTestUser.id;

    // 为孤儿防护测试创建关联数据
    const orphanTestBatch = await this.test('创建孤儿防护测试批次', async () => {
      const batch = await prisma.processingBatch.create({
        data: {
          factoryId,
          batchNumber: `ORPHAN_BATCH_${Date.now()}`,
          productType: '孤儿防护测试产品',
          rawMaterials: [
            { material: '孤儿防护原料', quantity: 50, unit: 'kg' }
          ],
          startDate: new Date(),
          productionLine: 'ORPHAN_LINE001',
          supervisorId: userId,
          targetQuantity: 25,
          status: 'planning',
          notes: '孤儿防护测试批次'
        }
      });

      this.testData.set('orphanTestBatch', batch.id);
      return batch;
    }, 'orphan_prevention');

    const orphanTestSession = await this.test('创建孤儿防护测试会话', async () => {
      const session = await prisma.session.create({
        data: {
          userId,
          factoryId,
          token: 'orphan-test-token-' + Date.now(),
          refreshToken: 'orphan-refresh-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      });

      this.testData.set('orphanTestSession', session.id);
      return session;
    }, 'orphan_prevention');

    // 测试3.1: 尝试删除有关联数据的用户
    await this.test('删除有关联数据的用户防护测试', async () => {
      if (!orphanTestBatch || !orphanTestSession) {
        throw new Error('孤儿防护测试数据创建失败');
      }

      try {
        await prisma.user.delete({
          where: { id: userId }
        });
        throw new Error('应该因为有关联数据而无法删除用户');
      } catch (error) {
        if (error.message.includes('Foreign key constraint') || 
            error.code === 'P2003') {
          return { 
            message: '用户孤儿防护正常工作',
            relatedData: {
              batches: 1,
              sessions: 1
            }
          };
        }
        throw error;
      }
    }, 'orphan_prevention');

    // 测试3.2: 正确删除关联数据后再删除用户
    await this.test('清理关联数据后删除用户测试', async () => {
      // 先删除所有关联数据
      const deleteResults = await Promise.all([
        prisma.session.deleteMany({ where: { userId } }),
        prisma.processingBatch.deleteMany({ where: { supervisorId: userId } })
      ]);

      const totalDeleted = deleteResults.reduce((sum, result) => sum + result.count, 0);
      
      if (totalDeleted === 0) {
        throw new Error('没有关联数据被删除');
      }

      // 现在应该可以删除用户
      const deletedUser = await prisma.user.delete({
        where: { id: userId }
      });

      this.testData.delete('orphanTestUser');
      this.testData.delete('orphanTestBatch'); 
      this.testData.delete('orphanTestSession');

      return { 
        message: '关联数据清理后用户删除成功',
        deletedRelatedRecords: totalDeleted,
        deletedUser: deletedUser.username
      };
    }, 'orphan_prevention');

    // 测试3.3: 尝试删除有用户的工厂
    await this.test('删除有用户的工厂防护测试', async () => {
      // 创建一个新用户来测试工厂删除防护
      const newUser = await prisma.user.create({
        data: {
          factoryId,
          username: 'orphan_test_user',
          passwordHash: '$2b$10$orphan.test.hash',
          email: 'orphantest@factory.com',
          fullName: '孤儿测试用户',
          department: 'processing',
          roleCode: 'operator',
          isActive: true
        }
      });

      try {
        await prisma.factory.delete({
          where: { id: factoryId }
        });
        
        // 如果能删除，清理创建的用户
        await prisma.user.delete({ where: { id: newUser.id } });
        
        throw new Error('应该因为有用户关联而无法删除工厂');
      } catch (error) {
        // 清理测试用户
        await prisma.user.delete({ where: { id: newUser.id } });
        
        if (error.message.includes('Foreign key constraint') || 
            error.code === 'P2003') {
          return { 
            message: '工厂孤儿防护正常工作'
          };
        }
        throw error;
      }
    }, 'orphan_prevention');
  }

  // 阶段4: 复杂关系场景测试
  async testComplexRelationships() {
    this.log('🌐 阶段4: 复杂关系场景测试', 'phase');

    // 验证工厂是否仍然存在，如果不存在则创建新的
    let factoryId = this.testData.get('factory');
    
    if (!factoryId) {
      this.log('❌ 跳过复杂关系测试: 缺少工厂数据', 'warning');
      return;
    }

    // 验证工厂是否存在
    const factoryExists = await prisma.factory.findUnique({
      where: { id: factoryId }
    });

    if (!factoryExists) {
      // 如果工厂被删除了，创建一个新的复杂关系测试工厂
      const complexFactory = await this.test('创建复杂关系测试工厂', async () => {
        const factoryData = {
          name: '复杂关系测试工厂',
          industry: '食品制造业',
          address: '深圳市测试区复杂路300号',
          employeeCount: 40,
          contactName: '复杂关系测试经理',
          contactPhone: '+86138000000401',
          contactEmail: 'complex@testfactory.com'
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

        this.testData.set('complexFactory', factory.id);
        return factory;
      }, 'complex_relationships');

      if (!complexFactory) {
        this.log('❌ 无法创建复杂关系测试工厂', 'warning');
        return;
      }
      factoryId = complexFactory.id;
    }

    // 测试4.1: 创建完整的生产流程关系链
    const productionChain = await this.test('创建完整生产流程关系链', async () => {
      // 1. 创建生产管理员
      const supervisor = await prisma.user.create({
        data: {
          factoryId,
          username: 'complex_supervisor',
          passwordHash: '$2b$10$complex.test.hash',
          email: 'supervisor@complex.com',
          fullName: '复杂测试主管',
          department: 'processing',
          roleCode: 'department_admin',
          isActive: true
        }
      });

      // 2. 创建质检员
      const inspector = await prisma.user.create({
        data: {
          factoryId,
          username: 'complex_inspector', 
          passwordHash: '$2b$10$complex.inspector.hash',
          email: 'inspector@complex.com',
          fullName: '复杂测试质检员',
          department: 'quality',
          roleCode: 'operator',
          isActive: true
        }
      });

      // 3. 创建生产批次
      const batch = await prisma.processingBatch.create({
        data: {
          factoryId,
          batchNumber: `COMPLEX_${Date.now()}`,
          productType: '复杂测试产品',
          rawMaterials: [
            { material: '复杂原料A', quantity: 200, unit: 'kg' },
            { material: '复杂原料B', quantity: 100, unit: 'kg' }
          ],
          startDate: new Date(),
          productionLine: 'COMPLEX_LINE001',
          supervisorId: supervisor.id,
          targetQuantity: 150,
          status: 'in_progress'
        }
      });

      // 4. 创建质检记录
      const inspection = await prisma.qualityInspection.create({
        data: {
          factoryId,
          batchId: batch.id,
          inspectorId: inspector.id,
          inspectionType: 'final_product',
          inspectionDate: new Date(),
          testItems: [
            {
              item: '复杂外观检查',
              standard: '无破损、无杂质',
              result: 'pass'
            },
            {
              item: '复杂重量测试', 
              standard: '149-151g',
              result: 'pass',
              actualValue: '150.2g'
            }
          ],
          overallResult: 'pass',
          qualityScore: 9.8 // MySQL DECIMAL(3,2) 最大值为9.99
        }
      });

      // 5. 创建设备
      const equipment = await prisma.factoryEquipment.create({
        data: {
          factoryId,
          equipmentCode: 'COMPLEX_EQP001',
          equipmentName: '复杂测试设备',
          equipmentType: '复杂生产设备',
          department: 'processing',
          location: '复杂测试车间-A1',
          status: 'active',
          specifications: {
            model: 'COMPLEX-PRO-2024',
            capacity: '200kg/h',
            alerts: {
              temperature: { max: 80, min: 10 },
              pressure: { max: 12, min: 2 }
            }
          }
        }
      });

      // 6. 创建监控数据
      const monitoring = await prisma.deviceMonitoringData.create({
        data: {
          equipmentId: equipment.id,
          factoryId,
          timestamp: new Date(),
          metrics: {
            temperature: 75.5,
            pressure: 10.2,
            humidity: 55.0,
            vibration: 0.05
          },
          status: 'normal',
          alertTriggered: false,
          dataSource: 'complex_test'
        }
      });

      this.testData.set('complex_supervisor', supervisor.id);
      this.testData.set('complex_inspector', inspector.id);
      this.testData.set('complex_batch', batch.id);
      this.testData.set('complex_inspection', inspection.id);
      this.testData.set('complex_equipment', equipment.id);
      this.testData.set('complex_monitoring', monitoring.id);

      return {
        supervisor: supervisor.id,
        inspector: inspector.id,
        batch: batch.id,
        inspection: inspection.id,
        equipment: equipment.id,
        monitoring: monitoring.id
      };
    }, 'complex_relationships');

    // 测试4.2: 复杂关系查询测试
    await this.test('复杂关系查询测试', async () => {
      const batchId = this.testData.get('complex_batch');
      if (!batchId) throw new Error('缺少复杂批次数据');

      // 执行复杂的多表关联查询
      const complexQuery = await prisma.processingBatch.findUnique({
        where: { id: batchId },
        include: {
          supervisor: {
            select: {
              id: true,
              username: true,
              fullName: true,
              department: true,
              roleCode: true
            }
          },
          qualityInspections: {
            include: {
              inspector: {
                select: {
                  id: true,
                  fullName: true,
                  department: true
                }
              }
            }
          },
          factory: {
            select: {
              id: true,
              name: true,
              industry: true
            }
          }
        }
      });

      if (!complexQuery) {
        throw new Error('复杂查询返回空结果');
      }

      if (!complexQuery.supervisor || complexQuery.qualityInspections.length === 0) {
        throw new Error('复杂关系数据不完整');
      }

      const inspection = complexQuery.qualityInspections[0];
      if (!inspection.inspector) {
        throw new Error('质检员关系数据缺失');
      }

      return {
        message: '复杂关系查询成功',
        batchNumber: complexQuery.batchNumber,
        supervisorName: complexQuery.supervisor.fullName,
        inspectorName: inspection.inspector.fullName,
        factoryName: complexQuery.factory.name,
        inspectionCount: complexQuery.qualityInspections.length
      };
    }, 'complex_relationships');

    // 测试4.3: 多工厂数据隔离测试
    await this.test('多工厂数据隔离测试', async () => {
      // 创建第二个工厂
      const factoryData2 = {
        name: '隔离测试工厂B',
        industry: '食品制造业',
        address: '上海市测试区隔离路200号',
        employeeCount: 25,
        contactName: '隔离测试经理B',
        contactPhone: '+86138000000201',
        contactEmail: 'isolation@testfactoryb.com'
      };

      const result2 = await factoryIdGenerator.generateNewFactoryId(factoryData2);
      const factory2 = await prisma.factory.create({
        data: {
          id: result2.factoryId,
          ...factoryData2,
          industryCode: result2.industryCode,
          regionCode: result2.regionCode,
          confidence: result2.confidence.overall,
          factoryYear: new Date().getFullYear(),
          sequenceNumber: result2.sequenceNumber,
          manuallyVerified: true
        }
      });

      // 在工厂2中创建用户
      const user2 = await prisma.user.create({
        data: {
          factoryId: factory2.id,
          username: 'isolation_user_b',
          passwordHash: '$2b$10$isolation.test.hash',
          email: 'userb@factoryb.com', 
          fullName: '隔离测试用户B',
          department: 'processing',
          roleCode: 'operator',
          isActive: true
        }
      });

      // 验证工厂1的用户无法访问工厂2的数据
      const factory1Users = await prisma.user.findMany({
        where: { factoryId: factoryId }
      });

      const factory2Users = await prisma.user.findMany({
        where: { factoryId: factory2.id }
      });

      // 验证跨工厂查询隔离
      const crossFactoryQuery = await prisma.user.findMany({
        where: {
          factoryId: factory2.id,
          username: { in: factory1Users.map(u => u.username) }
        }
      });

      if (crossFactoryQuery.length > 0) {
        throw new Error('工厂数据隔离失败，存在跨工厂数据访问');
      }

      // 清理测试数据
      await prisma.user.delete({ where: { id: user2.id } });
      await prisma.factory.delete({ where: { id: factory2.id } });

      return {
        message: '工厂数据隔离测试成功',
        factory1Users: factory1Users.length,
        factory2Users: 1, // 已删除
        crossFactoryResults: crossFactoryQuery.length
      };
    }, 'complex_relationships');
  }

  // 清理测试数据
  async cleanupTestData() {
    this.log('🧹 清理关系测试数据', 'phase');
    
    const cleanupOrder = [
      'complex_monitoring', 'complex_equipment', 'complex_inspection', 
      'complex_batch', 'complex_inspector', 'complex_supervisor', 'complexFactory',
      'orphanTestSession', 'orphanTestBatch', 'orphanTestUser',
      'alert', 'monitoringData', 'qualityInspection', 'session',
      'batch', 'user', 'equipment', 'factory'
    ];

    for (const dataKey of cleanupOrder) {
      const id = this.testData.get(dataKey);
      if (id) {
        await this.test(`清理${dataKey}数据`, async () => {
          const modelName = this.getModelName(dataKey);
          if (modelName && prisma[modelName]) {
            try {
              await prisma[modelName].delete({ where: { id } });
              return { message: `已删除${dataKey}: ${id}` };
            } catch (error) {
              // 如果记录不存在或已被级联删除，这是正常的
              if (error.code === 'P2025' || error.message.includes('not found')) {
                return { message: `${dataKey}已被级联删除或不存在: ${id}` };
              }
              throw error;
            }
          }
          return { message: `跳过${dataKey}: 模型不存在或已删除` };
        });
      }
    }
  }

  getModelName(key) {
    const modelMap = {
      'factory': 'factory',
      'complexFactory': 'factory',
      'user': 'user', 
      'orphanTestUser': 'user',
      'complex_supervisor': 'user',
      'complex_inspector': 'user',
      'batch': 'processingBatch',
      'orphanTestBatch': 'processingBatch',
      'complex_batch': 'processingBatch',
      'equipment': 'factoryEquipment',
      'complex_equipment': 'factoryEquipment',
      'qualityInspection': 'qualityInspection',
      'complex_inspection': 'qualityInspection',
      'monitoringData': 'deviceMonitoringData',
      'complex_monitoring': 'deviceMonitoringData',
      'alert': 'alertNotification',
      'session': 'session',
      'orphanTestSession': 'session'
    };
    return modelMap[key];
  }

  // 主测试执行器
  async runAllTests() {
    console.log(chalk.cyan.bold('🔗 白垩纪食品溯源系统 - 数据关系完整性测试'));
    console.log(chalk.cyan('📊 测试范围: 外键约束、级联操作、孤儿防护、复杂关系'));
    console.log(chalk.cyan(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`));

    const startTime = Date.now();

    try {
      // 按阶段执行关系完整性测试
      await this.testForeignKeyConstraints();
      await this.testCascadeOperations();
      await this.testOrphanPrevention();
      await this.testComplexRelationships();

    } catch (criticalError) {
      this.log(`💥 关键关系测试失败: ${criticalError.message}`, 'error');
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
    this.log('🔗 数据关系完整性测试完成', 'phase');
    console.log('='.repeat(70));

    console.log(chalk.cyan('\n📈 总体统计:'));
    console.log(`   总计测试: ${this.testResults.total}`);
    console.log(chalk.green(`   通过: ${this.testResults.passed}`));
    console.log(chalk.red(`   失败: ${this.testResults.failed}`));
    console.log(`   成功率: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    console.log(`   总耗时: ${duration}秒`);

    // 分类统计
    console.log(chalk.cyan('\n📋 分类测试结果:'));
    for (const [category, result] of Object.entries(this.testResults.categories)) {
      const total = result.passed + result.failed;
      const successRate = total > 0 ? (result.passed / total * 100).toFixed(1) : 0;
      const categoryName = {
        'foreign_key_constraints': '外键约束',
        'cascade_operations': '级联操作', 
        'orphan_prevention': '孤儿防护',
        'complex_relationships': '复杂关系'
      }[category] || category;
      
      console.log(`   ${categoryName}: ${result.passed}/${total} (${successRate}%)`);
    }

    // 失败详情
    if (this.testResults.failed > 0) {
      console.log(chalk.red('\n❌ 失败测试详情:'));
      this.testResults.details.forEach(detail => {
        console.log(chalk.red(`   - [${detail.category}] ${detail.name}: ${detail.error}`));
      });
    }

    // 测试结论
    console.log(chalk.cyan('\n💡 关系完整性测试结论:'));
    const successRate = (this.testResults.passed / this.testResults.total) * 100;
    if (successRate >= 95) {
      console.log(chalk.green('   🎉 数据关系完整性优秀！外键约束和级联操作正常'));
    } else if (successRate >= 80) {
      console.log(chalk.yellow('   ⚠️ 数据关系基本正常，部分约束需要改进'));
    } else {
      console.log(chalk.red('   🚨 数据关系存在较多问题，需要重点修复'));
    }

    console.log(chalk.cyan(`\n🔗 关系完整性健康度: ${successRate.toFixed(1)}%`));

    // 设置退出码
    if (successRate >= 85) {
      console.log(chalk.green('\n✅ 关系完整性测试达到可接受标准'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ 关系完整性测试未达标，需要修复'));
      process.exit(1);
    }
  }
}

// 执行关系完整性测试
console.log(chalk.blue('正在初始化数据关系完整性测试器...'));
const tester = new RelationshipIntegrityTester();

tester.runAllTests().catch(error => {
  console.error(chalk.red('关系完整性测试执行过程中发生致命错误:'), error);
  process.exit(1);
});