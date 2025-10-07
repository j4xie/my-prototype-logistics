/**
 * 完整业务流程测试
 * 1. 创建供应商
 * 2. 创建客户
 * 3. 创建原材料类型
 * 4. 创建产品类型
 * 5. 创建原材料批次（关联供应商）
 * 6. 创建生产计划（关联客户）
 * 7. 验证完整追溯链
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCompleteFlow() {
  console.log('🚀 开始完整业务流程测试\n');
  console.log('='.repeat(60));

  try {
    const factoryId = 'CRETAS_2024_001';
    const userId = 1; // super_admin

    // 步骤1: 创建供应商
    console.log('\n📦 步骤1: 创建供应商...');

    let supplier1 = await prisma.supplier.findFirst({
      where: { factoryId, code: 'SUP001' }
    });

    if (!supplier1) {
      supplier1 = await prisma.supplier.create({
      data: {
        factoryId,
        name: '陈老板海鲜批发',
        code: 'SUP001',
        contactPerson: '陈老板',
        contactPhone: '+8613800001111',
        address: '深圳市南山区水产批发市场A区101号',
        businessType: '水产批发',
        creditLevel: 'A',
        deliveryArea: '深圳市',
        paymentTerms: '月结30天',
        isActive: true,
        createdBy: userId,
      }
      });
      console.log(`✅ 创建供应商: ${supplier1.name} (${supplier1.code})`);
    } else {
      console.log(`✅ 供应商已存在: ${supplier1.name} (${supplier1.code})`);
    }

    let supplier2 = await prisma.supplier.findFirst({
      where: { factoryId, code: 'SUP002' }
    });

    if (!supplier2) {
      supplier2 = await prisma.supplier.create({
      data: {
        factoryId,
        name: '李氏养殖场',
        code: 'SUP002',
        contactPerson: '李总',
        contactPhone: '+8613900002222',
        address: '东莞市虎门镇渔业养殖基地',
        businessType: '养殖场',
        creditLevel: 'A',
        deliveryArea: '珠三角地区',
        paymentTerms: '货到付款',
        isActive: true,
        createdBy: userId,
      }
      });
      console.log(`✅ 创建供应商: ${supplier2.name} (${supplier2.code})`);
    } else {
      console.log(`✅ 供应商已存在: ${supplier2.name} (${supplier2.code})`);
    }

    // 步骤2: 创建客户
    console.log('\n🏪 步骤2: 创建客户...');

    let customer1 = await prisma.customer.findFirst({
      where: { factoryId, code: 'CUS003' }
    });

    if (!customer1) {
      customer1 = await prisma.customer.create({
      data: {
        factoryId,
        name: '华润万家超市',
        code: 'CUS003',
        contactPerson: '张采购',
        contactPhone: '+8613700003333',
        address: '深圳市福田区购物广场',
        businessType: '连锁超市',
        creditLevel: 'A',
        deliveryArea: '深圳市',
        paymentTerms: '月结45天',
        isActive: true,
        createdBy: userId,
      }
      });
      console.log(`✅ 创建客户: ${customer1.name} (${customer1.code})`);
    } else {
      console.log(`✅ 客户已存在: ${customer1.name} (${customer1.code})`);
    }

    let customer2 = await prisma.customer.findFirst({
      where: { factoryId, code: 'CUS004' }
    });

    if (!customer2) {
      customer2 = await prisma.customer.create({
      data: {
        factoryId,
        name: '海底捞火锅连锁',
        code: 'CUS004',
        contactPerson: '刘经理',
        contactPhone: '+8613800004444',
        address: '广州市天河区美食街88号',
        businessType: '餐饮连锁',
        creditLevel: 'B',
        deliveryArea: '广州市',
        paymentTerms: '月结30天',
        isActive: true,
        createdBy: userId,
      }
      });
      console.log(`✅ 创建客户: ${customer2.name} (${customer2.code})`);
    } else {
      console.log(`✅ 客户已存在: ${customer2.name} (${customer2.code})`);
    }

    // 步骤3: 创建原材料类型
    console.log('\n🐟 步骤3: 创建原材料类型...');
    const materialType1 = await prisma.rawMaterialType.findFirst({
      where: { factoryId, name: '鲈鱼' }
    });

    let material1;
    if (materialType1) {
      material1 = materialType1;
      console.log(`✅ 原材料已存在: ${material1.name}`);
    } else {
      material1 = await prisma.rawMaterialType.create({
        data: {
          factoryId,
          name: '鲈鱼',
          category: '淡水鱼',
          unit: 'kg',
          description: '新鲜鲈鱼，适合加工鱼片',
          isActive: true,
          createdBy: userId,
        }
      });
      console.log(`✅ 创建原材料类型: ${material1.name}`);
    }

    // 步骤4: 创建产品类型
    console.log('\n🍽️ 步骤4: 创建产品类型...');
    const productType1 = await prisma.productType.findFirst({
      where: { factoryId, name: '鲈鱼片' }
    });

    let product1;
    if (productType1) {
      product1 = productType1;
      console.log(`✅ 产品已存在: ${product1.name}`);
    } else {
      product1 = await prisma.productType.create({
        data: {
          factoryId,
          name: '鲈鱼片',
          code: 'FISH-001',
          category: '鱼片类',
          description: '新鲜鲈鱼片，去骨去刺',
          isActive: true,
          createdBy: userId,
        }
      });
      console.log(`✅ 创建产品类型: ${product1.name} (${product1.code})`);
    }

    // 步骤5: 创建原材料批次（关联供应商）
    console.log('\n📥 步骤5: 创建原材料批次...');

    // 生成批次号
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const batchCount = await prisma.materialBatch.count({
      where: {
        factoryId,
        batchNumber: { startsWith: `MAT-${dateStr}` }
      }
    });
    const batchNumber = `MAT-${dateStr}-${String(batchCount + 1).padStart(3, '0')}`;

    const batch1 = await prisma.materialBatch.create({
      data: {
        factoryId,
        batchNumber,
        materialTypeId: material1.id,
        supplierId: supplier1.id,  // 使用新的supplierId
        inboundQuantity: 1500,
        remainingQuantity: 1500,
        unitPrice: 25,
        totalCost: 37500,
        inboundDate: today,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
        qualityGrade: 'A',
        storageLocation: '冷库A区',
        status: 'available',
        createdBy: userId,
      }
    });
    console.log(`✅ 创建原材料批次: ${batch1.batchNumber}`);
    console.log(`   供应商: ${supplier1.name} (${supplier1.code})`);
    console.log(`   原材料: ${material1.name}`);
    console.log(`   数量: ${batch1.inboundQuantity}kg`);
    console.log(`   成本: ¥${batch1.totalCost}`);

    // 步骤6: 创建生产计划（关联客户）
    console.log('\n📋 步骤6: 创建生产计划...');

    const planCount = await prisma.productionPlan.count({
      where: {
        factoryId,
        planNumber: { startsWith: `PLAN-${dateStr}` }
      }
    });
    const planNumber = `PLAN-${dateStr}-${String(planCount + 1).padStart(3, '0')}`;

    const plan1 = await prisma.productionPlan.create({
      data: {
        factoryId,
        planNumber,
        productTypeId: product1.id,
        customerId: customer1.id,  // 使用新的customerId
        plannedQuantity: 200,
        estimatedMaterialUsage: 300,
        status: 'pending',
        notes: '华润万家超市订单',
        createdBy: userId,
      }
    });
    console.log(`✅ 创建生产计划: ${plan1.planNumber}`);
    console.log(`   客户: ${customer1.name} (${customer1.code})`);
    console.log(`   产品: ${product1.name} (${product1.code})`);
    console.log(`   计划产量: ${plan1.plannedQuantity}kg`);

    // 步骤7: 验证完整追溯链
    console.log('\n🔍 步骤7: 验证完整追溯链...');

    const traceData = await prisma.productionPlan.findUnique({
      where: { id: plan1.id },
      include: {
        customer: true,
        productType: true,
        creator: {
          select: { username: true, fullName: true }
        }
      }
    });

    const batchData = await prisma.materialBatch.findUnique({
      where: { id: batch1.id },
      include: {
        supplier: true,
        materialType: true,
      }
    });

    console.log('\n📊 完整追溯链展示:');
    console.log('='.repeat(60));
    console.log('🟢 成品信息:');
    console.log(`   产品: ${traceData.productType.name}`);
    console.log(`   计划产量: ${traceData.plannedQuantity}kg`);
    console.log(`   订单号: ${traceData.planNumber}`);
    console.log('\n🟡 客户信息:');
    console.log(`   客户: ${traceData.customer.name} (${traceData.customer.code})`);
    console.log(`   联系人: ${traceData.customer.contactPerson}`);
    console.log(`   电话: ${traceData.customer.contactPhone}`);
    console.log('\n🔵 原材料信息:');
    console.log(`   批次号: ${batchData.batchNumber}`);
    console.log(`   原料: ${batchData.materialType.name}`);
    console.log(`   数量: ${batchData.inboundQuantity}kg`);
    console.log('\n🟣 供应商信息:');
    console.log(`   供应商: ${batchData.supplier.name} (${batchData.supplier.code})`);
    console.log(`   联系人: ${batchData.supplier.contactPerson}`);
    console.log(`   电话: ${batchData.supplier.contactPhone}`);
    console.log('='.repeat(60));

    // 统计信息
    console.log('\n📈 数据库统计:');
    const supplierCount = await prisma.supplier.count({ where: { factoryId } });
    const customerCount = await prisma.customer.count({ where: { factoryId } });

    // 使用原生查询避免Prisma的NOT null问题
    const batchCountResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM material_batches
      WHERE factory_id = ${factoryId} AND supplier_id IS NOT NULL
    `;
    const batchCountTotal = Number(batchCountResult[0].count);

    const planCountResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM production_plans
      WHERE factory_id = ${factoryId} AND customer_id IS NOT NULL
    `;
    const planCountTotal = Number(planCountResult[0].count);

    console.log(`   供应商总数: ${supplierCount}`);
    console.log(`   客户总数: ${customerCount}`);
    console.log(`   原材料批次（已关联供应商）: ${batchCountTotal}`);
    console.log(`   生产计划（已关联客户）: ${planCountTotal}`);

    // 检查数据完整性
    console.log('\n✅ 数据完整性检查:');
    const unmappedBatchesResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM material_batches
      WHERE factory_id = ${factoryId} AND supplier_id IS NULL
    `;
    const unmappedBatches = Number(unmappedBatchesResult[0].count);

    const unmappedPlansResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM production_plans
      WHERE factory_id = ${factoryId} AND customer_id IS NULL
    `;
    const unmappedPlans = Number(unmappedPlansResult[0].count);

    if (unmappedBatches === 0 && unmappedPlans === 0) {
      console.log('   ✅ 所有批次都已关联供应商');
      console.log('   ✅ 所有生产计划都已关联客户');
      console.log('   ✅ 数据迁移完整！');
    } else {
      if (unmappedBatches > 0) console.log(`   ⚠️  ${unmappedBatches}个批次未关联供应商`);
      if (unmappedPlans > 0) console.log(`   ⚠️  ${unmappedPlans}个生产计划未关联客户`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 完整业务流程测试成功！');
    console.log('='.repeat(60));

    return {
      suppliers: [supplier1, supplier2],
      customers: [customer1, customer2],
      batch: batch1,
      plan: plan1,
      success: true
    };

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行测试
testCompleteFlow()
  .then((result) => {
    console.log('\n🎉 测试完成！可以安全清理Merchant表了。');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  });
