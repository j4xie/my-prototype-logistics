/**
 * 创建完整的测试数据集
 * 包括多个工厂、用户、角色权限、产品、商家、生产计划等
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           创建完整测试数据集                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ==================== 1. 创建工厂 ====================
  console.log('📍 步骤1: 创建工厂数据...');

  const factories = [
    {
      id: 'TEST_2024_001',
      name: '白垩纪水产加工厂',
      industry: '水产加工',
      address: '江苏省南通市海门区临江新区',
      contactName: '张经理',
      contactPhone: '+8613800138001',
      contactEmail: 'factory1@cretas.com',
    },
    {
      id: 'TEST_2024_002',
      name: '东海渔业加工中心',
      industry: '水产加工',
      address: '浙江省舟山市定海区',
      contactName: '李经理',
      contactPhone: '+8613800138002',
      contactEmail: 'factory2@cretas.com',
    },
  ];

  for (const f of factories) {
    await prisma.factory.upsert({
      where: { id: f.id },
      update: {},
      create: f,
    });
    console.log(`   ✅ ${f.name} (${f.id})`);
  }

  // ==================== 2. 创建用户(多角色) ====================
  console.log('\n👥 步骤2: 创建用户数据(8种角色)...');

  const users = [
    // 工厂1用户
    {
      factoryId: 'TEST_2024_001',
      username: 'super_admin',
      password: 'Admin@123',
      email: 'super@cretas.com',
      fullName: '超级管理员',
      phone: '+8613900000001',
      roleCode: 'factory_super_admin',
      department: 'management',
      description: '工厂超级管理员 - 拥有所有权限',
    },
    {
      factoryId: 'TEST_2024_001',
      username: 'permission_admin',
      password: 'Admin@123',
      email: 'perm@cretas.com',
      fullName: '权限管理员',
      phone: '+8613900000002',
      roleCode: 'permission_admin',
      department: 'management',
      description: '权限管理员 - 管理用户权限',
    },
    {
      factoryId: 'TEST_2024_001',
      username: 'dept_admin',
      password: 'Admin@123',
      email: 'dept@cretas.com',
      fullName: '部门管理员',
      phone: '+8613900000003',
      roleCode: 'department_admin',
      department: 'processing',
      description: '部门管理员 - 管理加工部',
    },
    {
      factoryId: 'TEST_2024_001',
      username: 'operator1',
      password: 'User@123',
      email: 'op1@cretas.com',
      fullName: '操作员-张三',
      phone: '+8613900000004',
      roleCode: 'operator',
      department: 'processing',
      description: '普通操作员 - 加工部',
    },
    {
      factoryId: 'TEST_2024_001',
      username: 'operator2',
      password: 'User@123',
      email: 'op2@cretas.com',
      fullName: '操作员-李四',
      phone: '+8613900000005',
      roleCode: 'operator',
      department: 'logistics',
      description: '普通操作员 - 物流部',
    },
    {
      factoryId: 'TEST_2024_001',
      username: 'viewer1',
      password: 'User@123',
      email: 'view1@cretas.com',
      fullName: '查看员-王五',
      phone: '+8613900000006',
      roleCode: 'viewer',
      department: 'management',
      description: '只读查看员',
    },

    // 工厂2用户
    {
      factoryId: 'TEST_2024_002',
      username: 'factory2_admin',
      password: 'Admin@123',
      email: 'admin2@cretas.com',
      fullName: '工厂2管理员',
      phone: '+8613900000007',
      roleCode: 'factory_super_admin',
      department: 'management',
      description: '工厂2超级管理员',
    },
    {
      factoryId: 'TEST_2024_002',
      username: 'factory2_operator',
      password: 'User@123',
      email: 'op3@cretas.com',
      fullName: '工厂2操作员',
      phone: '+8613900000008',
      roleCode: 'operator',
      department: 'processing',
      description: '工厂2操作员',
    },
  ];

  for (const u of users) {
    const hashedPassword = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: {
        factoryId_username: {
          factoryId: u.factoryId,
          username: u.username,
        },
      },
      update: {},
      create: {
        factoryId: u.factoryId,
        username: u.username,
        passwordHash: hashedPassword,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        roleCode: u.roleCode,
        department: u.department,
        isActive: true,
      },
    });
    console.log(`   ✅ ${u.fullName} (${u.username}) - ${u.roleCode} - ${u.description}`);
  }

  // ==================== 3. 创建产品类型 ====================
  console.log('\n🐟 步骤3: 创建产品类型...');

  const productTypes = [
    // 工厂1产品
    { factoryId: 'TEST_2024_001', name: '鱼片', code: 'YP001', category: '鱼肉制品', description: '新鲜鱼片' },
    { factoryId: 'TEST_2024_001', name: '鱼头', code: 'YT001', category: '鱼肉制品', description: '鱼头' },
    { factoryId: 'TEST_2024_001', name: '鱼骨', code: 'YG001', category: '鱼肉制品', description: '鱼骨' },
    { factoryId: 'TEST_2024_001', name: '鱼排', code: 'YPP001', category: '鱼肉制品', description: '鱼排' },
    { factoryId: 'TEST_2024_001', name: '鱼丸', code: 'YW001', category: '深加工', description: '手工鱼丸' },

    // 工厂2产品
    { factoryId: 'TEST_2024_002', name: '带鱼段', code: 'DY001', category: '鱼肉制品', description: '带鱼段' },
    { factoryId: 'TEST_2024_002', name: '虾仁', code: 'XR001', category: '虾类制品', description: '虾仁' },
  ];

  for (const pt of productTypes) {
    await prisma.productType.upsert({
      where: {
        factoryId_code: {
          factoryId: pt.factoryId,
          code: pt.code,
        },
      },
      update: {},
      create: {
        factoryId: pt.factoryId,
        name: pt.name,
        code: pt.code,
        category: pt.category,
        description: pt.description,
        isActive: true,
      },
    });
    console.log(`   ✅ ${pt.name} (${pt.code}) - ${pt.category}`);
  }

  // ==================== 4. 创建商家 ====================
  console.log('\n🏪 步骤4: 创建商家数据...');

  const merchants = [
    // 工厂1商家
    {
      factoryId: 'TEST_2024_001',
      name: '海鲜批发市场',
      code: 'MER001',
      contactPerson: '陈老板',
      contactPhone: '+8613700000001',
      address: '南通市农副产品批发市场',
    },
    {
      factoryId: 'TEST_2024_001',
      name: '大润发超市',
      code: 'MER002',
      contactPerson: '王采购',
      contactPhone: '+8613700000002',
      address: '南通市港闸区',
    },
    {
      factoryId: 'TEST_2024_001',
      name: '永辉超市',
      code: 'MER003',
      contactPerson: '李经理',
      contactPhone: '+8613700000003',
      address: '南通市崇川区',
    },

    // 工厂2商家
    {
      factoryId: 'TEST_2024_002',
      name: '舟山水产城',
      code: 'MER101',
      contactPerson: '赵总',
      contactPhone: '+8613700000004',
      address: '舟山市定海区',
    },
  ];

  for (const m of merchants) {
    await prisma.merchant.upsert({
      where: {
        factoryId_code: {
          factoryId: m.factoryId,
          code: m.code,
        },
      },
      update: {},
      create: m,
    });
    console.log(`   ✅ ${m.name} (${m.code}) - ${m.contactPerson}`);
  }

  // ==================== 5. 创建原料类型 ====================
  console.log('\n🐠 步骤5: 创建原料类型...');

  const rawMaterialTypes = [
    { factoryId: 'TEST_2024_001', name: '鲈鱼', category: '淡水鱼', unit: 'kg' },
    { factoryId: 'TEST_2024_001', name: '带鱼', category: '海水鱼', unit: 'kg' },
    { factoryId: 'TEST_2024_001', name: '黄花鱼', category: '海水鱼', unit: 'kg' },
    { factoryId: 'TEST_2024_002', name: '对虾', category: '虾类', unit: 'kg' },
  ];

  for (const rm of rawMaterialTypes) {
    await prisma.rawMaterialType.upsert({
      where: {
        factoryId_name: {
          factoryId: rm.factoryId,
          name: rm.name,
        },
      },
      update: {},
      create: rm,
    });
    console.log(`   ✅ ${rm.name} - ${rm.category}`);
  }

  // ==================== 6. 创建转换率配置 ====================
  console.log('\n⚙️  步骤6: 创建转换率配置...');

  const conversions = [
    {
      factoryId: 'TEST_2024_001',
      materialName: '鲈鱼',
      productCode: 'YP001',
      conversionRate: 57,
      wastageRate: 5,
      notes: '鲈鱼→鱼片 (去头去骨)',
    },
    {
      factoryId: 'TEST_2024_001',
      materialName: '鲈鱼',
      productCode: 'YT001',
      conversionRate: 20,
      wastageRate: 2,
      notes: '鲈鱼→鱼头',
    },
    {
      factoryId: 'TEST_2024_001',
      materialName: '带鱼',
      productCode: 'YP001',
      conversionRate: 60,
      wastageRate: 4,
      notes: '带鱼→鱼片',
    },
  ];

  for (const conv of conversions) {
    const material = await prisma.rawMaterialType.findFirst({
      where: { factoryId: conv.factoryId, name: conv.materialName },
    });
    const product = await prisma.productType.findFirst({
      where: { factoryId: conv.factoryId, code: conv.productCode },
    });

    if (material && product) {
      await prisma.materialProductConversion.upsert({
        where: {
          materialTypeId_productTypeId: {
            materialTypeId: material.id,
            productTypeId: product.id,
          },
        },
        update: {},
        create: {
          factoryId: conv.factoryId,
          materialTypeId: material.id,
          productTypeId: product.id,
          conversionRate: conv.conversionRate,
          wastageRate: conv.wastageRate,
          notes: conv.notes,
        },
      });
      console.log(`   ✅ ${conv.notes} - ${conv.conversionRate}% (损耗${conv.wastageRate}%)`);
    }
  }

  // ==================== 7. 创建加工批次(原料库存) ====================
  console.log('\n📦 步骤7: 创建加工批次(原料库存)...');

  const superAdmin = await prisma.user.findFirst({
    where: { factoryId: 'TEST_2024_001', roleCode: 'factory_super_admin' },
  });

  const today = new Date();
  const batches = [
    {
      factoryId: 'TEST_2024_001',
      batchNumber: 'BATCH-20250106-001',
      rawMaterialCategory: '鲈鱼',
      rawMaterialWeight: 500,
      supervisorId: superAdmin?.id || 1,
      startDate: today,
    },
    {
      factoryId: 'TEST_2024_001',
      batchNumber: 'BATCH-20250106-002',
      rawMaterialCategory: '带鱼',
      rawMaterialWeight: 300,
      supervisorId: superAdmin?.id || 1,
      startDate: today,
    },
    {
      factoryId: 'TEST_2024_001',
      batchNumber: 'BATCH-20250106-003',
      rawMaterialCategory: '黄花鱼',
      rawMaterialWeight: 200,
      supervisorId: superAdmin?.id || 1,
      startDate: today,
    },
  ];

  for (const batch of batches) {
    await prisma.processingBatch.create({
      data: batch,
    });
    console.log(`   ✅ ${batch.batchNumber} - ${batch.rawMaterialCategory} ${batch.rawMaterialWeight}kg`);
  }

  // ==================== 8. 创建生产计划 ====================
  console.log('\n📋 步骤8: 创建示例生产计划...');

  const product1 = await prisma.productType.findFirst({
    where: { factoryId: 'TEST_2024_001', code: 'YP001' },
  });
  const merchant1 = await prisma.merchant.findFirst({
    where: { factoryId: 'TEST_2024_001', code: 'MER001' },
  });

  if (product1 && merchant1 && superAdmin) {
    const plans = [
      {
        planNumber: 'PLAN-20250106-001',
        factoryId: 'TEST_2024_001',
        productTypeId: product1.id,
        merchantId: merchant1.id,
        plannedQuantity: 100,
        estimatedMaterialUsage: 184,
        status: 'pending',
        notes: '海鲜批发市场订单 - 鱼片100kg',
        createdBy: superAdmin.id,
      },
      {
        planNumber: 'PLAN-20250106-002',
        factoryId: 'TEST_2024_001',
        productTypeId: product1.id,
        merchantId: merchant1.id,
        plannedQuantity: 50,
        estimatedMaterialUsage: 92,
        status: 'in_progress',
        notes: '加急订单',
        createdBy: superAdmin.id,
      },
    ];

    for (const plan of plans) {
      await prisma.productionPlan.create({
        data: plan,
      });
      console.log(`   ✅ ${plan.planNumber} - ${plan.plannedQuantity}kg (${plan.status})`);
    }
  }

  // ==================== 总结 ====================
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ 完整测试数据创建成功!                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 数据统计:');
  const stats = await Promise.all([
    prisma.factory.count(),
    prisma.user.count(),
    prisma.productType.count(),
    prisma.merchant.count(),
    prisma.rawMaterialType.count(),
    prisma.materialProductConversion.count(),
    prisma.processingBatch.count(),
    prisma.productionPlan.count(),
  ]);

  console.log(`   工厂: ${stats[0]} 个`);
  console.log(`   用户: ${stats[1]} 个`);
  console.log(`   产品类型: ${stats[2]} 个`);
  console.log(`   商家: ${stats[3]} 个`);
  console.log(`   原料类型: ${stats[4]} 个`);
  console.log(`   转换率配置: ${stats[5]} 个`);
  console.log(`   原料批次: ${stats[6]} 个`);
  console.log(`   生产计划: ${stats[7]} 个`);

  console.log('\n👤 测试账号 (工厂1):');
  console.log('┌─────────────────────┬──────────────────┬────────────────────┐');
  console.log('│ 用户名              │ 密码             │ 角色               │');
  console.log('├─────────────────────┼──────────────────┼────────────────────┤');
  console.log('│ super_admin         │ Admin@123        │ 工厂超级管理员     │');
  console.log('│ permission_admin    │ Admin@123        │ 权限管理员         │');
  console.log('│ dept_admin          │ Admin@123        │ 部门管理员         │');
  console.log('│ operator1           │ User@123         │ 操作员(加工部)     │');
  console.log('│ operator2           │ User@123         │ 操作员(物流部)     │');
  console.log('│ viewer1             │ User@123         │ 查看员             │');
  console.log('└─────────────────────┴──────────────────┴────────────────────┘');

  console.log('\n👤 测试账号 (工厂2):');
  console.log('┌─────────────────────┬──────────────────┬────────────────────┐');
  console.log('│ factory2_admin      │ Admin@123        │ 工厂超级管理员     │');
  console.log('│ factory2_operator   │ User@123         │ 操作员             │');
  console.log('└─────────────────────┴──────────────────┴────────────────────┘');

  console.log('\n🏭 工厂信息:');
  console.log('   工厂1: TEST_2024_001 - 白垩纪水产加工厂');
  console.log('   工厂2: TEST_2024_002 - 东海渔业加工中心');

  console.log('\n✨ 现在可以使用这些账号测试系统功能了!\n');
}

main()
  .catch((e) => {
    console.error('\n❌ 创建测试数据失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
