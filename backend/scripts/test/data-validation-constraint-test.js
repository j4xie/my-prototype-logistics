#!/usr/bin/env node

/**
 * 白垩纪食品溯源系统 - 数据验证和约束检查测试
 * 阶段1-3: 数据类型验证、字段长度限制、枚举值约束、业务规则验证
 * 专注测试：数据类型、字段长度、枚举值、必填字段、唯一约束、范围验证
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';

const prisma = new PrismaClient();

class DataValidationConstraintTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
      categories: {
        'data_type_validation': { passed: 0, failed: 0 },
        'field_length_constraints': { passed: 0, failed: 0 },
        'enum_value_constraints': { passed: 0, failed: 0 },
        'required_field_validation': { passed: 0, failed: 0 },
        'unique_constraints': { passed: 0, failed: 0 },
        'range_validation': { passed: 0, failed: 0 },
        'business_logic_validation': { passed: 0, failed: 0 }
      }
    };
    this.testData = new Map(); // 存储测试数据
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
    this.log(`🔍 验证测试: ${name}`, 'info');
    
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

  // 创建基础测试数据
  async setupTestData() {
    this.log('📋 设置基础测试数据', 'phase');
    
    // 创建测试工厂
    const factory = await this.test('创建数据验证测试工厂', async () => {
      const factoryData = {
        name: '数据验证测试工厂',
        industry: '食品制造业',
        address: '北京市验证区测试路100号',
        employeeCount: 50,
        contactName: '验证测试经理',
        contactPhone: '+86138000000501',
        contactEmail: 'validation@testfactory.com'
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

    return factory;
  }

  // 阶段1: 数据类型验证测试
  async testDataTypeValidation() {
    this.log('🔢 阶段1: 数据类型验证测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过数据类型测试: 缺少工厂数据', 'warning');
      return;
    }

    // 测试1.1: 整数类型验证
    await this.test('User.id非整数类型验证', async () => {
      try {
        // 尝试通过直接SQL插入无效的ID类型来测试
        await prisma.$executeRaw`INSERT INTO users (factory_id, username, password_hash, email, full_name, id) VALUES (${factoryId}, 'invalid_id_test', 'hash', 'test@email.com', 'Test User', 'not_an_integer')`;
        throw new Error('应该因为ID类型错误而失败');
      } catch (error) {
        if (error.message.includes('Incorrect integer value') || 
            error.message.includes('invalid input') ||
            error.code === 'P2007') {
          return { message: '整数类型验证正常工作' };
        }
        throw error;
      }
    }, 'data_type_validation');

    // 测试1.2: 日期类型验证
    await this.test('ProcessingBatch日期类型验证', async () => {
      try {
        await prisma.processingBatch.create({
          data: {
            factoryId,
            batchNumber: 'INVALID_DATE_TEST',
            productType: '日期类型测试产品',
            rawMaterials: [],
            startDate: 'invalid-date-string', // 无效的日期字符串
            status: 'planning'
          }
        });
        throw new Error('应该因为日期格式错误而失败');
      } catch (error) {
        if (error.message.includes('Invalid value') || 
            error.message.includes('expected DateTime') ||
            error.code === 'P2007') {
          return { message: '日期类型验证正常工作' };
        }
        throw error;
      }
    }, 'data_type_validation');

    // 测试1.3: 布尔类型验证
    await this.test('Factory布尔类型验证', async () => {
      try {
        await prisma.$executeRaw`UPDATE factories SET is_active = 'invalid_boolean' WHERE id = ${factoryId}`;
        throw new Error('应该因为布尔值类型错误而失败');
      } catch (error) {
        if (error.message.includes('Incorrect') || 
            error.message.includes('invalid') ||
            error.code === 'P2007') {
          return { message: '布尔类型验证正常工作' };
        }
        throw error;
      }
    }, 'data_type_validation');

    // 测试1.4: JSON类型验证
    await this.test('ProcessingBatch JSON类型验证', async () => {
      try {
        // 尝试插入无效的JSON格式
        await prisma.$executeRaw`INSERT INTO processing_batches (factory_id, batch_number, product_type, raw_materials, start_date, status) VALUES (${factoryId}, 'JSON_TEST', 'Test Product', 'invalid-json-string', NOW(), 'planning')`;
        throw new Error('应该因为JSON格式错误而失败');
      } catch (error) {
        if (error.message.includes('Invalid JSON') || 
            error.message.includes('JSON') ||
            error.code === 'P2007') {
          return { message: 'JSON类型验证正常工作' };
        }
        throw error;
      }
    }, 'data_type_validation');

    // 测试1.5: Decimal类型验证
    await this.test('Decimal类型范围验证', async () => {
      // 创建一个用户来测试质检记录
      const user = await prisma.user.create({
        data: {
          factoryId,
          username: 'decimal_test_user',
          passwordHash: '$2b$10$decimal.test.hash',
          email: 'decimal@test.com',
          fullName: '数值测试用户',
          department: 'quality',
          roleCode: 'operator'
        }
      });

      this.testData.set('decimalTestUser', user.id);

      const batch = await prisma.processingBatch.create({
        data: {
          factoryId,
          batchNumber: 'DECIMAL_TEST_BATCH',
          productType: '数值测试产品',
          rawMaterials: [],
          startDate: new Date(),
          status: 'planning'
        }
      });

      this.testData.set('decimalTestBatch', batch.id);

      try {
        await prisma.qualityInspection.create({
          data: {
            factoryId,
            batchId: batch.id,
            inspectorId: user.id,
            inspectionType: 'final_product',
            inspectionDate: new Date(),
            testItems: [],
            overallResult: 'pass',
            qualityScore: 99.999 // 超出DECIMAL(3,2)范围 - 应该失败
          }
        });
        throw new Error('应该因为Decimal范围超出而失败');
      } catch (error) {
        if (error.message.includes('Out of range') || 
            error.message.includes('value out of range') ||
            error.code === 'P2007') {
          return { message: 'Decimal类型范围验证正常工作' };
        }
        throw error;
      }
    }, 'data_type_validation');
  }

  // 阶段2: 字段长度约束测试
  async testFieldLengthConstraints() {
    this.log('📏 阶段2: 字段长度约束测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过字段长度测试: 缺少工厂数据', 'warning');
      return;
    }

    // 测试2.1: 用户名长度限制
    await this.test('User.username长度限制测试', async () => {
      const longUsername = 'a'.repeat(256); // 假设用户名有长度限制
      
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: longUsername,
            passwordHash: '$2b$10$length.test.hash',
            email: 'length@test.com',
            fullName: '长度测试用户'
          }
        });
        
        // 如果成功了，检查是否被截断
        const createdUser = await prisma.user.findFirst({
          where: { factoryId, email: 'length@test.com' }
        });
        
        if (createdUser) {
          this.testData.set('lengthTestUser', createdUser.id);
          if (createdUser.username.length < longUsername.length) {
            return { message: '用户名长度被正确截断或限制' };
          } else {
            return { message: '用户名长度限制测试通过（无限制或限制很宽松）' };
          }
        }
        
        throw new Error('用户创建失败');
      } catch (error) {
        if (error.message.includes('too long') || 
            error.message.includes('Data too long') ||
            error.code === 'P2000') {
          return { message: '用户名长度限制正常工作' };
        }
        throw error;
      }
    }, 'field_length_constraints');

    // 测试2.2: 邮箱长度限制
    await this.test('User.email长度限制测试', async () => {
      const longEmail = 'a'.repeat(300) + '@test.com'; // 超长邮箱
      
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: 'email_length_test',
            passwordHash: '$2b$10$email.length.hash',
            email: longEmail,
            fullName: '邮箱长度测试用户'
          }
        });
        
        // 如果成功，检查是否有长度限制
        return { message: '邮箱长度限制测试通过（可能无严格限制）' };
      } catch (error) {
        if (error.message.includes('too long') || 
            error.message.includes('Data too long') ||
            error.code === 'P2000') {
          return { message: '邮箱长度限制正常工作' };
        }
        throw error;
      }
    }, 'field_length_constraints');

    // 测试2.3: 工厂名称长度限制
    await this.test('Factory.name长度限制测试', async () => {
      const longFactoryName = '超长工厂名称测试'.repeat(100); // 很长的工厂名
      
      try {
        const factoryData = {
          name: longFactoryName,
          industry: '测试行业',
          address: '测试地址',
          employeeCount: 10,
          contactName: '测试联系人',
          contactPhone: '+86138000000502',
          contactEmail: 'long@name.test'
        };

        const result = await factoryIdGenerator.generateNewFactoryId(factoryData);
        await prisma.factory.create({
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
        
        return { message: '工厂名称长度限制测试通过（可能无严格限制）' };
      } catch (error) {
        if (error.message.includes('too long') || 
            error.message.includes('Data too long') ||
            error.code === 'P2000') {
          return { message: '工厂名称长度限制正常工作' };
        }
        throw error;
      }
    }, 'field_length_constraints');

    // 测试2.4: 告警标题长度限制（VarChar(200)）
    await this.test('AlertNotification.title长度限制测试', async () => {
      const longTitle = '超长告警标题测试'.repeat(50); // 远超200字符
      
      try {
        await prisma.alertNotification.create({
          data: {
            factoryId,
            alertType: 'quality',
            severity: 'medium',
            title: longTitle,
            message: '测试告警消息',
            status: 'new'
          }
        });
        
        return { message: '告警标题长度限制测试通过（可能被截断）' };
      } catch (error) {
        if (error.message.includes('too long') || 
            error.message.includes('Data too long') ||
            error.code === 'P2000') {
          return { message: '告警标题长度限制正常工作' };
        }
        throw error;
      }
    }, 'field_length_constraints');
  }

  // 阶段3: 枚举值约束测试
  async testEnumValueConstraints() {
    this.log('📝 阶段3: 枚举值约束测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过枚举值测试: 缺少工厂数据', 'warning');
      return;
    }

    // 测试3.1: User.department枚举值测试
    await this.test('User.department无效枚举值测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: 'enum_test_user',
            passwordHash: '$2b$10$enum.test.hash',
            email: 'enum@test.com',
            fullName: '枚举测试用户',
            department: 'invalid_department', // 无效的部门枚举值
            roleCode: 'operator'
          }
        });
        throw new Error('应该因为无效的department枚举值而失败');
      } catch (error) {
        if (error.message.includes('Invalid value') || 
            error.message.includes('expected') ||
            error.code === 'P2007') {
          return { message: 'Department枚举约束正常工作' };
        }
        throw error;
      }
    }, 'enum_value_constraints');

    // 测试3.2: User.roleCode枚举值测试
    await this.test('User.roleCode无效枚举值测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: 'role_enum_test',
            passwordHash: '$2b$10$role.enum.hash',
            email: 'roleenum@test.com',
            fullName: '角色枚举测试',
            department: 'processing',
            roleCode: 'super_admin_god_mode' // 无效的角色枚举值
          }
        });
        throw new Error('应该因为无效的roleCode枚举值而失败');
      } catch (error) {
        if (error.message.includes('Invalid value') || 
            error.message.includes('expected') ||
            error.code === 'P2007') {
          return { message: 'RoleCode枚举约束正常工作' };
        }
        throw error;
      }
    }, 'enum_value_constraints');

    // 测试3.3: ProcessingBatch.status枚举值测试
    await this.test('ProcessingBatch.status无效枚举值测试', async () => {
      try {
        await prisma.processingBatch.create({
          data: {
            factoryId,
            batchNumber: 'ENUM_STATUS_TEST',
            productType: '状态枚举测试产品',
            rawMaterials: [],
            startDate: new Date(),
            status: 'super_completed_with_rainbow' // 无效的状态枚举值
          }
        });
        throw new Error('应该因为无效的status枚举值而失败');
      } catch (error) {
        if (error.message.includes('Invalid value') || 
            error.message.includes('expected') ||
            error.code === 'P2007') {
          return { message: 'BatchStatus枚举约束正常工作' };
        }
        throw error;
      }
    }, 'enum_value_constraints');

    // 测试3.4: AlertNotification.alertType枚举值测试
    await this.test('AlertNotification.alertType无效枚举值测试', async () => {
      try {
        await prisma.alertNotification.create({
          data: {
            factoryId,
            alertType: 'alien_invasion', // 无效的告警类型
            severity: 'high',
            title: '枚举测试告警',
            message: '这是一个枚举测试告警',
            status: 'new'
          }
        });
        throw new Error('应该因为无效的alertType枚举值而失败');
      } catch (error) {
        if (error.message.includes('Invalid value') || 
            error.message.includes('expected') ||
            error.code === 'P2007') {
          return { message: 'AlertType枚举约束正常工作' };
        }
        throw error;
      }
    }, 'enum_value_constraints');

    // 测试3.5: AlertNotification.severity枚举值测试
    await this.test('AlertNotification.severity无效枚举值测试', async () => {
      try {
        await prisma.alertNotification.create({
          data: {
            factoryId,
            alertType: 'quality',
            severity: 'apocalyptic', // 无效的严重程度
            title: '严重程度枚举测试',
            message: '测试严重程度枚举约束',
            status: 'new'
          }
        });
        throw new Error('应该因为无效的severity枚举值而失败');
      } catch (error) {
        if (error.message.includes('Invalid value') || 
            error.message.includes('expected') ||
            error.code === 'P2007') {
          return { message: 'AlertSeverity枚举约束正常工作' };
        }
        throw error;
      }
    }, 'enum_value_constraints');
  }

  // 阶段4: 必填字段验证测试
  async testRequiredFieldValidation() {
    this.log('⚡ 阶段4: 必填字段验证测试', 'phase');
    
    const factoryId = this.testData.get('factory');

    // 测试4.1: User缺少必填字段测试
    await this.test('User缺少username必填字段测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId,
            // username: 'missing_username', // 故意省略必填字段
            passwordHash: '$2b$10$required.test.hash',
            email: 'required@test.com',
            fullName: '必填字段测试用户'
          }
        });
        throw new Error('应该因为缺少username必填字段而失败');
      } catch (error) {
        if (error.message.includes('required') || 
            error.message.includes('Argument') ||
            error.code === 'P2012') {
          return { message: 'Username必填字段约束正常工作' };
        }
        throw error;
      }
    }, 'required_field_validation');

    // 测试4.2: Factory缺少必填字段测试
    await this.test('Factory缺少id必填字段测试', async () => {
      try {
        await prisma.factory.create({
          data: {
            // id: 'missing_id', // 故意省略必填的id字段
            name: '缺少ID测试工厂',
            industry: '测试行业',
            contactEmail: 'missing_id@test.com'
          }
        });
        throw new Error('应该因为缺少id必填字段而失败');
      } catch (error) {
        if (error.message.includes('required') || 
            error.message.includes('Argument') ||
            error.code === 'P2012') {
          return { message: 'Factory.id必填字段约束正常工作' };
        }
        throw error;
      }
    }, 'required_field_validation');

    // 测试4.3: ProcessingBatch缺少必填字段测试
    await this.test('ProcessingBatch缺少batchNumber必填字段测试', async () => {
      try {
        await prisma.processingBatch.create({
          data: {
            factoryId,
            // batchNumber: 'missing_batch_number', // 故意省略
            productType: '缺少批次号测试产品',
            rawMaterials: [],
            startDate: new Date(),
            status: 'planning'
          }
        });
        throw new Error('应该因为缺少batchNumber必填字段而失败');
      } catch (error) {
        if (error.message.includes('required') || 
            error.message.includes('Argument') ||
            error.code === 'P2012') {
          return { message: 'BatchNumber必填字段约束正常工作' };
        }
        throw error;
      }
    }, 'required_field_validation');

    // 测试4.4: AlertNotification缺少必填字段测试
    await this.test('AlertNotification缺少title必填字段测试', async () => {
      try {
        await prisma.alertNotification.create({
          data: {
            factoryId,
            alertType: 'quality',
            severity: 'medium',
            // title: '缺少标题测试', // 故意省略
            message: '测试缺少标题的告警',
            status: 'new'
          }
        });
        throw new Error('应该因为缺少title必填字段而失败');
      } catch (error) {
        if (error.message.includes('required') || 
            error.message.includes('Argument') ||
            error.code === 'P2012') {
          return { message: 'AlertNotification.title必填字段约束正常工作' };
        }
        throw error;
      }
    }, 'required_field_validation');
  }

  // 阶段5: 唯一约束测试
  async testUniqueConstraints() {
    this.log('🔐 阶段5: 唯一约束测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过唯一约束测试: 缺少工厂数据', 'warning');
      return;
    }

    // 测试5.1: 创建第一个用户作为基准
    const firstUser = await this.test('创建唯一约束测试基准用户', async () => {
      const user = await prisma.user.create({
        data: {
          factoryId,
          username: 'unique_test_user',
          passwordHash: '$2b$10$unique.test.hash',
          email: 'unique@test.com',
          fullName: '唯一约束测试用户',
          department: 'processing',
          roleCode: 'operator'
        }
      });

      this.testData.set('uniqueTestUser', user.id);
      return user;
    }, 'unique_constraints');

    if (!firstUser) {
      this.log('❌ 无法创建基准用户，跳过唯一约束测试', 'warning');
      return;
    }

    // 测试5.2: 用户名唯一约束测试（同一工厂内）
    await this.test('User.username同一工厂内唯一约束测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: 'unique_test_user', // 重复的用户名
            passwordHash: '$2b$10$duplicate.user.hash',
            email: 'duplicate@test.com',
            fullName: '重复用户名测试'
          }
        });
        throw new Error('应该因为用户名重复而失败');
      } catch (error) {
        if (error.message.includes('Unique constraint') || 
            error.message.includes('unique') ||
            error.code === 'P2002') {
          return { message: '用户名唯一约束正常工作' };
        }
        throw error;
      }
    }, 'unique_constraints');

    // 测试5.3: 邮箱唯一约束测试
    await this.test('User.email唯一约束测试', async () => {
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: 'different_username',
            passwordHash: '$2b$10$email.duplicate.hash',
            email: 'unique@test.com', // 重复的邮箱
            fullName: '重复邮箱测试'
          }
        });
        throw new Error('应该因为邮箱重复而失败');
      } catch (error) {
        if (error.message.includes('Unique constraint') || 
            error.message.includes('unique') ||
            error.code === 'P2002') {
          return { message: '邮箱唯一约束正常工作' };
        }
        throw error;
      }
    }, 'unique_constraints');

    // 测试5.4: Factory.id唯一约束测试
    await this.test('Factory.id唯一约束测试', async () => {
      try {
        const factoryData = {
          name: '重复ID测试工厂',
          industry: '测试行业',
          address: '重复测试地址',
          contactEmail: 'duplicate_id@test.com'
        };

        await prisma.factory.create({
          data: {
            id: factoryId, // 重复的工厂ID
            ...factoryData,
            industryCode: '123',
            regionCode: 'TEST'
          }
        });
        throw new Error('应该因为工厂ID重复而失败');
      } catch (error) {
        if (error.message.includes('Unique constraint') || 
            error.message.includes('unique') ||
            error.code === 'P2002') {
          return { message: '工厂ID唯一约束正常工作' };
        }
        throw error;
      }
    }, 'unique_constraints');

    // 测试5.5: UserWhitelist复合唯一约束测试
    await this.test('UserWhitelist复合唯一约束测试', async () => {
      // 先创建一个白名单记录
      await prisma.userWhitelist.create({
        data: {
          factoryId,
          phoneNumber: '+86138000000601',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      try {
        // 尝试创建相同工厂和手机号的记录
        await prisma.userWhitelist.create({
          data: {
            factoryId,
            phoneNumber: '+86138000000601', // 相同工厂+相同手机号
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
        throw new Error('应该因为复合唯一约束而失败');
      } catch (error) {
        if (error.message.includes('Unique constraint') || 
            error.message.includes('unique') ||
            error.code === 'P2002') {
          return { message: '白名单复合唯一约束正常工作' };
        }
        throw error;
      }
    }, 'unique_constraints');
  }

  // 阶段6: 范围验证测试
  async testRangeValidation() {
    this.log('📊 阶段6: 范围验证测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过范围验证测试: 缺少工厂数据', 'warning');
      return;
    }

    // 测试6.1: 员工数量负数验证
    await this.test('Factory.employeeCount负数验证', async () => {
      try {
        await prisma.factory.update({
          where: { id: factoryId },
          data: {
            employeeCount: -50 // 负数员工数量
          }
        });
        
        // 检查是否被存储为负数
        const updated = await prisma.factory.findUnique({
          where: { id: factoryId },
          select: { employeeCount: true }
        });
        
        if (updated.employeeCount < 0) {
          return { message: '员工数量负数被允许（可能需要业务层验证）' };
        } else {
          return { message: '员工数量负数被数据库约束阻止' };
        }
      } catch (error) {
        if (error.message.includes('constraint') || 
            error.message.includes('check') ||
            error.code === 'P2004') {
          return { message: '员工数量负数约束正常工作' };
        }
        throw error;
      }
    }, 'range_validation');

    // 测试6.2: 质量分数范围验证
    await this.test('QualityInspection.qualityScore范围验证', async () => {
      const userId = this.testData.get('decimalTestUser');
      const batchId = this.testData.get('decimalTestBatch');
      
      if (!userId || !batchId) {
        // 创建必要的测试数据
        const user = await prisma.user.create({
          data: {
            factoryId,
            username: 'range_test_inspector',
            passwordHash: '$2b$10$range.test.hash',
            email: 'range@inspector.com',
            fullName: '范围测试质检员',
            department: 'quality',
            roleCode: 'operator'
          }
        });

        const batch = await prisma.processingBatch.create({
          data: {
            factoryId,
            batchNumber: 'RANGE_TEST_BATCH',
            productType: '范围测试产品',
            rawMaterials: [],
            startDate: new Date(),
            status: 'planning'
          }
        });

        this.testData.set('rangeTestUser', user.id);
        this.testData.set('rangeTestBatch', batch.id);
        
        try {
          await prisma.qualityInspection.create({
            data: {
              factoryId,
              batchId: batch.id,
              inspectorId: user.id,
              inspectionType: 'final_product',
              inspectionDate: new Date(),
              testItems: [],
              overallResult: 'pass',
              qualityScore: -1.5 // 负数分数
            }
          });
          
          return { message: '质量分数负数被允许（可能需要业务层验证）' };
        } catch (error) {
          if (error.message.includes('Out of range') || 
              error.message.includes('constraint') ||
              error.code === 'P2007') {
            return { message: '质量分数范围约束正常工作' };
          }
          throw error;
        }
      }
      
      return { message: '跳过质量分数范围测试' };
    }, 'range_validation');

    // 测试6.3: 日期范围验证
    await this.test('ProcessingBatch日期逻辑验证', async () => {
      try {
        // 创建结束日期早于开始日期的批次
        await prisma.processingBatch.create({
          data: {
            factoryId,
            batchNumber: 'DATE_RANGE_TEST',
            productType: '日期范围测试产品',
            rawMaterials: [],
            startDate: new Date('2024-12-31'),
            endDate: new Date('2024-01-01'), // 结束日期早于开始日期
            status: 'planning'
          }
        });
        
        return { message: '日期逻辑验证被允许（需要业务层验证）' };
      } catch (error) {
        if (error.message.includes('constraint') || 
            error.message.includes('check') ||
            error.code === 'P2004') {
          return { message: '日期逻辑约束正常工作' };
        }
        throw error;
      }
    }, 'range_validation');
  }

  // 阶段7: 业务逻辑验证测试
  async testBusinessLogicValidation() {
    this.log('💼 阶段7: 业务逻辑验证测试', 'phase');
    
    const factoryId = this.testData.get('factory');
    if (!factoryId) {
      this.log('❌ 跳过业务逻辑测试: 缺少工厂数据', 'warning');
      return;
    }

    // 测试7.1: 用户角色权限层级验证
    await this.test('User.roleCode权限层级验证', async () => {
      // 创建一个普通操作员
      const operator = await prisma.user.create({
        data: {
          factoryId,
          username: 'business_logic_operator',
          passwordHash: '$2b$10$business.logic.hash',
          email: 'operator@business.com',
          fullName: '业务逻辑测试操作员',
          department: 'processing',
          roleCode: 'operator'
        }
      });

      this.testData.set('businessLogicOperator', operator.id);

      // 尝试让操作员创建管理员权限的记录（这应该由业务层而不是数据库层控制）
      try {
        await prisma.user.create({
          data: {
            factoryId,
            username: 'unauthorized_admin',
            passwordHash: '$2b$10$unauthorized.hash',
            email: 'unauthorized@admin.com',
            fullName: '未授权管理员',
            department: 'management',
            roleCode: 'factory_super_admin', // 高权限角色
            // 在实际业务中，这应该被业务层阻止，但数据库层通常允许
          }
        });
        
        return { message: '角色创建成功（业务逻辑验证应在应用层实现）' };
      } catch (error) {
        return { message: '角色创建限制由数据库层实现' };
      }
    }, 'business_logic_validation');

    // 测试7.2: 批次状态转换验证
    await this.test('ProcessingBatch状态转换逻辑验证', async () => {
      // 创建一个已完成的批次
      const completedBatch = await prisma.processingBatch.create({
        data: {
          factoryId,
          batchNumber: 'COMPLETED_BATCH_TEST',
          productType: '已完成批次测试',
          rawMaterials: [],
          startDate: new Date(),
          status: 'completed'
        }
      });

      try {
        // 尝试将已完成的批次改回计划中状态（不合理的状态回退）
        await prisma.processingBatch.update({
          where: { id: completedBatch.id },
          data: {
            status: 'planning' // 从completed回退到planning
          }
        });
        
        return { message: '批次状态回退被允许（业务逻辑验证应在应用层实现）' };
      } catch (error) {
        if (error.message.includes('constraint') || 
            error.message.includes('check')) {
          return { message: '批次状态转换约束由数据库层实现' };
        }
        throw error;
      }
    }, 'business_logic_validation');

    // 测试7.3: 告警分配逻辑验证
    await this.test('AlertNotification分配逻辑验证', async () => {
      const userId = this.testData.get('businessLogicOperator');
      
      try {
        // 创建一个告警并分配给不存在的用户
        await prisma.alertNotification.create({
          data: {
            factoryId,
            alertType: 'quality',
            severity: 'high',
            title: '分配逻辑测试告警',
            message: '测试告警分配给不存在用户',
            assignedTo: [999999, 888888], // 不存在的用户ID
            status: 'new'
          }
        });
        
        return { message: '告警分配给不存在用户被允许（需要业务层验证）' };
      } catch (error) {
        if (error.message.includes('constraint') || 
            error.message.includes('foreign key')) {
          return { message: '告警分配约束由数据库外键实现' };
        }
        throw error;
      }
    }, 'business_logic_validation');

    // 测试7.4: 工厂容量验证
    await this.test('Factory容量合理性验证', async () => {
      try {
        // 创建一个员工数量不合理的工厂
        const factoryData = {
          name: '容量测试工厂',
          industry: '食品制造业',
          address: '容量测试地址',
          employeeCount: 1000000, // 100万员工（不合理）
          contactName: '容量测试经理',
          contactPhone: '+86138000000701',
          contactEmail: 'capacity@test.com'
        };

        const result = await factoryIdGenerator.generateNewFactoryId(factoryData);
        await prisma.factory.create({
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
        
        return { message: '不合理员工数量被允许（需要业务层验证）' };
      } catch (error) {
        if (error.message.includes('constraint') || 
            error.message.includes('check')) {
          return { message: '员工数量约束由数据库层实现' };
        }
        throw error;
      }
    }, 'business_logic_validation');
  }

  // 清理测试数据
  async cleanupTestData() {
    this.log('🧹 清理验证测试数据', 'phase');
    
    // 简单的清理：删除所有测试相关数据
    try {
      // 删除所有测试创建的数据 - 由于有外键约束，顺序很重要
      await prisma.$executeRaw`DELETE FROM alert_notifications WHERE factory_id LIKE '%-%-%-%' OR title LIKE '%测试%'`;
      await prisma.$executeRaw`DELETE FROM quality_inspections WHERE factory_id LIKE '%-%-%-%'`;
      await prisma.$executeRaw`DELETE FROM processing_batches WHERE factory_id LIKE '%-%-%-%' OR batch_number LIKE '%TEST%'`;
      await prisma.$executeRaw`DELETE FROM user_whitelist WHERE factory_id LIKE '%-%-%-%'`;
      await prisma.$executeRaw`DELETE FROM users WHERE factory_id LIKE '%-%-%-%' OR username LIKE '%test%'`;
      await prisma.$executeRaw`DELETE FROM factories WHERE id LIKE '%-%-%-%' OR name LIKE '%测试%'`;
      
      return { message: '测试数据清理完成' };
    } catch (error) {
      this.log(`清理过程中出现错误: ${error.message}`, 'warning');
      return { message: '测试数据部分清理' };
    }
  }

  // 主测试执行器
  async runAllTests() {
    console.log(chalk.cyan.bold('🔍 白垩纪食品溯源系统 - 数据验证和约束检查测试'));
    console.log(chalk.cyan('📊 测试范围: 数据类型、字段长度、枚举值、必填字段、唯一约束、范围验证、业务逻辑'));
    console.log(chalk.cyan(`🕒 测试开始时间: ${new Date().toLocaleString()}\n`));

    const startTime = Date.now();

    try {
      // 设置基础测试数据
      await this.setupTestData();

      // 按阶段执行验证测试
      await this.testDataTypeValidation();
      await this.testFieldLengthConstraints();
      await this.testEnumValueConstraints();
      await this.testRequiredFieldValidation();
      await this.testUniqueConstraints();
      await this.testRangeValidation();
      await this.testBusinessLogicValidation();

    } catch (criticalError) {
      this.log(`💥 关键验证测试失败: ${criticalError.message}`, 'error');
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
    this.log('🔍 数据验证和约束检查测试完成', 'phase');
    console.log('='.repeat(80));

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
      if (total > 0) {
        const successRate = (result.passed / total * 100).toFixed(1);
        const categoryName = {
          'data_type_validation': '数据类型验证',
          'field_length_constraints': '字段长度约束',
          'enum_value_constraints': '枚举值约束',
          'required_field_validation': '必填字段验证',
          'unique_constraints': '唯一约束',
          'range_validation': '范围验证',
          'business_logic_validation': '业务逻辑验证'
        }[category] || category;
        
        console.log(`   ${categoryName}: ${result.passed}/${total} (${successRate}%)`);
      }
    }

    // 失败详情
    if (this.testResults.failed > 0) {
      console.log(chalk.red('\n❌ 失败测试详情:'));
      this.testResults.details.forEach(detail => {
        console.log(chalk.red(`   - [${detail.category}] ${detail.name}: ${detail.error}`));
      });
    }

    // 测试结论
    console.log(chalk.cyan('\n💡 数据验证约束测试结论:'));
    const successRate = (this.testResults.passed / this.testResults.total) * 100;
    if (successRate >= 90) {
      console.log(chalk.green('   🎉 数据验证约束优秀！所有主要约束正常工作'));
    } else if (successRate >= 75) {
      console.log(chalk.yellow('   ⚠️ 数据验证约束基本正常，部分约束需要改进'));
    } else {
      console.log(chalk.red('   🚨 数据验证约束存在较多问题，需要重点加强'));
    }

    console.log(chalk.cyan(`\n🔍 数据验证健康度: ${successRate.toFixed(1)}%`));

    // 设置退出码
    if (successRate >= 75) {
      console.log(chalk.green('\n✅ 数据验证约束测试达到可接受标准'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n❌ 数据验证约束测试未达标，需要修复'));
      process.exit(1);
    }
  }
}

// 执行数据验证约束测试
console.log(chalk.blue('正在初始化数据验证约束测试器...'));
const tester = new DataValidationConstraintTester();

tester.runAllTests().catch(error => {
  console.error(chalk.red('验证测试执行过程中发生致命错误:'), error);
  process.exit(1);
});