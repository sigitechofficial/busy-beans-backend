-- Revenue attribution (Phase 8).
-- One row per storefront order placed from the website with analytics context: which
-- visitor/session placed it, which landing pages that visitor came through, and the stored
-- first/last-touch UTM snapshot. Kept outside the commerce `orders` schema on purpose.
-- paid_at/revenue are filled by the marketing scheduler once the order's payment is done.
CREATE TABLE IF NOT EXISTS `marketing_order_attribution` (
  `order_id` INT UNSIGNED NOT NULL,
  `customer_user_id` INT UNSIGNED NULL,
  `visitor_id` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(64) NOT NULL,
  `landing_page_slug` VARCHAR(200) NULL,
  `first_landing_page_slug` VARCHAR(200) NULL,
  `first_touch` JSON NULL,
  `last_touch` JSON NULL,
  `order_total` DECIMAL(20,2) NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'usd',
  `status` VARCHAR(16) NOT NULL DEFAULT 'created',
  `paid_at` DATETIME NULL,
  `revenue` DECIMAL(20,2) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`),
  KEY `moa_status_created_idx` (`status`, `created_at`),
  KEY `moa_visitor_idx` (`visitor_id`),
  KEY `moa_lp_slug_idx` (`landing_page_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
