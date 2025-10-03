#!/usr/bin/env node

/**
 * 创建真实测试工厂数据脚本
 * 使用工厂ID生成系统创建标准的测试工厂
 */

import { PrismaClient } from '@prisma/client';
import { factoryIdGenerator } from '../src/utils/factory-id-generator.js';
import chalk from 'chalk';

const prisma = new PrismaClient();

class TestFactoryCreator {
  constructor() {
    this.testFactories = [
      {
        name: '海牛测试食品加工厂',
        industry: '食品制造业',
        address: '北京市海淀区中关村测试园区88号',
        contactPhone: '+86138000000001',
        contactEmail: 'test@heiniu-food.com',
        description: '专门用于系统测试的食品加工厂'
      },
      {
        name: '上海智能食品科技有限公司',
        industry: '食品技术服务',
        address: '上海市浦东新区张江高科技园区测试路123号',
        contactPhone: '+86138000000002', 
        contactEmail: 'tech@sh-food-tech.com',
        description: '食品技术研发测试工厂'
      },
      {
        name: '广州绿色农产品加工厂',
        industry: '农副食品加工业',
        address: '广州市番禺区测试工业园A区5号',
        contactPhone: '+86138000000003',
        contactEmail: 'green@gz-agriculture.com',
        description: '绿色农产品加工测试基地'
      }
    ];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const colors = {
      success: chalk.green,
      error: chalk.red,
      info: chalk.blue,
      warning: chalk.yellow
    };
    console.log(colors[type](`[${timestamp}] ${message}`));
  }

  async createTestFactory(factoryData) {
    try {
      // 1. 使用工厂ID生成系统生成ID
      this.log(`正在为 "${factoryData.name}" 生成工厂ID...`, 'info');
      const generationResult = await factoryIdGenerator.generateNewFactoryId(factoryData);
      
      this.log(`生成的工厂ID: ${generationResult.factoryId}`, 'info');
      this.log(`行业代码: ${generationResult.industryCode} (${generationResult.industryName})`, 'info');
      this.log(`地区代码: ${generationResult.regionCode} (${generationResult.regionName})`, 'info');
      this.log(`置信度: ${(generationResult.confidence.overall * 100).toFixed(1)}%`, 'info');

      // 2. 检查工厂是否已存在
      const existingFactory = await prisma.factory.findUnique({
        where: { id: generationResult.factoryId }
      });

      if (existingFactory) {
        this.log(`工厂 ${generationResult.factoryId} 已存在，跳过创建`, 'warning');
        return existingFactory;
      }

      // 3. 创建工厂记录
      const factory = await prisma.factory.create({
        data: {
          id: generationResult.factoryId,
          name: factoryData.name,
          industry: factoryData.industry,
          address: factoryData.address,
          contactPhone: factoryData.contactPhone,
          contactEmail: factoryData.contactEmail,
          isActive: true,
          // 智能推断的字段
          industryCode: generationResult.industryCode,
          regionCode: generationResult.regionCode,
          factoryYear: generationResult.factoryYear,
          sequenceNumber: generationResult.sequenceNumber,
          confidence: generationResult.confidence.overall,
          manuallyVerified: !generationResult.needsConfirmation,
          inferenceData: generationResult.reasoning
        }
      });

      this.log(`✅ 成功创建测试工厂: ${factory.id}`, 'success');
      return factory;

    } catch (error) {
      this.log(`❌ 创建工厂失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async createTestUser(factory, userData) {
    try {
      // 检查用户是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { 
          factoryId_username: {
            factoryId: factory.id,
            username: userData.username
          }
        }
      });

      if (existingUser) {
        this.log(`用户 ${userData.username} 在工厂 ${factory.id} 中已存在`, 'warning');
        return existingUser;
      }

      // 创建测试用户
      const user = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          fullName: userData.fullName,
          roleCode: userData.roleCode,
          department: userData.department,
          isActive: true
        }
      });

      this.log(`✅ 成功创建测试用户: ${user.username} (${user.fullName})`, 'success');
      return user;

    } catch (error) {
      this.log(`❌ 创建用户失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async createCompleteTestEnvironment() {
    console.log(chalk.cyan.bold('🏭 开始创建测试工厂环境'));
    console.log(chalk.cyan(`📅 创建时间: ${new Date().toLocaleString()}\n`));

    const createdFactories = [];
    const createdUsers = [];

    try {
      // 1. 创建测试工厂
      for (const factoryData of this.testFactories) {
        const factory = await this.createTestFactory(factoryData);
        createdFactories.push(factory);

        // 2. 为每个工厂创建测试用户
        const testUsers = [
          {
            username: 'test_admin',
            email: `admin@${factory.id.toLowerCase().replace(/-/g, '')}.test.com`,
            passwordHash: '$2b$10$example.hash.for.testing.purposes.only',
            fullName: '测试管理员',
            roleCode: 'factory_super_admin',
            department: 'management'
          },
          {
            username: 'test_operator', 
            email: `operator@${factory.id.toLowerCase().replace(/-/g, '')}.test.com`,
            passwordHash: '$2b$10$example.hash.for.testing.purposes.only',
            fullName: '测试操作员',
            roleCode: 'operator',
            department: 'processing'
          }
        ];

        for (const userData of testUsers) {
          try {
            const user = await this.createTestUser(factory, userData);
            createdUsers.push(user);
          } catch (error) {
            this.log(`跳过用户创建: ${error.message}`, 'warning');
          }
        }
      }

      // 3. 生成测试摘要
      console.log('\n' + '='.repeat(60));
      this.log('📊 测试环境创建完成', 'success');
      console.log('='.repeat(60));

      console.log(chalk.cyan('\n🏭 创建的测试工厂:'));
      createdFactories.forEach(factory => {
        console.log(`   ✅ ${factory.id} - ${factory.name}`);
        console.log(`      📍 ${factory.address}`);
        console.log(`      🏷️ ${factory.industryCode} (${factory.industry})`);
        console.log(`      📊 置信度: ${(factory.confidence * 100).toFixed(1)}%`);
        console.log('');
      });

      console.log(chalk.cyan('👥 创建的测试用户:'));
      createdUsers.forEach(user => {
        console.log(`   ✅ ${user.username} (${user.fullName}) - 工厂: ${user.factoryId}`);
      });

      console.log(chalk.cyan('\n📋 测试使用说明:'));
      console.log('   1. 测试时可以使用任意一个工厂ID进行API调用');
      console.log('   2. 平台管理员会自动分配第一个可用的工厂ID');
      console.log('   3. 所有测试数据都标记为 isActive: true');
      console.log('   4. 可以安全地重复运行此脚本，已存在的数据会被跳过');

      return {
        factories: createdFactories,
        users: createdUsers,
        summary: {
          totalFactories: createdFactories.length,
          totalUsers: createdUsers.length,
          mainTestFactoryId: createdFactories[0]?.id
        }
      };

    } catch (error) {
      this.log(`💥 创建测试环境失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateTestEnvironment() {
    this.log('🔍 验证测试环境...', 'info');
    
    try {
      // 验证工厂ID生成系统
      const testGeneration = await factoryIdGenerator.generateNewFactoryId({
        name: '验证测试工厂',
        industry: '测试行业',
        address: '北京市测试区'
      });
      
      this.log(`✅ 工厂ID生成系统正常: ${testGeneration.factoryId}`, 'success');
      
      // 验证数据库连接
      const factoryCount = await prisma.factory.count({ where: { isActive: true } });
      const userCount = await prisma.user.count({ where: { isActive: true } });
      
      this.log(`✅ 数据库连接正常: ${factoryCount} 个工厂, ${userCount} 个用户`, 'success');
      
      return true;
    } catch (error) {
      this.log(`❌ 测试环境验证失败: ${error.message}`, 'error');
      return false;
    }
  }
}

// 执行测试工厂创建
async function main() {
  const creator = new TestFactoryCreator();
  
  try {
    // 1. 验证环境
    const isValid = await creator.validateTestEnvironment();
    if (!isValid) {
      process.exit(1);
    }
    
    // 2. 创建测试环境
    const result = await creator.createCompleteTestEnvironment();
    
    // 3. 输出结果供其他脚本使用
    console.log('\n' + '='.repeat(60));
    console.log(chalk.green('🎉 测试环境创建成功！'));
    console.log(chalk.yellow(`主测试工厂ID: ${result.summary.mainTestFactoryId}`));
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red('💥 创建过程中发生错误:'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TestFactoryCreator };