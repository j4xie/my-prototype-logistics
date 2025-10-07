import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

async function run() {
  const pwd = await hashPassword('123456');

  // 重置所有密码
  const p1 = await prisma.platformAdmin.updateMany({ data: { passwordHash: pwd } });
  const p2 = await prisma.user.updateMany({ data: { passwordHash: pwd, isActive: true } });

  console.log(`✅ 已重置 ${p1.count} 个平台用户密码`);
  console.log(`✅ 已重置 ${p2.count} 个工厂用户密码`);
  console.log('\n🎉 所有账户密码已统一为: 123456\n');

  // 显示所有账户
  const platformUsers = await prisma.platformAdmin.findMany();
  const factoryUsers = await prisma.user.findMany({ orderBy: { username: 'asc' } });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【平台用户】密码: 123456');
  platformUsers.forEach(u => console.log(`  ${u.username}`));

  console.log('\n【工厂用户】密码: 123456');
  factoryUsers.forEach(u => {
    const status = u.isActive ? '✅' : '❌';
    console.log(`  ${status} ${u.username}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await prisma.$disconnect();
}

run();
