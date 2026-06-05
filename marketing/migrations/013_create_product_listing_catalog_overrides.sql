CREATE TABLE IF NOT EXISTS `product_listing_catalog_overrides` (
  `listing_type` VARCHAR(64) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `label` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`listing_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
