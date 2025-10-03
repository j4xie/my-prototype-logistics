#!/usr/bin/env node

/**
 * 检查当前数据库中实际可用的账号
 * 验证账号的有效性并输出清单
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkValidAccounts() {
  console.log('🔍 检查数据库中实际可用的账号...\n');

  try {
    // 1. 检查平台管理员账号
    console.log('📋 平台管理员账号 (PlatformAdmin):');
    console.log('='.repeat(50));
    
    const platformAdmins = await prisma.platformAdmin.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      }
    });

    if (platformAdmins.length > 0) {
      platformAdmins.forEach((admin, index) => {
        console.log(`${index + 1}. 用户名: ${admin.username}`);
        console.log(`   邮箱: ${admin.email}`);
        console.log(`   姓名: ${admin.fullName || '未设置'}`);
        console.log(`   角色: ${admin.role}`);
        console.log(`   创建时间: ${admin.createdAt.toLocaleString()}`);
        console.log(`   建议密码: Admin@123456 (默认密码)`);
        console.log('');
      });
    } else {
      console.log('❌ 没有找到平台管理员账号\n');
    }

    // 2. 检查工厂用户账号
    console.log('🏭 工厂用户账号 (Factory Users):');
    console.log('='.repeat(50));
    
    const factoryUsers = await prisma.user.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        roleCode: true,
        department: true,
        factoryId: true,
        createdAt: true,
        factory: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { factoryId: 'asc' },
        { roleCode: 'asc' }
      ]
    });

    if (factoryUsers.length > 0) {
      const usersByFactory = {};
      
      factoryUsers.forEach(user => {
        if (!usersByFactory[user.factoryId]) {
          usersByFactory[user.factoryId] = [];
        }
        usersByFactory[user.factoryId].push(user);
      });

      Object.entries(usersByFactory).forEach(([factoryId, users]) => {
        console.log(`🏭 工厂: ${users[0].factory.name} (${factoryId})`);
        
        users.forEach((user, index) => {
          console.log(`  ${index + 1}. 用户名: ${user.username}`);
          console.log(`     邮箱: ${user.email}`);
          console.log(`     姓名: ${user.fullName || '未设置'}`);
          console.log(`     角色: ${user.roleCode}`);
          console.log(`     部门: ${user.department || '未设置'}`);
          console.log(`     创建时间: ${user.createdAt.toLocaleString()}`);
          
          // 根据角色推荐密码
          let suggestedPassword = 'Unknown';
          switch (user.roleCode) {
            case 'factory_super_admin':
              suggestedPassword = 'FactoryAdmin@123456';
              break;
            case 'permission_admin':
              suggestedPassword = 'PermAdmin@123456';
              break;
            case 'department_admin':
              suggestedPassword = 'DeptAdmin@123456';
              break;
            case 'operator':
              suggestedPassword = 'Process@123456';
              break;
            case 'viewer':
              suggestedPassword = 'Viewer@123456';
              break;
            case 'developer':
              suggestedPassword = 'Dev@123456';
              break;
            default:
              suggestedPassword = '请联系管理员';
          }
          console.log(`     建议密码: ${suggestedPassword}`);
          console.log('');
        });
        console.log('-'.repeat(30) + '\n');
      });
    } else {
      console.log('❌ 没有找到激活的工厂用户账号\n');
    }

    // 3. 生成登录测试信息
    console.log('🧪 账号登录测试信息:');
    console.log('='.repeat(50));
    
    // 平台管理员登录示例
    if (platformAdmins.length > 0) {
      const firstPlatformAdmin = platformAdmins[0];
      console.log('📋 平台管理员登录:');
      console.log(`POST /api/auth/platform-login`);
      console.log(`{`);
      console.log(`  "username": "${firstPlatformAdmin.username}",`);
      console.log(`  "password": "Admin@123456"`);
      console.log(`}`);
      console.log('');
    }

    // 工厂用户登录示例
    if (factoryUsers.length > 0) {
      const firstFactoryUser = factoryUsers[0];
      let suggestedPassword = 'FactoryAdmin@123456';
      
      switch (firstFactoryUser.roleCode) {
        case 'factory_super_admin':
          suggestedPassword = 'FactoryAdmin@123456';
          break;
        case 'permission_admin':
          suggestedPassword = 'PermAdmin@123456';
          break;
        case 'department_admin':
          suggestedPassword = 'DeptAdmin@123456';
          break;
        case 'operator':
          suggestedPassword = 'Process@123456';
          break;
        case 'viewer':
          suggestedPassword = 'Viewer@123456';
          break;
        case 'developer':
          suggestedPassword = 'Dev@123456';
          break;
      }

      console.log('🏭 工厂用户登录:');
      console.log(`POST /api/auth/login`);
      console.log(`{`);
      console.log(`  "username": "${firstFactoryUser.username}",`);
      console.log(`  "password": "${suggestedPassword}",`);
      console.log(`  "factoryId": "${firstFactoryUser.factoryId}"`);
      console.log(`}`);
      console.log('');
    }

    // 4. 统计信息
    console.log('📊 账号统计:');
    console.log('='.repeat(50));
    console.log(`平台管理员数量: ${platformAdmins.length}`);
    console.log(`激活的工厂用户数量: ${factoryUsers.length}`);
    
    const roleStats = {};
    factoryUsers.forEach(user => {
      roleStats[user.roleCode] = (roleStats[user.roleCode] || 0) + 1;
    });
    
    console.log('\n各角色用户分布:');
    Object.entries(roleStats).forEach(([role, count]) => {
      console.log(`  ${role}: ${count} 个`);
    });

    return {
      platformAdmins,
      factoryUsers,
      total: platformAdmins.length + factoryUsers.length
    };

  } catch (error) {
    console.error('❌ 检查账号失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  checkValidAccounts().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

export default checkValidAccounts;