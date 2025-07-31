import pg from 'pg';
import { hashPassword } from './src/utils/password.js';

const { Client } = pg;

const initProductionDB = async () => {
  console.log('🚀 初始化生产数据库...');

  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_kfzr1lpLcA8q@ep-holy-bread-aetqpx34-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
    connectionTimeoutMillis: 30000, // 30秒超时
    idleTimeoutMillis: 30000,
    query_timeout: 30000
  });

  try {
    console.log('📊 连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功');

    // 1. 创建表结构
    console.log('\n🏗️ 创建表结构...');

    // 创建工厂表
    console.log('创建 factory 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS factory (
        id TEXT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(100),
        "contactEmail" VARCHAR(255),
        "contactPhone" VARCHAR(50),
        address TEXT,
        description TEXT,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "industryCode" VARCHAR(10),
        "regionCode" VARCHAR(10),
        "factoryYear" INTEGER,
        "sequenceNumber" INTEGER,
        "legacyId" VARCHAR(50),
        "inferenceData" JSONB,
        confidence DECIMAL,
        "manuallyVerified" BOOLEAN DEFAULT false
      )
    `);

    // 创建用户表
    console.log('创建 user 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "factoryId" TEXT NOT NULL REFERENCES factory(id),
        username VARCHAR(100) NOT NULL,
        "passwordHash" TEXT NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        "fullName" VARCHAR(255),
        "isActive" BOOLEAN DEFAULT true,
        "roleCode" VARCHAR(50) DEFAULT 'user',
        "roleLevel" INTEGER DEFAULT 99,
        department VARCHAR(100),
        position VARCHAR(100),
        permissions JSONB DEFAULT '[]'::jsonb,
        "lastLogin" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("factoryId", username),
        UNIQUE("factoryId", email)
      )
    `);

    // 创建白名单表
    console.log('创建 user_whitelist 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_whitelist (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "factoryId" TEXT NOT NULL REFERENCES factory(id),
        "phoneNumber" VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        "expiresAt" TIMESTAMP,
        "invitedBy" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("factoryId", "phoneNumber")
      )
    `);

    console.log('✅ 表结构创建完成');

    // 2. 插入测试数据
    console.log('\n📊 插入测试数据...');

    // 插入工厂数据
    const factoryId = 'FCT_2025_001';
    const factoryExists = await client.query('SELECT id FROM factory WHERE id = $1', [factoryId]);

    if (factoryExists.rows.length === 0) {
      await client.query(`
        INSERT INTO factory (
          id, name, industry, "contactEmail", "contactPhone",
          address, description, "isActive"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `, [
        factoryId,
        '黑牛演示工厂',
        '食品加工',
        'admin@heiniu.com',
        '021-12345678',
        '上海市浦东新区张江高科技园区',
        '专业的食品溯源管理工厂',
        true
      ]);
      console.log('✅ 工厂数据插入成功');
    } else {
      console.log('ℹ️ 工厂数据已存在');
    }

    // 插入用户数据
    const users = [
      {
        username: 'factory_admin',
        password: 'SuperAdmin@123',
        roleCode: 'factory_super_admin',
        fullName: '工厂超级管理员',
        email: 'admin@heiniu.com'
      },
      {
        username: 'developer',
        password: 'Developer@123',
        roleCode: 'developer',
        fullName: '系统开发者',
        email: 'dev@heiniu.com'
      }
    ];

    for (const userData of users) {
      const userExists = await client.query(
        'SELECT id FROM "user" WHERE "factoryId" = $1 AND username = $2',
        [factoryId, userData.username]
      );

      if (userExists.rows.length === 0) {
        const passwordHash = await hashPassword(userData.password);

        await client.query(`
          INSERT INTO "user" (
            "factoryId", username, "passwordHash", "fullName",
            email, "isActive", "roleCode", "roleLevel"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          )
        `, [
          factoryId,
          userData.username,
          passwordHash,
          userData.fullName,
          userData.email,
          true,
          userData.roleCode,
          userData.roleCode === 'developer' ? -1 : 0
        ]);

        console.log(`✅ 用户 ${userData.username} 创建成功`);
      } else {
        console.log(`ℹ️ 用户 ${userData.username} 已存在`);
      }
    }

    // 3. 验证数据
    console.log('\n🔍 验证数据...');
    const factoryCount = await client.query('SELECT COUNT(*) as count FROM factory');
    const userCount = await client.query('SELECT COUNT(*) as count FROM "user"');

    console.log(`工厂数量: ${factoryCount.rows[0].count}`);
    console.log(`用户数量: ${userCount.rows[0].count}`);

    console.log('\n🎉 生产数据库初始化完成！');
    console.log('可用的测试账户:');
    console.log('1. factory_admin / SuperAdmin@123 (工厂管理员)');
    console.log('2. developer / Developer@123 (系统开发者)');
    console.log('工厂ID: FCT_2025_001');

  } catch (error) {
    console.log('❌ 数据库初始化失败:', error.message);

    if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Neon数据库可能处于休眠状态');
      console.log('解决方案:');
      console.log('1. 登录 https://console.neon.tech');
      console.log('2. 访问您的项目以唤醒数据库');
      console.log('3. 重新运行此脚本');
    } else {
      console.log('错误详情:', error);
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

initProductionDB();
