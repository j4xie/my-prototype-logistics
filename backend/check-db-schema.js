import pg from 'pg';

const { Client } = pg;

const checkDatabaseSchema = async () => {
  console.log('🔍 检查数据库架构...');

  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_kfzr1lpLcA8q@ep-holy-bread-aetqpx34-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    query_timeout: 10000
  });

  try {
    console.log('📊 连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功');

    // 查询所有表
    console.log('\n📋 查询数据库表结构...');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✅ 找到 ${tablesResult.rows.length} 个表:`);
    tablesResult.rows.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });

    // 检查关键表是否存在
    const keyTables = ['factory', 'user', 'user_whitelist'];
    const existingTables = tablesResult.rows.map(row => row.table_name);

    console.log('\n🔍 检查关键表:');
    keyTables.forEach(tableName => {
      const exists = existingTables.includes(tableName);
      console.log(`  ${tableName}: ${exists ? '✅ 存在' : '❌ 不存在'}`);
    });

    // 如果表存在，检查数据
    if (existingTables.includes('factory')) {
      console.log('\n📊 检查工厂数据...');
      const factoryCount = await client.query('SELECT COUNT(*) as count FROM factory');
      console.log(`工厂数量: ${factoryCount.rows[0].count}`);

      if (factoryCount.rows[0].count > 0) {
        const factories = await client.query('SELECT id, name, "isActive" FROM factory LIMIT 3');
        factories.rows.forEach((factory, index) => {
          console.log(`  ${index + 1}. ${factory.id} - ${factory.name} (${factory.isActive ? '激活' : '未激活'})`);
        });
      }
    }

    if (existingTables.includes('user')) {
      console.log('\n👥 检查用户数据...');
      const userCount = await client.query('SELECT COUNT(*) as count FROM "user"');
      console.log(`用户数量: ${userCount.rows[0].count}`);

      if (userCount.rows[0].count > 0) {
        const users = await client.query('SELECT username, "factoryId", "roleCode" FROM "user" LIMIT 3');
        users.rows.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.username} (${user.factoryId}) - ${user.roleCode}`);
        });
      }
    }

  } catch (error) {
    console.log('❌ 数据库操作失败:', error.message);
    console.log('📋 错误详情:', {
      code: error.code,
      severity: error.severity,
      detail: error.detail
    });

    if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 解决建议:');
      console.log('1. 检查 Neon 数据库是否处于休眠状态');
      console.log('2. 在 Neon 控制台手动唤醒数据库');
      console.log('3. 检查连接字符串是否正确');
    }

  } finally {
    try {
      await client.end();
      console.log('\n📊 数据库连接已关闭');
    } catch (e) {
      console.log('连接关闭时出错:', e.message);
    }
  }
};

checkDatabaseSchema();
