import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        roleCode: true,
        factoryId: true,
        department: true,
        isActive: true,
      },
      take: 10
    });

    console.log('\n📋 数据库中的用户列表:\n');
    users.forEach(user => {
      console.log(`  • ${user.username} (${user.email})`);
      console.log(`    ID: ${user.id}, Role: ${user.roleCode}, Factory: ${user.factoryId}`);
      console.log(`    Department: ${user.department}, Active: ${user.isActive}`);
      console.log('');
    });

    console.log(`\n总共 ${users.length} 个用户\n`);
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
