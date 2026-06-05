CREATE TABLE IF NOT EXISTS `global_sections` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `status` ENUM('active','draft') NOT NULL DEFAULT 'draft',
  `content` JSON NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `global_sections_type_idx` (`type`),
  KEY `global_sections_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
