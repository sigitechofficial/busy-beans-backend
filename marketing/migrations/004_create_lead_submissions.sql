CREATE TABLE IF NOT EXISTS `lead_submissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `landing_page_id` VARCHAR(64) NULL,
  `page_url` VARCHAR(2000) NOT NULL,
  `fields` JSON NOT NULL,
  `test_mode` TINYINT(1) NOT NULL DEFAULT 0,
  `submitted_at` DATETIME NOT NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `lead_submissions_page_idx` (`landing_page_id`),
  KEY `lead_submissions_submitted_idx` (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
