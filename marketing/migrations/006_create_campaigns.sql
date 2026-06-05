CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` ENUM('draft','active','paused','completed','archived') NOT NULL DEFAULT 'draft',
  `linked_landing_page_id` VARCHAR(64) NULL,
  `destination_url` VARCHAR(1000) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campaigns_linked_page_idx` (`linked_landing_page_id`),
  KEY `campaigns_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
