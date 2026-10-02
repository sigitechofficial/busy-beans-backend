-- Ad spend entered by the marketing team (until spend is imported from the ad platforms). One row =
-- what one campaign on one platform (source, optionally medium) cost over a date range. Reports
-- spread an entry evenly over its days and count the days inside the report period, then show
-- spend, cost per lead / won lead and ROAS next to the campaign's leads and revenue. Additive.
CREATE TABLE IF NOT EXISTS `marketing_ad_spend` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `source` VARCHAR(100) NOT NULL,
  `medium` VARCHAR(100) NULL,
  `campaign` VARCHAR(255) NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'USD',
  `notes` VARCHAR(500) NULL,
  `created_by` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `mas_campaign_idx` (`campaign`, `source`),
  KEY `mas_period_idx` (`period_start`, `period_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
