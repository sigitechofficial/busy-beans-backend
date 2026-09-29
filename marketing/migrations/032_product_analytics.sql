-- Product & store analytics (Phase 16).
-- Events: the product a view / cart event is about (derived server-side from the URL or the
-- event metadata) and the signed-in customer account (sent only with analytics consent).
ALTER TABLE `marketing_analytics_events`
  ADD COLUMN `product_id` VARCHAR(64) NULL AFTER `page_type`,
  ADD COLUMN `customer_user_id` BIGINT NULL AFTER `product_id`,
  ADD KEY `mae_product_ts_idx` (`product_id`, `timestamp`),
  ADD KEY `mae_customer_ts_idx` (`customer_user_id`, `timestamp`);

-- Order line items snapshot (productId, name, qty, lineTotal, categoryId) for product revenue.
ALTER TABLE `marketing_order_attribution`
  ADD COLUMN `items` JSON NULL;

-- Who looked at identified customer data (names / emails / customer journeys) in the Campaign
-- Builder. One row per request that returned identified customers.
CREATE TABLE IF NOT EXISTS `marketing_pii_access_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `marketing_user_id` VARCHAR(64) NULL,
  `email` VARCHAR(255) NULL,
  `role` VARCHAR(64) NULL,
  `action` VARCHAR(32) NOT NULL,
  `subject` VARCHAR(128) NULL,
  `customer_ids` JSON NULL,
  `ip_anonymized` VARCHAR(64) NULL,
  `user_agent` VARCHAR(300) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `mpal_created_idx` (`created_at`),
  KEY `mpal_user_idx` (`marketing_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
