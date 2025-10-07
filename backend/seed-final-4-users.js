/**
 * 创建最终4个核心账号
 * 1. 平台管理员
 * 2. 超级工厂管理员
 * 3. 加工部门管理员
 * 4. 加工部门员工
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           创建最终4个核心账号                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 清空数据库
  console.log('🧹 清空现有数据...');
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0;`;

  const tables = [
    'shipment_records',
    'material_consumptions',
    'production_plans',
    'material_product_conversions',
    'raw_material_types',
    'product_types',
    'merchants',
    'processing_batches',
    'sessions',
    'users',
    'factories',
    'platform_admins',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table};`);
    } catch (e) {
      // 忽略不存在的表
    }
  }

  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1;`;
  console.log('   ✅ 数据库已清空\n');

  const password = '123456';
  const hashedPassword = await bcrypt.hash(password, 12);

  // 1. 创建平台管理员
  console.log('👤 步骤1: 创建平台管理员...');
  const platformAdmin = await prisma.platformAdmin.create({
    data: {
      username: 'platform_admin',
      passwordHash: hashedPassword,
      email: 'platform@cretas.com',
      fullName: '平台管理员',
      role: 'platform_admin',
    },
  });
  console.log(`   ✅ ${platformAdmin.username} - ${platformAdmin.fullName}\n`);

  // 2. 创建工厂
  console.log('🏭 步骤2: 创建测试工厂...');
  const factory = await prisma.factory.create({
    data: {
      id: 'CRETAS_2024_001',
      name: '白垩纪水产加工厂',
      industry: '水产加工',
      address: '江苏省南通市海门区临江新区',
      contactName: '张经理',
      contactPhone: '+8613800138001',
      contactEmail: 'factory@cretas.com',
      isActive: true,
    },
  });
  console.log(`   ✅ ${factory.name} (${factory.id})\n`);

  // 3. 创建工厂用户
  console.log('👥 步骤3: 创建工厂用户...');

  const users = [
    {
      username: 'super_admin',
      fullName: '超级工厂管理员',
      email: 'super@cretas.com',
      phone: '+8613900000001',
      roleCode: 'factory_super_admin',
      department: 'management',
      description: '拥有工厂所有权限',
    },
    {
      username: 'dept_admin',
      fullName: '加工部门管理员',
      email: 'dept@cretas.com',
      phone: '+8613900000002',
      roleCode: 'department_admin',
      department: 'processing',
      description: '管理加工部',
    },
    {
      username: 'operator1',
      fullName: '加工部员工-张三',
      email: 'operator@cretas.com',
      phone: '+8613900000003',
      roleCode: 'operator',
      department: 'processing',
      description: '加工部普通员工',
    },
  ];

  for (const u of users) {
    await prisma.user.create({
      data: {
        factoryId: factory.id,
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
    console.log(`   ✅ ${u.username} - ${u.fullName} (${u.description})`);
  }

  // 4. 创建产品类型
  console.log('\n🐟 步骤4: 创建产品类型...');
  const products = [
    { code: 'YP001', name: '鱼片', category: '鱼肉制品' },
    { code: 'YT001', name: '鱼头', category: '鱼肉制品' },
    { code: 'YG001', name: '鱼骨', category: '鱼副产品' },
  ];

  for (const p of products) {
    await prisma.productType.create({
      data: {
        factoryId: factory.id,
        code: p.code,
        name: p.name,
        category: p.category,
        isActive: true,
      },
    });
    console.log(`   ✅ ${p.name} (${p.code})`);
  }

  // 5. 创建商家
  console.log('\n🏪 步骤5: 创建商家...');
  const merchants = [
    { code: 'MER001', name: '海鲜批发市场', contactPerson: '陈老板', phone: '+8613700000001' },
    { code: 'MER002', name: '大润发超市', contactPerson: '王采购', phone: '+8613700000002' },
  ];

  for (const m of merchants) {
    await prisma.merchant.create({
      data: {
        factoryId: factory.id,
        code: m.code,
        name: m.name,
        contactPerson: m.contactPerson,
        contactPhone: m.phone,
        isActive: true,
      },
    });
    console.log(`   ✅ ${m.name} (${m.code}) - ${m.contactPerson}`);
  }

  // 6. 创建原料类型
  console.log('\n🐠 步骤6: 创建原料类型...');
  const materials = [
    { name: '鲈鱼', category: '淡水鱼', unit: 'kg' },
    { name: '带鱼', category: '海水鱼', unit: 'kg' },
  ];

  const createdMaterials = [];
  for (const m of materials) {
    const material = await prisma.rawMaterialType.create({
      data: {
        factoryId: factory.id,
        name: m.name,
        category: m.category,
        unit: m.unit,
        isActive: true,
      },
    });
    createdMaterials.push(material);
    console.log(`   ✅ ${m.name} - ${m.category}`);
  }

  // 7. 创建转换率
  console.log('\n⚙️  步骤7: 创建转换率配置...');
  const productYP = await prisma.productType.findFirst({
    where: { factoryId: factory.id, code: 'YP001' },
  });

  if (productYP && createdMaterials[0]) {
    await prisma.materialProductConversion.create({
      data: {
        factoryId: factory.id,
        materialTypeId: createdMaterials[0].id,
        productTypeId: productYP.id,
        conversionRate: 57,
        wastageRate: 5,
        notes: '鲈鱼→鱼片转换率',
      },
    });
    console.log(`   ✅ 鲈鱼→鱼片 (57%, 损耗5%)`);
  }

  // 8. 创建原料批次
  console.log('\n📦 步骤8: 创建原料库存...');
  const superAdmin = await prisma.user.findFirst({
    where: { username: 'super_admin' },
  });

  const batches = [
    { number: 'BATCH-20250106-001', category: '鲈鱼', weight: 500 },
    { number: 'BATCH-20250106-002', category: '带鱼', weight: 300 },
  ];

  for (const b of batches) {
    await prisma.processingBatch.create({
      data: {
        factoryId: factory.id,
        batchNumber: b.number,
        rawMaterialCategory: b.category,
        rawMaterialWeight: b.weight,
        supervisorId: superAdmin?.id,
        startDate: new Date(),
      },
    });
    console.log(`   ✅ ${b.number} - ${b.category} ${b.weight}kg`);
  }

  // 9. 显示最终清单
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ 系统初始化完成!                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 最终数据统计:');
  const stats = await Promise.all([
    prisma.platformAdmin.count(),
    prisma.factory.count(),
    prisma.user.count(),
    prisma.productType.count(),
    prisma.merchant.count(),
    prisma.rawMaterialType.count(),
    prisma.materialProductConversion.count(),
    prisma.processingBatch.count(),
  ]);

  console.log(`   平台管理员: ${stats[0]} 个`);
  console.log(`   工厂: ${stats[1]} 个`);
  console.log(`   工厂用户: ${stats[2]} 个`);
  console.log(`   产品类型: ${stats[3]} 个`);
  console.log(`   商家: ${stats[4]} 个`);
  console.log(`   原料类型: ${stats[5]} 个`);
  console.log(`   转换率: ${stats[6]} 个`);
  console.log(`   原料库存: ${stats[7]} 个 (800kg)`);

  console.log('\n🔐 最终账号清单 (统一密码: 123456):\n');

  console.log('┌────────────────┬──────────┬──────────────────┬──────────┐');
  console.log('│ 用户名         │ 密码     │ 角色             │ 类型     │');
  console.log('├────────────────┼──────────┼──────────────────┼──────────┤');
  console.log('│ platform_admin │ 123456   │ 平台管理员       │ 平台     │');
  console.log('│ super_admin    │ 123456   │ 超级工厂管理员   │ 工厂1    │');
  console.log('│ dept_admin     │ 123456   │ 加工部门管理员   │ 工厂1    │');
  console.log('│ operator1      │ 123456   │ 加工部门员工     │ 工厂1    │');
  console.log('└────────────────┴──────────┴──────────────────┴──────────┘\n');

  console.log('🏭 工厂信息:');
  console.log(`   ID: ${factory.id}`);
  console.log(`   名称: ${factory.name}`);
  console.log(`   地址: ${factory.address}\n`);

  console.log('✨ 系统已准备就绪,可以开始测试!\n');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
