#!/usr/bin/env node

/**
 * 测试数据库连接脚本
 */

import { PrismaClient } from '@prisma/client';
import { verifyPassword } from './src/utils/password.js';

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  try {
    console.log('🔍 测试数据库连接...');
    
    // 1. 测试基础连接
    console.log('1. 测试基础连接...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ 数据库连接成功:', result);
    
    // 2. 测试工厂查询
    console.log('\\n2. 测试工厂查询...');
    const factory = await prisma.factory.findFirst({
      where: {
        id: 'TEST_2024_001',
        isActive: true,
      },
    });
    console.log('✅ 工厂查询成功:', factory ? factory.name : '未找到');
    
    // 3. 测试用户查询
    console.log('\\n3. 测试用户查询...');
    const user = await prisma.user.findFirst({
      where: {
        factoryId: 'TEST_2024_001',
        username: 'factory_admin',
      },
      include: {
        factory: true,
      },
    });
    console.log('✅ 用户查询成功:', user ? user.username : '未找到');
    
    // 4. 测试密码验证
    if (user) {
      console.log('\\n4. 测试密码验证...');
      const isPasswordValid = await verifyPassword('SuperAdmin@123', user.passwordHash);
      console.log('✅ 密码验证结果:', isPasswordValid ? '正确' : '错误');
    }
    
    console.log('\\n🎉 所有测试通过!');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testDatabaseConnection().catch(console.error);