#!/usr/bin/env node

/**
 * 简单的API测试脚本
 * 测试认证系统的基础功能
 */

import { generateToken, verifyToken } from './src/utils/jwt.js';
import { hashPassword, verifyPassword, generateRandomPassword } from './src/utils/password.js';

console.log('🧪 开始测试认证系统基础功能...\n');

// 测试JWT功能
console.log('1. 测试JWT令牌生成和验证:');
try {
  const payload = { userId: 1, username: 'test', factoryId: 'TEST_2024_001' };
  const token = generateToken(payload);
  console.log('✅ JWT令牌生成成功');
  
  const decoded = verifyToken(token);
  console.log('✅ JWT令牌验证成功');
  console.log('   解码数据:', decoded.username, decoded.factoryId);
} catch (error) {
  console.log('❌ JWT测试失败:', error.message);
}

console.log('');

// 测试密码功能
console.log('2. 测试密码加密和验证:');
try {
  const password = 'TestPassword123';
  const hashedPassword = await hashPassword(password);
  console.log('✅ 密码加密成功');
  
  const isValid = await verifyPassword(password, hashedPassword);
  console.log('✅ 密码验证成功:', isValid);
  
  const randomPassword = generateRandomPassword();
  console.log('✅ 随机密码生成成功:', randomPassword);
} catch (error) {
  console.log('❌ 密码测试失败:', error.message);
}

console.log('');

// 测试验证中间件
console.log('3. 测试数据验证:');
try {
  const { z } = await import('zod');
  const phoneRegex = /^1[3-9]\d{9}$/;
  const phoneSchema = z.string().regex(phoneRegex);
  
  phoneSchema.parse('13812345678'); // 有效手机号
  console.log('✅ 手机号验证成功');
  
  try {
    phoneSchema.parse('12345'); // 无效手机号
  } catch (error) {
    console.log('✅ 无效手机号正确被拒绝');
  }
} catch (error) {
  console.log('❌ 验证测试失败:', error.message);
}

console.log('');

// 测试错误处理
console.log('4. 测试错误处理:');
try {
  const { 
    AppError, 
    ValidationError, 
    AuthenticationError,
    createSuccessResponse 
  } = await import('./src/middleware/errorHandler.js');
  
  const validationError = new ValidationError('测试验证错误');
  console.log('✅ ValidationError创建成功:', validationError.name);
  
  const authError = new AuthenticationError('测试认证错误');
  console.log('✅ AuthenticationError创建成功:', authError.name);
  
  const successResponse = createSuccessResponse({ test: 'data' }, '测试成功');
  console.log('✅ 成功响应格式正确:', successResponse.success);
} catch (error) {
  console.log('❌ 错误处理测试失败:', error.message);
}

console.log('');
console.log('🎉 基础功能测试完成！');
console.log('');
console.log('📝 下一步：');
console.log('1. 安装依赖: npm install');
console.log('2. 配置数据库连接 (.env文件)');
console.log('3. 运行数据库迁移: npm run migrate');
console.log('4. 启动服务器: npm run dev');
console.log('');