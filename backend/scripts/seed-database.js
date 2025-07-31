#!/usr/bin/env node

/**
 * 数据库种子数据脚本
 * 创建测试工厂、用户和基础数据
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log('🌱 开始初始化种子数据...\n');

    // 1. 创建测试工厂
    console.log('1. 创建测试工厂...');
    
    const factory = await prisma.factory.upsert({
      where: { id: 'TEST_2024_001' },
      update: {},
      create: {
        id: 'TEST_2024_001',
        name: '黑牛食品测试工厂',
        industry: '食品加工',
        contactEmail: 'test-factory@heiniu.com',
        contactPhone: '13800138001',
        contactName: '测试工厂管理员',
        address: '上海市浦东新区测试路123号',
        employeeCount: 100,
        subscriptionPlan: 'premium',
        isActive: true,
      },
    });
    
    console.log(`   ✅ 工厂创建成功: ${factory.name} (ID: ${factory.id})`);

    // 2. 创建工厂超级管理员
    console.log('\n2. 创建工厂超级管理员...');
    
    const superAdminPassword = 'SuperAdmin@123';
    const superAdminHash = await hashPassword(superAdminPassword);
    
    const superAdmin = await prisma.user.upsert({
      where: { 
        factoryId_username: {
          factoryId: factory.id,
          username: 'factory_admin'
        }
      },
      update: {},
      create: {
        factoryId: factory.id,
        username: 'factory_admin',
        passwordHash: superAdminHash,
        email: 'factory-admin@heiniu.com',
        phone: '13800138002',
        fullName: '工厂超级管理员',
        isActive: true,
        roleCode: 'factory_super_admin',
        roleLevel: 0,
        department: 'management',
        position: '超级管理员',
        permissions: [
          'admin:read', 'admin:write', 'admin:delete',
          'user:read', 'user:write', 'user:delete',
          'whitelist:read', 'whitelist:write', 'whitelist:delete',
          'farming:read', 'farming:write', 'farming:delete',
          'processing:read', 'processing:write', 'processing:delete',
          'logistics:read', 'logistics:write', 'logistics:delete',
          'quality:read', 'quality:write', 'quality:delete',
        ],
      },
    });
    
    console.log(`   ✅ 超级管理员创建成功: ${superAdmin.username}`);
    console.log(`   密码: ${superAdminPassword}`);

    // 3. 创建部门管理员
    console.log('\n3. 创建部门管理员...');
    
    const departments = [
      { code: 'farming_admin', name: '养殖部门管理员', dept: 'farming', permissions: ['farming:read', 'farming:write', 'farming:delete'] },
      { code: 'processing_admin', name: '加工部门管理员', dept: 'processing', permissions: ['processing:read', 'processing:write', 'processing:delete'] },
      { code: 'logistics_admin', name: '物流部门管理员', dept: 'logistics', permissions: ['logistics:read', 'logistics:write', 'logistics:delete'] },
    ];

    for (const dept of departments) {
      const deptAdminPassword = 'DeptAdmin@123';
      const deptAdminHash = await hashPassword(deptAdminPassword);
      
      const deptAdmin = await prisma.user.upsert({
        where: { 
          factoryId_username: {
            factoryId: factory.id,
            username: dept.code
          }
        },
        update: {},
        create: {
          factoryId: factory.id,
          username: dept.code,
          passwordHash: deptAdminHash,
          email: `${dept.code}@heiniu.com`,
          phone: `1380013800${departments.indexOf(dept) + 3}`,
          fullName: dept.name,
          isActive: true,
          roleCode: 'department_admin',
          roleLevel: 10,
          department: dept.dept,
          position: '部门管理员',
          permissions: [...dept.permissions, 'common:read'],
        },
      });
      
      console.log(`   ✅ ${dept.name}创建成功: ${deptAdmin.username}`);
    }

    // 4. 创建白名单数据
    console.log('\n4. 创建测试白名单...');
    
    const whitelistPhones = [
      '13900139001', '13900139002', '13900139003', 
      '13900139004', '13900139005'
    ];

    for (const phone of whitelistPhones) {
      await prisma.userWhitelist.upsert({
        where: {
          factoryId_phoneNumber: {
            factoryId: factory.id,
            phoneNumber: phone
          }
        },
        update: {},
        create: {
          factoryId: factory.id,
          phoneNumber: phone,
          addedByUserId: superAdmin.id,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        },
      });
    }
    
    console.log(`   ✅ 创建 ${whitelistPhones.length} 个测试白名单记录`);

    // 5. 创建待激活用户
    console.log('\n5. 创建待激活测试用户...');
    
    const testUsers = [
      { username: 'test_user_001', phone: '13900139001', name: '测试用户一', dept: 'farming' },
      { username: 'test_user_002', phone: '13900139002', name: '测试用户二', dept: 'processing' },
    ];

    for (const testUser of testUsers) {
      const userPassword = 'TestUser@123';
      const userHash = await hashPassword(userPassword);
      
      const user = await prisma.user.upsert({
        where: { 
          factoryId_username: {
            factoryId: factory.id,
            username: testUser.username
          }
        },
        update: {},
        create: {
          factoryId: factory.id,
          username: testUser.username,
          passwordHash: userHash,
          email: `${testUser.username}@heiniu.com`,
          phone: testUser.phone,
          fullName: testUser.name,
          isActive: false, // 待激活状态
          roleCode: 'unactivated',
          roleLevel: 99,
          permissions: [],
        },
      });
      
      // 更新对应的白名单状态
      await prisma.userWhitelist.updateMany({
        where: {
          factoryId: factory.id,
          phoneNumber: testUser.phone,
        },
        data: {
          status: 'REGISTERED',
        },
      });
      
      console.log(`   ✅ 待激活用户创建成功: ${user.username}`);
    }

    console.log('\n🎉 种子数据初始化完成!');
    console.log('\n📋 测试账户信息:');
    console.log('');
    console.log('🏭 测试工厂信息:');
    console.log(`   工厂ID: ${factory.id}`);
    console.log(`   工厂名称: ${factory.name}`);
    console.log('');
    console.log('👤 测试账户:');
    console.log(`   超级管理员: factory_admin / SuperAdmin@123`);
    console.log(`   养殖管理员: farming_admin / DeptAdmin@123`);
    console.log(`   加工管理员: processing_admin / DeptAdmin@123`);
    console.log(`   物流管理员: logistics_admin / DeptAdmin@123`);
    console.log('');
    console.log('📱 测试白名单手机号:');
    whitelistPhones.forEach(phone => console.log(`   ${phone}`));
    console.log('');
    console.log('⏳ 待激活用户:');
    testUsers.forEach(user => console.log(`   ${user.username} (${user.phone})`));
    console.log('');

  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行种子数据初始化
seedDatabase().catch(console.error);