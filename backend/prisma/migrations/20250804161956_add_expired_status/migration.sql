/*
  Warnings:

  - You are about to alter the column `token` on the `temp_tokens` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to drop the column `permissions` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `role_level` on the `users` table. All the data in the column will be lost.
  - You are about to alter the column `role_code` on the `users` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `Enum(EnumId(9))`.
  - You are about to alter the column `department` on the `users` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `Enum(EnumId(8))`.
  - A unique constraint covering the columns `[token]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[refresh_token]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.
  - Made the column `expires_at` on table `user_whitelist` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `sessions` DROP FOREIGN KEY `sessions_factory_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_whitelist` DROP FOREIGN KEY `user_whitelist_factory_id_fkey`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_factory_id_fkey`;

-- DropIndex
DROP INDEX `sessions_refresh_token_key` ON `sessions`;

-- DropIndex
DROP INDEX `sessions_token_key` ON `sessions`;

-- AlterTable
ALTER TABLE `factories` MODIFY `address` VARCHAR(191) NULL,
    MODIFY `subscription_plan` VARCHAR(191) NULL,
    MODIFY `contact_name` VARCHAR(191) NULL,
    MODIFY `contact_phone` VARCHAR(191) NULL,
    MODIFY `industry_code` VARCHAR(191) NULL,
    MODIFY `legacy_id` VARCHAR(191) NULL,
    MODIFY `region_code` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `platform_admins` ADD COLUMN `role` ENUM('platform_super_admin', 'platform_operator', 'system_developer') NOT NULL DEFAULT 'platform_operator',
    MODIFY `username` VARCHAR(191) NOT NULL,
    MODIFY `phone` VARCHAR(191) NULL,
    MODIFY `full_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sessions` MODIFY `factory_id` VARCHAR(191) NOT NULL,
    MODIFY `token` VARCHAR(191) NOT NULL,
    MODIFY `refresh_token` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `temp_tokens` MODIFY `token` VARCHAR(191) NOT NULL,
    MODIFY `factory_id` VARCHAR(191) NOT NULL,
    MODIFY `phone_number` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user_whitelist` ADD COLUMN `added_by_platform_id` INTEGER NULL,
    MODIFY `factory_id` VARCHAR(191) NOT NULL,
    MODIFY `phone_number` VARCHAR(191) NOT NULL,
    MODIFY `expires_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `permissions`,
    DROP COLUMN `role_level`,
    MODIFY `factory_id` VARCHAR(191) NOT NULL,
    MODIFY `username` VARCHAR(191) NOT NULL,
    MODIFY `phone` VARCHAR(191) NULL,
    MODIFY `full_name` VARCHAR(191) NULL,
    MODIFY `role_code` ENUM('factory_super_admin', 'permission_admin', 'department_admin', 'operator', 'viewer', 'unactivated') NOT NULL DEFAULT 'unactivated',
    MODIFY `department` ENUM('farming', 'processing', 'logistics', 'quality', 'management') NULL,
    MODIFY `position` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `user_role_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `factory_id` VARCHAR(191) NOT NULL,
    `old_role_code` ENUM('factory_super_admin', 'permission_admin', 'department_admin', 'operator', 'viewer', 'unactivated') NULL,
    `new_role_code` ENUM('factory_super_admin', 'permission_admin', 'department_admin', 'operator', 'viewer', 'unactivated') NOT NULL,
    `old_department` ENUM('farming', 'processing', 'logistics', 'quality', 'management') NULL,
    `new_department` ENUM('farming', 'processing', 'logistics', 'quality', 'management') NULL,
    `changed_by` INTEGER NOT NULL,
    `changed_by_type` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_role_history_user`(`user_id`),
    INDEX `idx_role_history_factory`(`factory_id`),
    INDEX `idx_changed_by`(`changed_by`),
    INDEX `idx_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission_audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actor_type` VARCHAR(191) NOT NULL,
    `actor_id` INTEGER NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NULL,
    `target_user_id` INTEGER NULL,
    `target_resource_id` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `factory_id` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `result` VARCHAR(191) NOT NULL DEFAULT 'success',
    `error_message` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_admin_actor`(`actor_type`, `actor_id`),
    INDEX `idx_admin_timestamp`(`timestamp`),
    INDEX `idx_admin_factory`(`factory_id`),
    INDEX `idx_admin_action`(`action`),
    INDEX `idx_admin_result`(`result`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_access_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` INTEGER NOT NULL,
    `user_type` VARCHAR(191) NOT NULL,
    `factory_id` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `data_type` VARCHAR(191) NOT NULL,
    `resource_id` VARCHAR(191) NULL,
    `operation` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_data_user`(`user_id`, `user_type`),
    INDEX `idx_data_timestamp`(`timestamp`),
    INDEX `idx_data_factory`(`factory_id`),
    INDEX `idx_data_type`(`data_type`),
    INDEX `idx_data_operation`(`operation`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `factory_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `factory_id` VARCHAR(191) NOT NULL,
    `allow_self_registration` BOOLEAN NOT NULL DEFAULT false,
    `require_admin_approval` BOOLEAN NOT NULL DEFAULT true,
    `default_user_role` ENUM('factory_super_admin', 'permission_admin', 'department_admin', 'operator', 'viewer', 'unactivated') NOT NULL DEFAULT 'viewer',
    `session_timeout_minutes` INTEGER NOT NULL DEFAULT 1440,
    `max_failed_login_attempts` INTEGER NOT NULL DEFAULT 5,
    `password_policy` JSON NULL,
    `department_settings` JSON NULL,
    `custom_permissions` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `factory_settings_factory_id_key`(`factory_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_platform_role` ON `platform_admins`(`role`);

-- CreateIndex
CREATE UNIQUE INDEX `sessions_token_key` ON `sessions`(`token`);

-- CreateIndex
CREATE UNIQUE INDEX `sessions_refresh_token_key` ON `sessions`(`refresh_token`);

-- CreateIndex
CREATE INDEX `idx_type_factory` ON `temp_tokens`(`type`, `factory_id`);

-- CreateIndex
CREATE INDEX `idx_expires_used` ON `temp_tokens`(`expires_at`, `is_used`);

-- CreateIndex
CREATE INDEX `idx_status_factory` ON `user_whitelist`(`status`, `factory_id`);

-- CreateIndex
CREATE INDEX `idx_expires_at` ON `user_whitelist`(`expires_at`);

-- CreateIndex
CREATE INDEX `user_whitelist_added_by_platform_id_fkey` ON `user_whitelist`(`added_by_platform_id`);

-- CreateIndex
CREATE INDEX `idx_role_department` ON `users`(`role_code`, `department`);

-- CreateIndex
CREATE INDEX `idx_factory_role` ON `users`(`factory_id`, `role_code`);

-- CreateIndex
CREATE INDEX `idx_active_users` ON `users`(`is_active`, `factory_id`);

-- AddForeignKey
ALTER TABLE `user_whitelist` ADD CONSTRAINT `user_whitelist_added_by_platform_id_fkey` FOREIGN KEY (`added_by_platform_id`) REFERENCES `platform_admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_whitelist` ADD CONSTRAINT `user_whitelist_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role_history` ADD CONSTRAINT `user_role_history_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role_history` ADD CONSTRAINT `user_role_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factory_settings` ADD CONSTRAINT `factory_settings_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
