/**
 * 重置所有用户密码为 123456
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 开始重置所有用户密码为: 123456\n');

  const newPassword = '123456';
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // 获取所有用户
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      roleCode: true,
    },
  });

  console.log(`找到 ${users.length} 个用户\n`);

  // 批量更新所有用户密码
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });
    console.log(`✅ ${user.username} (${user.fullName || 'N/A'}) - ${user.roleCode}`);
  }

  console.log('\n✅ 所有用户密码已重置为: 123456');
  console.log('\n📋 测试账号清单:');
  console.log('┌─────────────────────┬──────────┬────────────────────┐');
  console.log('│ 用户名              │ 密码     │ 角色               │');
  console.log('├─────────────────────┼──────────┼────────────────────┤');

  users.forEach(user => {
    const username = user.username.padEnd(20);
    const role = user.roleCode.padEnd(20);
    console.log(`│ ${username}│ 123456   │ ${role}│`);
  });

  console.log('└─────────────────────┴──────────┴────────────────────┘\n');
}

main()
  .catch((e) => {
    console.error('❌ 重置密码失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
