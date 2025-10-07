import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showAllAccounts() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 所有测试账户 (统一密码: 123456)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 平台用户
  const platformUsers = await prisma.platformAdmin.findMany({
    orderBy: { username: 'asc' }
  });

  console.log('【平台用户】');
  platformUsers.forEach(u => {
    console.log(`  用户名: ${u.username.padEnd(15)} 密码: 123456  角色: ${u.role}`);
  });

  // 工厂用户
  const factoryUsers = await prisma.user.findMany({
    orderBy: { username: 'asc' },
    include: { factory: true }
  });

  console.log('\n【工厂用户】');
  factoryUsers.forEach(u => {
    const dept = u.department || '未分配';
    const role = u.roleCode || '未设置';
    console.log(`  用户名: ${u.username.padEnd(15)} 密码: 123456  角色: ${role.padEnd(20)} 部门: ${dept}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await prisma.$disconnect();
}

showAllAccounts();
