import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const testDatabase = async () => {
  console.log('🔍 测试数据库连接...');
  
  try {
    // 1. 测试数据库连接
    console.log('📊 连接数据库...');
    await prisma.$connect();
    console.log('✅ 数据库连接成功');
    
    // 2. 查询工厂数据
    console.log('\n📋 查询工厂列表...');
    const factories = await prisma.factory.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true
      },
      take: 5
    });
    
    console.log(`✅ 找到 ${factories.length} 个工厂:`);
    factories.forEach((factory, index) => {
      console.log(`  ${index + 1}. ${factory.id} - ${factory.name} (${factory.isActive ? '激活' : '未激活'})`);
    });
    
    // 3. 查询用户数据
    console.log('\n👥 查询用户列表...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        factoryId: true,
        roleCode: true,
        isActive: true
      },
      take: 5
    });
    
    console.log(`✅ 找到 ${users.length} 个用户:`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.factoryId}) - ${user.roleCode} (${user.isActive ? '激活' : '未激活'})`);
    });
    
    // 4. 查询特定用户
    if (factories.length > 0) {
      const factoryId = factories[0].id;
      console.log(`\n🔍 查询工厂 ${factoryId} 的用户...`);
      
      const factoryUsers = await prisma.user.findMany({
        where: { factoryId },
        select: {
          username: true,
          roleCode: true,
          isActive: true
        }
      });
      
      console.log(`✅ 找到 ${factoryUsers.length} 个用户:`);
      factoryUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} - ${user.roleCode} (${user.isActive ? '激活' : '未激活'})`);
      });
    }
    
  } catch (error) {
    console.log('❌ 数据库操作失败:', error.message);
    console.log('📋 错误详情:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n📊 数据库连接已关闭');
  }
};

testDatabase();