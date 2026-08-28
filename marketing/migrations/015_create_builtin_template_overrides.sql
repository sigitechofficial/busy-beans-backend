CREATE TABLE IF NOT EXISTS `builtin_template_overrides` (
  `template_id` VARCHAR(64) NOT NULL,
  `initial_sections` JSON NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
