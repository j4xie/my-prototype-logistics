-- DropForeignKey
ALTER TABLE `suppliers` DROP FOREIGN KEY `suppliers_factory_id_fkey`;

-- DropForeignKey
ALTER TABLE `suppliers` DROP FOREIGN KEY `suppliers_created_by_fkey`;

-- DropForeignKey
ALTER TABLE `customers` DROP FOREIGN KEY `customers_factory_id_fkey`;

-- DropForeignKey
ALTER TABLE `customers` DROP FOREIGN KEY `customers_created_by_fkey`;

-- DropForeignKey
ALTER TABLE `production_plans` DROP FOREIGN KEY `production_plans_customer_id_fkey`;

-- DropForeignKey
ALTER TABLE `shipment_records` DROP FOREIGN KEY `shipment_records_customer_id_fkey`;

-- DropForeignKey
ALTER TABLE `material_batches` DROP FOREIGN KEY `material_batches_supplier_id_fkey`;

-- AlterTable
ALTER TABLE `production_plans` DROP COLUMN `customer_id`,
    ADD COLUMN `merchant_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `shipment_records` DROP COLUMN `customer_id`,
    ADD COLUMN `merchant_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `material_batches` DROP COLUMN `supplier_id`,
    ADD COLUMN `merchant_id` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `suppliers`;

-- DropTable
DROP TABLE `customers`;

-- CreateIndex
CREATE INDEX `processing_batches_supervisor_id_fkey` ON `processing_batches`(`supervisor_id` ASC);

-- CreateIndex
CREATE INDEX `quality_inspections_factory_id_fkey` ON `quality_inspections`(`factory_id` ASC);

-- CreateIndex
CREATE INDEX `alert_notifications_resolved_by_fkey` ON `alert_notifications`(`resolved_by` ASC);

-- CreateIndex
CREATE INDEX `activation_codes_created_by_fkey` ON `activation_codes`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `activation_records_user_id_fkey` ON `activation_records`(`user_id` ASC);

-- CreateIndex
CREATE INDEX `report_templates_created_by_fkey` ON `report_templates`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `employee_time_clocks_work_type_id_fkey` ON `employee_time_clocks`(`work_type_id` ASC);

-- CreateIndex
CREATE INDEX `batch_work_sessions_work_type_id_fkey` ON `batch_work_sessions`(`work_type_id` ASC);

-- CreateIndex
CREATE INDEX `raw_material_types_created_by_fkey` ON `raw_material_types`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `product_types_created_by_fkey` ON `product_types`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `material_product_conversions_created_by_fkey` ON `material_product_conversions`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `material_product_conversions_product_type_id_fkey` ON `material_product_conversions`(`product_type_id` ASC);

-- CreateIndex
CREATE INDEX `merchants_created_by_fkey` ON `merchants`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `production_plans_created_by_fkey` ON `production_plans`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `production_plans_merchant_id_fkey` ON `production_plans`(`merchant_id` ASC);

-- CreateIndex
CREATE INDEX `production_plans_product_type_id_fkey` ON `production_plans`(`product_type_id` ASC);

-- CreateIndex
CREATE INDEX `material_consumptions_recorded_by_fkey` ON `material_consumptions`(`recorded_by` ASC);

-- CreateIndex
CREATE INDEX `shipment_records_merchant_id_idx` ON `shipment_records`(`merchant_id` ASC);

-- CreateIndex
CREATE INDEX `shipment_records_recorded_by_fkey` ON `shipment_records`(`recorded_by` ASC);

-- CreateIndex
CREATE INDEX `material_batches_created_by_fkey` ON `material_batches`(`created_by` ASC);

-- CreateIndex
CREATE INDEX `material_batches_material_type_id_fkey` ON `material_batches`(`material_type_id` ASC);

-- CreateIndex
CREATE INDEX `material_batches_merchant_id_idx` ON `material_batches`(`merchant_id` ASC);

-- CreateIndex
CREATE INDEX `material_batch_adjustments_adjusted_by_fkey` ON `material_batch_adjustments`(`adjusted_by` ASC);

-- AddForeignKey
ALTER TABLE `material_batches` ADD CONSTRAINT `material_batches_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plans` ADD CONSTRAINT `production_plans_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipment_records` ADD CONSTRAINT `shipment_records_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

