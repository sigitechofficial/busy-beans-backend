CREATE TABLE IF NOT EXISTS `marketing_forms` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `variant` VARCHAR(64) NOT NULL DEFAULT 'lead-form',
  `status` ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  `content` JSON NOT NULL,
  `usage_count` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(64) NULL,
  `updated_by` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `marketing_forms_slug_unique` (`slug`),
  KEY `marketing_forms_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
