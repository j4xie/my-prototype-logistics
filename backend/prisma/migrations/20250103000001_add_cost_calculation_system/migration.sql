-- AlterTable ProcessingBatch - 添加成本核算字段
ALTER TABLE `processing_batches`
ADD COLUMN `raw_material_cost` DECIMAL(12, 2) NULL,
ADD COLUMN `raw_material_weight` DECIMAL(10, 2) NULL,
ADD COLUMN `raw_material_category` VARCHAR(100) NULL,
ADD COLUMN `product_category` ENUM('fresh', 'frozen') NULL,
ADD COLUMN `expected_price` DECIMAL(12, 2) NULL,
ADD COLUMN `labor_cost` DECIMAL(12, 2) NULL,
ADD COLUMN `equipment_cost` DECIMAL(12, 2) NULL,
ADD COLUMN `total_cost` DECIMAL(12, 2) NULL,
ADD COLUMN `profit_margin` DECIMAL(12, 2) NULL,
ADD COLUMN `profit_rate` DECIMAL(5, 2) NULL;

-- CreateIndex
CREATE INDEX `idx_product_category` ON `processing_batches`(`product_category`);

-- AlterTable User - 添加薪资和CCR字段
ALTER TABLE `users`
ADD COLUMN `monthly_salary` DECIMAL(10, 2) NULL,
ADD COLUMN `expected_work_minutes` INT NULL,
ADD COLUMN `ccr_rate` DECIMAL(8, 4) NULL;

-- AlterTable FactoryEquipment - 添加设备成本字段
ALTER TABLE `factory_equipment`
ADD COLUMN `purchase_cost` DECIMAL(12, 2) NULL,
ADD COLUMN `hourly_operation_cost` DECIMAL(8, 2) NULL,
ADD COLUMN `maintenance_count` INT NOT NULL DEFAULT 0,
ADD COLUMN `total_maintenance_cost` DECIMAL(12, 2) NULL,
ADD COLUMN `last_maintenance_date` DATETIME(3) NULL;

-- CreateTable BatchWorkSession - 批次员工工作时段表
CREATE TABLE `batch_work_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `work_type_id` VARCHAR(191) NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NULL,
    `total_minutes` INTEGER NULL,
    `processed_quantity` DECIMAL(10, 2) NULL,
    `ccr_rate` DECIMAL(8, 4) NOT NULL,
    `labor_cost` DECIMAL(10, 2) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_batch_user_work`(`batch_id`, `user_id`),
    INDEX `idx_user_work_time`(`user_id`, `start_time`),
    INDEX `idx_batch_work_time`(`batch_id`, `start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable BatchEquipmentUsage - 批次设备使用记录表
CREATE TABLE `batch_equipment_usage` (
    `id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NOT NULL,
    `equipment_id` VARCHAR(191) NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NULL,
    `usage_duration` INTEGER NULL,
    `equipment_cost` DECIMAL(10, 2) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_batch_equipment`(`batch_id`, `equipment_id`),
    INDEX `idx_equipment_usage_time`(`equipment_id`, `start_time`),
    INDEX `idx_batch_equipment_time`(`batch_id`, `start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable EquipmentMaintenance - 设备维修记录表
CREATE TABLE `equipment_maintenance_records` (
    `id` VARCHAR(191) NOT NULL,
    `equipment_id` VARCHAR(191) NOT NULL,
    `maintenance_date` DATETIME(3) NOT NULL,
    `maintenance_type` ENUM('routine', 'repair', 'emergency', 'upgrade') NOT NULL,
    `cost` DECIMAL(10, 2) NOT NULL,
    `description` TEXT NULL,
    `performed_by` INTEGER NULL,
    `duration_minutes` INTEGER NULL,
    `parts_replaced` JSON NULL,
    `next_scheduled_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_equipment_maintenance`(`equipment_id`, `maintenance_date`),
    INDEX `idx_maintenance_type_date`(`maintenance_type`, `maintenance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `batch_work_sessions` ADD CONSTRAINT `batch_work_sessions_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `processing_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batch_work_sessions` ADD CONSTRAINT `batch_work_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batch_work_sessions` ADD CONSTRAINT `batch_work_sessions_work_type_id_fkey` FOREIGN KEY (`work_type_id`) REFERENCES `work_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batch_equipment_usage` ADD CONSTRAINT `batch_equipment_usage_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `processing_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batch_equipment_usage` ADD CONSTRAINT `batch_equipment_usage_equipment_id_fkey` FOREIGN KEY (`equipment_id`) REFERENCES `factory_equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment_maintenance_records` ADD CONSTRAINT `equipment_maintenance_records_equipment_id_fkey` FOREIGN KEY (`equipment_id`) REFERENCES `factory_equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
