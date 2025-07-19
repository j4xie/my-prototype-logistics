-- AlterTable
ALTER TABLE `factories` ADD COLUMN `confidence` DOUBLE NULL,
    ADD COLUMN `factory_year` INTEGER NULL,
    ADD COLUMN `industry_code` VARCHAR(3) NULL,
    ADD COLUMN `inference_data` JSON NULL,
    ADD COLUMN `legacy_id` VARCHAR(50) NULL,
    ADD COLUMN `manually_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `region_code` VARCHAR(2) NULL,
    ADD COLUMN `sequence_number` INTEGER NULL;

-- CreateIndex
CREATE INDEX `idx_factory_code` ON `factories`(`industry_code`, `region_code`, `factory_year`);

-- CreateIndex
CREATE INDEX `idx_legacy_id` ON `factories`(`legacy_id`);

-- CreateIndex
CREATE INDEX `idx_industry` ON `factories`(`industry_code`);

-- CreateIndex
CREATE INDEX `idx_region` ON `factories`(`region_code`);

-- CreateIndex
CREATE INDEX `idx_year` ON `factories`(`factory_year`);
