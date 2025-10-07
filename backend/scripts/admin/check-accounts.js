import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getAllAccounts() {
  try {
    console.log('='.repeat(80));
    console.log('📊 系统账号及权限完整列表');
    console.log('='.repeat(80));

    // 1. 查询所有工厂用户
    console.log('\n🏭 工厂用户 (Factory Users):');
    console.log('-'.repeat(80));
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        factoryId: true,
        roleCode: true,
        department: true,
        isActive: true,
        factory: { select: { name: true } }
      },
      orderBy: { id: 'asc' }
    });

    users.forEach((user, index) => {
      console.log(`\n[${index + 1}] 用户名: ${user.username}`);
      console.log(`    邮箱: ${user.email}`);
      console.log(`    姓名: ${user.fullName || '未设置'}`);
      console.log(`    工厂: ${user.factory?.name || '无'} (ID: ${user.factoryId})`);
      console.log(`    角色: ${user.roleCode}`);
      console.log(`    部门: ${user.department || '未设置'}`);
      console.log(`    状态: ${user.isActive ? '✅ 已激活' : '❌ 未激活'}`);
    });

    // 2. 查询所有平台管理员
    console.log('\n\n🌐 平台管理员 (Platform Admins):');
    console.log('-'.repeat(80));
    const platformAdmins = await prisma.platformAdmin.findMany({
      select: {
        id: true, username: true, email: true, 
        fullName: true, role: true, phone: true
      },
      orderBy: { id: 'asc' }
    });

    platformAdmins.forEach((admin, index) => {
      console.log(`\n[${index + 1}] 用户名: ${admin.username}`);
      console.log(`    邮箱: ${admin.email}`);
      console.log(`    姓名: ${admin.fullName || '未设置'}`);
      console.log(`    角色: ${admin.role}`);
      console.log(`    电话: ${admin.phone || '未设置'}`);
    });

    // 3. 角色权限说明
    console.log('\n\n📋 角色权限说明:');
    console.log('-'.repeat(80));
    
    const roles = [
      { code: 'developer', name: '系统开发者', level: 0, perms: '所有系统权限、开发工具、调试功能' },
      { code: 'platform_super_admin', name: '平台超级管理员', level: 0, perms: '管理所有工厂、用户管理、系统配置' },
      { code: 'platform_operator', name: '平台运营', level: 1, perms: '查看所有工厂、基本运营功能' },
      { code: 'factory_super_admin', name: '工厂超级管理员', level: 0, perms: '工厂所有权限、用户管理、部门管理、全部业务模块' },
      { code: 'permission_admin', name: '权限管理员', level: 1, perms: '用户权限管理、角色分配、查看所有数据' },
      { code: 'department_admin', name: '部门管理员', level: 2, perms: '部门数据管理、部门用户管理、部门业务功能' },
      { code: 'operator', name: '操作员', level: 3, perms: '基本业务操作、数据录入、查看本人数据' },
      { code: 'viewer', name: '查看者', level: 4, perms: '只读访问、查看授权数据' },
      { code: 'unactivated', name: '未激活', level: 99, perms: '无权限，需要激活' }
    ];

    roles.forEach(r => {
      console.log(`\n• ${r.code}:`);
      console.log(`  名称: ${r.name} (级别: ${r.level})`);
      console.log(`  权限: ${r.perms}`);
    });

    // 4. 统计
    console.log('\n\n📈 统计信息:');
    console.log('-'.repeat(80));
    console.log(`工厂用户总数: ${users.length}`);
    console.log(`平台管理员总数: ${platformAdmins.length}`);
    console.log(`已激活: ${users.filter(u => u.isActive).length} | 未激活: ${users.filter(u => !u.isActive).length}`);

    const roleGroups = {};
    users.forEach(u => { roleGroups[u.roleCode] = (roleGroups[u.roleCode] || 0) + 1; });
    
    console.log('\n按角色分布:');
    Object.entries(roleGroups).forEach(([role, count]) => {
      console.log(`  ${role}: ${count} 个用户`);
    });

    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getAllAccounts();
