import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

async function resetPasswords() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 开始重置所有用户密码为 123456...\n');

    const newPassword = '123456';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    console.log(`🔑 新密码: ${newPassword}`);
    console.log(`🔐 哈希值: ${hashedPassword}\n`);

    // 重置平台管理员密码
    console.log('📋 重置平台管理员密码:');
    const platformAdmins = await prisma.platformAdmin.findMany({
      select: { id: true, username: true }
    });

    for (const admin of platformAdmins) {
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { passwordHash: hashedPassword }
      });
      console.log(`  ✅ ${admin.username} - 密码已重置为 123456`);
    }

    // 重置工厂用户密码（如果有的话）
    console.log('\n👥 重置工厂用户密码:');
    try {
      const users = await prisma.user.findMany({
        select: { id: true, username: true }
      });

      if (users.length > 0) {
        for (const user of users) {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword }
          });
          console.log(`  ✅ ${user.username} - 密码已重置为 123456`);
        }
      } else {
        console.log('  (无工厂用户)');
      }
    } catch (error) {
      console.log('  (工厂用户表可能不存在或结构不同)');
    }

    console.log('\n🎉 所有用户密码重置完成！');
    console.log('\n📱 现在可以使用以下账户登录:');
    console.log('   用户名: developer, 密码: 123456');
    console.log('   用户名: platform_admin, 密码: 123456');

  } catch (error) {
    console.error('❌ 密码重置失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswords();