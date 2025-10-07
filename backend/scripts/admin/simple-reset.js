import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

async function run() {
  const pwd = await hashPassword('123456');

  // 重置所有密码
  await prisma.platformAdmin.updateMany({ data: { passwordHash: pwd } });
  await prisma.user.updateMany({ data: { passwordHash: pwd } });

  // 获取工厂
  const factory = await prisma.factory.findFirst();
  if (!factory) {
    console.log('没有工厂');
    process.exit(1);
  }

  // 确保基础账户存在
  const accounts = [
    { username: 'admin', role: 'platform_super_admin', name: '平台管理员', type: 'platform' },
    { username: 'developer', role: 'system_developer', name: '系统开发者', type: 'platform' },
    { username: 'super_admin', roleCode: 'factory_super_admin', dept: 'management', name: '工厂超管', type: 'factory' },
    { username: 'perm_admin', roleCode: 'permission_admin', dept: 'management', name: '权限管理员', type: 'factory' },
    { username: 'proc_admin', roleCode: 'department_admin', dept: 'processing', name: '加工部管理员', type: 'factory' },
    { username: 'farm_admin', roleCode: 'department_admin', dept: 'farming', name: '养殖部管理员', type: 'factory' },
    { username: 'logi_admin', roleCode: 'department_admin', dept: 'logistics', name: '物流部管理员', type: 'factory' },
    { username: 'proc_user', roleCode: 'operator', dept: 'processing', name: '加工操作员', type: 'factory' },
  ];

  for (const acc of accounts) {
    if (acc.type === 'platform') {
      await prisma.platformAdmin.upsert({
        where: { username: acc.username },
        update: { passwordHash: pwd },
        create: {
          username: acc.username,
          passwordHash: pwd,
          role: acc.role,
          fullName: acc.name,
          email: `${acc.username}@test.com`
        }
      });
    } else {
      await prisma.user.upsert({
        where: { factoryId_username: { factoryId: factory.id, username: acc.username } },
        update: { passwordHash: pwd },
        create: {
          factoryId: factory.id,
          username: acc.username,
          passwordHash: pwd,
          email: `${acc.username}@test.com`,
          phone: '13800138000',
          fullName: acc.name,
          roleCode: acc.roleCode,
          department: acc.dept
        }
      });
    }
    console.log(`✅ ${acc.username} - ${acc.name}`);
  }

  console.log('\n🎉 完成！所有密码: 123456');
  await prisma.$disconnect();
}

run();
