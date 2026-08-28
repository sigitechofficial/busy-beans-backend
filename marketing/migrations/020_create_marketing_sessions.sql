CREATE TABLE IF NOT EXISTS `marketing_sessions` (
  `session_id` VARCHAR(64) NOT NULL,
  `visitor_id` VARCHAR(64) NOT NULL,
  `started_at` DATETIME NOT NULL,
  `ended_at` DATETIME NOT NULL,
  `landing_page_id` VARCHAR(64) NULL,
  `landing_page_slug` VARCHAR(200) NULL,
  `is_landing_page_session` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  KEY `marketing_sessions_visitor_idx` (`visitor_id`),
  KEY `marketing_sessions_landing_slug_idx` (`landing_page_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
