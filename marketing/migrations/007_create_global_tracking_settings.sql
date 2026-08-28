CREATE TABLE IF NOT EXISTS `global_tracking_settings` (
  `id` INT NOT NULL DEFAULT 1,
  `settings` JSON NOT NULL,
  `updated_by` VARCHAR(255) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `global_tracking_settings` (`id`, `settings`, `updated_by`)
VALUES (
  1,
  JSON_OBJECT('captureUtmFields', true),
  'System'
)
ON DUPLICATE KEY UPDATE `id` = `id`;
