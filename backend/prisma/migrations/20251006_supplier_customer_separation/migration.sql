-- 供应商/客户分离迁移
-- 创建供应商表和客户表，将Merchant表分离为两个独立表

-- 步骤1: 创建suppliers表（供应商）
CREATE TABLE `suppliers` (
    `id` VARCHAR(191) NOT NULL,
    `factory_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `contact_person` VARCHAR(191) NULL,
    `contact_phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `business_type` VARCHAR(191) NULL,
    `credit_level` VARCHAR(191) NULL,
    `delivery_area` VARCHAR(191) NULL,
    `payment_terms` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` INTEGER NULL,

    UNIQUE INDEX `suppliers_factory_id_code_key`(`factory_id`, `code`),
    INDEX `suppliers_factory_id_is_active_idx`(`factory_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 步骤2: 创建customers表（客户）
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `factory_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `contact_person` VARCHAR(191) NULL,
    `contact_phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `business_type` VARCHAR(191) NULL,
    `credit_level` VARCHAR(191) NULL,
    `delivery_area` VARCHAR(191) NULL,
    `payment_terms` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` INTEGER NULL,

    UNIQUE INDEX `customers_factory_id_code_key`(`factory_id`, `code`),
    INDEX `customers_factory_id_is_active_idx`(`factory_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 步骤3: 添加外键约束到suppliers表
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 步骤4: 添加外键约束到customers表
ALTER TABLE `customers` ADD CONSTRAINT `customers_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customers` ADD CONSTRAINT `customers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 步骤5: 在material_batches表中添加supplier_id列
ALTER TABLE `material_batches` ADD COLUMN `supplier_id` VARCHAR(191) NULL AFTER `merchant_id`;

-- 步骤6: 在production_plans表中添加customer_id列
ALTER TABLE `production_plans` ADD COLUMN `customer_id` VARCHAR(191) NULL AFTER `merchant_id`;

-- 步骤7: 在shipment_records表中添加customer_id列
ALTER TABLE `shipment_records` ADD COLUMN `customer_id` VARCHAR(191) NULL AFTER `merchant_id`;

-- 步骤8: 数据迁移将在单独的脚本中执行
-- （将在migrate-merchant-data.js中完成）

-- 步骤9: 添加索引（暂时不设置为必填，等数据迁移后再设置）
CREATE INDEX `material_batches_supplier_id_idx` ON `material_batches`(`supplier_id`);
CREATE INDEX `production_plans_customer_id_idx` ON `production_plans`(`customer_id`);
CREATE INDEX `shipment_records_customer_id_idx` ON `shipment_records`(`customer_id`);

-- 步骤10: 添加外键约束（暂时允许NULL，等数据迁移后再修改）
ALTER TABLE `material_batches` ADD CONSTRAINT `material_batches_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `production_plans` ADD CONSTRAINT `production_plans_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `shipment_records` ADD CONSTRAINT `shipment_records_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 注意: 执行完数据迁移后，需要运行以下命令:
-- 1. 将supplier_id和customer_id设置为NOT NULL
-- 2. 删除旧的merchant_id列
-- 这些操作将在数据迁移脚本验证后执行
