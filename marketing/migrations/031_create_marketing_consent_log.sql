-- Cookie consent log (proof of consent). One row per choice a visitor saves in the website's cookie
-- banner. `consent_id` is a random id also kept in the visitor's `bb_consent` cookie, so a record
-- can be matched to a browser without storing who the person is. IP addresses are stored
-- anonymized (IPv4 /24, IPv6 /48). Rows older than MARKETING_CONSENT_LOG_RETENTION_DAYS are purged
-- by the marketing scheduler.
CREATE TABLE IF NOT EXISTS `marketing_consent_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `consent_id` CHAR(36) NOT NULL,
  `visitor_id` VARCHAR(64) NULL,
  `analytics` TINYINT(1) NOT NULL,
  `marketing` TINYINT(1) NOT NULL,
  `action` VARCHAR(16) NOT NULL,
  `consent_mode` VARCHAR(10) NOT NULL,
  `opt_in_region` TINYINT(1) NOT NULL,
  `country` CHAR(2) NULL,
  `gpc` TINYINT(1) NOT NULL DEFAULT 0,
  `policy_version` VARCHAR(20) NOT NULL,
  `banner_version` VARCHAR(10) NOT NULL,
  `page_path` VARCHAR(500) NULL,
  `ip_anonymized` VARCHAR(64) NULL,
  `user_agent` VARCHAR(300) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `mcl_consent_idx` (`consent_id`, `created_at`),
  KEY `mcl_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
