#!/usr/bin/env node

/**
 * 重置所有测试账户密码为简单统一密码
 * 统一密码: 123456
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

const SIMPLE_PASSWORD = '123456';

async function resetPasswords() {
  try {
    console.log('🔄 开始重置测试账户密码...\n');

    const hashedPassword = await hashPassword(SIMPLE_PASSWORD);

    // 1. 重置平台管理员密码
    console.log('1. 重置平台管理员密码...');
    const platformAdmins = await prisma.platformAdmin.updateMany({
      data: { passwordHash: hashedPassword }
    });
    console.log(`   ✅ 已重置 ${platformAdmins.count} 个平台管理员密码\n`);

    // 2. 重置所有工厂用户密码
    console.log('2. 重置工厂用户密码...');
    const users = await prisma.user.updateMany({
      data: { passwordHash: hashedPassword }
    });
    console.log(`   ✅ 已重置 ${users.count} 个工厂用户密码\n`);

    console.log('🎉 密码重置完成！\n');
    console.log('📋 新的统一密码: 123456\n');
    console.log('📊 测试账户列表:\n');

    // 显示所有账户
    console.log('【平台用户】');
    const platformUsers = await prisma.platformAdmin.findMany({
      select: { username: true, role: true, fullName: true }
    });
    platformUsers.forEach(u => {
      console.log(`   ${u.username.padEnd(20)} (${u.fullName || u.role})`);
    });

    console.log('\n【工厂用户】');
    const factoryUsers = await prisma.user.findMany({
      select: {
        username: true,
        roleCode: true,
        department: true,
        fullName: true,
        isActive: true
      },
      orderBy: [
        { roleCode: 'asc' },
        { username: 'asc' }
      ]
    });

    const roleOrder = {
      'factory_super_admin': 1,
      'permission_admin': 2,
      'department_admin': 3,
      'operator': 4,
      'user': 5,
      'viewer': 6,
      'unactivated': 7
    };

    factoryUsers.sort((a, b) => {
      return (roleOrder[a.roleCode] || 99) - (roleOrder[b.roleCode] || 99);
    });

    factoryUsers.forEach(u => {
      const status = u.isActive ? '✅' : '❌';
      const dept = u.department ? `[${u.department}]` : '';
      console.log(`   ${status} ${u.username.padEnd(20)} ${dept.padEnd(15)} (${u.fullName || u.roleCode})`);
    });

    console.log('\n💡 提示:');
    console.log('   所有账户密码已统一为: 123456');
    console.log('   ❌ 标记的账户为未激活状态，无法登录');
    console.log('   ✅ 标记的账户可以正常登录\n');

  } catch (error) {
    console.error('❌ 密码重置失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
resetPasswords();
