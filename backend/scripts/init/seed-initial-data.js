import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

async function seedInitialData() {
  try {
    console.log('🌱 开始初始化数据库...');

    // 1. 创建平台管理员
    console.log('📝 创建平台管理员...');
    const platformAdmin = await prisma.platformAdmin.upsert({
      where: { username: 'platform_admin' },
      update: {},
      create: {
        username: 'platform_admin',
        passwordHash: await hashPassword('Admin@123456'),
        email: 'platform@logistics.com',
        fullName: '平台管理员',
      },
    });
    console.log(`✅ 平台管理员创建成功: ${platformAdmin.username}`);

    // 2. 创建测试工厂
    console.log('🏭 创建测试工厂...');
    const factory = await prisma.factory.upsert({
      where: { id: 'TEST_2024_001' },
      update: {},
      create: {
        id: 'TEST_2024_001',
        name: '测试食品加工厂',
        industry: 'FOOD_PROCESSING',
        region: 'BEIJING',
        address: '北京市朝阳区测试街道123号',
        contact: '13800138000',
        email: 'test@factory.com',
        isActive: true,
      },
    });
    console.log(`✅ 测试工厂创建成功: ${factory.name}`);

    // 3. 创建工厂超级管理员
    console.log('👤 创建工厂超级管理员...');
    const superAdmin = await prisma.user.upsert({
      where: { 
        factoryId_username: {
          factoryId: 'TEST_2024_001',
          username: 'factory_admin'
        }
      },
      update: {},
      create: {
        factoryId: 'TEST_2024_001',
        username: 'factory_admin',
        passwordHash: await hashPassword('SuperAdmin@123'),
        email: 'admin@testfactory.com',
        phone: '13800138000',
        fullName: '工厂超级管理员',
        isActive: true,
        roleLevel: 1,
        roleCode: 'factory_super_admin',
        department: 'management',
        position: '超级管理员',
        permissions: ['all'],
      },
    });
    console.log(`✅ 工厂超级管理员创建成功: ${superAdmin.username}`);

    // 4. 创建白名单测试数据
    console.log('📋 创建白名单测试数据...');
    const whitelistData = [
      { phone: '13800138001', name: '张三', department: '养殖部门', position: '养殖技术员' },
      { phone: '13800138002', name: '李四', department: '加工部门', position: '质检员' },
      { phone: '13800138003', name: '王五', department: '物流部门', position: '配送员' },
      { phone: '13800138004', name: '赵六', department: '管理部门', position: '主管' },
      { phone: '13800138005', name: '钱七', department: '质检部门', position: '检验员' },
    ];

    for (const item of whitelistData) {
      await prisma.userWhitelist.upsert({
        where: {
          factoryId_phoneNumber: {
            factoryId: 'TEST_2024_001',
            phoneNumber: item.phone
          }
        },
        update: {},
        create: {
          factoryId: 'TEST_2024_001',
          phoneNumber: item.phone,
          invitedBy: superAdmin.id,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
          metadata: {
            name: item.name,
            department: item.department,
            position: item.position
          }
        },
      });
    }
    console.log(`✅ 白名单数据创建成功: ${whitelistData.length} 条记录`);

    // 5. 创建部门测试用户
    console.log('👥 创建部门测试用户...');
    const departmentUsers = [
      { username: 'farming_admin', role: 'department_admin', dept: 'farming', name: '养殖部主管' },
      { username: 'processing_admin', role: 'department_admin', dept: 'processing', name: '加工部主管' },
      { username: 'logistics_admin', role: 'department_admin', dept: 'logistics', name: '物流部主管' },
      { username: 'test_user', role: 'user', dept: 'farming', name: '测试用户' },
    ];

    for (const userData of departmentUsers) {
      await prisma.user.upsert({
        where: {
          factoryId_username: {
            factoryId: 'TEST_2024_001',
            username: userData.username
          }
        },
        update: {},
        create: {
          factoryId: 'TEST_2024_001',
          username: userData.username,
          passwordHash: await hashPassword('Test@123456'),
          email: `${userData.username}@testfactory.com`,
          phone: `1380013${8006 + departmentUsers.indexOf(userData)}`,
          fullName: userData.name,
          isActive: true,
          roleLevel: userData.role === 'department_admin' ? 10 : 50,
          roleCode: userData.role,
          department: userData.dept,
          position: userData.role === 'department_admin' ? '部门主管' : '普通员工',
          permissions: userData.role === 'department_admin' ? ['read', 'write', 'manage_department'] : ['read'],
        },
      });
    }
    console.log(`✅ 部门用户创建成功: ${departmentUsers.length} 个用户`);

    console.log('🎉 数据库初始化完成！');
    console.log('\n📊 创建的账号信息:');
    console.log('平台管理员: platform_admin / Admin@123456');
    console.log('工厂超管: factory_admin / SuperAdmin@123');
    console.log('养殖主管: farming_admin / Test@123456');
    console.log('加工主管: processing_admin / Test@123456');
    console.log('物流主管: logistics_admin / Test@123456');
    console.log('测试用户: test_user / Test@123456');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  seedInitialData()
    .then(() => {
      console.log('✅ 种子数据插入成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 种子数据插入失败:', error);
      process.exit(1);
    });
}

export default seedInitialData;