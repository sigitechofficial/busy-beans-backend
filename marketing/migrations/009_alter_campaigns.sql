ALTER TABLE `campaigns`
  ADD COLUMN `campaign_type` VARCHAR(64) NULL AFTER `name`,
  ADD COLUMN `objective` ENUM('awareness','traffic','leads','engagement','conversions') NULL AFTER `campaign_type`,
  ADD COLUMN `platforms` JSON NULL AFTER `objective`,
  ADD COLUMN `budget_note` TEXT NULL AFTER `platforms`,
  ADD COLUMN `start_date` DATE NULL AFTER `budget_note`,
  ADD COLUMN `end_date` DATE NULL AFTER `start_date`,
  ADD COLUMN `product_id` VARCHAR(64) NULL AFTER `linked_landing_page_id`,
  ADD COLUMN `creative_notes` TEXT NULL AFTER `product_id`,
  ADD COLUMN `utm_source_default` VARCHAR(64) NULL AFTER `creative_notes`;

ALTER TABLE `campaigns`
  ADD KEY `campaigns_product_idx` (`product_id`);
