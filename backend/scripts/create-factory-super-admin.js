#!/usr/bin/env node

/**
 * 创建工厂超级管理员账号脚本
 * 为指定工厂创建工厂超级管理员
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createFactorySuperAdmin() {
  console.log('🔄 开始创建工厂超级管理员账号...\n');

  try {
    // 1. 检查或创建测试工厂
    let factory = await prisma.factory.findUnique({
      where: { id: 'TEST_2024_001' }
    });

    if (!factory) {
      console.log('📦 创建测试工厂...');
      factory = await prisma.factory.create({
        data: {
          id: 'TEST_2024_001',
          name: '海牛测试工厂',
          industry: '食品制造业',
          address: '北京市海淀区中关村测试园区88号',
          contactPhone: '+86138000000001',
          contactEmail: 'test@heiniu-food.com',
          isActive: true,
          industryCode: 'FOOD',
          regionCode: 'BJ',
          factoryYear: 2024,
          sequenceNumber: 1
        }
      });
      console.log(`✅ 测试工厂创建成功: ${factory.id}\n`);
    } else {
      console.log(`✅ 测试工厂已存在: ${factory.id}\n`);
    }

    // 2. 创建工厂超级管理员账号信息
    const adminData = {
      username: 'factory_admin',
      password: 'FactoryAdmin@123456',
      email: 'factory.admin@heiniu.com',
      phone: '+86138000099001',
      fullName: '工厂超级管理员',
      roleCode: 'factory_super_admin',
      department: 'management',
      position: '工厂总管理员'
    };

    // 3. 检查管理员是否已存在
    const existingAdmin = await prisma.user.findFirst({
      where: { 
        factoryId: factory.id,
        username: adminData.username
      }
    });

    if (existingAdmin) {
      console.log('⚠️  工厂超级管理员已存在，正在更新密码...');
      
      // 更新密码
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { 
          passwordHash: hashedPassword,
          isActive: true,
          roleCode: 'factory_super_admin',
          fullName: adminData.fullName,
          department: 'management',
          position: adminData.position
        }
      });
      
      console.log('✅ 工厂超级管理员密码已更新\n');
    } else {
      // 4. 创建新的工厂超级管理员
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      
      const factoryAdmin = await prisma.user.create({
        data: {
          factoryId: factory.id,
          username: adminData.username,
          passwordHash: hashedPassword,
          email: adminData.email,
          phone: adminData.phone,
          fullName: adminData.fullName,
          isActive: true,
          roleCode: adminData.roleCode,
          department: adminData.department,
          position: adminData.position
        }
      });

      console.log('✅ 工厂超级管理员创建成功!\n');

      // 5. 记录角色历史
      await prisma.userRoleHistory.create({
        data: {
          userId: factoryAdmin.id,
          factoryId: factory.id,
          oldRoleCode: null,
          newRoleCode: adminData.roleCode,
          changedBy: factoryAdmin.id,
          changedByType: 'self_creation',
          reason: '初始创建工厂超级管理员账号'
        }
      });
    }

    // 6. 显示账号信息
    console.log('🎉 工厂超级管理员账号信息：');
    console.log('=====================================');
    console.log(`🏭 工厂ID: ${factory.id}`);
    console.log(`🏭 工厂名称: ${factory.name}`);
    console.log(`👤 用户名: ${adminData.username}`);
    console.log(`🔐 密码: ${adminData.password}`);
    console.log(`📧 邮箱: ${adminData.email}`);
    console.log(`📱 电话: ${adminData.phone}`);
    console.log(`👨‍💼 姓名: ${adminData.fullName}`);
    console.log(`🎯 角色: ${adminData.roleCode} (工厂超级管理员)`);
    console.log(`🏢 部门: ${adminData.department}`);
    console.log(`💼 职位: ${adminData.position}`);
    console.log('=====================================');
    console.log('');
    console.log('🔗 登录信息：');
    console.log(`   登录地址: POST /api/auth/login`);
    console.log(`   请求体: {`);
    console.log(`     "username": "${adminData.username}",`);
    console.log(`     "password": "${adminData.password}",`);
    console.log(`     "factoryId": "${factory.id}"`);
    console.log(`   }`);
    console.log('');
    console.log('⚠️  请妥善保存账号信息！');

    // 7. 验证创建结果
    const createdUser = await prisma.user.findFirst({
      where: { 
        factoryId: factory.id,
        username: adminData.username
      },
      include: {
        factory: {
          select: { name: true, id: true }
        }
      }
    });

    if (createdUser) {
      console.log('\n✅ 验证成功：工厂超级管理员账号可正常使用');
      console.log(`   用户ID: ${createdUser.id}`);
      console.log(`   激活状态: ${createdUser.isActive ? '已激活' : '未激活'}`);
      console.log(`   所属工厂: ${createdUser.factory.name} (${createdUser.factory.id})`);
    }

  } catch (error) {
    console.error('❌ 创建工厂超级管理员失败:', error.message);
    console.error('详细错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  createFactorySuperAdmin().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

export default createFactorySuperAdmin;