CREATE TABLE IF NOT EXISTS `landing_page_versions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `landing_page_id` VARCHAR(64) NOT NULL,
  `version_number` INT NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `published_by` VARCHAR(255) NULL,
  `published_at` DATETIME NOT NULL,
  `notes` TEXT NULL,
  `snapshot_section_count` INT NOT NULL DEFAULT 0,
  `sections_snapshot` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `landing_page_versions_page_version_idx` (`landing_page_id`, `version_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
