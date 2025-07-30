#!/usr/bin/env node

/**
 * 统一的种子数据脚本
 * 整合并优化了 seed-database.js 和 seed-initial-data.js
 * 避免重复和冲突，提供清晰的账号管理
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient();

// 统一的账号配置
const ACCOUNTS_CONFIG = {
  platform: {
    username: 'platform_admin',
    password: 'Admin@123456',
    email: 'admin@heiniu.com',
    fullName: '平台管理员'
  },
  developer: {
    username: 'developer',
    password: 'Developer@123',
    email: 'developer@heiniu.com',
    fullName: '系统开发者'
  },
  factory: {
    id: 'TEST_2024_001',
    name: '黑牛食品测试工厂',
    industry: '食品加工',
    superAdmin: {
      username: 'factory_admin',
      password: 'SuperAdmin@123',
      email: 'admin@heiniu.com',
      fullName: '工厂超级管理员'
    }
  },
  departments: [
    {
      username: 'farming_admin',
      password: 'DeptAdmin@123',
      email: 'farming@heiniu.com',
      fullName: '养殖部门管理员',
      department: 'farming',
      permissions: ['farming:read', 'farming:write', 'farming:delete', 'trace:read']
    },
    {
      username: 'processing_admin', 
      password: 'DeptAdmin@123',
      email: 'processing@heiniu.com',
      fullName: '加工部门管理员',
      department: 'processing',
      permissions: ['processing:read', 'processing:write', 'processing:delete', 'trace:read']
    },
    {
      username: 'logistics_admin',
      password: 'DeptAdmin@123', 
      email: 'logistics@heiniu.com',
      fullName: '物流部门管理员',
      department: 'logistics',
      permissions: ['logistics:read', 'logistics:write', 'logistics:delete', 'trace:read']
    }
  ],
  testUsers: [
    {
      username: 'test_user_001',
      password: 'TestUser@123',
      email: 'testuser001@heiniu.com',
      fullName: '测试用户一',
      phone: '13900139001',
      department: 'farming'
    },
    {
      username: 'test_user_002',
      password: 'TestUser@123', 
      email: 'testuser002@heiniu.com',
      fullName: '测试用户二',
      phone: '13900139002',
      department: 'processing'
    }
  ]
};

async function runUnifiedSeed() {
  try {
    console.log('🌱 开始统一种子数据初始化...\n');

    // 1. 创建平台管理员
    console.log('1. 📝 创建平台管理员...');
    const platformAdmin = await prisma.platformAdmin.upsert({
      where: { username: ACCOUNTS_CONFIG.platform.username },
      update: {},
      create: {
        username: ACCOUNTS_CONFIG.platform.username,
        passwordHash: await hashPassword(ACCOUNTS_CONFIG.platform.password),
        email: ACCOUNTS_CONFIG.platform.email,
        fullName: ACCOUNTS_CONFIG.platform.fullName,
      },
    });
    console.log(`   ✅ 平台管理员: ${platformAdmin.username}`);

    // 2. 创建测试工厂
    console.log('\n2. 🏭 创建测试工厂...');
    const factory = await prisma.factory.upsert({
      where: { id: ACCOUNTS_CONFIG.factory.id },
      update: {},
      create: {
        id: ACCOUNTS_CONFIG.factory.id,
        name: ACCOUNTS_CONFIG.factory.name,
        industry: ACCOUNTS_CONFIG.factory.industry,
        contactEmail: ACCOUNTS_CONFIG.factory.superAdmin.email,
        contactPhone: '13800138001',
        contactName: ACCOUNTS_CONFIG.factory.superAdmin.fullName,
        address: '上海市浦东新区测试路123号',
        employeeCount: 100,
        subscriptionPlan: 'premium',
        isActive: true,
      },
    });
    console.log(`   ✅ 工厂: ${factory.name} (ID: ${factory.id})`);

    // 3. 创建工厂超级管理员
    console.log('\n3. 👤 创建工厂超级管理员...');
    const superAdminPassword = ACCOUNTS_CONFIG.factory.superAdmin.password;
    const superAdminHash = await hashPassword(superAdminPassword);
    
    const superAdmin = await prisma.user.upsert({
      where: { 
        factoryId_username: {
          factoryId: factory.id,
          username: ACCOUNTS_CONFIG.factory.superAdmin.username
        }
      },
      update: {},
      create: {
        factoryId: factory.id,
        username: ACCOUNTS_CONFIG.factory.superAdmin.username,
        passwordHash: superAdminHash,
        email: ACCOUNTS_CONFIG.factory.superAdmin.email,
        phone: '13800138002',
        fullName: ACCOUNTS_CONFIG.factory.superAdmin.fullName,
        isActive: true,
        roleCode: 'super_admin',
        roleLevel: 0,
        department: 'admin',
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
    console.log(`   ✅ 超级管理员: ${superAdmin.username}`);

    // 4. 创建开发者账号
    console.log('\n4. 🛠️ 创建开发者账号...');
    const developerPassword = ACCOUNTS_CONFIG.developer.password;
    const developerHash = await hashPassword(developerPassword);
    
    const developer = await prisma.user.upsert({
      where: { 
        factoryId_username: {
          factoryId: factory.id,
          username: ACCOUNTS_CONFIG.developer.username
        }
      },
      update: {},
      create: {
        factoryId: factory.id,
        username: ACCOUNTS_CONFIG.developer.username,
        passwordHash: developerHash,
        email: ACCOUNTS_CONFIG.developer.email,
        phone: '13800138000',
        fullName: ACCOUNTS_CONFIG.developer.fullName,
        isActive: true,
        roleCode: 'developer',
        roleLevel: -1, // 最高权限级别
        department: 'development',
        position: '系统开发者',
        permissions: [
          'all', // 开发者拥有所有权限
          'developer:debug', 'developer:config', 'developer:export',
          'admin:read', 'admin:write', 'admin:delete',
          'user:read', 'user:write', 'user:delete',
          'whitelist:read', 'whitelist:write', 'whitelist:delete',
          'farming:read', 'farming:write', 'farming:delete',
          'processing:read', 'processing:write', 'processing:delete',
          'logistics:read', 'logistics:write', 'logistics:delete',
          'quality:read', 'quality:write', 'quality:delete',
          'platform:read', 'platform:write', 'platform:delete',
        ],
      },
    });
    console.log(`   ✅ 开发者账号: ${developer.username}`);

    // 5. 创建部门管理员
    console.log('\n5. 🔹 创建部门管理员...');
    for (const dept of ACCOUNTS_CONFIG.departments) {
      const deptAdminHash = await hashPassword(dept.password);
      
      const deptAdmin = await prisma.user.upsert({
        where: { 
          factoryId_username: {
            factoryId: factory.id,
            username: dept.username
          }
        },
        update: {},
        create: {
          factoryId: factory.id,
          username: dept.username,
          passwordHash: deptAdminHash,
          email: dept.email,
          phone: `1380013800${ACCOUNTS_CONFIG.departments.indexOf(dept) + 3}`,
          fullName: dept.fullName,
          isActive: true,
          roleCode: 'department_admin',
          roleLevel: 10,
          department: dept.department,
          position: '部门管理员',
          permissions: dept.permissions,
        },
      });
      
      console.log(`   ✅ ${dept.fullName}: ${deptAdmin.username}`);
    }

    // 6. 创建白名单数据
    console.log('\n6. 📱 创建测试白名单...');
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
    console.log(`   ✅ 创建 ${whitelistPhones.length} 个白名单记录`);

    // 7. 创建待激活用户
    console.log('\n7. ⏳ 创建待激活测试用户...');
    for (const testUser of ACCOUNTS_CONFIG.testUsers) {
      const userHash = await hashPassword(testUser.password);
      
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
          email: testUser.email,
          phone: testUser.phone,
          fullName: testUser.fullName,
          isActive: false, // 待激活状态
          roleCode: 'unactivated',
          roleLevel: 99,
          department: testUser.department,
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
      
      console.log(`   ✅ 待激活用户: ${user.username} (${user.phone})`);
    }

    // 7. 显示完整的账号信息
    console.log('\n🎉 统一种子数据初始化完成!');
    console.log('\n' + '='.repeat(60));
    console.log('📋 完整的测试账号信息');
    console.log('='.repeat(60));
    
    console.log('\n🛠️ 开发者账号 (拥有所有权限，可切换平台/工厂):');
    console.log(`   用户名: ${ACCOUNTS_CONFIG.developer.username}`);
    console.log(`   密码: ${ACCOUNTS_CONFIG.developer.password}`);
    console.log(`   工厂ID: ${ACCOUNTS_CONFIG.factory.id}`);
    console.log('   登录地址: POST /api/auth/login');
    console.log('   特权: 访问所有模块，跨平台切换');
    
    console.log('\n🔐 平台管理员 (用于平台管理界面):');
    console.log(`   用户名: ${ACCOUNTS_CONFIG.platform.username}`);
    console.log(`   密码: ${ACCOUNTS_CONFIG.platform.password}`);
    console.log('   登录地址: POST /api/auth/platform-login');
    
    console.log('\n🏭 工厂管理员 (用于工厂管理界面):');
    console.log(`   用户名: ${ACCOUNTS_CONFIG.factory.superAdmin.username}`);
    console.log(`   密码: ${ACCOUNTS_CONFIG.factory.superAdmin.password}`);
    console.log(`   工厂ID: ${ACCOUNTS_CONFIG.factory.id}`);
    console.log('   登录地址: POST /api/auth/login');
    
    console.log('\n🔹 部门管理员:');
    ACCOUNTS_CONFIG.departments.forEach(dept => {
      console.log(`   ${dept.fullName}: ${dept.username} / ${dept.password}`);
    });
    
    console.log('\n⏳ 待激活用户 (需要管理员激活):');
    ACCOUNTS_CONFIG.testUsers.forEach(user => {
      console.log(`   ${user.fullName}: ${user.username} / ${user.password} (${user.phone})`);
    });
    
    console.log('\n📱 白名单手机号:');
    whitelistPhones.forEach(phone => console.log(`   ${phone}`));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有账号创建完成，可以开始测试！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 统一种子数据初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行统一种子数据初始化
runUnifiedSeed().catch(console.error);