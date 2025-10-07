import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('🌱 开始创建测试用户...\n');

  const password = '123456';
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    // 1. 创建测试工厂（如果不存在）
    const factory = await prisma.factory.upsert({
      where: { factoryId: 'TEST_FACTORY_001' },
      update: {},
      create: {
        factoryId: 'TEST_FACTORY_001',
        name: '测试工厂',
        industryCode: 'FOOD',
        region: 'TEST',
        contactPerson: '测试负责人',
        contactPhone: '13800138000',
        contactEmail: 'test@cretas.com',
        address: '测试地址',
        isActive: true,
      },
    });
    console.log('✅ 测试工厂已创建:', factory.factoryId);

    // 2. 创建平台用户
    console.log('\n📋 创建平台用户...');

    const platformUsers = [
      {
        username: 'admin',
        email: 'admin@cretas.com',
        fullName: '系统管理员',
        role: 'platform_operator',
      },
      {
        username: 'developer',
        email: 'developer@cretas.com',
        fullName: '系统开发者',
        role: 'developer',
      },
      {
        username: 'platform_admin',
        email: 'platform@cretas.com',
        fullName: '平台管理员',
        role: 'platform_operator',
      },
    ];

    for (const userData of platformUsers) {
      const user = await prisma.platformAdmin.upsert({
        where: { username: userData.username },
        update: { passwordHash },
        create: {
          ...userData,
          passwordHash,
          isActive: true,
        },
      });
      console.log(\`  ✅ \${user.username} - \${user.fullName}\`);
    }

    // 3. 创建工厂用户
    console.log('\n📋 创建工厂用户...');

    const factoryUsers = [
      {
        username: 'super_admin',
        email: 'super@test.com',
        phone: '13800138001',
        fullName: '工厂超级管理员',
        roleCode: 'factory_super_admin',
        department: 'management',
        position: '超级管理员',
        permissions: ['admin:read', 'admin:write', 'user:read', 'user:write'],
      },
      {
        username: 'perm_admin',
        email: 'perm@test.com',
        phone: '13800138002',
        fullName: '权限管理员',
        roleCode: 'permission_admin',
        department: 'management',
        position: '权限管理员',
        permissions: ['user:read', 'user:write'],
      },
      {
        username: 'proc_admin',
        email: 'proc@test.com',
        phone: '13800138003',
        fullName: '加工管理员',
        roleCode: 'department_admin',
        department: 'processing',
        position: '加工部门管理员',
        permissions: ['processing:read', 'processing:write'],
      },
      {
        username: 'farm_admin',
        email: 'farm@test.com',
        phone: '13800138004',
        fullName: '养殖管理员',
        roleCode: 'department_admin',
        department: 'farming',
        position: '养殖部门管理员',
        permissions: ['farming:read', 'farming:write'],
      },
      {
        username: 'logi_admin',
        email: 'logi@test.com',
        phone: '13800138005',
        fullName: '物流管理员',
        roleCode: 'department_admin',
        department: 'logistics',
        position: '物流部门管理员',
        permissions: ['logistics:read', 'logistics:write'],
      },
      {
        username: 'proc_user',
        email: 'user@test.com',
        phone: '13800138006',
        fullName: '加工普通员工',
        roleCode: 'operator',
        department: 'processing',
        position: '操作员',
        permissions: ['processing:read'],
      },
    ];

    for (const userData of factoryUsers) {
      const user = await prisma.user.upsert({
        where: {
          factoryId_username: {
            factoryId: factory.factoryId,
            username: userData.username,
          },
        },
        update: { passwordHash },
        create: {
          factoryId: factory.factoryId,
          ...userData,
          passwordHash,
          isActive: true,
        },
      });
      console.log(\`  ✅ \${user.username} - \${user.fullName} (\${user.department})\`);
    }

    console.log('\n✅ 所有测试用户创建成功！');
    console.log('\n📋 登录信息:');
    console.log('   统一密码: 123456');
    console.log('\n   平台用户: admin, developer, platform_admin');
    console.log('   工厂用户: super_admin, perm_admin, proc_admin, farm_admin, logi_admin, proc_user');

  } catch (error) {
    console.error('❌ 创建用户失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
