/**
 * 清理用户,只保留4个核心账号
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始清理用户数据...\n');

  // 需要保留的账号
  const keepUsers = [
    'super_admin',      // 超级工厂管理员
    'dept_admin',       // 加工部门管理员
    'operator1',        // 加工部门员工
  ];

  console.log('保留以下账号:');
  keepUsers.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  console.log('');

  // 1. 删除工厂2及其所有数据
  console.log('📍 步骤1: 删除工厂2...');
  const factory2 = await prisma.factory.findUnique({
    where: { id: 'TEST_2024_002' },
  });

  if (factory2) {
    await prisma.factory.delete({
      where: { id: 'TEST_2024_002' },
    });
    console.log('   ✅ 已删除工厂2及其关联数据\n');
  }

  // 2. 删除工厂1中不需要的用户
  console.log('📍 步骤2: 清理工厂1用户...');
  const allUsers = await prisma.user.findMany({
    where: { factoryId: 'TEST_2024_001' },
  });

  for (const user of allUsers) {
    if (!keepUsers.includes(user.username)) {
      await prisma.user.delete({
        where: { id: user.id },
      });
      console.log(`   🗑️  已删除: ${user.username} (${user.fullName || 'N/A'})`);
    }
  }

  // 3. 创建平台管理员
  console.log('\n📍 步骤3: 创建平台管理员...');
  const platformPassword = await bcrypt.hash('123456', 12);

  const platformAdmin = await prisma.platformAdmin.upsert({
    where: { username: 'platform_admin' },
    update: {},
    create: {
      username: 'platform_admin',
      passwordHash: platformPassword,
      email: 'platform@cretas.com',
      fullName: '平台管理员',
      roleCode: 'platform_super_admin',
      isActive: true,
    },
  });
  console.log(`   ✅ 平台管理员创建成功: ${platformAdmin.username}\n`);

  // 4. 显示最终账号清单
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ 用户清理完成!                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 最终数据统计:');
  const [userCount, factoryCount] = await Promise.all([
    prisma.user.count(),
    prisma.factory.count(),
  ]);
  console.log(`   工厂用户: ${userCount} 个`);
  console.log(`   工厂数: ${factoryCount} 个`);
  console.log(`   平台管理员: 1 个\n`);

  console.log('👤 最终账号清单 (统一密码: 123456):');
  console.log('┌──────────────────┬──────────┬────────────────────┬──────────┐');
  console.log('│ 用户名           │ 密码     │ 角色               │ 类型     │');
  console.log('├──────────────────┼──────────┼────────────────────┼──────────┤');
  console.log('│ platform_admin   │ 123456   │ 平台管理员         │ 平台     │');
  console.log('│ super_admin      │ 123456   │ 超级工厂管理员     │ 工厂     │');
  console.log('│ dept_admin       │ 123456   │ 加工部门管理员     │ 工厂     │');
  console.log('│ operator1        │ 123456   │ 加工部门员工       │ 工厂     │');
  console.log('└──────────────────┴──────────┴────────────────────┴──────────┘\n');

  console.log('✨ 系统已精简完毕,可以开始测试!\n');
}

main()
  .catch((e) => {
    console.error('❌ 清理失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
