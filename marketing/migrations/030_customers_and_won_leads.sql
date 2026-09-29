-- Customer reporting (Phase 13).
-- 1. Leads marked "won" by the sales team count as customers: record when that happened.
ALTER TABLE `lead_submissions`
  ADD COLUMN `converted_at` DATETIME NULL AFTER `conversion_status`,
  ADD KEY `ls_status_converted_idx` (`conversion_status`, `converted_at`);
UPDATE `lead_submissions` SET `converted_at` = COALESCE(`updated_at`, `submitted_at`)
  WHERE `conversion_status` = 'won' AND `converted_at` IS NULL;

-- 2. Repeat customers: which paid order of the customer this is, and whether it was credited
--    to the customer's original source (orders without their own tracking, e.g. recurring).
ALTER TABLE `marketing_order_attribution`
  ADD COLUMN `customer_order_seq` INT NULL AFTER `revenue`,
  ADD COLUMN `is_repeat` TINYINT(1) NOT NULL DEFAULT 0 AFTER `customer_order_seq`,
  ADD COLUMN `inherited_from_order_id` INT UNSIGNED NULL AFTER `is_repeat`,
  ADD KEY `moa_customer_idx` (`customer_user_id`, `status`);

-- 3. Daily page stats: won leads and repeat-order revenue.
ALTER TABLE `marketing_daily_page_stats`
  ADD COLUMN `won_leads` INT NOT NULL DEFAULT 0 AFTER `leads`,
  ADD COLUMN `won_revenue` DECIMAL(20,2) NOT NULL DEFAULT 0 AFTER `won_leads`,
  ADD COLUMN `repeat_orders_last` INT NOT NULL DEFAULT 0 AFTER `revenue_last`,
  ADD COLUMN `repeat_revenue_last` DECIMAL(20,2) NOT NULL DEFAULT 0 AFTER `repeat_orders_last`,
  ADD COLUMN `repeat_orders_first` INT NOT NULL DEFAULT 0 AFTER `revenue_first`,
  ADD COLUMN `repeat_revenue_first` DECIMAL(20,2) NOT NULL DEFAULT 0 AFTER `repeat_orders_first`;

-- Stored days lack the new columns' data: forget them so reports rebuild them on next read.
DELETE FROM `marketing_daily_page_stats`;
DELETE FROM `marketing_daily_rollup_runs`;
