-- Admin panel → Campaign Builder single sign-on (Phase 10).
-- One row per issued code: only the SHA-256 of the code is stored; a code is valid for 60 s
-- and can be exchanged once. Rows double as the audit log (who issued, who used, outcome).
CREATE TABLE IF NOT EXISTS `marketing_sso_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code_hash` CHAR(64) NOT NULL,
  `admin_entity` VARCHAR(32) NOT NULL,
  `admin_id` INT UNSIGNED NOT NULL,
  `admin_email` VARCHAR(255) NOT NULL,
  `issued_ip` VARCHAR(64) NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `used_ip` VARCHAR(64) NULL,
  `used_user_agent` VARCHAR(300) NULL,
  `marketing_user_id` VARCHAR(64) NULL,
  `outcome` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `msc_code_hash_unique` (`code_hash`),
  KEY `msc_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
