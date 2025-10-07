#!/usr/bin/env node

/**
 * 创建完整的测试用户数据
 * 所有密码统一为: 123456
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();
const PASSWORD = '123456';

async function createCompleteTestUsers() {
  try {
    console.log('🔄 开始创建完整测试用户...\n');

    const hashedPassword = await hashPassword(PASSWORD);

    // 1. 确保有测试工厂
    console.log('1. 检查测试工厂...');
    let factory = await prisma.factory.findFirst({
      where: { factoryId: { startsWith: 'FAC' } }
    });

    if (!factory) {
      factory = await prisma.factory.create({
        data: {
          factoryId: 'FAC001',
          name: '海牛测试工厂',
          industry: 'processing',
          region: 'jiangsu',
          address: '江苏省南京市测试路123号',
          contactPerson: '测试负责人',
          contactPhone: '13800138000',
          isActive: true,
          subscriptionPlan: 'premium'
        }
      });
      console.log(`   ✅ 创建测试工厂: ${factory.name} (${factory.factoryId})\n`);
    } else {
      console.log(`   ✅ 使用现有工厂: ${factory.name} (${factory.factoryId})\n`);
    }

    // 2. 创建平台管理员
    console.log('2. 创建平台管理员...');
    await prisma.platformAdmin.upsert({
      where: { username: 'admin' },
      update: { passwordHash: hashedPassword },
      create: {
        username: 'admin',
        passwordHash: hashedPassword,
        role: 'platform_super_admin',
        email: 'admin@cretas.com',
        fullName: '平台超级管理员',
        isActive: true
      }
    });
    console.log('   ✅ admin - 平台超级管理员\n');

    // 3. 创建系统开发者
    console.log('3. 创建系统开发者...');
    await prisma.platformAdmin.upsert({
      where: { username: 'developer' },
      update: { passwordHash: hashedPassword },
      create: {
        username: 'developer',
        passwordHash: hashedPassword,
        role: 'system_developer',
        email: 'dev@cretas.com',
        fullName: '系统开发者',
        isActive: true
      }
    });
    console.log('   ✅ developer - 系统开发者\n');

    // 4. 创建工厂用户
    console.log('4. 创建工厂用户...');

    const factoryUsers = [
      // 工厂超级管理员
      {
        username: 'super_admin',
        roleCode: 'factory_super_admin',
        department: 'management',
        fullName: '工厂超级管理员',
        phone: '13800138001'
      },
      // 权限管理员
      {
        username: 'perm_admin',
        roleCode: 'permission_admin',
        department: 'management',
        fullName: '权限管理员',
        phone: '13800138002'
      },
      // 加工部门管理员
      {
        username: 'proc_admin',
        roleCode: 'department_admin',
        department: 'processing',
        fullName: '加工部门管理员',
        phone: '13800138003'
      },
      // 养殖部门管理员
      {
        username: 'farm_admin',
        roleCode: 'department_admin',
        department: 'farming',
        fullName: '养殖部门管理员',
        phone: '13800138004'
      },
      // 物流部门管理员
      {
        username: 'logi_admin',
        roleCode: 'department_admin',
        department: 'logistics',
        fullName: '物流部门管理员',
        phone: '13800138005'
      },
      // 加工操作员
      {
        username: 'proc_user',
        roleCode: 'operator',
        department: 'processing',
        fullName: '加工操作员',
        phone: '13800138006'
      },
      // 养殖操作员
      {
        username: 'farm_user',
        roleCode: 'operator',
        department: 'farming',
        fullName: '养殖操作员',
        phone: '13800138007'
      },
      // 查看者
      {
        username: 'viewer',
        roleCode: 'viewer',
        department: 'quality',
        fullName: '质检查看员',
        phone: '13800138008'
      }
    ];

    for (const userData of factoryUsers) {
      await prisma.user.upsert({
        where: {
          factoryId_username: {
            factoryId: factory.id,
            username: userData.username
          }
        },
        update: {
          passwordHash: hashedPassword,
          isActive: true
        },
        create: {
          factoryId: factory.id,
          username: userData.username,
          passwordHash: hashedPassword,
          email: `${userData.username}@cretas.com`,
          phone: userData.phone,
          fullName: userData.fullName,
          roleCode: userData.roleCode,
          department: userData.department,
          position: userData.fullName,
          isActive: true,
          roleLevel: userData.roleCode === 'factory_super_admin' ? 0 :
                     userData.roleCode === 'permission_admin' ? 5 :
                     userData.roleCode === 'department_admin' ? 10 :
                     userData.roleCode === 'operator' ? 20 : 30
        }
      });
      console.log(`   ✅ ${userData.username.padEnd(15)} - ${userData.fullName} (${userData.department})`);
    }

    console.log('\n🎉 测试用户创建完成！\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 测试账户列表 (所有密码: 123456)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('【平台用户】');
    console.log('  admin          → 平台超级管理员');
    console.log('  developer      → 系统开发者\n');

    console.log('【工厂用户】');
    console.log('  super_admin    → 工厂超级管理员 [management]');
    console.log('  perm_admin     → 权限管理员 [management]');
    console.log('  proc_admin     → 加工部门管理员 [processing]');
    console.log('  farm_admin     → 养殖部门管理员 [farming]');
    console.log('  logi_admin     → 物流部门管理员 [logistics]');
    console.log('  proc_user      → 加工操作员 [processing]');
    console.log('  farm_user      → 养殖操作员 [farming]');
    console.log('  viewer         → 质检查看员 [quality]\n');

    console.log('💡 登录后跳转:');
    console.log('  admin          → 平台控制面板');
    console.log('  developer      → 首页 (全部权限)');
    console.log('  super_admin    → 首页 (全部权限)');
    console.log('  perm_admin     → 权限管理中心');
    console.log('  proc_admin     → 加工模块 (含白名单按钮)');
    console.log('  farm_admin     → 养殖模块 (含白名单按钮)');
    console.log('  logi_admin     → 物流模块 (含白名单按钮)');
    console.log('  proc_user      → 加工模块 (无白名单按钮)');
    console.log('  farm_user      → 养殖模块 (无白名单按钮)');
    console.log('  viewer         → 质检模块 (只读)\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 创建失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createCompleteTestUsers();
