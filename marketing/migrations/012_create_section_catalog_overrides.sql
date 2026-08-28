CREATE TABLE IF NOT EXISTS `section_catalog_overrides` (
  `section_type` VARCHAR(64) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `label` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `default_content` JSON NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`section_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
