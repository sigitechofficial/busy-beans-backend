-- Reporting rollups (Phase 9).
-- One row per business-timezone day per page (site page or landing page) with additive
-- metrics, built by marketing/services/pageStats.service.js. Distinct visitors over a range
-- are not additive, so reports count them live; `visitors` here is that day's distinct count.
CREATE TABLE IF NOT EXISTS `marketing_daily_page_stats` (
  `stat_date` DATE NOT NULL,
  `page_type` VARCHAR(32) NOT NULL,
  `page_slug` VARCHAR(200) NOT NULL,
  `views` INT NOT NULL DEFAULT 0,
  `visitors` INT NOT NULL DEFAULT 0,
  `sessions` INT NOT NULL DEFAULT 0,
  `entrances` INT NOT NULL DEFAULT 0,
  `bounces` INT NOT NULL DEFAULT 0,
  `exits` INT NOT NULL DEFAULT 0,
  `engaged_ms` BIGINT NOT NULL DEFAULT 0,
  `engagement_reports` INT NOT NULL DEFAULT 0,
  `scroll_pct_sum` BIGINT NOT NULL DEFAULT 0,
  `cta_clicks` INT NOT NULL DEFAULT 0,
  `form_starts` INT NOT NULL DEFAULT 0,
  `form_submits` INT NOT NULL DEFAULT 0,
  `leads` INT NOT NULL DEFAULT 0,
  `orders_last` INT NOT NULL DEFAULT 0,
  `revenue_last` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `orders_first` INT NOT NULL DEFAULT 0,
  `revenue_first` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `computed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`stat_date`, `page_type`, `page_slug`),
  KEY `mdps_type_slug_date_idx` (`page_type`, `page_slug`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which days have been rolled up (a day with no traffic has a run but no stat rows).
CREATE TABLE IF NOT EXISTS `marketing_daily_rollup_runs` (
  `stat_date` DATE NOT NULL,
  `time_zone` VARCHAR(64) NOT NULL,
  `computed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
