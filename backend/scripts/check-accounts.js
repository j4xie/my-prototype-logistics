#!/usr/bin/env node

/**
 * 检查数据库中所有账号的实际状态
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const prisma = new PrismaClient();

async function checkAccounts() {
  try {
    console.log('🔍 检查数据库中的账号状态...\n');

    // 1. 检查平台管理员
    console.log('📋 平台管理员账号:');
    const platformAdmins = await prisma.platformAdmin.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        createdAt: true
      }
    });

    if (platformAdmins.length === 0) {
      console.log('   ❌ 未找到平台管理员账号');
    } else {
      platformAdmins.forEach(admin => {
        console.log(`   ✅ ${admin.username} | ${admin.email} | ${admin.fullName} | 创建时间: ${admin.createdAt.toISOString().split('T')[0]}`);
      });
    }

    // 2. 检查工厂
    console.log('\n🏭 工厂信息:');
    const factories = await prisma.factory.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        isActive: true,
        createdAt: true
      }
    });

    if (factories.length === 0) {
      console.log('   ❌ 未找到工厂');
    } else {
      factories.forEach(factory => {
        console.log(`   🏭 ${factory.id} | ${factory.name} | ${factory.industry} | ${factory.isActive ? '激活' : '停用'}`);
      });
    }

    // 3. 检查工厂用户账号
    console.log('\n👤 工厂用户账号 (按工厂和角色排序):');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        factoryId: true,
        username: true,
        email: true,
        fullName: true,
        roleCode: true,
        department: true,
        position: true,
        isActive: true,
        createdAt: true
      },
      orderBy: [
        { factoryId: 'asc' },
        { roleCode: 'asc' },
        { username: 'asc' }
      ]
    });

    if (users.length === 0) {
      console.log('   ❌ 未找到工厂用户');
    } else {
      // 按角色分组显示
      const roleGroups = {
        'factory_super_admin': '🔹 工厂超级管理员',
        'department_admin': '🔸 部门管理员', 
        'user': '👨‍💼 普通用户',
        'unactivated': '⏳ 待激活用户'
      };

      const usersByRole = {};
      users.forEach(user => {
        if (!usersByRole[user.roleCode]) {
          usersByRole[user.roleCode] = [];
        }
        usersByRole[user.roleCode].push(user);
      });

      Object.entries(roleGroups).forEach(([roleCode, roleName]) => {
        if (usersByRole[roleCode]) {
          console.log(`\n   ${roleName}:`);
          usersByRole[roleCode].forEach(user => {
            const status = user.isActive ? '✅激活' : '❌停用';
            const factoryLabel = user.factoryId === 'TEST_2024_001' ? '🧪测试工厂' : user.factoryId;
            const isTestUser = user.factoryId === 'TEST_2024_001' || user.position === 'SYSTEM_DEVELOPER';
            const testMarker = isTestUser ? '🧪' : '🏢';
            console.log(`     ${testMarker} ${user.username} | ${user.email} | ${user.fullName} | 工厂:${factoryLabel} | ${user.department || '无部门'} | ${status}`);
          });
        }
      });

      // 显示其他未分类的角色
      Object.keys(usersByRole).forEach(roleCode => {
        if (!roleGroups[roleCode]) {
          console.log(`\n   🔹 ${roleCode.toUpperCase()}:`);
          usersByRole[roleCode].forEach(user => {
            const status = user.isActive ? '✅激活' : '❌停用';
            console.log(`     ${user.username} | ${user.email} | ${user.fullName} | ${user.department || '无部门'} | ${status}`);
          });
        }
      });
    }

    // 4. 检查白名单
    console.log('\n📱 白名单手机号:');
    const whitelists = await prisma.userWhitelist.findMany({
      select: {
        phoneNumber: true,
        status: true,
        factoryId: true,
        expiresAt: true,
        createdAt: true
      },
      orderBy: { phoneNumber: 'asc' }
    });

    if (whitelists.length === 0) {
      console.log('   ❌ 未找到白名单记录');
    } else {
      whitelists.forEach(whitelist => {
        const expired = whitelist.expiresAt && whitelist.expiresAt < new Date();
        const statusText = expired ? '⏰过期' : 
                          whitelist.status === 'PENDING' ? '⏳待注册' :
                          whitelist.status === 'REGISTERED' ? '✅已注册' : whitelist.status;
        console.log(`   ${whitelist.phoneNumber} | ${statusText} | ${whitelist.factoryId}`);
      });
    }

    // 5. 统计信息
    console.log('\n📊 统计信息:');
    console.log(`   平台管理员: ${platformAdmins.length} 个`);
    console.log(`   工厂数量: ${factories.length} 个`);
    console.log(`   工厂用户: ${users.length} 个`);
    console.log(`   白名单记录: ${whitelists.length} 条`);

    // 6. 检查可能的重复账号
    console.log('\n🔍 重复账号检查:');
    const duplicateCheck = await prisma.user.groupBy({
      by: ['username', 'factoryId'],
      having: {
        username: {
          _count: {
            gt: 1
          }
        }
      }
    });

    if (duplicateCheck.length === 0) {
      console.log('   ✅ 未发现重复用户名');
    } else {
      console.log('   ❌ 发现重复用户名:');  
      duplicateCheck.forEach(dup => {
        console.log(`     工厂 ${dup.factoryId} 中的用户名 "${dup.username}" 出现重复`);
      });
    }

  } catch (error) {
    console.error('❌ 检查账号失败:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行检查
checkAccounts().catch(console.error);