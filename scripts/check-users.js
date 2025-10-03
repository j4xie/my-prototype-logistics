import { PrismaClient } from '@prisma/client';

async function checkUsers() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 检查数据库用户...\n');

    // 检查平台管理员
    console.log('📋 平台管理员 (PlatformAdmin):');
    const platformAdmins = await prisma.platformAdmin.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (platformAdmins.length > 0) {
      platformAdmins.forEach(admin => {
        console.log(`  - 用户名: ${admin.username}`);
        console.log(`  - 邮箱: ${admin.email}`);
        console.log(`  - 角色: ${admin.role}`);
        console.log(`  - 创建时间: ${admin.createdAt}`);
        console.log('');
      });
    } else {
      console.log('  (无平台管理员)');
    }

    // 检查工厂用户
    console.log('\n👥 工厂用户 (User):');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        factoryId: true,
        createdAt: true
      }
    });

    if (users.length > 0) {
      users.forEach(user => {
        console.log(`  - 用户名: ${user.username}`);
        console.log(`  - 全名: ${user.fullName}`);
        console.log(`  - 角色: ${user.role}`);
        console.log(`  - 工厂ID: ${user.factoryId}`);
        console.log(`  - 创建时间: ${user.createdAt}`);
        console.log('');
      });
    } else {
      console.log('  (无工厂用户)');
    }

    // 检查白名单
    console.log('\n📝 白名单 (UserWhitelist):');
    const whitelist = await prisma.userWhitelist.findMany({
      select: {
        phoneNumber: true,
        status: true,
        createdAt: true
      }
    });

    if (whitelist.length > 0) {
      whitelist.forEach(entry => {
        console.log(`  - 手机: ${entry.phoneNumber}, 状态: ${entry.status}`);
      });
    } else {
      console.log('  (无白名单记录)');
    }

  } catch (error) {
    console.error('❌ 数据库查询错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();