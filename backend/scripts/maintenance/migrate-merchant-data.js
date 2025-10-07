/**
 * 商家数据迁移脚本
 * 将Merchant表的数据智能分离到Supplier和Customer表
 *
 * 分离规则:
 * 1. 在MaterialBatch中使用的Merchant → Supplier（供应商）
 * 2. 在ProductionPlan中使用的Merchant → Customer（客户）
 * 3. 同时作为供应商和客户的 → 创建两条记录
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 生成供应商代码
 */
function generateSupplierCode(index) {
  return `SUP${String(index).padStart(3, '0')}`;
}

/**
 * 生成客户代码
 */
function generateCustomerCode(index) {
  return `CUS${String(index).padStart(3, '0')}`;
}

/**
 * 主迁移函数
 */
async function migrateMerchantData() {
  console.log('🚀 开始迁移Merchant数据...\n');

  try {
    // 1. 获取所有Merchant
    const merchants = await prisma.merchant.findMany({
      include: {
        materialBatches: true,    // 作为供应商的批次
        productionPlans: true,    // 作为客户的订单
      }
    });

    console.log(`📊 找到 ${merchants.length} 个商家记录\n`);

    let supplierCount = 0;
    let customerCount = 0;
    let bothCount = 0;

    // 2. 遍历每个Merchant，判断其角色
    for (const merchant of merchants) {
      const isSupplier = merchant.materialBatches.length > 0;
      const isCustomer = merchant.productionPlans.length > 0;

      console.log(`\n处理商家: ${merchant.name} (${merchant.code})`);
      console.log(`  - 提供原材料批次: ${merchant.materialBatches.length}`);
      console.log(`  - 订购生产计划: ${merchant.productionPlans.length}`);

      if (isSupplier && isCustomer) {
        // 既是供应商又是客户 → 创建两条记录
        console.log(`  ✅ 既是供应商又是客户，创建两条记录`);

        // 创建Supplier
        const supplier = await prisma.supplier.create({
          data: {
            factoryId: merchant.factoryId,
            name: merchant.name,
            code: generateSupplierCode(supplierCount + 1),
            contactPerson: merchant.contactPerson,
            contactPhone: merchant.contactPhone,
            address: merchant.address,
            businessType: merchant.businessType,
            creditLevel: merchant.creditLevel,
            deliveryArea: null,
            paymentTerms: null,
            isActive: merchant.isActive,
            createdBy: merchant.createdBy,
            createdAt: merchant.createdAt,
            updatedAt: merchant.updatedAt,
          }
        });
        console.log(`     → 创建供应商: ${supplier.code}`);
        supplierCount++;

        // 创建Customer
        const customer = await prisma.customer.create({
          data: {
            factoryId: merchant.factoryId,
            name: merchant.name,
            code: generateCustomerCode(customerCount + 1),
            contactPerson: merchant.contactPerson,
            contactPhone: merchant.contactPhone,
            address: merchant.address,
            businessType: merchant.businessType,
            creditLevel: merchant.creditLevel,
            deliveryArea: null,
            paymentTerms: null,
            isActive: merchant.isActive,
            createdBy: merchant.createdBy,
            createdAt: merchant.createdAt,
            updatedAt: merchant.updatedAt,
          }
        });
        console.log(`     → 创建客户: ${customer.code}`);
        customerCount++;

        // 更新MaterialBatch的supplierId
        await prisma.materialBatch.updateMany({
          where: { merchantId: merchant.id },
          data: { supplierId: supplier.id }
        });
        console.log(`     → 更新 ${merchant.materialBatches.length} 个批次的供应商ID`);

        // 更新ProductionPlan的customerId
        await prisma.productionPlan.updateMany({
          where: { merchantId: merchant.id },
          data: { customerId: customer.id }
        });
        console.log(`     → 更新 ${merchant.productionPlans.length} 个生产计划的客户ID`);

        // 更新ShipmentRecord的customerId
        const shipments = await prisma.shipmentRecord.updateMany({
          where: {
            plan: {
              merchantId: merchant.id
            }
          },
          data: { customerId: customer.id }
        });
        console.log(`     → 更新出货记录的客户ID`);

        bothCount++;

      } else if (isSupplier) {
        // 仅作为供应商
        console.log(`  ✅ 仅作为供应商`);

        const supplier = await prisma.supplier.create({
          data: {
            factoryId: merchant.factoryId,
            name: merchant.name,
            code: generateSupplierCode(supplierCount + 1),
            contactPerson: merchant.contactPerson,
            contactPhone: merchant.contactPhone,
            address: merchant.address,
            businessType: merchant.businessType,
            creditLevel: merchant.creditLevel,
            deliveryArea: null,
            paymentTerms: null,
            isActive: merchant.isActive,
            createdBy: merchant.createdBy,
            createdAt: merchant.createdAt,
            updatedAt: merchant.updatedAt,
          }
        });
        console.log(`     → 创建供应商: ${supplier.code}`);
        supplierCount++;

        // 更新MaterialBatch的supplierId
        await prisma.materialBatch.updateMany({
          where: { merchantId: merchant.id },
          data: { supplierId: supplier.id }
        });
        console.log(`     → 更新 ${merchant.materialBatches.length} 个批次的供应商ID`);

      } else if (isCustomer) {
        // 仅作为客户
        console.log(`  ✅ 仅作为客户`);

        const customer = await prisma.customer.create({
          data: {
            factoryId: merchant.factoryId,
            name: merchant.name,
            code: generateCustomerCode(customerCount + 1),
            contactPerson: merchant.contactPerson,
            contactPhone: merchant.contactPhone,
            address: merchant.address,
            businessType: merchant.businessType,
            creditLevel: merchant.creditLevel,
            deliveryArea: null,
            paymentTerms: null,
            isActive: merchant.isActive,
            createdBy: merchant.createdBy,
            createdAt: merchant.createdAt,
            updatedAt: merchant.updatedAt,
          }
        });
        console.log(`     → 创建客户: ${customer.code}`);
        customerCount++;

        // 更新ProductionPlan的customerId
        await prisma.productionPlan.updateMany({
          where: { merchantId: merchant.id },
          data: { customerId: customer.id }
        });
        console.log(`     → 更新 ${merchant.productionPlans.length} 个生产计划的客户ID`);

        // 更新ShipmentRecord的customerId
        await prisma.shipmentRecord.updateMany({
          where: {
            plan: {
              merchantId: merchant.id
            }
          },
          data: { customerId: customer.id }
        });
        console.log(`     → 更新出货记录的客户ID`);

      } else {
        // 未使用的商家（可能是测试数据）
        console.log(`  ⚠️  未使用的商家，跳过`);
      }
    }

    // 3. 打印迁移统计
    console.log('\n' + '='.repeat(60));
    console.log('📊 迁移统计:');
    console.log(`  - 总商家数: ${merchants.length}`);
    console.log(`  - 创建供应商: ${supplierCount}`);
    console.log(`  - 创建客户: ${customerCount}`);
    console.log(`  - 既是供应商又是客户: ${bothCount}`);
    console.log('='.repeat(60));

    // 4. 验证迁移结果
    console.log('\n🔍 验证迁移结果...');

    const unmappedBatches = await prisma.materialBatch.count({
      where: { supplierId: null }
    });

    const unmappedPlans = await prisma.productionPlan.count({
      where: { customerId: null }
    });

    const unmappedShipments = await prisma.shipmentRecord.count({
      where: { customerId: null }
    });

    if (unmappedBatches > 0 || unmappedPlans > 0 || unmappedShipments > 0) {
      console.log('❌ 发现未映射的数据:');
      if (unmappedBatches > 0) console.log(`  - 批次未映射供应商: ${unmappedBatches}`);
      if (unmappedPlans > 0) console.log(`  - 生产计划未映射客户: ${unmappedPlans}`);
      if (unmappedShipments > 0) console.log(`  - 出货记录未映射客户: ${unmappedShipments}`);
      throw new Error('数据迁移不完整，请检查！');
    }

    console.log('✅ 所有数据已成功映射！');
    console.log('\n✨ 迁移完成！下一步需要:');
    console.log('  1. 运行 finalize-migration.js 完成最终清理');
    console.log('  2. 该脚本将删除merchant_id列并设置NOT NULL约束');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migrateMerchantData()
  .then(() => {
    console.log('\n🎉 数据迁移成功完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 数据迁移失败:', error);
    process.exit(1);
  });
