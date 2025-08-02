const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPlatformAdmin() {
  try {
    console.log('检查平台管理员...');

    // 查找所有平台管理员
    const admins = await prisma.platformAdmin.findMany();
    console.log('平台管理员数量:', admins.length);

    if (admins.length > 0) {
      console.log('\n平台管理员列表:');
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. 用户名: ${admin.username}, 邮箱: ${admin.email}, 创建时间: ${admin.createdAt}`);
      });
    } else {
      console.log('\n❌ 没有找到平台管理员');
      console.log('需要创建platform_admin用户...');
    }

    // 查找特定的platform_admin用户
    const specificAdmin = await prisma.platformAdmin.findUnique({
      where: { username: 'platform_admin' }
    });

    if (specificAdmin) {
      console.log('\n✅ 找到platform_admin用户:');
      console.log('- 用户名:', specificAdmin.username);
      console.log('- 邮箱:', specificAdmin.email);
      console.log('- 全名:', specificAdmin.fullName);
      console.log('- 创建时间:', specificAdmin.createdAt);
    } else {
      console.log('\n❌ 没有找到username为platform_admin的用户');
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPlatformAdmin();
