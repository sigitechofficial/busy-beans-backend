CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(200) NOT NULL,
  `brand` VARCHAR(255) NOT NULL DEFAULT '',
  `category` ENUM('bean-to-cup','espresso','commercial','hospitality','office') NOT NULL DEFAULT 'office',
  `short_description` TEXT NOT NULL,
  `features` JSON NOT NULL,
  `image_media_id` VARCHAR(64) NULL,
  `demo_landing_slug` VARCHAR(200) NULL,
  `recommended_campaign_types` JSON NULL,
  `status` ENUM('active','draft','archived') NOT NULL DEFAULT 'active',
  `campaign_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_unique` (`slug`),
  KEY `products_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
