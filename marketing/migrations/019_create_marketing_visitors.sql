CREATE TABLE IF NOT EXISTS `marketing_visitors` (
  `visitor_id` VARCHAR(64) NOT NULL,
  `first_seen_at` DATETIME NOT NULL,
  `last_seen_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`visitor_id`),
  KEY `marketing_visitors_last_seen_idx` (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
