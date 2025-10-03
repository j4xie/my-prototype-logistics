#!/usr/bin/env node

/**
 * 平台管理员初始化脚本
 * 创建第一个平台管理员账户
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient();

async function initPlatformAdmin() {
  try {
    console.log('🚀 初始化平台管理员账户...\n');

    // 检查是否已存在平台管理员
    const existingAdmin = await prisma.platformAdmin.findFirst();
    
    if (existingAdmin) {
      console.log('⚠️  平台管理员已存在:');
      console.log(`   用户名: ${existingAdmin.username}`);
      console.log(`   邮箱: ${existingAdmin.email}`);
      console.log(`   创建时间: ${existingAdmin.createdAt}`);
      console.log('');
      
      const confirm = process.argv.includes('--force');
      if (!confirm) {
        console.log('如需重新创建，请使用 --force 参数');
        return;
      }
      
      console.log('🗑️  删除现有平台管理员...');
      await prisma.platformAdmin.deleteMany({});
    }

    // 创建新的平台管理员
    const adminData = {
      username: process.env.PLATFORM_ADMIN_USERNAME || 'platform_admin',
      email: process.env.PLATFORM_ADMIN_EMAIL || 'admin@heiniu.com',
      fullName: process.env.PLATFORM_ADMIN_NAME || '平台管理员',
      password: process.env.PLATFORM_ADMIN_PASSWORD || 'Admin@123456'
    };

    // 加密密码
    const passwordHash = await hashPassword(adminData.password);

    // 创建平台管理员
    const admin = await prisma.platformAdmin.create({
      data: {
        username: adminData.username,
        passwordHash,
        email: adminData.email,
        fullName: adminData.fullName,
      },
    });

    console.log('✅ 平台管理员创建成功!');
    console.log('');
    console.log('📋 管理员信息:');
    console.log(`   用户名: ${admin.username}`);
    console.log(`   邮箱: ${admin.email}`);
    console.log(`   姓名: ${admin.fullName}`);
    console.log(`   密码: ${adminData.password}`);
    console.log('');
    console.log('🔐 登录地址: POST /api/auth/platform-login');
    console.log('');
    console.log('⚠️  请尽快登录系统并修改默认密码!');

  } catch (error) {
    console.error('❌ 创建平台管理员失败:', error.message);
    
    if (error.code === 'P2002') {
      console.error('   原因: 用户名或邮箱已存在');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行初始化
initPlatformAdmin().catch(console.error);