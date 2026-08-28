CREATE TABLE IF NOT EXISTS `marketing_seed_status` (
  `module_key` VARCHAR(64) NOT NULL,
  `seeded` TINYINT(1) NOT NULL DEFAULT 0,
  `completeness` ENUM('full','partial','empty') NOT NULL DEFAULT 'empty',
  `record_count` INT NOT NULL DEFAULT 0,
  `expected_count` INT NOT NULL DEFAULT 0,
  `synced_at` DATETIME NULL,
  `synced_by` VARCHAR(255) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`module_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
