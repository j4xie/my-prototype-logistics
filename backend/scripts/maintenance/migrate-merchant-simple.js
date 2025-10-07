/**
 * 简化版商家数据迁移脚本
 * 直接使用SQL查询迁移数据
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

async function migrateMerchantData() {
  console.log('🚀 开始迁移Merchant数据...\n');

  try {
    // 1. 获取所有Merchant（使用原始SQL）
    const merchants = await prisma.$queryRaw`
      SELECT * FROM merchants
    `;

    console.log(`📊 找到 ${merchants.length} 个商家记录\n`);

    let supplierCount = 0;
    let customerCount = 0;
    let bothCount = 0;

    // 2. 遍历每个Merchant
    for (const merchant of merchants) {
      // 检查是否在material_batches中使用（作为供应商）
      const batchUsage = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM material_batches
        WHERE merchant_id = ${merchant.id}
      `;
      const isSupplier = batchUsage[0].count > 0;

      // 检查是否在production_plans中使用（作为客户）
      const planUsage = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM production_plans
        WHERE merchant_id = ${merchant.id}
      `;
      const isCustomer = planUsage[0].count > 0;

      console.log(`\n处理商家: ${merchant.name} (${merchant.code})`);
      console.log(`  - 提供原材料批次: ${batchUsage[0].count}`);
      console.log(`  - 订购生产计划: ${planUsage[0].count}`);

      if (isSupplier && isCustomer) {
        // 既是供应商又是客户
        console.log(`  ✅ 既是供应商又是客户，创建两条记录`);

        // 创建Supplier
        const supplierCode = generateSupplierCode(supplierCount + 1);
        const supplier = await prisma.supplier.create({
          data: {
            factoryId: merchant.factory_id,
            name: merchant.name,
            code: supplierCode,
            contactPerson: merchant.contact_person,
            contactPhone: merchant.contact_phone,
            address: merchant.address,
            businessType: merchant.business_type,
            creditLevel: merchant.credit_level,
            isActive: Boolean(merchant.is_active),
            createdBy: merchant.created_by,
            createdAt: merchant.created_at,
            updatedAt: merchant.updated_at,
          }
        });
        console.log(`     → 创建供应商: ${supplier.code}`);
        supplierCount++;

        // 创建Customer
        const customerCode = generateCustomerCode(customerCount + 1);
        const customer = await prisma.customer.create({
          data: {
            factoryId: merchant.factory_id,
            name: merchant.name,
            code: customerCode,
            contactPerson: merchant.contact_person,
            contactPhone: merchant.contact_phone,
            address: merchant.address,
            businessType: merchant.business_type,
            creditLevel: merchant.credit_level,
            isActive: Boolean(merchant.is_active),
            createdBy: merchant.created_by,
            createdAt: merchant.created_at,
            updatedAt: merchant.updated_at,
          }
        });
        console.log(`     → 创建客户: ${customer.code}`);
        customerCount++;

        // 更新MaterialBatch的supplierId
        await prisma.$executeRaw`
          UPDATE material_batches
          SET supplier_id = ${supplier.id}
          WHERE merchant_id = ${merchant.id}
        `;
        console.log(`     → 更新 ${batchUsage[0].count} 个批次的供应商ID`);

        // 更新ProductionPlan的customerId
        await prisma.$executeRaw`
          UPDATE production_plans
          SET customer_id = ${customer.id}
          WHERE merchant_id = ${merchant.id}
        `;
        console.log(`     → 更新 ${planUsage[0].count} 个生产计划的客户ID`);

        // 更新ShipmentRecord的customerId
        await prisma.$executeRaw`
          UPDATE shipment_records
          SET customer_id = ${customer.id}
          WHERE plan_id IN (
            SELECT id FROM production_plans WHERE merchant_id = ${merchant.id}
          )
        `;
        console.log(`     → 更新出货记录的客户ID`);

        bothCount++;

      } else if (isSupplier) {
        // 仅作为供应商
        console.log(`  ✅ 仅作为供应商`);

        const supplierCode = generateSupplierCode(supplierCount + 1);
        const supplier = await prisma.supplier.create({
          data: {
            factoryId: merchant.factory_id,
            name: merchant.name,
            code: supplierCode,
            contactPerson: merchant.contact_person,
            contactPhone: merchant.contact_phone,
            address: merchant.address,
            businessType: merchant.business_type,
            creditLevel: merchant.credit_level,
            isActive: Boolean(merchant.is_active),
            createdBy: merchant.created_by,
            createdAt: merchant.created_at,
            updatedAt: merchant.updated_at,
          }
        });
        console.log(`     → 创建供应商: ${supplier.code}`);
        supplierCount++;

        // 更新MaterialBatch的supplierId
        await prisma.$executeRaw`
          UPDATE material_batches
          SET supplier_id = ${supplier.id}
          WHERE merchant_id = ${merchant.id}
        `;
        console.log(`     → 更新 ${batchUsage[0].count} 个批次的供应商ID`);

      } else if (isCustomer) {
        // 仅作为客户
        console.log(`  ✅ 仅作为客户`);

        const customerCode = generateCustomerCode(customerCount + 1);
        const customer = await prisma.customer.create({
          data: {
            factoryId: merchant.factory_id,
            name: merchant.name,
            code: customerCode,
            contactPerson: merchant.contact_person,
            contactPhone: merchant.contact_phone,
            address: merchant.address,
            businessType: merchant.business_type,
            creditLevel: merchant.credit_level,
            isActive: Boolean(merchant.is_active),
            createdBy: merchant.created_by,
            createdAt: merchant.created_at,
            updatedAt: merchant.updated_at,
          }
        });
        console.log(`     → 创建客户: ${customer.code}`);
        customerCount++;

        // 更新ProductionPlan的customerId
        await prisma.$executeRaw`
          UPDATE production_plans
          SET customer_id = ${customer.id}
          WHERE merchant_id = ${merchant.id}
        `;
        console.log(`     → 更新 ${planUsage[0].count} 个生产计划的客户ID`);

        // 更新ShipmentRecord的customerId
        await prisma.$executeRaw`
          UPDATE shipment_records
          SET customer_id = ${customer.id}
          WHERE plan_id IN (
            SELECT id FROM production_plans WHERE merchant_id = ${merchant.id}
          )
        `;
        console.log(`     → 更新出货记录的客户ID`);

      } else {
        // 未使用的商家 → 创建为客户（默认策略）
        console.log(`  ⚠️  未使用的商家，默认创建为客户`);

        const customerCode = generateCustomerCode(customerCount + 1);
        const customer = await prisma.customer.create({
          data: {
            factoryId: merchant.factory_id,
            name: merchant.name,
            code: customerCode,
            contactPerson: merchant.contact_person,
            contactPhone: merchant.contact_phone,
            address: merchant.address,
            businessType: merchant.business_type,
            creditLevel: merchant.credit_level,
            isActive: Boolean(merchant.is_active),
            createdBy: merchant.created_by,
            createdAt: merchant.created_at,
            updatedAt: merchant.updated_at,
          }
        });
        console.log(`     → 创建客户: ${customer.code}`);
        customerCount++;
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

    const unmappedBatches = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM material_batches
      WHERE supplier_id IS NULL AND merchant_id IS NOT NULL
    `;

    const unmappedPlans = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM production_plans
      WHERE customer_id IS NULL AND merchant_id IS NOT NULL
    `;

    const unmappedShipments = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM shipment_records
      WHERE customer_id IS NULL AND merchant_id IS NOT NULL
    `;

    if (unmappedBatches[0].count > 0 || unmappedPlans[0].count > 0 || unmappedShipments[0].count > 0) {
      console.log('❌ 发现未映射的数据:');
      if (unmappedBatches[0].count > 0) console.log(`  - 批次未映射供应商: ${unmappedBatches[0].count}`);
      if (unmappedPlans[0].count > 0) console.log(`  - 生产计划未映射客户: ${unmappedPlans[0].count}`);
      if (unmappedShipments[0].count > 0) console.log(`  - 出货记录未映射客户: ${unmappedShipments[0].count}`);
      throw new Error('数据迁移不完整，请检查！');
    }

    console.log('✅ 所有数据已成功映射！');
    console.log('\n✨ 迁移完成！');

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
