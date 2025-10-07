/**
 * 初始化脚本 - 只创建admin账号
 * 用途：清空所有账号，只保留admin / 123456
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  开始清理数据库...');

  // 1. 删除所有相关数据（按依赖顺序）
  // 先删除有外键依赖的表
  await prisma.qualityInspection.deleteMany({});
  await prisma.processingBatch.deleteMany({});
  await prisma.employeeWorkRecord.deleteMany({});
  await prisma.employeeWorkSession.deleteMany({});
  await prisma.employeeTimeClock.deleteMany({});

  // 然后删除用户数据
  await prisma.platformAdmin.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ 已清空所有用户相关数据');

  // 2. 创建唯一的admin账号
  const hashedPassword = await bcrypt.hash('123456', 10);

  await prisma.platformAdmin.create({
    data: {
      username: 'admin',
      passwordHash: hashedPassword,
      email: 'admin@cretas.com',
      fullName: '系统管理员',
      role: 'platform_admin',
    },
  });

  console.log('✅ 已创建admin账号');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 唯一可用账号：');
  console.log('   用户名: admin');
  console.log('   密码: 123456');
  console.log('   角色: platform_super_admin (平台超级管理员)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎉 初始化完成！');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
