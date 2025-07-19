#!/usr/bin/env node

/**
 * 测试JWT令牌生成脚本
 */

import { PrismaClient } from '@prisma/client';
import { generateAuthTokens } from './src/utils/jwt.js';

const prisma = new PrismaClient();

async function testJWTGeneration() {
  try {
    console.log('🔐 测试JWT令牌生成...');
    
    // 1. 获取测试用户
    console.log('1. 获取测试用户...');
    const user = await prisma.user.findFirst({
      where: {
        factoryId: 'TEST_2024_001',
        username: 'factory_admin',
      },
      include: {
        factory: true,
      },
    });
    
    if (!user) {
      throw new Error('测试用户不存在');
    }
    
    console.log('✅ 用户信息:', {
      id: user.id,
      username: user.username,
      factoryId: user.factoryId,
      roleCode: user.roleCode,
      permissions: user.permissions
    });
    
    // 2. 生成JWT令牌
    console.log('\\n2. 生成JWT令牌...');
    const tokens = await generateAuthTokens(user);
    
    console.log('✅ 令牌生成成功:');
    console.log('Token length:', tokens.token.length);
    console.log('RefreshToken length:', tokens.refreshToken.length);
    
    // 3. 检查Session记录
    console.log('\\n3. 检查Session记录...');
    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        factoryId: user.factoryId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });
    
    console.log('✅ Session记录:', sessions.length > 0 ? '已创建' : '未创建');
    if (sessions.length > 0) {
      console.log('Session ID:', sessions[0].id);
      console.log('Is Revoked:', sessions[0].isRevoked);
      console.log('Expires At:', sessions[0].expiresAt);
    }
    
    console.log('\\n🎉 JWT测试通过!');
    
  } catch (error) {
    console.error('❌ JWT测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testJWTGeneration().catch(console.error);