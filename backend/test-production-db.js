// 使用原生数据库连接测试
import pg from 'pg';

const { Client } = pg;

const testProductionDB = async () => {
  console.log('🔍 测试生产数据库连接...');
  
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_kfzr1lpLcA8q@ep-holy-bread-aetqpx34-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });
  
  try {
    console.log('📊 连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功');
    
    // 查询工厂表
    console.log('\n📋 查询工厂列表...');
    const factoriesResult = await client.query('SELECT id, name, "isActive" FROM factory LIMIT 5');
    console.log(`✅ 找到 ${factoriesResult.rows.length} 个工厂:`);
    factoriesResult.rows.forEach((factory, index) => {
      console.log(`  ${index + 1}. ${factory.id} - ${factory.name} (${factory.isActive ? '激活' : '未激活'})`);
    });
    
    // 查询用户表
    console.log('\n👥 查询用户列表...');
    const usersResult = await client.query('SELECT id, username, "factoryId", "roleCode", "isActive" FROM "user" LIMIT 5');
    console.log(`✅ 找到 ${usersResult.rows.length} 个用户:`);
    usersResult.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.factoryId}) - ${user.roleCode} (${user.isActive ? '激活' : '未激活'})`);
    });
    
    // 查找 factory_admin 用户
    console.log('\n🔍 查找 factory_admin 用户...');
    const adminResult = await client.query('SELECT * FROM "user" WHERE username = $1', ['factory_admin']);
    console.log(`✅ 找到 ${adminResult.rows.length} 个 factory_admin 用户:`);
    adminResult.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.factoryId}) - ${user.roleCode} - 密码哈希存在: ${!!user.passwordHash}`);
    });
    
  } catch (error) {
    console.log('❌ 数据库操作失败:', error.message);
    console.log('📋 错误码:', error.code);
  } finally {
    await client.end();
    console.log('\n📊 数据库连接已关闭');
  }
};

testProductionDB();