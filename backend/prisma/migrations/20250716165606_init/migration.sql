-- CreateTable
CREATE TABLE `factories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `employee_count` INTEGER NULL,
    `subscription_plan` VARCHAR(50) NULL,
    `contact_name` VARCHAR(100) NULL,
    `contact_phone` VARCHAR(50) NULL,
    `contact_email` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `full_name` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `platform_admins_username_key`(`username`),
    UNIQUE INDEX `platform_admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_whitelist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `factory_id` VARCHAR(20) NOT NULL,
    `phone_number` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'REGISTERED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `added_by_user_id` INTEGER NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_whitelist_factory_id_phone_number_key`(`factory_id`, `phone_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `factory_id` VARCHAR(20) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `full_name` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `role_level` INTEGER NOT NULL DEFAULT 99,
    `role_code` VARCHAR(50) NOT NULL DEFAULT 'unactivated',
    `department` VARCHAR(100) NULL,
    `position` VARCHAR(100) NULL,
    `permissions` JSON NULL,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_factory_id_username_key`(`factory_id`, `username`),
    UNIQUE INDEX `users_factory_id_email_key`(`factory_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `factory_id` VARCHAR(20) NOT NULL,
    `token` TEXT NOT NULL,
    `refresh_token` TEXT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_token_key`(`token`(255)),
    UNIQUE INDEX `sessions_refresh_token_key`(`refresh_token`(255)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `temp_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(255) NOT NULL,
    `type` ENUM('PHONE_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
    `factory_id` VARCHAR(20) NOT NULL,
    `phone_number` VARCHAR(50) NULL,
    `data` JSON NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `is_used` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `temp_tokens_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_whitelist` ADD CONSTRAINT `user_whitelist_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_whitelist` ADD CONSTRAINT `user_whitelist_added_by_user_id_fkey` FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_factory_id_fkey` FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
