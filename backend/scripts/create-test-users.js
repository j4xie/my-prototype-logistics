/**
 * 创建完整的测试用户数据
 * 支持集成测试所需的所有角色用户
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('🔄 开始创建测试用户数据...');

  const testFactory = await prisma.factory.findFirst({
    where: { id: 'TEST_2024_001' }
  });

  if (!testFactory) {
    throw new Error('测试工厂 TEST_2024_001 不存在，请先创建工厂');
  }

  const testUsers = [
    {
      username: 'process_op001',
      password: 'Process@123456',
      email: 'process_op001@heiniu.com',
      phone: '+86138000000004',
      fullName: '加工操作员01',
      roleCode: 'operator',
      factoryId: testFactory.id,
      department: 'processing',
      position: '加工操作员',
      description: '集成测试 - 加工操作员'
    },
    {
      username: 'viewer_001',
      password: 'Viewer@123456',
      email: 'viewer_001@heiniu.com',
      phone: '+86138000000005',
      fullName: '查看者01',
      roleCode: 'viewer',
      factoryId: testFactory.id,
      department: 'quality',
      position: '质量查看员',
      description: '集成测试 - 查看者角色'
    },
    {
      username: 'dept_admin001',
      password: 'DeptAdmin@123456',
      email: 'dept_admin001@heiniu.com',
      phone: '+86138000000006',
      fullName: '部门管理员01',
      roleCode: 'department_admin',
      factoryId: testFactory.id,
      department: 'management',
      position: '部门管理员',
      description: '集成测试 - 部门管理员'
    },
    {
      username: 'perm_admin001',
      password: 'PermAdmin@123456',
      email: 'perm_admin001@heiniu.com',
      phone: '+86138000000007',
      fullName: '权限管理员01',
      roleCode: 'permission_admin',
      factoryId: testFactory.id,
      department: 'management',
      position: '权限管理员',
      description: '集成测试 - 权限管理员'
    },
    {
      username: 'test_unactivated',
      password: 'Unactivated@123456',
      email: 'test_unactivated@heiniu.com',
      phone: '+86138000000008',
      fullName: '未激活用户',
      roleCode: 'unactivated',
      factoryId: testFactory.id,
      department: 'management',
      position: '待激活用户',
      isActive: false,
      description: '集成测试 - 未激活用户'
    }
  ];

  try {
    for (const userData of testUsers) {
      // 检查用户是否已存在
      const existing = await prisma.user.findFirst({
        where: { 
          OR: [
            { username: userData.username },
            { email: userData.email },
            { phone: userData.phone }
          ]
        }
      });

      if (existing) {
        console.log(`⚠️  用户 ${userData.username} 已存在，跳过`);
        continue;
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // 创建用户
      const newUser = await prisma.user.create({
        data: {
          username: userData.username,
          passwordHash: hashedPassword,
          email: userData.email,
          phone: userData.phone,
          fullName: userData.fullName,
          roleCode: userData.roleCode,
          factoryId: userData.factoryId,
          department: userData.department,
          position: userData.position,
          isActive: userData.isActive !== false // 默认激活
        }
      });

      console.log(`✅ 已创建用户: ${userData.username} (${userData.fullName}) - ${userData.roleCode}`);

      // 记录角色历史
      await prisma.userRoleHistory.create({
        data: {
          userId: newUser.id,
          factoryId: userData.factoryId,
          oldRoleCode: null,
          newRoleCode: userData.roleCode,
          changedBy: 1, // platform_admin
          changedByType: 'platform_admin',
          reason: '集成测试用户初始创建'
        }
      });
    }

    console.log('\\n🎉 测试用户创建完成！');
    
    // 显示当前用户统计
    const userStats = await prisma.user.groupBy({
      by: ['roleCode'],
      where: { factoryId: testFactory.id },
      _count: true
    });
    
    console.log('📊 当前工厂用户统计:');
    userStats.forEach(stat => {
      console.log(`  ${stat.roleCode}: ${stat._count} 个用户`);
    });

  } catch (error) {
    console.error('❌ 创建测试用户失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestUsers().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

export default createTestUsers;