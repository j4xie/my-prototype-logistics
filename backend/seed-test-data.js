/**
 * 创建生产计划测试所需的基础数据
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建测试数据...\n');

  // 1. 创建测试工厂
  console.log('1. 创建测试工厂...');
  const factory = await prisma.factory.upsert({
    where: { id: 'TEST_2024_001' },
    update: {},
    create: {
      id: 'TEST_2024_001',
      name: '白垩纪测试工厂',
      industry: '水产加工',
      address: '测试地址123号',
      contactName: '测试联系人',
      contactPhone: '+8613800000000',
      isActive: true,
    },
  });
  console.log(`   ✅ 工厂创建成功: ${factory.name} (${factory.id})`);

  // 2. 创建测试用户
  console.log('\n2. 创建测试用户...');
  const hashedPassword = await bcrypt.hash('DeptAdmin@123', 12);

  const user = await prisma.user.upsert({
    where: {
      factoryId_username: {
        factoryId: factory.id,
        username: 'processing_admin',
      },
    },
    update: {},
    create: {
      username: 'processing_admin',
      email: 'processing@test.com',
      fullName: '加工部管理员',
      passwordHash: hashedPassword,
      phone: '+8613800000000',
      factoryId: factory.id,
      roleCode: 'factory_super_admin',
      department: 'processing',
      isActive: true,
    },
  });
  console.log(`   ✅ 用户创建成功: ${user.username} (${user.fullName})`);

  // 3. 创建产品类型
  console.log('\n3. 创建产品类型...');
  const productTypes = [
    { name: '鱼片', code: 'YP001', category: '鱼肉制品' },
    { name: '鱼头', code: 'YT001', category: '鱼肉制品' },
    { name: '鱼骨', code: 'YG001', category: '鱼肉制品' },
  ];

  for (const pt of productTypes) {
    await prisma.productType.upsert({
      where: {
        factoryId_code: {
          factoryId: factory.id,
          code: pt.code,
        },
      },
      update: {},
      create: {
        factoryId: factory.id,
        name: pt.name,
        code: pt.code,
        category: pt.category,
        isActive: true,
      },
    });
    console.log(`   ✅ 产品类型: ${pt.name} (${pt.code})`);
  }

  // 4. 创建商家
  console.log('\n4. 创建商家...');
  const merchants = [
    { name: '海鲜批发市场', code: 'MER001', contactPhone: '+8613900000001' },
    { name: '水产品超市', code: 'MER002', contactPhone: '+8613900000002' },
  ];

  for (const m of merchants) {
    await prisma.merchant.upsert({
      where: {
        factoryId_code: {
          factoryId: factory.id,
          code: m.code,
        },
      },
      update: {},
      create: {
        factoryId: factory.id,
        name: m.name,
        code: m.code,
        contactPhone: m.contactPhone,
        isActive: true,
      },
    });
    console.log(`   ✅ 商家: ${m.name} (${m.code})`);
  }

  // 原料类型和转换率由其他模块管理,这里跳过

  console.log('\n✅ 测试数据创建完成!');
  console.log('\n测试账号信息:');
  console.log('  用户名: processing_admin');
  console.log('  密码: DeptAdmin@123');
  console.log('  工厂ID: TEST_2024_001');
}

main()
  .catch((e) => {
    console.error('❌ 创建测试数据失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
